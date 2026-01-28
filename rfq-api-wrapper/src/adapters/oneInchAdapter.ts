import { BaseAdapter } from './baseAdapter';
import { z } from 'zod';
import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex, createWalletClient, http, numberToHex, keccak256, encodeAbiParameters, parseAbiParameters, hashTypedData } from 'viem';

const OneInchQuoteSchema = z.object({
  fromTokenAddress: z.string(),
  toTokenAddress: z.string(),
  amount: z.string(),
  fromAddress: z.string().optional(),
  chainId: z.coerce.number().default(1),
});

// 1inch Limit Order Protocol V4 constants
const DEFAULT_ONE_INCH_ROUTER_V4 = '0x111111125421caae1042fd7022ad658b0d462f42';

export class OneInchAdapter extends BaseAdapter {
  private account;
  private routerAddress: string;

  constructor(zeroExService: ZeroExService, privateKey: string, routerAddress?: string) {
    super('1inch', zeroExService);
    this.account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as Hex);
    this.routerAddress = routerAddress || DEFAULT_ONE_INCH_ROUTER_V4;
  }

  async handleQuote(query: any): Promise<any> {
    const validated = OneInchQuoteSchema.parse(query);
    logger.info(`Handling 1inch quote request: ${validated.fromTokenAddress} -> ${validated.toTokenAddress} on chain ${validated.chainId}`);

    // Call 0x to get a price
    const zeroExPrice = await this.zeroExService.getPrice({
      sellToken: validated.fromTokenAddress,
      buyToken: validated.toTokenAddress,
      sellAmount: validated.amount,
      taker: this.account.address,
      chainId: validated.chainId,
    });

    // 1inch Limit Order V4 Logic
    const makerAsset = validated.toTokenAddress;
    const takerAsset = validated.fromTokenAddress;
    const makingAmount = BigInt(zeroExPrice.buyAmount);
    const takingAmount = BigInt(validated.amount);

    // Create a salt with expiration (standard for 1inch RFQ)
    // Salt structure for RFQ: (uint40 expiration) + (uint24 unknown) + (uint192 random)
    const expiration = BigInt(Math.floor(Date.now() / 1000) + 120); // 2 minutes
    const salt = (expiration << 216n) | BigInt(Math.floor(Math.random() * 1000000));

    const order = {
      salt,
      makerAsset: makerAsset as Hex,
      takerAsset: takerAsset as Hex,
      maker: this.account.address as Hex,
      receiver: '0x0000000000000000000000000000000000000000' as Hex,
      allowedSender: '0x0000000000000000000000000000000000000000' as Hex,
      makingAmount,
      takingAmount,
      offsets: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      interactions: '0x' as Hex,
    };

    const domain = {
      name: '1inch Limit Order Protocol',
      version: '4',
      chainId: validated.chainId,
      verifyingContract: this.routerAddress as Hex,
    };

    const types = {
        Order: [
            { name: 'salt', type: 'uint256' },
            { name: 'makerAsset', type: 'address' },
            { name: 'takerAsset', type: 'address' },
            { name: 'maker', type: 'address' },
            { name: 'receiver', type: 'address' },
            { name: 'allowedSender', type: 'address' },
            { name: 'makingAmount', type: 'uint256' },
            { name: 'takingAmount', type: 'uint256' },
            { name: 'offsets', type: 'uint256' },
            { name: 'interactions', type: 'bytes' },
        ],
    };

    const signature = await this.account.signTypedData({
        domain,
        primaryType: 'Order',
        types,
        message: order,
    });

    return {
      orderHash: this.calculateOrderHash(order, domain),
      signature,
      data: {
        ...order,
        salt: order.salt.toString(),
        makingAmount: order.makingAmount.toString(),
        takingAmount: order.takingAmount.toString(),
      },
    };
  }

  private calculateOrderHash(order: any, domain: any): Hex {
    return hashTypedData({
        domain,
        primaryType: 'Order',
        types: {
            Order: [
                { name: 'salt', type: 'uint256' },
                { name: 'makerAsset', type: 'address' },
                { name: 'takerAsset', type: 'address' },
                { name: 'maker', type: 'address' },
                { name: 'receiver', type: 'address' },
                { name: 'allowedSender', type: 'address' },
                { name: 'makingAmount', type: 'uint256' },
                { name: 'takingAmount', type: 'uint256' },
                { name: 'offsets', type: 'uint256' },
                { name: 'interactions', type: 'bytes' },
            ],
        },
        message: order,
    });
  }
}
