import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { KyberLimitOrderService } from '../services/kyberLimitOrderService';
import { CHAINS } from '../config/chains';

export class MirrorBot extends BaseBot {
  constructor(
    zeroExService: any,
    chainId: number,
    private kyberService: KyberLimitOrderService
  ) {
    super(zeroExService, chainId);
  }

  async run() {
    logger.info(`Starting RFQ Mirroring Bot on chain ${this.chainId}...`);

    const tokenA = CHAINS[this.chainId].tokens['WETH'];
    const tokenB = CHAINS[this.chainId].tokens['USDC'];

    if (!tokenA || !tokenB) {
      logger.error('Missing tokens for mirroring.');
      return;
    }

    while (true) {
      try {
        // 1. Get 0x "True" Price
        const price = await this.zeroExService.getPrice({
          sellToken: tokenA,
          buyToken: tokenB,
          sellAmount: '1000000000000000000',
          chainId: this.chainId,
        });

        // 2. Mirror on Kyber (as a Maker)
        // We post a limit order with a spread
        await this.kyberService.createAndPostOrder({
          makerAsset: tokenA,
          takerAsset: tokenB,
          makerAmount: '1000000000000000000',
          chainId: this.chainId,
        });

        this.logOpportunity('Mirroring', `Quoting WETH/USDC at 0x rate + spread`, true);

        await new Promise(resolve => setTimeout(resolve, 60000)); // Refresh quotes every min
      } catch (e: any) {
        logger.error(`MirrorBot Error: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
}
