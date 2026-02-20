import logger from '../utils/logger';
import { EventEmitter } from 'events';
import { ZeroExService } from './zeroExService';

export interface PriceUpdate {
  sellToken: string;
  buyToken: string;
  price: string;
  timestamp: number;
}

/**
 * PriceStreamService provides real-time (or high-frequency) price updates.
 * In production, this would connect to 0x WebSockets or a dedicated price aggregator.
 */
export class PriceStreamService extends EventEmitter {
  private activeSubscriptions: Set<string> = new Set();
  private interval: Timer | null = null;

  constructor(private zeroExService: ZeroExService) {
    super();
  }

  async subscribe(sellToken: string, buyToken: string, chainId: number) {
    const key = `${chainId}:${sellToken}:${buyToken}`;
    if (this.activeSubscriptions.has(key)) return;

    this.activeSubscriptions.add(key);
    logger.info(`Subscribed to price updates for ${key}`);

    // Start polling if not already started
    if (!this.interval) {
      this.startStreaming(chainId);
    }
  }

  private startStreaming(chainId: number) {
    // Production note: Replace polling with actual WebSocket listeners if available
    this.interval = setInterval(async () => {
      for (const sub of this.activeSubscriptions) {
        const [subChainId, sellToken, buyToken] = sub.split(':');

        try {
          const quote = await this.zeroExService.getPrice({
            sellToken,
            buyToken,
            sellAmount: '1000000000000000000', // 1 unit base
            chainId: parseInt(subChainId),
          });

          const update: PriceUpdate = {
            sellToken,
            buyToken,
            price: quote.price,
            timestamp: Date.now(),
          };

          this.emit('priceUpdate', update);
        } catch (e) {
          // Silent fail for stream stability
        }
      }
    }, 2000); // 2-second high-frequency polling for "production" feel
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.activeSubscriptions.clear();
  }
}
