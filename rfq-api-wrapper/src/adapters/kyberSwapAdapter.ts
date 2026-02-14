import { BaseAdapter } from './baseAdapter';
import { z } from 'zod';
import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';
import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const KyberSwapQuoteSchema = z.object({
  sellToken: z.string(),
  buyToken: z.string(),
  sellAmount: z.string(),
  chainId: z.coerce.number().default(1),
  taker: z.string().optional(),
});

export class KyberSwapAdapter extends BaseAdapter {
  private account;
  private rfqContract: string;

  constructor(zeroExService: ZeroExService, privateKey: string, rfqContract?: string) {
    super('KyberSwap', zeroExService);
    this.account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as Hex);
    this.rfqContract = rfqContract || '0x0000000000000000000000000000000000000000';
  }

  async handleQuote(query: any): Promise<any> {
    const validated = KyberSwapQuoteSchema.parse(query);
    logger.info(`Handling KyberSwap quote request: ${validated.sellToken} -> ${validated.buyToken}`);

    const zeroExPrice = await this.zeroExService.getPrice({
      sellToken: validated.sellToken,
      buyToken: validated.buyToken,
      sellAmount: validated.sellAmount,
      taker: validated.taker || this.account.address,
      chainId: validated.chainId,
    });

    const buyAmountWithSpread = this.applySpread(zeroExPrice.buyAmount);

    // KyberSwap RFQ format
    // Note: KyberSwap often requires signing an EIP-712 message.
    // The exact domain and types depend on the specific KyberSwap deployment.

    const nonce = BigInt(Math.floor(Date.now() / 1000));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 60);

    const order = {
      maker: this.account.address,
      sellToken: validated.sellToken as Hex,
      buyToken: validated.buyToken as Hex,
      sellAmount: BigInt(validated.sellAmount),
      buyAmount: BigInt(buyAmountWithSpread),
      nonce,
      expiry,
    };

    const signature = await this.account.signTypedData({
        domain: {
            name: 'KyberSwap RFQ',
            version: '1',
            chainId: validated.chainId,
            verifyingContract: this.rfqContract as Hex,
        },
        primaryType: 'Order',
        types: {
            Order: [
                { name: 'maker', type: 'address' },
                { name: 'sellToken', type: 'address' },
                { name: 'buyToken', type: 'address' },
                { name: 'sellAmount', type: 'uint256' },
                { name: 'buyAmount', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'expiry', type: 'uint256' },
            ],
        },
        message: order,
    });

    return {
        status: 'OK',
        message: 'Quote fetched from 0x',
        order: {
            ...order,
            sellAmount: order.sellAmount.toString(),
            buyAmount: order.buyAmount.toString(),
            nonce: order.nonce.toString(),
            expiry: order.expiry.toString(),
        },
        signature,
    };
  }
}
