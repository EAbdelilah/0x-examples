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

  constructor(protected zeroExService: ZeroExService, chainId: number) {
    this.chainId = chainId;
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
    const status = profitable ? '🔥 PROFITABLE' : '❄️ Scanning';
    logger.info(`[${strategy}] Chain ${this.chainId} | ${status} | ${details}`);
  }
}
