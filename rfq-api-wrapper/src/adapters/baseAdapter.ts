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
  protected async applySpread(buyAmount: string, chainId: number, buyToken: string): Promise<string> {
    const amount = BigInt(buyAmount);

    // Track price for volatility guard
    await spreadService.trackPrice(chainId, buyToken, buyAmount);

    const spreadBps = await spreadService.getEffectiveSpread(chainId, buyToken);
    const multiplier = BigInt(10000 - spreadBps);
    const result = (amount * multiplier) / 10000n;
    return result.toString();
  }
}
