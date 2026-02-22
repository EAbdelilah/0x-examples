import { SpatialArbBot } from './bots/SpatialArbBot';
import { LiquidationBot } from './bots/LiquidationBot';
import { MirrorBot } from './bots/MirrorBot';
import { TriangularArbBot } from './bots/TriangularArbBot';
import { CollateralSwapBot } from './bots/CollateralSwapBot';
import { SelfLiquidationBot } from './bots/SelfLiquidationBot';
import { MultiBot } from './bots/MultiBot';
import { BaseBot } from './bots/BaseBot';
import { ZeroExService } from './services/zeroExService';
import { KyberLimitOrderService } from './services/kyberLimitOrderService';
import logger from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const strategyArg = process.argv[2];
const chainId = parseInt(process.argv[3] || '8453');

const zeroEx = new ZeroExService();
const kyber = new KyberLimitOrderService(process.env.PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000001', zeroEx);

function getBotInstance(name: string): BaseBot {
  switch (name) {
    case 'spatial': return new SpatialArbBot(zeroEx, chainId);
    case 'liquidate': return new LiquidationBot(zeroEx, chainId);
    case 'mirror': return new MirrorBot(zeroEx, chainId, kyber);
    case 'triangular': return new TriangularArbBot(zeroEx, chainId);
    case 'collateral': return new CollateralSwapBot(zeroEx, chainId);
    case 'self-liq': return new SelfLiquidationBot(zeroEx, chainId);
    default:
      throw new Error(`Invalid strategy: ${name}`);
  }
}

async function main() {
  let bot: BaseBot;

  const strategies = strategyArg.split(',');

  if (strategies.length > 1) {
    const bots = strategies.map(s => getBotInstance(s.trim()));
    bot = new MultiBot(zeroEx, chainId, bots);
  } else {
    try {
      bot = getBotInstance(strategies[0]);
    } catch (e: any) {
      logger.error('Invalid strategy. Use: spatial | liquidate | mirror | triangular | collateral | self-liq (or a comma-separated list)');
      process.exit(1);
    }
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
