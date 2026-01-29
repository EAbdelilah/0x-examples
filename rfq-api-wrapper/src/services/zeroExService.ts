import axios from "axios";
import { config } from "dotenv";
import logger from "../utils/logger";

config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;
const ZERO_EX_API_URL = "https://api.0x.org";

const headers = {
  "0x-api-key": ZERO_EX_API_KEY || "",
  "0x-version": "v2",
};

export interface ZeroExPriceParams {
  chainId: string;
  sellToken: string;
  buyToken: string;
  sellAmount?: string;
  buyAmount?: string;
  taker?: string;
}

export class ZeroExError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ZeroExError";
  }
}

export const getZeroExPrice = async (params: ZeroExPriceParams) => {
  try {
    const response = await axios.get(`${ZERO_EX_API_URL}/swap/permit2/price`, {
      params,
      headers,
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message;
    logger.error("Error fetching price from 0x", { status, message, params });
    throw new ZeroExError(status, message);
  }
};

export const getZeroExQuote = async (params: ZeroExPriceParams) => {
  try {
    const response = await axios.get(`${ZERO_EX_API_URL}/swap/permit2/quote`, {
      params,
      headers,
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message;
    logger.error("Error fetching quote from 0x", { status, message, params });
    throw new ZeroExError(status, message);
  }
};
