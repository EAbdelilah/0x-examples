import axios from 'axios';
import qs from 'qs';
import logger from '../utils/logger';
import { ExternalApiError } from '../utils/errors';

export interface ZeroExPriceParams {
  sellToken: string;
  buyToken: string;
  sellAmount?: string;
  buyAmount?: string;
  taker?: string;
  chainId: number;
}

export class ZeroExService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getBaseUrl(chainId: number): string {
    // Chains supported by Permit2 (v2) as of the latest check
    const v2Chains = [1, 10, 56, 137, 8453, 42161, 43114, 59144, 534352, 5000, 81457, 34443, 480, 10143, 130, 80094, 57073, 9745, 143, 146, 2741];

    if (v2Chains.includes(chainId)) {
      return 'https://api.0x.org/swap/permit2';
    }
    // Fallback to legacy v1 for other chains like Fantom (250) and Celo (42220)
    return 'https://api.0x.org/swap/v1';
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
