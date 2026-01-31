import axios from 'axios';
import qs from 'qs';
import logger from '../utils/logger';
import { ExternalApiError } from '../utils/errors';

export interface ZeroExPriceParams {
  sellToken: string;
  buyToken: string;
  sellAmount?: string;
  buyAmount?: string;
  taker: string;
  chainId: number;
}

export class ZeroExService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getBaseUrl(chainId: number): string {
    const chainMap: Record<number, string> = {
      1: '',
      10: 'optimism.',
      56: 'bsc.',
      137: 'polygon.',
      250: 'fantom.',
      8453: 'base.',
      42161: 'arbitrum.',
      43114: 'avalanche.',
      42220: 'celo.',
      59144: 'linea.',
      81457: 'blast.',
      5000: 'mantle.',
      34443: 'mode.',
      534352: 'scroll.',
      480: 'worldchain.',
      146: 'sonic.',
      80094: 'berachain.',
      130: 'unichain.',
      57073: 'ink.',
      2741: 'abstract.',
      10117: 'monadtestnet.',
      10143: 'monad.',
      11155111: 'sepolia.',
    };
    const prefix = chainMap[chainId] ?? '';
    return `https://${prefix}api.0x.org/swap/permit2`;
  }

  async getPrice(params: ZeroExPriceParams) {
    try {
      const query = qs.stringify({
        ...params,
        chainId: params.chainId.toString(),
      });
      const url = `${this.getBaseUrl(params.chainId)}/price?${query}`;

      logger.debug(`Fetching price from 0x: ${url}`);
      const response = await axios.get(url, {
        headers: {
          '0x-api-key': this.apiKey,
          '0x-version': 'v2',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error fetching price from 0x:', error.response?.data || error.message);
      throw new ExternalApiError(
        error.response?.data?.reason || 'Failed to fetch price from 0x',
        error.response?.status
      );
    }
  }

  async getQuote(params: ZeroExPriceParams) {
    try {
      const query = qs.stringify({
        ...params,
        chainId: params.chainId.toString(),
      });
      const url = `${this.getBaseUrl(params.chainId)}/quote?${query}`;

      logger.debug(`Fetching quote from 0x: ${url}`);
      const response = await axios.get(url, {
        headers: {
          '0x-api-key': this.apiKey,
          '0x-version': 'v2',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error('Error fetching quote from 0x:', error.response?.data || error.message);
      throw new ExternalApiError(
        error.response?.data?.reason || 'Failed to fetch quote from 0x',
        error.response?.status
      );
    }
  }
}
