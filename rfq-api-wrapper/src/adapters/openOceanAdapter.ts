import { BaseAdapter } from './baseAdapter';
import { z } from 'zod';
import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';

const OpenOceanQuoteSchema = z.object({
  inTokenAddress: z.string(),
  outTokenAddress: z.string(),
  amount: z.string(),
  chainId: z.coerce.number().default(1),
  account: z.string().optional(),
});

/**
 * OpenOcean PMM Adapter
 *
 * OpenOcean's RFQ API expects a competitive rate.
 * For whitelisted PMMs, they route trades directly to your API.
 */
export class OpenOceanAdapter extends BaseAdapter {
  constructor(zeroExService: ZeroExService) {
    super('OpenOcean', zeroExService);
  }

  async handleQuote(query: any): Promise<any> {
    const validated = OpenOceanQuoteSchema.parse(query);
    logger.info(`Handling OpenOcean quote request: ${validated.inTokenAddress} -> ${validated.outTokenAddress}`);

    const zeroExPrice = await this.zeroExService.getPrice({
      sellToken: validated.inTokenAddress,
      buyToken: validated.outTokenAddress,
      sellAmount: validated.amount,
      taker: validated.account,
      chainId: validated.chainId,
    });

    const amountWithSpread = this.applySpread(zeroExPrice.buyAmount, `${validated.inTokenAddress}-${validated.outTokenAddress}`, zeroExPrice.price);

    return {
      outAmount: amountWithSpread,
      price: amountWithSpread,
      inAmount: validated.amount,
      minOutAmount: amountWithSpread,
      router: '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64',
      estimatedGas: this.estimateGas(validated.chainId),
    };
  }
}
