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

  private getBaseUrl(v: 'v1' | 'v2' = 'v2', chainId?: number): string {
    if (v === 'v2') {
      return 'https://api.0x.org/swap/permit2';
    }
    // For v1, some chains use subdomains, but consolidated is safer for core chains
    return 'https://api.0x.org/swap/v1';
  }

  async getPrice(params: ZeroExPriceParams) {
    try {
      const { taker, ...rest } = params;
      const query = qs.stringify({
        ...rest,
        sellToken: params.sellToken.toLowerCase(),
        buyToken: params.buyToken.toLowerCase(),
      });
      const url = `${this.getBaseUrl('v2', params.chainId)}/price?${query}`;
      logger.debug(`Fetching price from 0x v2: ${url}`);
      const response = await axios.get(url, {
        headers: {
          '0x-api-key': this.apiKey,
          '0x-version': 'v2',
        },
      });

      return response.data;
    } catch (error: any) {
      logger.warn('0x v2 Price Fetch Failed:', error.response?.data || error.message);
      return null;
    }
  }

  async getQuote(params: ZeroExPriceParams) {
    try {
      // 1. Try v2 first
      const queryV2 = qs.stringify({
        ...params,
        sellToken: params.sellToken.toLowerCase(),
        buyToken: params.buyToken.toLowerCase(),
        taker: params.taker?.toLowerCase(),
      });
      const urlV2 = `${this.getBaseUrl('v2', params.chainId)}/quote?${queryV2}`;
      const response = await axios.get(urlV2, {
        headers: {
          '0x-api-key': this.apiKey,
          '0x-version': 'v2',
        },
      });
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      // If v2 fails with validation error, fallback to v1 with skipValidation
      if (errorData?.name === 'SWAP_VALIDATION_FAILED' || errorData?.reason === 'Swap validation failed') {
        logger.info('0x v2 Validation Failed. Falling back to v1 skipValidation...');
        const queryV1 = qs.stringify({
          ...params,
          sellToken: params.sellToken.toLowerCase(),
          buyToken: params.buyToken.toLowerCase(),
          taker: params.taker?.toLowerCase(),
          skipValidation: 'true',
        });
        const urlV1 = `${this.getBaseUrl('v1', params.chainId)}/quote?${queryV1}`;
        const respV1 = await axios.get(urlV1, {
          headers: {
            '0x-api-key': this.apiKey,
            '0x-version': 'v1',
          }
        });
        return respV1.data;
      }

      logger.error('Final 0x Quote Fetch Failure:', {
        message: error.message,
        data: errorData,
        params: params
      });
      throw new ExternalApiError(
        errorData?.reason || errorData?.message || 'Failed to fetch quote from 0x',
        error.response?.status
      );
    }
  }

  /**
   * Fetch a v1 quote with skipValidation=true.
   * Use this for swaps executed INSIDE a flash loan callback (AtomicBroker),
   * because v2/Permit2 quotes require off-chain signatures that can't be set up
   * during a callback. V1 returns plain ERC20 allowance-based calldata.
   */
  async getV1Quote(params: ZeroExPriceParams) {
    try {
      // v1 API: chain is set by subdomain, NOT by ?chainId= query param
      // Also: takerAddress (not taker), skipValidation=true for callback compat
      const { chainId, taker, ...rest } = params;
      const query = qs.stringify({
        ...rest,
        sellToken: params.sellToken.toLowerCase(),
        buyToken: params.buyToken.toLowerCase(),
        takerAddress: taker?.toLowerCase(),
        skipValidation: true,
      });
      // Use Base-specific subdomain for chain 8453, otherwise use main endpoint
      const host = params.chainId === 8453
        ? 'https://base.api.0x.org'
        : 'https://api.0x.org';
      const url = `${host}/swap/v1/quote?${query}`;
      logger.debug(`Fetching v1 quote (skipValidation): ${url}`);
      const response = await axios.get(url, {
        headers: { '0x-api-key': this.apiKey },
        timeout: 8000,
      });
      // v1 quote response: { to, data, value, buyAmount, allowanceTarget, ... }
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      logger.error('0x v1 Quote Fetch Failed:', {
        message: error.message,
        data: errorData,
        params,
      });
      return null;
    }
  }
}
