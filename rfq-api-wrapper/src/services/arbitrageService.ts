import { Hex, createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { mainnet, base } from 'viem/chains';
import logger from '../utils/logger';
import { ZeroExService } from './zeroExService';
import { CHAINS } from '../config/chains';

const UNISWAP_V2_PAIR_ABI = parseAbi([
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
]);

const UNISWAP_V3_POOL_ABI = parseAbi([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
]);

export class ArbitrageService {
  constructor(private zeroExService: ZeroExService) {}

  /**
   * Monitors multiple DEX pools simultaneously.
   * By checking many individual pools against the 0x Aggregator (100+ sources),
   * we effectively scan the entire market for price discrepancies.
   */
  /**
   * Monitors multiple DEX pools simultaneously.
   * PRO TIP: To prevent front-running by MEV bots, use a Private RPC (e.g. Flashbots)
   * in your environment configuration (RPC_URL_1, RPC_URL_8453, etc).
   */
  async monitorMultiplePools(pools: { chainId: number, address: string, dexName: string, version?: 'v2' | 'v3' }[]) {
    logger.info(`Scanning ${pools.length} pools across multiple DEXs for arbitrage...`);

    for (const pool of pools) {
      if (pool.version === 'v3') {
        await this.monitorUniswapV3(pool.chainId, pool.address, pool.dexName);
      } else {
        await this.monitorUniswapV2(pool.chainId, pool.address, pool.dexName);
      }
    }
  }

  /**
   * Monitors a specific pair for arbitrage opportunities between 0x and a specific AMM.
   * NOTE: This is a "1 vs Many" strategy. We monitor 1 specific AMM pool and compare it
   * against 0x, which aggregates liquidity from 100+ DEXs simultaneously.
   */
  /**
   * Monitors a Uniswap V3 pool for arbitrage opportunities.
   */
  async monitorUniswapV3(chainId: number, poolAddress: string, dexName: string = 'Uniswap V3') {
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return;

    const rpcUrl = process.env[`RPC_URL_${chainId}`] || process.env.RPC_URL;
    const publicClient = createPublicClient({
      chain: chainId === 8453 ? base : mainnet,
      transport: http(rpcUrl),
    });

    try {
      const slot0 = await publicClient.readContract({
        address: poolAddress as Hex,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: 'slot0',
      }) as any;

      const token0 = await publicClient.readContract({
        address: poolAddress as Hex,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: 'token0',
      }) as string;

      const token1 = await publicClient.readContract({
        address: poolAddress as Hex,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: 'token1',
      }) as string;

      const decimals0 = await publicClient.readContract({
        address: token0 as Hex,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }) as number;

      const decimals1 = await publicClient.readContract({
        address: token1 as Hex,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }) as number;

      // Calculate V3 Price from sqrtPriceX96
      // Price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
      const sqrtPriceX96 = BigInt(slot0[0]);
      const priceRatio = (Number(sqrtPriceX96) / 2**96)**2;
      const ammPrice = priceRatio * 10**(decimals0 - decimals1);

      // Check 0x price
      const sellAmount = (10n ** BigInt(decimals0)).toString();
      const zeroExPrice = await this.zeroExService.getPrice({
        sellToken: token0,
        buyToken: token1,
        sellAmount,
        chainId,
      });

      const zxPrice = Number(zeroExPrice.buyAmount) / 10**decimals1;

      logger.info(`[${dexName} V3] Arbitrage Check ${token0}/${token1}: AMM=${ammPrice.toFixed(6)}, 0x=${zxPrice.toFixed(6)}`);

      if (zxPrice > ammPrice * 1.01) {
        logger.info(`🔥 Potential Arbitrage Found on ${dexName} V3! Buy on AMM, Sell on 0x.`);
      }
    } catch (error: any) {
      logger.error(`Error monitoring arbitrage on V3 pool ${poolAddress}:`, error.message);
    }
  }

  async monitorUniswapV2(chainId: number, pairAddress: string, dexName: string = 'Uniswap V2 Clone') {
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return;

    const rpcUrl = process.env[`RPC_URL_${chainId}`] || process.env.RPC_URL;
    const publicClient = createPublicClient({
      chain: chainId === 8453 ? base : mainnet,
      transport: http(rpcUrl),
    });

    try {
      const [reserve0, reserve1] = await publicClient.readContract({
        address: pairAddress as Hex,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'getReserves',
      }) as [bigint, bigint];

      const token0 = await publicClient.readContract({
        address: pairAddress as Hex,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'token0',
      }) as string;

      const token1 = await publicClient.readContract({
        address: pairAddress as Hex,
        abi: UNISWAP_V2_PAIR_ABI,
        functionName: 'token1',
      }) as string;

      const decimals0 = await publicClient.readContract({
        address: token0 as Hex,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }) as number;

      const decimals1 = await publicClient.readContract({
        address: token1 as Hex,
        abi: parseAbi(['function decimals() view returns (uint8)']),
        functionName: 'decimals',
      }) as number;

      // Calculate AMM Price: How much token1 for 1 unit of token0?
      // price = (reserve1 / 10^decimals1) / (reserve0 / 10^decimals0)
      const ammPrice = (Number(reserve1) / 10**decimals1) / (Number(reserve0) / 10**decimals0);

      // Check 0x price for same direction
      const sellAmount = (10n ** BigInt(decimals0)).toString(); // 1 unit of token0
      const zeroExPrice = await this.zeroExService.getPrice({
        sellToken: token0,
        buyToken: token1,
        sellAmount,
        chainId,
      });

      const zxPrice = Number(zeroExPrice.buyAmount) / 10**decimals1;

      logger.info(`[${dexName}] Arbitrage Check ${token0}/${token1}: AMM=${ammPrice.toFixed(6)}, 0x=${zxPrice.toFixed(6)}`);

      if (zxPrice > ammPrice * 1.01) { // 1% profit threshold
        logger.info(`🔥 Potential Arbitrage Found on ${dexName}! Buy on AMM, Sell on 0x.`);

        /**
         * ZERO-CAPITAL EXECUTION FLOW:
         * 1. Call AtomicBroker.execute(token1, amountToBorrow, params)
         * 2. AtomicBroker triggers receiveFlashLoan() from Balancer Vault.
         * 3. Inside receiveFlashLoan:
         *    a. We now have 'amountToBorrow' of token1 (Flash Loaned).
         *    b. Swap token1 -> token0 on the AMM (Uniswap V2).
         *    c. Swap token0 -> token1 on 0x (using params.zeroExData).
         *    d. Repay 'amountToBorrow' + fee back to Balancer.
         *    e. Any surplus token1 is profit remaining in the contract.
         *
         * RESULT: You captured the price difference using Balancer's liquidity,
         * only paying for the gas of this transaction.
         */
      }
    } catch (error: any) {
      logger.error(`Error monitoring arbitrage on ${pairAddress}:`, error.message);
    }
  }
}
