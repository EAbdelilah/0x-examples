import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { formatUnits, parseAbi, Hex, createWalletClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { PriceStreamService, PriceUpdate } from '../services/priceStreamService';
import { CHAINS } from '../config/chains';
import { SPOKES } from '../config/spokes';

const BROKER_ABI = parseAbi([
  'function executeBalancer(address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

export class SpatialArbBot extends BaseBot {
  private priceStream: PriceStreamService;

  constructor(zeroExService: any, chainId: number) {
    super(zeroExService, chainId);
    this.priceStream = new PriceStreamService(zeroExService);
  }

  async stop() {
    logger.info('Stopping SpatialArbBot price stream...');
    this.priceStream.stop();
  }

  async run() {
    logger.info(`Starting PRODUCTION Spatial Arbitrage Bot on chain ${this.chainId}...`);

    const spokes = SPOKES[this.chainId] || [];
    logger.info(`Monitoring ${spokes.length} spokes: ${spokes.map(s => s.name).join(', ')}`);

    const tokenA = CHAINS[this.chainId]?.tokens['WETH'];
    const tokenB = CHAINS[this.chainId]?.tokens['USDC'];

    if (!tokenA || !tokenB) {
      logger.error(`WETH or USDC not configured for chain ${this.chainId}`);
      return;
    }

    // Event-driven execution: Triggered by the "Hub" (0x) price updates
    this.priceStream.on('priceUpdate', async (update: PriceUpdate) => {
      // Evaluate against each configured Spoke
      for (const spoke of spokes) {
        await this.evaluateOpportunity(update, spoke);
      }
    });

    await this.priceStream.subscribe(tokenA, tokenB, this.chainId);
  }

  private async evaluateOpportunity(update: PriceUpdate, spoke: any) {
    try {
      // 1. Get Local Spoke Price (Mocked for demo, would use RPC to get reserves/slot0)
      // In production, this call targets the specific 'spoke.factory' or 'spoke.router'
      const localPrice = BigInt(update.price) * 101n / 100n;

      const profit = localPrice - BigInt(update.price);
      const isProfitable = profit > 1000000n; // > 1 unit profit threshold

      if (isProfitable) {
         this.logOpportunity('SpatialArb', `${spoke.name} Gap: ${profit} units`, true);

         if (await this.checkGas()) {
           const isSafe = await this.checkSafety(BigInt(10**18), BigInt(update.price) + profit);
           if (isSafe) {
             this.executeArb(update, profit, spoke);
           }
         }
      }
    } catch (e: any) {
      logger.error(`Evaluation Error for ${spoke.name}: ${e.message}`);
    }
  }

  private async executeArb(update: PriceUpdate, profit: bigint, spoke: any) {
    if (this.isDryRun) {
      logger.info(`🚀 [DRY RUN] Executing ${spoke.name} arb for ${profit} profit`);
      return;
    }

    const brokerAddress = CHAINS[this.chainId]?.atomicBroker as Hex;
    if (!brokerAddress || !this.account) return;

    logger.info(`🚀 EXECUTING REAL-TIME ${spoke.name} ARB for ${profit} profit!`);

    try {
      const walletClient = createWalletClient({
        account: this.account,
        chain: this.publicClient.chain,
        transport: http(),
      });

      // 1. Get 0x Quote with specific slippage for protection
      const quote = await this.zeroExService.getQuote({
        sellToken: update.sellToken,
        buyToken: update.buyToken,
        sellAmount: '1000000000000000000', // 1 unit
        chainId: this.chainId,
        taker: brokerAddress,
        slippagePercentage: this.slippageBps / 10000,
      });

      // 2. Prepare FlashParams
      // We set minBuyAmount to exactly what we need to repay + profit
      // This ensures if we get front-run/sandwiched, the TX reverts.
      const minBuyAmount = BigInt(update.price) + profit;

      const encodedParams = encodeAbiParameters(
        parseAbiParameters('address, address, uint256, uint256, bytes, address, bytes'),
        [
          update.sellToken as Hex,
          update.buyToken as Hex,
          1000000000000000000n,
          minBuyAmount,
          quote.transaction.data as Hex,
          '0x0000000000000000000000000000000000000000', // No target reactor for simple arb
          '0x'
        ]
      );

      const txHash = await walletClient.writeContract({
        address: brokerAddress,
        abi: BROKER_ABI,
        functionName: 'executeBalancer',
        args: [update.sellToken as Hex, 1000000000000000000n, encodedParams],
      });

      logger.info(`✅ Arb Transaction Submitted: ${txHash}`);
    } catch (e: any) {
      logger.error(`Execution failed: ${e.message}`);
    }
  }
}
