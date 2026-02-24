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
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, optimism, arbitrum, bsc } from 'viem/chains';
import { CHAINS } from '../config/chains';
import { getTopTokensForChain } from '../config/topTokens';
import { dbService } from './database';
import { notifier } from './notificationService';

const BROKER_ABI = parseAbi([
  'function execute(uint8 provider, address providerAddress, address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

export class FillerService {
  private readonly UNISWAPX_API = 'https://api.uniswap.org/v2/orders';
  private account: Account | null = null;
  private publicClients: Map<number, any> = new Map();
  private arbitrageService: ArbitrageService;

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
    const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
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
    const sellToken = order.input.token;
    const sellAmount = order.input.amount;
    const buyToken = order.outputs[0].token;
    const buyAmount = order.outputs[0].amount;

    try {
      // 1. Get Best Quote from Aggregators (0x, 1inch, ParaSwap)
      const quote = await this.arbitrageService.discoverAggregatorArb(
        chainId,
        sellToken,
        buyToken,
        sellAmount
      );

      if (!quote) return;

      // 2. Profitability check (Aggregator BuyAmount > Intent BuyAmount)
      if (BigInt(quote.buyAmount) > BigInt(buyAmount)) {
        const profit = BigInt(quote.buyAmount) - BigInt(buyAmount);
        const decimals = await this.arbitrageService.getTokenDecimals(chainId, buyToken);
        const formattedProfit = formatUnits(profit, decimals);

        logger.info(`🔥 PROFITABLE: ${quote.source} gives ${quote.buyAmount} (vs intent ${buyAmount}) for ${order.orderHash.slice(0, 10)}. Expected profit: ${formattedProfit} tokens.`);
        await this.executeArbitrage(order, chainId, quote, source);
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
      const publicClient = this.getPublicClient(chainId);
      const walletClient = createWalletClient({
        account: this.account,
        chain: publicClient.chain,
        transport: http(rpcUrl),
      });

      // 1. Construct Arbitrage Opportunity
      // Fix: 0x quote uses quote.transaction.*, 1inch/ParaSwap use quote.to/data/value directly
      const aggTo = quote.transaction?.to ?? quote.to;
      const aggData = quote.transaction?.data ?? quote.data;
      const aggValue = quote.transaction?.value ?? quote.value;

      const opportunity = await this.arbitrageService.fillIntentArbitrage({
        chainId,
        intent: {
          ...order,
          reactor: CHAINS[chainId].uniswapXReactor,
          fillData: encodeAbiParameters(
            parseAbiParameters('(bytes, bytes)[]'),
            [[[order.encodedOrder as Hex, order.signature as Hex]]]
          )
        },
        source: source as any,
        aggregatorQuote: { to: aggTo, data: aggData, value: aggValue }
      });

      if (!opportunity) return;

      // 2. Encode FlashParams
      const encodedParams = this.arbitrageService.encodeFlashParams(opportunity);

      // 3. Simulate before sending (avoid wasted gas on reverts)
      const ok = await this.arbitrageService.simulateExecution(
        chainId, broker, opportunity.borrowToken, opportunity.borrowAmount,
        encodedParams, this.account.address, opportunity.provider, opportunity.providerAddress
      );
      if (!ok) {
        logger.warn(`⚠️  Simulation failed for intent ${order.orderHash?.slice(0, 10)} — skipping`);
        return;
      }

      // 4. Execute through AtomicBroker
      const txHash = await walletClient.writeContract({
        address: broker,
        abi: BROKER_ABI,
        functionName: 'execute',
        args: [opportunity.provider, opportunity.providerAddress as Hex, opportunity.borrowToken as Hex, opportunity.borrowAmount, encodedParams],
        chain: publicClient.chain,
      });

      logger.info(`✅ Arbitrage TX submitted: ${txHash}`);
      dbService.saveOrder({ ...order, status: 'filled', chainId });
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
      const publicClient = this.getPublicClient(chainId);
      const walletClient = createWalletClient({
        account: this.account,
        chain: publicClient.chain,
        transport: http(rpcUrl),
      });

      const encodedParams = this.arbitrageService.encodeFlashParams(opportunity);

      // Simulate before sending — skip if it would revert
      const ok = await this.arbitrageService.simulateExecution(
        chainId, broker, opportunity.borrowToken, opportunity.borrowAmount,
        encodedParams, this.account.address, opportunity.provider, opportunity.providerAddress
      );
      if (!ok) {
        logger.warn(`⚠️  Direct DEX arb simulation failed on chain ${chainId} — skipping`);
        return;
      }

      const txHash = await walletClient.writeContract({
        address: broker,
        abi: BROKER_ABI,
        functionName: 'execute',
        args: [opportunity.provider, opportunity.providerAddress as Hex, opportunity.borrowToken as Hex, opportunity.borrowAmount, encodedParams],
        chain: publicClient.chain,
      });

      logger.info(`✅ Direct DEX Arb TX submitted: ${txHash}`);
      await notifier.notifyFill(txHash, chainId);
    } catch (error: any) {
      logger.error(`❌ Direct DEX Arb failed: ${error.message}`);
    }
  }
}
