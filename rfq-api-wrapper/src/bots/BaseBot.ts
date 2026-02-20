import { ZeroExService } from '../services/zeroExService';
import logger from '../utils/logger';
import { Hex, createPublicClient, http, Account, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base } from 'viem/chains';
import { CHAINS } from '../config/chains';

export abstract class BaseBot {
  protected account: Account | null = null;
  protected publicClient: any;
  protected chainId: number;
  protected isDryRun: boolean;

  constructor(protected zeroExService: ZeroExService, chainId: number) {
    this.chainId = chainId;
    this.isDryRun = process.env.DRY_RUN === 'true';
    const pk = process.env.PRIVATE_KEY;
    if (pk) {
      this.account = privateKeyToAccount(`0x${pk.replace('0x', '')}` as Hex);
    }

    const rpc = process.env[`RPC_URL_${chainId}`] || process.env.RPC_URL;
    const chain = chainId === 8453 ? base : mainnet;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpc),
    });
  }

  abstract run(): Promise<void>;

  protected async checkGas(): Promise<boolean> {
    if (!this.account) return false;
    const balance = await this.publicClient.getBalance({ address: this.account.address });
    const isOk = balance > parseUnits('0.005', 18);
    if (!isOk) logger.warn(`Low gas balance on chain ${this.chainId}`);
    return isOk;
  }

  protected logOpportunity(strategy: string, details: string, profitable: boolean) {
    const dryStatus = this.isDryRun ? '[DRY RUN] ' : '';
    const status = profitable ? '🔥 PROFITABLE' : '❄️ Scanning';
    logger.info(`${dryStatus}[${strategy}] Chain ${this.chainId} | ${status} | ${details}`);
  }

  protected async checkSafety(
    sellAmount: bigint,
    buyAmount: bigint,
    minProfitBps: number = 10
  ): Promise<boolean> {
    // 1. Minimum Profit Check (Default 10 bps)
    const profit = buyAmount - sellAmount; // Note: Simplified for same-unit comparison
    const minProfit = (sellAmount * BigInt(minProfitBps)) / 10000n;

    if (profit < minProfit) {
      logger.debug(`Safety: Profit too low (${profit} < ${minProfit})`);
      return false;
    }

    // 2. Max Trade Size (Prevent fat-finger/unlimited risk)
    const maxTrade = parseUnits(process.env.MAX_TRADE_SIZE || '10', 18);
    if (sellAmount > maxTrade) {
      logger.warn(`Safety: Trade size exceeds MAX_TRADE_SIZE (${sellAmount} > ${maxTrade})`);
      return false;
    }

    return true;
  }
}
