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
  private readonly baseUrl = 'https://api.0x.org/swap/permit2';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getPrice(params: ZeroExPriceParams) {
    try {
      const query = qs.stringify({
        ...params,
        chainId: params.chainId.toString(),
      });
      const url = `${this.baseUrl}/price?${query}`;

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
      const url = `${this.baseUrl}/quote?${query}`;

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
