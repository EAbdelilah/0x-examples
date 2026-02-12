import { ZeroExService } from '../services/zeroExService';
import { SpreadService } from '../services/spreadService';

export interface AggregatorAdapter {
  name: string;
  handleQuote(req: any): Promise<any>;
}

export abstract class BaseAdapter implements AggregatorAdapter {
  protected spreadService: SpreadService;

  constructor(
    public name: string,
    protected zeroExService: ZeroExService
  ) {
    const baseSpreadBps = Number(process.env.SPREAD_BPS || '0');
    this.spreadService = new SpreadService(baseSpreadBps);
  }

  abstract handleQuote(req: any): Promise<any>;

  /**
   * Applies the dynamic spread to the 0x buyAmount.
   * @param buyAmount The amount received from 0x
   * @param pair The token pair (e.g. WETH-USDC)
   * @param price The current exchange rate from 0x
   */
  protected applySpread(buyAmount: string, pair: string, price: string): string {
    const amount = BigInt(buyAmount);

    // Use the actual price for volatility detection
    const currentPrice = parseFloat(price);

    const bps = this.spreadService.getSpread(pair, currentPrice);
    const multiplier = BigInt(10000 - bps);
    const result = (amount * multiplier) / 10000n;
    return result.toString();
  }

  protected estimateGas(chainId: number): string {
    const gasEstimates: Record<number, string> = {
      1: '200000',
      10: '500000',
      137: '250000',
      8453: '500000',
      42161: '800000',
    };
    return gasEstimates[chainId] || '300000';
  }
}
