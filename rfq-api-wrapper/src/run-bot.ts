import { SpatialArbBot } from './bots/SpatialArbBot';
import { LiquidationBot } from './bots/LiquidationBot';
import { MirrorBot } from './bots/MirrorBot';
import { TriangularArbBot } from './bots/TriangularArbBot';
import { CollateralSwapBot } from './bots/CollateralSwapBot';
import { SelfLiquidationBot } from './bots/SelfLiquidationBot';
import { ZeroExService } from './services/zeroExService';
import { KyberLimitOrderService } from './services/kyberLimitOrderService';
import logger from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const strategy = process.argv[2];
const chainId = parseInt(process.argv[3] || '8453');

const zeroEx = new ZeroExService();
const kyber = new KyberLimitOrderService(process.env.PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000001', zeroEx);

async function main() {
  let bot;

  switch (strategy) {
    case 'spatial':
      bot = new SpatialArbBot(zeroEx, chainId);
      break;
    case 'liquidate':
      bot = new LiquidationBot(zeroEx, chainId);
      break;
    case 'mirror':
      bot = new MirrorBot(zeroEx, chainId, kyber);
      break;
    case 'triangular':
      bot = new TriangularArbBot(zeroEx, chainId);
      break;
    case 'collateral':
      bot = new CollateralSwapBot(zeroEx, chainId);
      break;
    case 'self-liq':
      bot = new SelfLiquidationBot(zeroEx, chainId);
      break;
    default:
      logger.error('Invalid strategy. Use: spatial | liquidate | mirror | triangular | collateral | self-liq');
      process.exit(1);
  }

  process.on('SIGINT', async () => {
    logger.info('Caught interrupt signal (SIGINT)');
    if (bot) await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Caught termination signal (SIGTERM)');
    if (bot) await bot.stop();
    process.exit(0);
  });

  await bot.run();
}

main().catch(e => {
  logger.error(e);
  process.exit(1);
});
