import { MultiBot } from './bots/MultiBot';
import { SpatialArbBot } from './bots/SpatialArbBot';
import { LiquidationBot } from './bots/LiquidationBot';
import { ZeroExService } from './services/zeroExService';
import logger from './utils/logger';

async function testMulti() {
  logger.info('Testing MultiBot Initialization...');
  const zeroEx = new ZeroExService('mock');
  const chainId = 8453;

  const bot1 = new SpatialArbBot(zeroEx, chainId);
  const bot2 = new LiquidationBot(zeroEx, chainId);

  const multi = new MultiBot(zeroEx, chainId, [bot1, bot2]);

  logger.info('MultiBot initialized successfully.');
  // We don't run it as it loops infinitely, just verifying construction
}

testMulti().catch(console.error);
