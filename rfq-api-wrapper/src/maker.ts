import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import { KyberLimitOrderService } from './services/kyberLimitOrderService';
import logger from './utils/logger';

dotenv.config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const TICK_INTERVAL = 60000; // 1 minute

const zeroExService = new ZeroExService(ZERO_EX_API_KEY);
const kyberService = new KyberLimitOrderService(PRIVATE_KEY, zeroExService);

async function tick() {
  logger.info('--- Maker Bot Tick ---');
  try {
    const result = await kyberService.createAndPostOrder({
      makerAsset: '0x4200000000000000000000000000000000000006', // WETH on Base
      takerAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
      makerAmount: (10n ** 14n).toString(), // 0.0001 WETH
      chainId: 8453,
      expiry: Math.floor(Date.now() / 1000) + 300, // 5 minute expiry for active bot
    });

    logger.info('Order update result:', result);
  } catch (error) {
    logger.error('Failed to run maker tick:', error);
  }
}

async function main() {
  logger.info('Starting KyberSwap Maker Bot...');

  // Run immediately
  await tick();

  // Set interval for subsequent runs
  setInterval(tick, TICK_INTERVAL);
}

main().catch(err => {
  logger.error('Critical bot error:', err);
  process.exit(1);
});
