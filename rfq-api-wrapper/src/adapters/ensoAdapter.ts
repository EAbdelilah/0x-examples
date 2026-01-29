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
      taker: validated.fromAddress || '0x0000000000000000000000000000000000000000',
      chainId: validated.chainId,
    });

    return {
      amountOut: zeroExPrice.buyAmount,
      price: zeroExPrice.buyAmount, // Simplified
    };
  }
}
