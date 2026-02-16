import logger from '../utils/logger';
import { DatabaseService, dbService } from './database';

export class SpreadService {
  private baseSpreadBps: number;
  private volatilityThreshold = 0.01; // 1%
  private volatilitySurchargeBps = 50;

  constructor(baseSpreadBps?: number) {
    this.baseSpreadBps = baseSpreadBps ?? Number(process.env.SPREAD_BPS || '50');
  }

  /**
   * Calculates the appropriate spread in BPS, accounting for volatility.
   */
  async getEffectiveSpread(chainId: number, tokenAddress: string): Promise<number> {
    // Dynamically read from env if not explicitly set to allow testing
    const currentBaseSpread = process.env.SPREAD_BPS ? Number(process.env.SPREAD_BPS) : this.baseSpreadBps;

    const isVolatile = await this.checkVolatility(chainId, tokenAddress);

    if (isVolatile) {
      logger.info(`High volatility detected for ${tokenAddress} on chain ${chainId}. Applying surcharge.`);
      return currentBaseSpread + this.volatilitySurchargeBps;
    }

    return currentBaseSpread;
  }

  /**
   * Tracks a new price point for a token pair or individual token.
   * Price should be normalized (e.g., amount of buyToken per 1 unit of sellToken).
   */
  async trackPrice(chainId: number, tokenAddress: string, price: string) {
    dbService.savePrice(chainId, tokenAddress, price);
  }

  /**
   * Checks if the token has exceeded the volatility threshold in the last 5 minutes.
   */
  private async checkVolatility(chainId: number, tokenAddress: string): Promise<boolean> {
    const prices = dbService.getRecentPrices(chainId, tokenAddress, 10); // Last 10 price points

    if (prices.length < 2) return false;

    const priceValues = prices.map(p => parseFloat(p.priceInNative));
    const maxPrice = Math.max(...priceValues);
    const minPrice = Math.min(...priceValues);

    if (minPrice === 0) return false;

    const variance = (maxPrice - minPrice) / minPrice;
    return variance > this.volatilityThreshold;
  }
}

export const spreadService = new SpreadService();
