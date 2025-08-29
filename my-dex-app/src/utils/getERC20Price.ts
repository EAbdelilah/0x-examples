const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913'; // USDC on Base
const CHAIN_ID = '8453'; // Base mainnet
const USDC_DECIMALS = 6;

if (!ZERO_EX_API_KEY) {
  throw new Error('Missing ZERO_EX_API_KEY environment variable');
}

const headers = {
  '0x-api-key': ZERO_EX_API_KEY,
};

export async function getERC20Price(tokenAddress: string): Promise<number> {
  const params = new URLSearchParams({
    sellToken: tokenAddress,
    buyToken: USDC_ADDRESS,
    sellAmount: (10 ** 18).toString(), // Assuming the token has 18 decimals
  });

  const url = `https://base.api.0x.org/swap/v1/price?${params.toString()}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch price: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.price) {
    throw new Error('Price not available');
  }

  return parseFloat(data.price);
}
