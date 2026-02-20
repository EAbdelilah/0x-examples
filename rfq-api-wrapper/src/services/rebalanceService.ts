import { ZeroExService } from './zeroExService';
import { InventoryService } from './inventoryService';
import logger from '../utils/logger';
import { Hex, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export class RebalanceService {
  constructor(
    private zeroExService: ZeroExService,
    private inventoryService: InventoryService,
    private chainId: number,
    private baseToken: string
  ) {}

  async rebalance(tokensToClean: string[]) {
    logger.info(`Starting automated rebalancing to ${this.baseToken}...`);

    const pk = process.env.PRIVATE_KEY;
    if (!pk) return;
    const account = privateKeyToAccount(`0x${pk.replace('0x', '')}` as Hex);

    const walletClient = createWalletClient({
      account,
      transport: http(),
    });

    for (const token of tokensToClean) {
      if (token.toLowerCase() === this.baseToken.toLowerCase()) continue;

      const balance = this.inventoryService.getBalance(token);

      // Only rebalance if balance is significant (e.g. > $10 worth, hardcoded for demo)
      if (balance > 0n) {
        try {
          logger.info(`Rebalancing ${token}...`);
          const quote = await this.zeroExService.getQuote({
            sellToken: token,
            buyToken: this.baseToken,
            sellAmount: balance.toString(),
            chainId: this.chainId,
            taker: account.address
          });

          // Execute swap via 0x
          const hash = await walletClient.sendTransaction({
             to: quote.transaction.to as Hex,
             data: quote.transaction.data as Hex,
             value: BigInt(quote.transaction.value),
             chain: walletClient.chain
          });

          logger.info(`Rebalance transaction submitted: ${hash}`);
        } catch (e: any) {
          logger.error(`Rebalance failed for ${token}: ${e.message}`);
        }
      }
    }
  }
}
