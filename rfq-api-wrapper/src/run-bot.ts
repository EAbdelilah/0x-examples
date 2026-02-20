import { SpatialArbBot } from './bots/SpatialArbBot';
import { LiquidationBot } from './bots/LiquidationBot';
import { MirrorBot } from './bots/MirrorBot';
import { YieldHoppingBot } from './bots/YieldHoppingBot';
import { LoopFarmingBot } from './bots/LoopFarmingBot';
import { ZeroExService } from './services/zeroExService';
import { KyberLimitOrderService } from './services/kyberLimitOrderService';
import logger from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const strategy = process.argv[2];
const chainId = parseInt(process.argv[3] || '8453');

const zeroEx = new ZeroExService();
const kyber = new KyberLimitOrderService();

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
    case 'yield':
      bot = new YieldHoppingBot(zeroEx, chainId);
      break;
    case 'loop':
      bot = new LoopFarmingBot(zeroEx, chainId);
      break;
    default:
      logger.error('Invalid strategy. Use: spatial | liquidate | mirror | yield | loop');
      process.exit(1);
  }

  await bot.run();
}

main().catch(e => {
  logger.error(e);
  process.exit(1);
});
