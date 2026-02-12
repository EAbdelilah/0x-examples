import logger from '../utils/logger';

export class SpreadService {
  private baseSpreadBps: number;
  private lastPrices: Map<string, { price: number, timestamp: number }> = new Map();
  private readonly VOLATILITY_WINDOW_MS = 60000; // 1 minute

  constructor(baseSpreadBps: number) {
    this.baseSpreadBps = baseSpreadBps;
  }

  /**
   * Calculates the optimal spread based on market conditions
   */
  getSpread(pair: string, currentPrice: number): number {
    const volatility = this.calculateVolatility(pair, currentPrice);

    // If volatility is high (> 1% change in short period), double the spread
    if (volatility > 0.01) {
      logger.warn(`High volatility detected for ${pair}: ${(volatility * 100).toFixed(2)}%. Increasing spread.`);
      return this.baseSpreadBps + 50; // Add 50 bps surcharge
    }

    return this.baseSpreadBps;
  }

  private calculateVolatility(pair: string, currentPrice: number): number {
    const now = Date.now();
    const lastData = this.lastPrices.get(pair);
    this.lastPrices.set(pair, { price: currentPrice, timestamp: now });

    if (!lastData) return 0;

    // Only consider volatility within the window
    if (now - lastData.timestamp > this.VOLATILITY_WINDOW_MS) {
      return 0;
    }

    return Math.abs(currentPrice - lastData.price) / lastData.price;
  }
}
