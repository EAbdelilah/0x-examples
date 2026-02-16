import logger from './utils/logger';
import { ZeroExService } from './services/zeroExService';
import { ArbitrageService } from './services/arbitrageService';
import { FillerService } from './services/fillerService';
import { ARBITRAGE_POOLS } from './config/arbitrage';
import dotenv from 'dotenv';

dotenv.config();

async function runDryRun() {
  logger.info('🚀 Starting Dry Run Scan for Profitable Trades...');

  const apiKey = process.env.ZERO_EX_API_KEY;
  if (!apiKey) {
    logger.error('❌ ZERO_EX_API_KEY not found in .env. Dry run cannot fetch real-time 0x prices.');
    logger.info('💡 To run this for real, add your key to .env and run: bun run dry-run');
    return;
  }

  const zeroExService = new ZeroExService(apiKey);
  const arbitrageService = new ArbitrageService(zeroExService);
  const fillerService = new FillerService(zeroExService);

  // 1. Check UniswapX Orders on Base
  logger.info('\n--- Scanning UniswapX (Base) ---');
  try {
    await fillerService.monitorUniswapX(8453);
  } catch (e: any) {
    logger.warn(`Failed to scan UniswapX: ${e.message}`);
  }

  // 2. Check Arbitrage Pools
  logger.info('\n--- Scanning Multi-DEX Arbitrage Pools ---');
  try {
    await arbitrageService.monitorMultiplePools(ARBITRAGE_POOLS);
  } catch (e: any) {
    logger.warn(`Failed to scan Arbitrage Pools: ${e.message}`);
  }

  logger.info('\n✅ Dry Run Scan Complete.');
}

runDryRun().catch(err => {
  logger.error('Unhandled error during dry run:', err);
});
