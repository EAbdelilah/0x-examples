import { Hex, hashTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import axios from 'axios';
import logger from '../utils/logger';
import { ZeroExService } from './zeroExService';

export class KyberLimitOrderService {
  private account;
  private readonly baseUrl = 'https://limit-order.kyberswap.com';

  constructor(privateKey: string, private zeroExService: ZeroExService) {
    this.account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as Hex);
  }

  async createAndPostOrder(params: {
    makerAsset: string;
    takerAsset: string;
    makerAmount: string;
    chainId: number;
    expiry?: number;
  }) {
    logger.info(`Creating KyberSwap Limit Order: ${params.makerAsset} -> ${params.takerAsset}`);

    // 1. Fetch 0x Price to determine how much we want in return (takerAmount)
    const zeroExPrice = await this.zeroExService.getPrice({
      sellToken: params.makerAsset,
      buyToken: params.takerAsset,
      sellAmount: params.makerAmount,
      taker: this.account.address,
      chainId: params.chainId,
    });

    const takerAmount = BigInt(zeroExPrice.buyAmount);
    const expiry = params.expiry || Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const salt = BigInt(Math.floor(Math.random() * 1000000000));

    const order = {
      maker: this.account.address,
      takerAsset: params.takerAsset as Hex,
      makerAsset: params.makerAsset as Hex,
      takerAmount,
      makerAmount: BigInt(params.makerAmount),
      salt,
      expiry: BigInt(expiry),
    };

    const domain = {
      name: 'KyberSwap Limit Order',
      version: '1',
      chainId: params.chainId,
      verifyingContract: '0x3965947e4513e0e2c846a366657c66f7a8b7042f' as Hex, // Placeholder for Kyber LO contract
    };

    const types = {
      Order: [
        { name: 'maker', type: 'address' },
        { name: 'takerAsset', type: 'address' },
        { name: 'makerAsset', type: 'address' },
        { name: 'takerAmount', type: 'uint256' },
        { name: 'makerAmount', type: 'uint256' },
        { name: 'salt', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    };

    const signature = await this.account.signTypedData({
      domain,
      primaryType: 'Order',
      types,
      message: order,
    });

    // 2. Post to KyberSwap API
    /*
    try {
      const response = await axios.post(`${this.baseUrl}/${params.chainId}/orders`, {
        order: {
            ...order,
            takerAmount: takerAmount.toString(),
            makerAmount: params.makerAmount,
            salt: salt.toString(),
            expiry: expiry.toString(),
        },
        signature,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Error posting to KyberSwap Limit Order API:', error.response?.data || error.message);
      throw error;
    }
    */

    return {
      order,
      signature,
      message: 'Order created and signed locally. Post to KyberSwap API to activate.',
    };
  }
}
