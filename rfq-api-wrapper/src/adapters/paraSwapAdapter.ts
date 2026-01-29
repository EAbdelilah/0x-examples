import { BaseAdapter } from './baseAdapter';
import { z } from 'zod';
import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';
import { Hex, hashTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ParaSwapPriceSchema = z.object({
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  side: z.enum(['SELL', 'BUY']).default('SELL'),
  network: z.coerce.number().default(1),
  userAddress: z.string().optional(),
  isFirmQuote: z.coerce.boolean().default(false),
});

export class ParaSwapAdapter extends BaseAdapter {
  private account;

  constructor(zeroExService: ZeroExService, privateKey: string) {
    super('ParaSwap', zeroExService);
    this.account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as Hex);
  }

  async handleQuote(query: any): Promise<any> {
    const validated = ParaSwapPriceSchema.parse(query);
    logger.info(`Handling ParaSwap ${validated.isFirmQuote ? 'firm' : 'indicative'} price request: ${validated.from} -> ${validated.to}`);

    const params: any = {
      sellToken: validated.from,
      buyToken: validated.to,
      taker: this.account.address,
      chainId: validated.network,
    };

    if (validated.side === 'SELL') {
      params.sellAmount = validated.amount;
    } else {
      params.buyAmount = validated.amount;
    }

    const zeroExPrice = await this.zeroExService.getPrice(params);

    const response: any = {
      price: zeroExPrice.buyAmount,
      guaranteedPrice: zeroExPrice.minBuyAmount || zeroExPrice.buyAmount,
      address: this.account.address,
      // Optional: specify limits for this pair
      minAmount: '1',
      maxAmount: '1000000000000000000000000',
    };

    if (validated.isFirmQuote) {
        // Implement ParaSwap EIP-712 signing if needed
        // This usually depends on the ParaSwap Augustus version being used
        // For now, we return a signed message that represents the quote
        const domain = {
            name: 'ParaSwap PMM',
            version: '1',
            chainId: validated.network,
            verifyingContract: '0xdef171fe48cf0148b1a80588e8984849ef5d5744' as Hex, // Placeholder
        };

        const types = {
            Quote: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'price', type: 'uint256' },
                { name: 'salt', type: 'uint256' },
                { name: 'expiry', type: 'uint256' },
            ],
        };

        const randomValues = new Uint32Array(1);
        crypto.getRandomValues(randomValues);

        const message = {
            from: validated.from as Hex,
            to: validated.to as Hex,
            amount: BigInt(validated.amount),
            price: BigInt(zeroExPrice.buyAmount),
            salt: BigInt(randomValues[0]),
            expiry: BigInt(Math.floor(Date.now() / 1000) + 60), // 60 seconds
        };

        const signature = await this.account.signTypedData({
            domain,
            primaryType: 'Quote',
            types,
            message,
        });

        response.signature = signature;
        response.order = message;
    }

    return response;
  }
}
