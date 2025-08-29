import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const aggregatorV3InterfaceABI = [
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'description',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint80', name: '_roundId', type: 'uint80' }],
    name: 'getRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL),
});

import { priceFeeds } from '@/config/priceFeeds';

// This function now gets the price of a token from a mapping of price feeds.
export async function getERC20Price(tokenAddress: string): Promise<number> {
  const priceFeedAddress = priceFeeds[tokenAddress];

  if (!priceFeedAddress) {
    throw new Error(`Price feed not found for token: ${tokenAddress}`);
  }

  const data = await publicClient.readContract({
    address: priceFeedAddress as `0x${string}`,
    abi: aggregatorV3InterfaceABI,
    functionName: 'latestRoundData',
  });

  const decimals = await publicClient.readContract({
    address: priceFeedAddress as `0x${string}`,
    abi: aggregatorV3InterfaceABI,
    functionName: 'decimals',
  });

  // The price is returned as a BigInt, so we need to format it to a number.
  const price = parseFloat(formatUnits(data[1] as bigint, decimals as number));

  return price;
}
