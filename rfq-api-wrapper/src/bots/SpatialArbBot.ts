import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { formatUnits, parseAbi, Hex, createWalletClient, http, encodeAbiParameters, parseAbiParameters } from 'viem';
import { PriceStreamService, PriceUpdate } from '../services/priceStreamService';
import { CHAINS } from '../config/chains';

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

  private async executeArb(update: PriceUpdate, profit: bigint) {
    if (this.isDryRun) {
      logger.info(`🚀 [DRY RUN] Executing arb for ${profit} profit`);
      return;
    }

    const brokerAddress = CHAINS[this.chainId]?.atomicBroker as Hex;
    if (!brokerAddress || !this.account) return;

    logger.info(`🚀 EXECUTING REAL-TIME ARB for ${profit} profit!`);

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
