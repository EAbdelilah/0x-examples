import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import { FillerService } from './services/fillerService';
import logger from './utils/logger';

dotenv.config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY!;
const TICK_INTERVAL = 30000; // 30 seconds

const zeroExService = new ZeroExService(ZERO_EX_API_KEY);
const fillerService = new FillerService(zeroExService);

async function tick() {
  logger.info('--- Filler Bot Tick ---');
  try {
    // Check Base chain for opportunities
    await fillerService.monitorUniswapX(8453);

    // You can add more chains here
    // await fillerService.monitorUniswapX(1);
  } catch (error) {
    logger.error('Failed to run filler tick:', error);
  }
}

async function main() {
  logger.info('Starting UniswapX Filler Bot...');

  // Run immediately
  await tick();

  // Set interval for subsequent runs
  setInterval(tick, TICK_INTERVAL);
}

main().catch(err => {
    logger.error('Critical filler bot error:', err);
    process.exit(1);
});
