import { ZeroExService } from '../services/zeroExService';

export interface AggregatorAdapter {
  name: string;
  handleQuote(req: any): Promise<any>;
}

export abstract class BaseAdapter implements AggregatorAdapter {
  protected spreadBps: number;

  constructor(
    public name: string,
    protected zeroExService: ZeroExService
  ) {
    this.spreadBps = Number(process.env.SPREAD_BPS || '0');
  }

  abstract handleQuote(req: any): Promise<any>;

  /**
   * Applies the configured spread to the 0x buyAmount.
   * Returns the amount to be quoted to the user.
   */
  protected applySpread(buyAmount: string): string {
    const amount = BigInt(buyAmount);
    const multiplier = BigInt(10000 - this.spreadBps);
    const result = (amount * multiplier) / 10000n;
    return result.toString();
  }
}
