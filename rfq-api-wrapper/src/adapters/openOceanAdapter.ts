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
      taker: validated.account || '0x0000000000000000000000000000000000000000',
      chainId: validated.chainId,
    });

    const amountWithSpread = this.applySpread(zeroExPrice.buyAmount);

    return {
      outAmount: amountWithSpread,
      price: amountWithSpread,
    };
  }
}
