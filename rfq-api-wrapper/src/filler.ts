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

// Identify chains with any fillable intent source (UniswapX Only)
// Exclude Ethereum mainnet (chain 1) due to prohibitively high gas costs
const searchableChains = Object.values(CHAINS).filter(c =>
  c.uniswapXReactor && c.chainId !== 1
);

async function tick() {
  logger.info('--- Multi-Chain Filler Bot Tick ---');

  const tasks = searchableChains.map(async (chain) => {
    try {
      logger.debug(`Monitoring chain ${chain.chainId} (${chain.name})...`);
      // Run monitors for this chain in parallel
      await Promise.all([
        fillerService.monitorUniswapX(chain.chainId)
      ]);
    } catch (error: any) {
      logger.error(`Error on chain ${chain.chainId} (${chain.name}):`, error.message);
    }
  });

  await Promise.all(tasks);
}

async function main() {
  logger.info(`Starting Atomic Arbitrage Filler Bot...`);

  // Start the perpetual monitor loop across all chains
  await fillerService.runMonitorLoop();
}

main().catch(err => {
  logger.error('Critical filler bot error:', err);
  process.exit(1);
});
