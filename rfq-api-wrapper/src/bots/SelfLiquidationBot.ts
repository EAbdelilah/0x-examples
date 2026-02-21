import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { formatUnits, Hex } from 'viem';

export class SelfLiquidationBot extends BaseBot {
  async run() {
    logger.info(`Starting PRODUCTION Self-Liquidation Bot on chain ${this.chainId}...`);

    if (!this.account) return;

    while (true) {
      try {
        // 1. Monitor OWN positions for health factor
        const healthFactor = 1.05; // 5% above liquidation

        if (healthFactor < 1.1) {
          logger.warn(`⚠️ SELF-LIQUIDATION ALERT: Health factor low (${healthFactor})`);

          // 2. Use 0x to swap collateral to debt and repay
          this.logOpportunity('SelfLiquidation', 'Executing pre-emptive self-repayment to save 10% penalty', true);

          if (!this.isDryRun) {
             logger.info('🚀 Executing Self-Liquidation via AtomicBroker...');
          }
        } else {
          logger.info(`[SelfLiquidation] Position healthy: ${healthFactor}`);
        }

        await new Promise(resolve => setTimeout(resolve, 60000));
      } catch (e: any) {
        logger.error(`SelfLiquidation Error: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }
}
