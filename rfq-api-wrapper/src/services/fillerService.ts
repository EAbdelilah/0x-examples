import axios from 'axios';
import logger from '../utils/logger';
import { ZeroExService } from './zeroExService';
import { ArbitrageService, ArbitrageOpportunity } from './arbitrageService';
import {
  Hex,
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  Account,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  isAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, optimism, arbitrum, bsc, polygon, avalanche, fantom, celo } from 'viem/chains';
import { CHAINS } from '../config/chains';
import { getTopTokensForChain } from '../config/topTokens';
import { dbService } from './database';
import { notifier } from './notificationService';

const BROKER_ABI = parseAbi([
  'function executeBalancer(address vault, address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
  'function executeSky(address flashMint, address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

const REACTOR_ABI = parseAbi([
  'function execute((bytes order, bytes signature)[] calldata orders) external',
]);

export class FillerService {
  private readonly UNISWAPX_API = 'https://api.uniswap.org/v2/orders';
  private account: Account | null = null;
  private publicClients: Map<number, any> = new Map();
  private arbitrageService: ArbitrageService;
  private readonly CHAIN_MAP: Record<number, any> = {
    1: mainnet,
    10: optimism,
    56: bsc,
    137: polygon,
    250: fantom,
    8453: base,
    42161: arbitrum,
    42220: celo,
    43114: avalanche,
  };

  constructor(private zeroExService: ZeroExService) {
    const pk = process.env.PRIVATE_KEY;
    if (pk) {
      this.account = privateKeyToAccount(`0x${pk.replace('0x', '')}` as Hex);
    }
    this.arbitrageService = new ArbitrageService(zeroExService);
  }

  private getPublicClient(chainId: number) {
    if (this.publicClients.has(chainId)) return this.publicClients.get(chainId);
    const rpc = process.env[`RPC_URL_${chainId}`];
    const chain = this.CHAIN_MAP[chainId] || mainnet;
    const client = createPublicClient({ chain, transport: http(rpc) });
    this.publicClients.set(chainId, client);
    return client;
  }

  async runMonitorLoop() {
    logger.info('Starting Multi-Blockchain UniswapX Arbitrage Monitor Loop...');
    const chainIds = Object.keys(CHAINS).map(Number);

    while (true) {
      for (const chainId of chainIds) {
        if (!process.env[`RPC_URL_${chainId}`]) continue;

        await Promise.allSettled([
          this.monitorUniswapX(chainId)
        ]);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  async scanTopPairs(chainId: number) {
    const topTokens = getTopTokensForChain(chainId);
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return;

    for (let i = 0; i < topTokens.length; i++) {
      for (let j = i + 1; j < topTokens.length; j++) {
        const tokenA = chainConfig.tokens?.[topTokens[i]];
        const tokenB = chainConfig.tokens?.[topTokens[j]];
        if (!tokenA || !tokenB) continue;
        // Aggregator-based discovery (0x vs 1inch vs ParaSwap)
        // Use correct decimals per token (USDC=6, WETH=18, etc.)
        const amount = (await this.arbitrageService.getScanAmount(chainId, tokenA)).toString();
        await this.arbitrageService.discoverAggregatorArb(chainId, tokenA, tokenB, amount);
      }
    }
  }

  /**
   * Scans top pairs directly between DEXs on-chain (Uniswap V3 vs Aerodrome, etc.)
   * This finds circular arbitrage without relying on aggregator APIs.
   */
  async scanDirectDexArb(chainId: number) {
    const topTokens = getTopTokensForChain(chainId);
    const chainConfig = CHAINS[chainId];
    if (!chainConfig?.dexs) return; // Only scan chains with DEX config

    for (let i = 0; i < topTokens.length; i++) {
      for (let j = i + 1; j < topTokens.length; j++) {
        const tokenA = chainConfig.tokens?.[topTokens[i]];
        const tokenB = chainConfig.tokens?.[topTokens[j]];
        if (!tokenA || !tokenB) continue;

        // Use correct decimals per token (USDC=6, WETH=18, etc.)
        const amountIn = await this.arbitrageService.getScanAmount(chainId, tokenA);
        const opportunity = await this.arbitrageService.discoverDirectDexArb(chainId, tokenA, tokenB, amountIn);

        if (opportunity) {
          await this.executeDirectArb(opportunity, chainId);
        }
      }
    }
  }

  async monitorUniswapX(chainId: number) {
    const reactor = CHAINS[chainId]?.uniswapXReactor;
    if (!reactor) return;

    try {
      const response = await axios.get(this.UNISWAPX_API, {
        params: { chainId, orderStatus: 'open', limit: 20 }
      });
      const orders = response.data.orders || [];
      for (const order of orders) {
        if (dbService.getOrder(order.orderHash)) continue;
        await this.evaluateAndFillIntent(order, chainId, 'uniswapx');
      }
    } catch (e: any) {
      logger.error(`UniswapX Monitor Error: ${e.message}`);
    }
  }

  private async evaluateAndFillIntent(order: any, chainId: number, source: 'uniswapx') {
    const sellTokenRaw = order.input?.token;
    let sellAmountStr = order.input?.amount || order.input?.startAmount || order.input?.amountStr;

    // UniswapX Dutch Orders usually have outputs[0]. Some might have output (singular) or multiple outputs.
    const output = (order.outputs && order.outputs.length > 0) ? order.outputs[0] : (order.output || {});
    const buyTokenRaw = output.token;
    let buyAmountStr = output.amount || output.startAmount || output.amountStr;

    if (!sellTokenRaw || !buyTokenRaw || !sellAmountStr || !buyAmountStr) {
      return;
    }

    // Hex check: Some tokens or adapters return hex strings without 0x
    const toDecimal = (val: string) => {
      if (typeof val !== 'string') return val;
      if (val.startsWith('0x')) return val;
      // If it looks like hex (contains A-F) and is long, it's probably hex
      if (/[a-fA-F]/.test(val) && val.length > 10) return `0x${val}`;
      return val;
    };

    const sellAmount = toDecimal(sellAmountStr.toString());
    const buyAmount = toDecimal(buyAmountStr.toString());

    // 0x API expects 0xeeee... for native tokens, Uniswap often uses 0x0000...
    const normalizeToken = (addr: string) => {
      if (!addr) return addr;
      if (addr.toLowerCase() === '0x0000000000000000000000000000000000000000') return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      return addr;
    };

    const sellToken = normalizeToken(sellTokenRaw);
    const buyToken = normalizeToken(buyTokenRaw);

    if (!isAddress(sellToken) || !isAddress(buyToken)) {
      return;
    }

    // Liquidity filter: only attempt arbitrage on orders with highly-liquid input tokens.
    // 0x v1 (used for execution) only routes popular token pairs. Illiquid or obscure tokens
    // (EURC, AERO, BRETT, etc.) get false-profitable v2 quotes but fail on v1 execution.
    const chainTokens = CHAINS[chainId]?.tokens ?? {};
    const LIQUID_SYMBOLS = ['WETH', 'WMATIC', 'USDC', 'USDT', 'WBTC', 'DAI', 'cbETH', 'cbBTC', 'AERO'];
    const isNativeEth = (addr: string) =>
      addr.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
      addr.toLowerCase() === '0x0000000000000000000000000000000000000000';
    const liquidTokenAddresses = new Set(
      LIQUID_SYMBOLS
        .map((sym) => (chainTokens[sym] as string | undefined)?.toLowerCase())
        .filter(Boolean) as string[]
    );
    const isLiquid = (addr: string) => isNativeEth(addr) || liquidTokenAddresses.has(addr.toLowerCase());

    if (!isLiquid(sellToken) || !isLiquid(buyToken)) {
      return; // Skip if either token is not in the high-liquidity allowlist
    }

    // Native ETH filter: Until we implement a dedicated native ETH filler with reactorCallback,
    // we must skip native ETH orders to avoid the non-payable reactor.execute() revert.
    if (isNativeEth(sellToken) || isNativeEth(buyToken)) {
      return;
    }

    if (Math.random() < 0.1) {
      logger.info(`🔍 DEBUG: Raw UniswapX Order structure for ${order.orderHash.slice(0, 10)}: ${JSON.stringify({ input: order.input, outputs: order.outputs }).slice(0, 500)}`);
    }

    try {
      // 1. Get Best Quote from Aggregators
      // We use the discoverAggregatorArb which will now use 0x v2 correctly
      const bestAggQuote = await this.arbitrageService.discoverAggregatorArb(
        chainId,
        sellToken,
        buyToken,
        sellAmount
      );

      if (!bestAggQuote) return;

      // UniswapX Price is the buyAmount we must give to the filler
      const uniswapPrice = BigInt(buyAmount);
      const aggregatorPrice = BigInt(bestAggQuote.buyAmount);

      if (aggregatorPrice <= uniswapPrice) return;

      const profit = aggregatorPrice - uniswapPrice;
      const profitDecimals = await this.arbitrageService.getTokenDecimals(chainId, buyToken);
      const profitFormatted = formatUnits(profit, profitDecimals);

      logger.info(`🔥 PROFITABLE: ${bestAggQuote.source} buyAmount=${bestAggQuote.buyAmount} vs UniswapX buyAmount=${buyAmount} | PROFIT=${profitFormatted} ${buyToken.slice(0, 6)} | Hash=${order.orderHash}`);

      if (profit > 0n) {
        await this.executeArbitrage(order, chainId, bestAggQuote, source);
      }
    } catch (e) {
      // Skip
    }
  }

  private async executeArbitrage(order: any, chainId: number, quote: any, source: string) {
    if (!this.account) return;

    const broker = CHAINS[chainId]?.atomicBroker as Hex;
    if (!broker) return;

    logger.info(`🚀 Executing ATOMIC ARBITRAGE on chain ${chainId}...`);

    try {
      const rpcUrl = process.env[`RPC_URL_${chainId}`];
      const chain = this.CHAIN_MAP[chainId] || mainnet;
      const walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      });

      // 1. Construct Arbitrage Opportunity
      // We need the REVERSE of the original quote:
      //   - Original quote: sellToken → buyToken (what user is selling → what user is buying)
      //   - Execution quote: input token (what we receive from order fill) → output token (USDC we borrowed)
      // The taker MUST be the broker contract, not the wallet.
      const output = (order.outputs && order.outputs.length > 0) ? order.outputs[0] : {};
      const inputToken = order.input?.token;
      const outputToken = output.token;
      const inputAmount = order.input?.startAmount ?? order.input?.maxAmount ?? order.input?.amount;

      if (!inputToken || !outputToken || !inputAmount) {
        logger.warn('❌ executeArbitrage: Missing input/output token or amount from order');
        return;
      }

      // Fetch an execution quote using 0x v1 (allowance-based, skipValidation).
      // getExecutionQuote handles native ETH normalization (input → 0xeeee, output → WETH).
      const execQuote = await this.arbitrageService.getExecutionQuote(
        chainId,
        inputToken,
        outputToken,
        inputAmount
      );

      if (!execQuote) {
        logger.warn('❌ executeArbitrage: Could not get execution quote from aggregator');
        return;
      }

      const eq = execQuote as any;
      const aggTo = eq.transaction?.to ?? eq.to;
      const aggData = eq.transaction?.data ?? eq.data;
      const aggValue = eq.transaction?.value ?? eq.value;
      const allowanceTarget = eq.allowanceTarget || eq.transaction?.allowanceTarget || aggTo;

      logger.info(`📊 Execution Quote Result: buyAmount=${eq.buyAmount} (${eq.source || 'Aggregator'}) | Need to repay ~${inputAmount} (borrowed)`);

      const opportunity = await this.arbitrageService.fillIntentArbitrage({
        chainId,
        intent: {
          ...order,
          reactor: CHAINS[chainId].uniswapXReactor,
          fillData: encodeFunctionData({
            abi: REACTOR_ABI,
            functionName: 'execute',
            args: [[{ order: order.encodedOrder as Hex, signature: order.signature as Hex }]]
          })
        },
        source: source as any,
        aggregatorQuote: {
          to: aggTo,
          data: aggData,
          value: aggValue,
          allowanceTarget
        }
      });

      if (!opportunity) return;

      // 2. Select best 0% Provider
      const provider = await this.arbitrageService.findBestFlashLoanProvider(chainId, opportunity.borrowToken, opportunity.borrowAmount);
      if (!provider) {
        logger.warn(`🚫 No 0% flash loan liquidity found for ${opportunity.borrowToken} on chain ${chainId}`);
        return;
      }
      opportunity.flashProvider = provider;

      // 3. Simulate before sending
      const ok = await this.arbitrageService.simulateExecution(chainId, opportunity, this.account.address);
      if (!ok) return;

      // 4. Execute through AtomicBroker via specific provider method
      const encodedParams = this.arbitrageService.encodeFlashParams(opportunity);
      let functionName = 'executeBalancer';
      let args: any[] = [];

      if (provider.type === 'balancer') {
        functionName = 'executeBalancer';
        args = [provider.target as Hex, opportunity.borrowToken as Hex, opportunity.borrowAmount, encodedParams];
      } else if (provider.type === 'sky') {
        functionName = 'executeSky';
        args = [provider.target as Hex, opportunity.borrowToken as Hex, opportunity.borrowAmount, encodedParams];
      }

      logger.info(`💸 Using ${provider.name} flash loan...`);
      const txHash = await walletClient.writeContract({
        address: broker,
        abi: parseAbi([`function ${functionName}(address, address, uint256, bytes) external`]),
        functionName: functionName as any,
        args: args as any,
        chain,
      });

      logger.info(`✅ Arbitrage TX submitted: ${txHash}`);
      dbService.saveOrder({ ...order, status: 'filled', chainId, txHash });
      await notifier.notifyFill(txHash, chainId);
    } catch (error: any) {
      logger.error(`❌ Arbitrage failed: ${error.message}`);
    }
  }

  private async executeDirectArb(opportunity: ArbitrageOpportunity, chainId: number) {
    if (!this.account) return;
    const broker = CHAINS[chainId]?.atomicBroker as Hex;
    if (!broker) return;

    logger.info(`🚀 Executing DIRECT DEX ARBITRAGE on chain ${chainId}...`);

    try {
      const rpcUrl = process.env[`RPC_URL_${chainId}`];
      const chain = this.CHAIN_MAP[chainId] || mainnet;
      const walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      });

      // 1. Select best 0% Provider
      const provider = await this.arbitrageService.findBestFlashLoanProvider(chainId, opportunity.borrowToken, opportunity.borrowAmount);
      if (!provider) {
        logger.warn(`🚫 No 0% flash loan liquidity found for ${opportunity.borrowToken} on chain ${chainId}`);
        return;
      }
      opportunity.flashProvider = provider;

      // 2. Simulate before sending
      const ok = await this.arbitrageService.simulateExecution(chainId, opportunity, this.account.address);
      if (!ok) return;

      // 3. Execute
      const encodedParams = this.arbitrageService.encodeFlashParams(opportunity);
      let functionName = 'executeBalancer';
      let args: any[] = [];

      if (provider.type === 'balancer') {
        functionName = 'executeBalancer';
        args = [provider.target as Hex, opportunity.borrowToken as Hex, opportunity.borrowAmount, encodedParams];
      } else if (provider.type === 'sky') {
        functionName = 'executeSky';
        args = [provider.target as Hex, opportunity.borrowToken as Hex, opportunity.borrowAmount, encodedParams];
      }

      logger.info(`💸 Using ${provider.name} flash loan...`);
      const txHash = await walletClient.writeContract({
        address: broker,
        abi: parseAbi([`function ${functionName}(address, address, uint256, bytes) external`]),
        functionName: functionName as any,
        args: args as any,
        chain,
      });

      logger.info(`✅ Direct DEX Arb TX submitted: ${txHash}`);
      dbService.saveOrder({ ...opportunity, status: 'filled', chainId, txHash } as any);
      await notifier.notifyFill(txHash, chainId);
    } catch (error: any) {
      logger.error(`❌ Direct DEX Arb failed: ${error.message}`);
    }
  }
}
