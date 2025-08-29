import { URLSearchParams } from 'url';

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;
const ZERO_EX_API_URL = 'https://api.0x.org';

if (!ZERO_EX_API_KEY) {
  throw new Error('Missing ZERO_EX_API_KEY environment variable');
}

export async function getQuote(params: {
  sellToken: string;
  buyToken: string;
  sellAmount?: string;
  buyAmount?: string;
  takerAddress: string;
  slippagePercentage?: string;
}) {
  const headers = {
    '0x-api-key': ZERO_EX_API_KEY,
  };

  const qs = new URLSearchParams(params).toString();
  const url = `${ZERO_EX_API_URL}/swap/v1/quote?${qs}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch quote: ${response.statusText}`);
  }

  return response.json();
}
