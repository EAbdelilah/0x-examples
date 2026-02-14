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
    const subdomainMap: Record<number, string> = {
      1: 'api',
      10: 'optimism.api',
      56: 'bsc.api',
      137: 'polygon.api',
      8453: 'base.api',
      42161: 'arbitrum.api',
      43114: 'avalanche.api',
      59144: 'linea.api',
      534352: 'scroll.api',
      5000: 'mantle.api',
      81457: 'blast.api',
      34443: 'mode.api',
      480: 'worldchain.api',
      10143: 'monadtestnet.api',
      130: 'unichain.api',
      80094: 'berachain.api',
      57073: 'ink.api',
      9745: 'plasma.api',
      143: 'monad.api',
      146: 'sonic.api',
      2741: 'abstract.api',
    };

    const subdomain = subdomainMap[chainId];
    if (subdomain) {
      return `https://${subdomain}.0x.org/swap/permit2`;
    }

    // Fallback to legacy v1 for other chains like Fantom (250) and Celo (42220)
    // Legacy v1 usually uses subdomains too if they exist, but many are on api.0x.org
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
