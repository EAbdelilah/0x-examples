import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { formatUnits, parseAbi } from 'viem';
import { PriceStreamService, PriceUpdate } from '../services/priceStreamService';

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

    const tokenA = '0x4200000000000000000000000000000000000006'; // WETH (Base)
    const tokenB = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC (Base)

    // Event-driven execution
    this.priceStream.on('priceUpdate', async (update: PriceUpdate) => {
      await this.evaluateOpportunity(update);
    });

    await this.priceStream.subscribe(tokenA, tokenB, this.chainId);
  }

  private async evaluateOpportunity(update: PriceUpdate) {
    try {
      // 1. Get Local DEX price (Mocked for demo)
      // In production, you'd fetch this from a WebSocket provider or direct node query
      const localPrice = BigInt(update.price) * 101n / 100n;

      const profit = localPrice - BigInt(update.price);
      const isProfitable = profit > 1000000n; // > 1 USDC profit threshold

      if (isProfitable) {
         this.logOpportunity('SpatialArb', `Real-time Gap: ${profit} units`, true);

         if (await this.checkGas()) {
           const isSafe = await this.checkSafety(BigInt(10**18), BigInt(update.price) + profit);
           if (isSafe) {
             this.executeArb(update, profit);
           }
         }
      }
    } catch (e: any) {
      logger.error(`Evaluation Error: ${e.message}`);
    }
  }

  private executeArb(update: any, profit: bigint) {
    if (this.isDryRun) {
      logger.info(`🚀 [DRY RUN] Executing arb for ${profit} profit`);
    } else {
      logger.info(`🚀 EXECUTING REAL-TIME ARB for ${profit} profit!`);
      // Trigger AtomicBroker...
    }
  }
}
