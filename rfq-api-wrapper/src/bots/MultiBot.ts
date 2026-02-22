import { BaseBot } from './BaseBot';
import logger from '../utils/logger';

export class MultiBot extends BaseBot {
  private bots: BaseBot[] = [];

  constructor(zeroExService: any, chainId: number, bots: BaseBot[]) {
    super(zeroExService, chainId);
    this.bots = bots;
  }

  async run() {
    logger.info(`🚀 Starting Multi-Bot with ${this.bots.length} strategies on chain ${this.chainId}...`);

    // Run all bots concurrently
    await Promise.all(this.bots.map(bot => bot.run()));
  }

  async stop() {
    logger.info(`Stopping all ${this.bots.length} bots in Multi-Bot...`);
    await Promise.all(this.bots.map(bot => bot.stop()));
  }
}
