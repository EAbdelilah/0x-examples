import { BaseAdapter } from './baseAdapter';
import { z } from 'zod';
import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';

const EnsoQuoteSchema = z.object({
  fromToken: z.string(),
  toToken: z.string(),
  amount: z.string(),
  chainId: z.coerce.number().default(1),
  fromAddress: z.string().optional(),
});

/**
 * Enso Finance Adapter
 *
 * Enso acts as an "Intent Engine". As an Action Provider, you define
 * smart contract interactions. This adapter provides the pricing logic
 * that Enso's "Graphers" use to include your liquidity in their routes.
 */
export class EnsoAdapter extends BaseAdapter {
  constructor(zeroExService: ZeroExService) {
    super('Enso', zeroExService);
  }

  async handleQuote(query: any): Promise<any> {
    const validated = EnsoQuoteSchema.parse(query);
    logger.info(`Handling Enso quote request: ${validated.fromToken} -> ${validated.toToken}`);

    const zeroExPrice = await this.zeroExService.getPrice({
      sellToken: validated.fromToken,
      buyToken: validated.toToken,
      sellAmount: validated.amount,
      taker: validated.fromAddress,
      chainId: validated.chainId,
    });

    const amountWithSpread = this.applySpread(zeroExPrice.buyAmount, `${validated.fromToken}-${validated.toToken}`, zeroExPrice.price);

    return {
      amountOut: amountWithSpread,
      price: amountWithSpread,
      gas: this.estimateGas(validated.chainId),
      // For Enso, we might return the 'action' to take
      action: {
        target: '0xdef1C0ded9bec7F1a1670819833240f027b25EfF', // 0x Proxy
        callData: zeroExPrice.data, // If using /quote instead of /price
      }
    };
  }
}
