import { ZeroExService } from '../services/zeroExService';
import { spreadService } from '../services/spreadService';

export interface AggregatorAdapter {
  name: string;
  handleQuote(req: any): Promise<any>;
}

export abstract class BaseAdapter implements AggregatorAdapter {
  constructor(
    public name: string,
    protected zeroExService: ZeroExService
  ) {}

  abstract handleQuote(req: any): Promise<any>;

  /**
   * Applies the configured spread to the 0x buyAmount.
   * Returns the amount to be quoted to the user.
   */
  protected async applySpread(buyAmount: string, sellAmount: string, sellToken: string, buyToken: string, chainId: number): Promise<string> {
    const amount = BigInt(buyAmount);
    const sell = BigInt(sellAmount);

    // Track volatility per unique token pair
    const pairKey = `${sellToken.toLowerCase()}-${buyToken.toLowerCase()}`;

    if (sell > 0n) {
        // Calculate a price ratio (using 18 decimals of precision) to track volatility
        // This represents how many units of buyToken per unit of sellToken
        const priceRatio = (amount * BigInt(1e18)) / sell;
        await spreadService.trackPrice(chainId, pairKey, priceRatio.toString());
    }

    const spreadBps = await spreadService.getEffectiveSpread(chainId, pairKey);
    const multiplier = BigInt(10000 - spreadBps);
    const result = (amount * multiplier) / 10000n;
    return result.toString();
  }
}
