import axios from 'axios';
import logger from '../utils/logger';
import { ZeroExService } from './zeroExService';
import {
  Hex,
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  parseUnits,
  Account,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, optimism, arbitrum, bsc } from 'viem/chains';
import { CHAINS } from '../config/chains';
import { dbService } from './database';
import { notifier } from './notificationService';

const REACTOR_ABI = parseAbi([
  'function execute((bytes,bytes)[] calls) external payable',
  'function executeWithCallback((bytes,bytes)[] calls, bytes callbackData) external payable',
]);

const BROKER_ABI = parseAbi([
  'function execute(address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

export class FillerService {
  private readonly UNISWAPX_API = 'https://api.uniswap.org/v2/orders';
  private account: Account | null = null;
  private publicClients: Map<number, any> = new Map();

  constructor(private zeroExService: ZeroExService) {
    const pk = process.env.PRIVATE_KEY;
    if (pk) {
      this.account = privateKeyToAccount(`0x${pk.replace('0x', '')}` as Hex);
    }
  }

  private getPublicClient(chainId: number) {
    if (this.publicClients.has(chainId)) {
      return this.publicClients.get(chainId);
    }

    const customRpc = process.env[`RPC_URL_${chainId}`];

    // Map chainId to viem chains
    const chainMap: Record<number, any> = {
      1: mainnet,
      10: optimism,
      56: bsc,
      137: mainnet, // Placeholder for Polygon (viem mainnet is used with RPC)
      8453: base,
      42161: arbitrum,
    };

    const client = createPublicClient({
      chain: chainMap[chainId] || mainnet,
      transport: http(customRpc),
    });

    this.publicClients.set(chainId, client);
    return client;
  }

  private async getTokenDecimals(token: string, chainId: number): Promise<number> {
    try {
      const publicClient = this.getPublicClient(chainId);
      const decimals = await publicClient.readContract({
        address: token as Hex,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      });
      return Number(decimals);
    } catch (e) {
      return 18; // Fallback
    }
  }

  async monitorUniswapX(chainId: number) {
    if (!this.account) {
      logger.warn('No private key configured. Filler running in Read-only mode.');
    }

    const reactor = CHAINS[chainId]?.uniswapXReactor;
    if (!reactor) return;

    // 0. Production Health Check
    if (!await this.checkRpcHealth(chainId)) {
      logger.error(`Chain ${chainId}: RPC is unhealthy or unreachable. Skipping...`);
      return;
    }

    try {
      let cursor: string | undefined = undefined;
      let totalScanned = 0;
      const MAX_ORDERS_PER_TICK = 1000;

      do {
        const response = await axios.get(this.UNISWAPX_API, {
          params: { chainId, orderStatus: 'open', cursor, limit: 100 }
        });

        const orders = response.data.orders || [];
        if (orders.length === 0) break;

        logger.info(`Chain ${chainId}: Processing batch of ${orders.length} orders (Total: ${totalScanned + orders.length}).`);

        for (const order of orders) {
          // Skip if we already processed this order
          if (dbService.getOrder(order.orderHash)) continue;
          await this.evaluateAndFill(order, chainId, reactor as Hex);
        }

        totalScanned += orders.length;
        cursor = response.data.nextCursor;

        // Safety break
        if (totalScanned >= MAX_ORDERS_PER_TICK) {
          logger.warn(`Chain ${chainId}: Reached MAX_ORDERS_PER_TICK (${MAX_ORDERS_PER_TICK}). Stopping search.`);
          break;
        }
      } while (cursor);

      logger.info(`Chain ${chainId}: Scanned ${totalScanned} open orders.`);
    } catch (error: any) {
      logger.error(`Error monitoring UniswapX on chain ${chainId}:`, error.message);
    }
  }

  private async checkRpcHealth(chainId: number): Promise<boolean> {
    try {
      const publicClient = this.getPublicClient(chainId);
      await publicClient.getBlockNumber();
      return true;
    } catch (e) {
      return false;
    }
  }

  private async checkGasBalance(chainId: number): Promise<boolean> {
    if (!this.account) return false;
    try {
      const publicClient = this.getPublicClient(chainId);
      const balance = await publicClient.getBalance({ address: this.account.address });
      // Minimum 0.005 Native token for safe execution
      return balance > parseUnits('0.005', 18);
    } catch (e) {
      return false;
    }
  }

  private async evaluateAndFill(order: any, chainId: number, reactor: Hex) {
    if (!await this.checkGasBalance(chainId)) {
      logger.debug(`Chain ${chainId}: Insufficient gas balance for execution. Skipping order.`);
      return;
    }

    const sellToken = order.input?.token;
    const sellAmount = order.input?.amount;
    const buyToken = order.outputs?.[0]?.token;
    const buyAmount = order.outputs?.[0]?.amount;

    if (!sellToken || !buyToken || !sellAmount || !buyAmount) return;

    try {
      // 1. Check if we have tokens to fill (if running in live mode)
      // (Production todo: Add inventory check here)

      // 2. Fetch 0x quote
      const zeroExPrice = await this.zeroExService.getPrice({
        sellToken,
        buyToken,
        sellAmount,
        chainId,
      });

      const currentAuctionOutput = BigInt(buyAmount);
      const zeroExOutput = BigInt(zeroExPrice.buyAmount);

      // 3. Estimate Gas Cost
      const publicClient = this.getPublicClient(chainId);
      const gasPrice = await publicClient.getGasPrice();
      const estimatedGas = 300000n; // Estimate for reactor fill
      const gasCost = estimatedGas * gasPrice;

      // 4. Profitability
      const spreadBps = BigInt(process.env.SPREAD_BPS || '0');
      const requiredOutput = (currentAuctionOutput * (10000n + spreadBps)) / 10000n;

      // Normalization for comparison
      const decimals = await this.getTokenDecimals(buyToken, chainId);
      const profitRaw = zeroExOutput - requiredOutput;

      // Convert profit to 18 decimals to compare with gasCost (which is 18 decimals native)
      // Note: This assumes 1 buyToken unit is roughly 1 Native token unit value-wise for simple comparison
      // In production, you'd multiply profit by (NativePrice / TokenPrice)
      const normalizedProfit = (profitRaw * BigInt(10 ** (18 - Math.min(18, decimals))));

      logger.debug(`Profit for ${order.orderHash}: ${formatUnits(profitRaw, decimals)} (Gas: ${formatUnits(gasCost, 18)})`);

      if (normalizedProfit > gasCost) {
        logger.info(`🔥 Profitable order found! Expected Profit: ${formatUnits(normalizedProfit - gasCost, 18)} native-equivalent`);

        dbService.saveOrder({
          orderHash: order.orderHash,
          chainId,
          maker: order.maker,
          sellToken,
          buyToken,
          sellAmount,
          buyAmount,
          status: 'pending'
        });

        await this.executeFill(order, chainId, reactor);
      }
    } catch (error: any) {
      logger.debug(`Skipping order ${order.orderHash}: ${error.message}`);
    }
  }

  private async executeFill(order: any, chainId: number, reactor: Hex) {
    if (!this.account) return;

    const chainConfig = CHAINS[chainId];
    const brokerAddress = chainConfig?.atomicBroker as Hex;
    const balancerVault = chainConfig?.balancerVault as Hex;

    if (!brokerAddress || !balancerVault) {
      logger.warn(`Atomic Broker not configured for chain ${chainId}. Falling back to standard fill.`);
      return this.executeStandardFill(order, chainId, reactor);
    }

    logger.info(`🚀 Executing ATOMIC fill for order ${order.orderHash} on chain ${chainId}...`);

    try {
      const publicClient = this.getPublicClient(chainId);
      const walletClient = createWalletClient({
        account: this.account,
        chain: publicClient.chain,
        transport: http(),
      });

      // 1. Get 0x Quote with data
      const quote = await this.zeroExService.getQuote({
        sellToken: order.input.token,
        buyToken: order.outputs[0].token,
        sellAmount: order.input.amount,
        chainId,
        taker: brokerAddress,
      });

      // 2. Prepare FlashParams for AtomicBroker
      const flashParams = {
        sellToken: order.input.token,
        buyToken: order.outputs[0].token,
        sellAmount: BigInt(order.input.amount),
        minBuyAmount: BigInt(order.outputs[0].amount),
        zeroExData: quote.transaction.data as Hex,
        targetReactor: reactor,
        reactorData: encodeAbiParameters(
          parseAbiParameters('(bytes, bytes)[]'),
          [[[order.encodedOrder as Hex, order.signature as Hex]]]
        )
      };

      const encodedParams = encodeAbiParameters(
        parseAbiParameters('address, address, uint256, uint256, bytes, address, bytes'),
        [
          flashParams.sellToken as Hex,
          flashParams.buyToken as Hex,
          flashParams.sellAmount,
          flashParams.minBuyAmount,
          flashParams.zeroExData,
          flashParams.targetReactor,
          flashParams.reactorData
        ]
      );

      // 3. Call AtomicBroker.execute
      const txHash = await walletClient.writeContract({
        address: brokerAddress,
        abi: BROKER_ABI,
        functionName: 'execute',
        args: [
          order.input.token as Hex,
          BigInt(order.input.amount),
          encodedParams
        ],
        chain: publicClient.chain,
      });

      logger.info(`✅ Atomic Fill submitted: ${txHash}`);
      dbService.updateOrderStatus(order.orderHash, 'filled', txHash);
      await notifier.notifyFill(txHash, chainId);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
    } catch (error: any) {
      logger.error(`❌ Atomic Fill failed: ${error.message}`);
      dbService.updateOrderStatus(order.orderHash, 'failed');
      await notifier.notifyError('Atomic Fill', error.message);
    }
  }

  private async executeStandardFill(order: any, chainId: number, reactor: Hex) {
    if (!this.account) return;

    logger.info(`🚀 Executing STANDARD fill for order ${order.orderHash} on chain ${chainId}...`);

    try {
      const publicClient = this.getPublicClient(chainId);
      const walletClient = createWalletClient({
        account: this.account,
        chain: publicClient.chain,
        transport: http(),
      });

      const txHash = await walletClient.writeContract({
        address: reactor,
        abi: REACTOR_ABI,
        functionName: 'execute',
        args: [[
          [order.encodedOrder, order.signature as Hex]
        ]],
        chain: publicClient.chain,
      });

      logger.info(`✅ Standard Fill submitted: ${txHash}`);
      dbService.updateOrderStatus(order.orderHash, 'filled', txHash);
      await notifier.notifyFill(txHash, chainId);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
    } catch (error: any) {
      logger.error(`❌ Standard Fill failed: ${error.message}`);
      dbService.updateOrderStatus(order.orderHash, 'failed');
      await notifier.notifyError('Standard Fill', error.message);
    }
  }

  async monitorCoWSwap() {
    logger.info('Monitoring CoW Swap... (Requires Solver Whitelist)');
  }

  async monitorEnso(chainId: number) {
    const ensoRouter = CHAINS[chainId]?.ensoRouter;
    if (!ensoRouter) return;

    logger.info(`Chain ${chainId}: Monitoring Enso Intents... (Permissionless Grapher Role)`);
    // NOTE: Enso intents are currently fetched via their "Shortcuts API" 
    // or by participating in their decentralized Grapher network.
    // Placeholder for fetching public intents.
  }

  async monitor1Inch(chainId: number) {
    logger.info(`Chain ${chainId}: Monitoring 1inch Fusion... (Requires Resolver Whitelist)`);
    // Placeholder for 1inch Fusion WebSocket or API.
  }
}
