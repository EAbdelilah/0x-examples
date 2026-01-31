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
    const spreadBps = Number(process.env.SPREAD_BPS || '0');
    logger.info(`Creating KyberSwap Limit Order: ${params.makerAsset} -> ${params.takerAsset} with ${spreadBps} bps spread`);

    // 1. Fetch 0x Price to determine how much we want in return (takerAmount)
    const zeroExPrice = await this.zeroExService.getPrice({
      sellToken: params.makerAsset,
      buyToken: params.takerAsset,
      sellAmount: params.makerAmount,
      taker: this.account.address,
      chainId: params.chainId,
    });

    // Apply Spread: takerAmount = zeroExBuyAmount * (10000 - spreadBps) / 10000
    const takerAmount = (BigInt(zeroExPrice.buyAmount) * BigInt(10000 - spreadBps)) / 10000n;
    const expiry = params.expiry || Math.floor(Date.now() / 1000) + 3600;

    // 2. Prepare Payload for /sign-message
    const signPayload = {
      chainId: params.chainId.toString(),
      maker: this.account.address,
      makerAsset: params.makerAsset,
      takerAsset: params.takerAsset,
      makingAmount: params.makerAmount,
      takingAmount: takerAmount.toString(),
      expiredAt: Number(expiry)
    };

    try {
      // Step A: Get Typed Data to Sign
      const signRes = await axios.post(`${this.baseUrl}/write/api/v1/orders/sign-message`, signPayload);
      const { types, domain, message, primaryType } = signRes.data.data;

      // Filter out EIP712Domain from types for Viem as it likely infers it from domain object
      const { EIP712Domain, ...signingTypes } = types;

      // Step B: Sign
      const signature = await this.account.signTypedData({
        domain,
        types: signingTypes,
        primaryType,
        message,
      });

      // Step C: Post Signed Order
      const postPayload = {
        chainId: params.chainId.toString(),
        ...message,
        expiredAt: Number(expiry),
        signature,
      };

      const response = await axios.post(`${this.baseUrl}/write/api/v1/orders`, postPayload);
      logger.info('Successfully posted order to KyberSwap');
      return response.data;
    } catch (error: any) {
      logger.warn('Failed to post to KyberSwap API', error.response?.data || error.message);
      return {
        status: 'FAILED',
        error: error.response?.data || error.message,
      };
    }
  }
}
