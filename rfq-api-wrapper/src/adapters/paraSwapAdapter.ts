import { BaseAdapter } from './baseAdapter';
import { z } from 'zod';
import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';
import { Hex, hashTypedData, getAddress } from 'viem';
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

// ParaSwap Augustus V6 addresses (examples)
const PARASWAP_ROUTER: Record<number, string> = {
  1: '0x6a000f20005980200222b0030099000b00000000',
  137: '0x6a000f20005980200222b0030099000b00000000',
  8453: '0x6a000f20005980200222b0030099000b00000000', // Base
};

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
    const buyAmountWithSpread = this.applySpread(zeroExPrice.buyAmount, `${validated.from}-${validated.to}`, zeroExPrice.price);

    const response: any = {
      price: buyAmountWithSpread,
      guaranteedPrice: buyAmountWithSpread,
      address: this.account.address,
      minAmount: '1',
      maxAmount: '1000000000000000000000000',
      network: validated.network,
      gasEstimate: this.estimateGas(validated.network),
    };

    if (validated.isFirmQuote) {
        const expiry = Math.floor(Date.now() / 1000) + 60; // 60 seconds
        const salt = BigInt(Math.floor(Math.random() * 1000000000));

        const domain = {
            name: 'ParaSwap PMM',
            version: '1',
            chainId: validated.network,
            verifyingContract: getAddress(PARASWAP_ROUTER[validated.network] || PARASWAP_ROUTER[1]) as Hex,
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

        const message = {
            from: validated.from as Hex,
            to: validated.to as Hex,
            amount: BigInt(validated.amount),
            price: BigInt(buyAmountWithSpread),
            salt,
            expiry: BigInt(expiry),
        };

        const signature = await this.account.signTypedData({
            domain,
            primaryType: 'Quote',
            types,
            message,
        });

        response.signature = signature;
        response.order = {
            ...message,
            salt: message.salt.toString(),
            expiry: message.expiry.toString(),
            amount: message.amount.toString(),
            price: message.price.toString(),
        };
    }

    return response;
  }
}
