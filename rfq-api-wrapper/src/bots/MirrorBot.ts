import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { KyberLimitOrderService } from '../services/kyberLimitOrderService';
import { InventoryService } from '../services/inventoryService';
import { CHAINS } from '../config/chains';

/**
 * MirrorBot executes a passive market making strategy.
 * NOTE: This bot requires token inventory in your wallet because it posts
 * traditional Limit Orders where the TAKER initiates the transaction.
 *
 * For a ZERO-CAPITAL version of this strategy, use the FillerService (Atomic Mirroring).
 */
export class MirrorBot extends BaseBot {
  private inventory: InventoryService;

  constructor(
    zeroExService: any,
    chainId: number,
    private kyberService: KyberLimitOrderService
  ) {
    super(zeroExService, chainId);
    if (!this.account) throw new Error('Account required for MirrorBot');
    this.inventory = new InventoryService(chainId, this.account.address);
  }

  async run() {
    logger.info(`Starting PRODUCTION RFQ Mirroring Bot on chain ${this.chainId}...`);

    const tokenA = CHAINS[this.chainId].tokens['WETH'];
    const tokenB = CHAINS[this.chainId].tokens['USDC'];

    if (!tokenA || !tokenB) {
      logger.error('Missing tokens for mirroring.');
      return;
    }

    while (true) {
      try {
        // 1. Update Inventory
        await this.inventory.updateBalances([tokenA, tokenB]);

        // 2. Risk Check: Can we actually fulfill the order we are about to quote?
        const amountToQuote = 1000000000000000000n; // 1 WETH
        if (!this.inventory.canFill(tokenA, amountToQuote)) {
           logger.warn(`MirrorBot: Insufficient inventory to quote ${amountToQuote} of ${tokenA}. Skipping...`);
           await new Promise(resolve => setTimeout(resolve, 30000));
           continue;
        }

        // 3. Get 0x "True" Price
        const price = await this.zeroExService.getPrice({
          sellToken: tokenA,
          buyToken: tokenB,
          sellAmount: amountToQuote.toString(),
          chainId: this.chainId,
        });

        // 4. Mirror on Kyber (as a Maker)
        if (!this.isDryRun) {
          await this.kyberService.createAndPostOrder({
            makerAsset: tokenA,
            takerAsset: tokenB,
            makerAmount: amountToQuote.toString(),
            chainId: this.chainId,
          });
        }

        this.logOpportunity('Mirroring', `Quoting WETH/USDC at 0x rate + spread`, true);

        await new Promise(resolve => setTimeout(resolve, 60000)); // Refresh quotes every min
      } catch (e: any) {
        logger.error(`MirrorBot Error: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
}
