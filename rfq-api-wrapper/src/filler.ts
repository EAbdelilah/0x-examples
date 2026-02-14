import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import { FillerService } from './services/fillerService';
import logger from './utils/logger';
import { CHAINS } from './config/chains';

dotenv.config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY!;
const TICK_INTERVAL = Number(process.env.TICK_INTERVAL || '30000');

const zeroExService = new ZeroExService(ZERO_EX_API_KEY);
const fillerService = new FillerService(zeroExService);

// Identify chains with UniswapX reactors
const searchableChains = Object.values(CHAINS).filter(c => c.uniswapXReactor);

async function tick() {
  logger.info('--- Filler Bot Tick ---');
  try {
    for (const chain of searchableChains) {
      await fillerService.monitorUniswapX(chain.chainId);
    }
  } catch (error) {
    logger.error('Failed to run filler tick:', error);
  }
}

async function main() {
  logger.info(`Starting UniswapX Filler Bot monitoring ${searchableChains.length} chains...`);

  // Run immediately
  await tick();

  // Set interval for subsequent runs
  setInterval(tick, TICK_INTERVAL);
}

main().catch(err => {
  logger.error('Critical filler bot error:', err);
  process.exit(1);
});
