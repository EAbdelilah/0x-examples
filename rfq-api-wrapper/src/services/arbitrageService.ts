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

export class ArbitrageService {
  constructor(private zeroExService: ZeroExService) {}

  /**
   * Monitors a specific pair for arbitrage opportunities between 0x and Uniswap V2.
   */
  async monitorUniswapV2(chainId: number, pairAddress: string) {
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return;

    const publicClient = createPublicClient({
      chain: chainId === 1 ? mainnet : base, // Simplified for example
      transport: http(process.env[`RPC_URL_${chainId}`]),
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

      // Simple price check: How much token1 for 1 unit of token0?
      // price = reserve1 / reserve0 (ignoring decimals for simplicity in this example)
      const ammPrice = Number(reserve1) / Number(reserve0);

      // Check 0x price for same direction
      const zeroExPrice = await this.zeroExService.getPrice({
        sellToken: token0,
        buyToken: token1,
        sellAmount: (10n ** 18n).toString(), // 1 unit
        chainId,
      });

      const zxPrice = Number(zeroExPrice.buyAmount) / 1e18;

      logger.info(`Arbitrage Check: AMM=${ammPrice}, 0x=${zxPrice}`);

      if (zxPrice > ammPrice * 1.01) { // 1% profit threshold
        logger.info(`🔥 Potential Arbitrage! Buy on AMM, Sell on 0x.`);
        // To execute:
        // 1. Flash loan token1 from Balancer using AtomicBroker
        // 2. Swap token1 for token0 on AMM
        // 3. Swap token0 for token1 on 0x
        // 4. Repay flash loan
        // 5. Keep profit
      }
    } catch (error: any) {
      logger.error(`Error monitoring arbitrage on ${pairAddress}:`, error.message);
    }
  }
}
