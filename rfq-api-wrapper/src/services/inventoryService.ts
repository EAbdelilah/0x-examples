import { Hex, createPublicClient, http, formatUnits } from 'viem';
import { mainnet, base } from 'viem/chains';
import logger from '../utils/logger';

export class InventoryService {
  private balances: Map<string, bigint> = new Map();
  private publicClient: any;

  constructor(private chainId: number, private address: Hex) {
    const rpc = process.env[`RPC_URL_${chainId}`] || process.env.RPC_URL;
    const chain = chainId === 8453 ? base : mainnet;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpc),
    });
  }

  async updateBalances(tokens: string[]) {
    for (const token of tokens) {
      try {
        const balance = await this.publicClient.readContract({
          address: token as Hex,
          abi: [{
            name: 'balanceOf',
            type: 'function',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
            stateMutability: 'view'
          }],
          functionName: 'balanceOf',
          args: [this.address],
        });

        this.balances.set(token.toLowerCase(), balance);
        logger.debug(`Inventory: ${token} balance = ${formatUnits(balance, 18)}`);
      } catch (e: any) {
        logger.error(`Failed to update balance for ${token}: ${e.message}`);
      }
    }
  }

  canFill(token: string, amount: bigint): boolean {
    const balance = this.balances.get(token.toLowerCase()) || 0n;
    return balance >= amount;
  }

  getBalance(token: string): bigint {
    return this.balances.get(token.toLowerCase()) || 0n;
  }
}
