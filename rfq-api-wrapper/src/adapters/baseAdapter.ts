import { ZeroExService } from '../services/zeroExService';
import { spreadService } from '../services/spreadService';

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
    this.spreadBps = Number(process.env.SPREAD_BPS || '10');
  }

  abstract handleQuote(req: any): Promise<any>;

  /**
   * Applies a dynamic spread to the 0x buyAmount.
   * Returns the amount to be quoted to the user.
   */
  protected applySpread(buyAmount: string, params?: {
    sellToken?: string;
    buyToken?: string;
    sellAmount?: string;
    chainId?: number;
  }): string {
    // Use dynamic spread if params provided, otherwise fall back to static
    const spread = params
      ? spreadService.calculateSpread({
        sellToken: params.sellToken || '',
        buyToken: params.buyToken || '',
        sellAmount: params.sellAmount || '0',
        chainId: params.chainId || 1,
      })
      : this.spreadBps;

    return spreadService.applySpread(buyAmount, spread);
  }
}
