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
  Account,
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

export class FillerService {
  private readonly UNISWAPX_API = 'https://api.uniswap.org/v2/orders';
  private account: Account | null = null;

  constructor(private zeroExService: ZeroExService) {
    const pk = process.env.PRIVATE_KEY;
    if (pk) {
      this.account = privateKeyToAccount(`0x${pk.replace('0x', '')}` as Hex);
    }
  }

  private getPublicClient(chainId: number) {
    const customRpc = process.env[`RPC_URL_${chainId}`];

    // Map chainId to viem chains
    const chainMap: Record<number, any> = {
      1: mainnet,
      10: optimism,
      56: bsc,
      8453: base,
      42161: arbitrum,
    };

    return createPublicClient({
      chain: chainMap[chainId] || mainnet,
      transport: http(customRpc),
    });
  }

  async monitorUniswapX(chainId: number) {
    if (!this.account) {
      logger.warn('No private key configured. Filler running in Read-only mode.');
    }

    const reactor = CHAINS[chainId]?.uniswapXReactor;
    if (!reactor) return;

    try {
      const response = await axios.get(this.UNISWAPX_API, {
        params: { chainId, orderStatus: 'open' }
      });

      const orders = response.data.orders || [];
      logger.info(`Chain ${chainId}: Found ${orders.length} potential orders.`);

      for (const order of orders) {
        // Skip if we already processed this order
        if (dbService.getOrder(order.orderHash)) continue;
        await this.evaluateAndFill(order, chainId, reactor as Hex);
      }
    } catch (error: any) {
      logger.error(`Error monitoring UniswapX on chain ${chainId}:`, error.message);
    }
  }

  private async evaluateAndFill(order: any, chainId: number, reactor: Hex) {
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

      // In production, we must subtract gas costs if we are paying them
      const profit = zeroExOutput - requiredOutput;

      logger.debug(`Profit for ${order.orderHash}: ${profit.toString()} (Gas: ${gasCost.toString()})`);

      if (profit > gasCost) {
        logger.info(`🔥 Profitable order found! Expected Profit: ${formatUnits(profit - gasCost, 18)} ETH-equivalent`);

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

    logger.info(`🚀 Executing fill for order ${order.orderHash} on chain ${chainId}...`);

    try {
      const publicClient = this.getPublicClient(chainId);
      const walletClient = createWalletClient({
        account: this.account,
        chain: publicClient.chain,
        transport: http(),
      });

      // Format for UniswapX Reactor: execute([{ order: bytes, signature: bytes }])
      // encodedOrder from Uniswap API is the raw bytes needed
      const txHash = await walletClient.writeContract({
        address: reactor,
        abi: REACTOR_ABI,
        functionName: 'execute',
        args: [[
          [order.encodedOrder, order.signature as Hex]
        ]],
        chain: publicClient.chain,
      });

      logger.info(`✅ Fill transaction submitted: ${txHash}`);
      dbService.updateOrderStatus(order.orderHash, 'filled', txHash);
      await notifier.notifyFill(txHash, chainId);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
    } catch (error: any) {
      logger.error(`❌ Fill failed: ${error.message}`);
      dbService.updateOrderStatus(order.orderHash, 'failed');
      await notifier.notifyError('UniswapX Fill', error.message);
    }
  }

  async monitorCoWSwap() {
    logger.info('Monitoring CoW Swap... (Requires Solver Whitelist)');
  }
}
