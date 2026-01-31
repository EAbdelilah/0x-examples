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

    const KYBER_LO_CONTRACTS: Record<number, string> = {
      1: '0x3965947e4513e0e2c846a366657c66f7a8b7042f', // Ethereum Mainnet
      42161: '0x227B0c196eA8db17A665EA6824D972A64202E936', // Arbitrum
      8453: '0x3965947e4513e0e2c846a366657c66f7a8b7042f', // Base
      137: '0x3965947e4513e0e2c846a366657c66f7a8b7042f', // Polygon
      56: '0x3965947e4513e0e2c846a366657c66f7a8b7042f', // BSC
      10: '0x3965947e4513e0e2c846a366657c66f7a8b7042f', // Optimism
    };

    const domain = {
      name: 'KyberSwap Limit Order',
      version: '1',
      chainId: params.chainId,
      verifyingContract: (KYBER_LO_CONTRACTS[params.chainId] || '0x3965947e4513e0e2c846a366657c66f7a8b7042f') as Hex,
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
      logger.info('Successfully posted order to KyberSwap');
      return response.data;
    } catch (error: any) {
      // If the API is not reachable or returns an error, we still return the signed order
      // so the user can debug or post it manually.
      logger.warn('Failed to post to KyberSwap API, but order was signed.', error.response?.data || error.message);
      return {
        order,
        signature,
        status: 'SIGNED_ONLY',
        error: error.response?.data || error.message,
      };
    }
  }
}
