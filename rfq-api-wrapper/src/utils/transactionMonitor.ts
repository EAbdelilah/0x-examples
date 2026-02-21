import logger from './logger';
import { metrics } from '../services/metricsService';
import { PublicClient, Hex } from 'viem';

export class TransactionMonitor {
  constructor(private publicClient: PublicClient) {}

  async waitForConfirmation(txHash: Hex, strategy: string) {
    logger.info(`[${strategy}] Monitoring transaction: ${txHash}`);

    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
        timeout: 60_000, // 60 seconds timeout
      });

      if (receipt.status === 'success') {
        logger.info(`[${strategy}] ✅ Transaction Confirmed in block ${receipt.blockNumber}`);
        metrics.strategySuccess.inc({ strategy, chainId: this.publicClient.chain?.id.toString() || 'unknown' });
      } else {
        logger.error(`[${strategy}] ❌ Transaction Reverted in block ${receipt.blockNumber}`);
        metrics.strategyFail.inc({ strategy, chainId: this.publicClient.chain?.id.toString() || 'unknown' });
      }
      return receipt;
    } catch (error: any) {
      if (error.name === 'TransactionNotFoundError') {
        logger.warn(`[${strategy}] ⚠️ Transaction not found. It might have been dropped.`);
      } else {
        logger.error(`[${strategy}] ❌ Monitoring failed: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Suggests priority fees for MEV-protected transactions.
   * Private RPCs often require a minimum priority fee to be included by builders.
   */
  async getMEVGasStrategy() {
    const feeData = await this.publicClient.estimateFeesPerGas();
    return {
      maxFeePerGas: feeData.maxFeePerGas,
      // Use 1.5x the base priority fee to ensure builder priority
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas || 0n) * 150n / 100n,
    };
  }
}
