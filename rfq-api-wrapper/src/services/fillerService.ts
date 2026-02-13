import axios from 'axios';
import logger from '../utils/logger';
import { ZeroExService } from './zeroExService';
import { Hex, createPublicClient, http } from 'viem';
import { mainnet, base } from 'viem/chains';

export class FillerService {
  private readonly UNISWAPX_API = 'https://api.uniswap.org/v2/orders';
  private ethPriceInBuyToken: Map<string, bigint> = new Map();

  constructor(private zeroExService: ZeroExService) { }

  async monitorUniswapX(chainId: number) {
    logger.info(`Checking UniswapX for filler opportunities on chain ${chainId}...`);

    try {
      const response = await axios.get(this.UNISWAPX_API, {
        params: {
          chainId,
          orderStatus: 'open',
        }
      });

      const orders = response.data.orders || [];
      logger.info(`Found ${orders.length} open UniswapX orders.`);

      for (const order of orders) {
        await this.evaluateAndFill(order, chainId);
      }
    } catch (error: any) {
      logger.error('Error fetching UniswapX orders:', error.message);
    }
  }

  private async evaluateAndFill(order: any, chainId: number) {
    const UNISWAPX_REACTORS: Record<number, string> = {
      1: '0x00000011F84B9aa48e5f8aA8B9897600006289Be',
      8453: '0x000000001Ec5656dcdB24D90DFa42742738De729',
    };

    const reactor = UNISWAPX_REACTORS[chainId];
    if (!reactor) return;

    const sellToken = order.input?.token;
    const sellAmount = order.input?.amount;
    const buyToken = order.outputs?.[0]?.token;
    const buyAmount = order.outputs?.[0]?.amount;

    if (!sellToken || !buyToken || !sellAmount || !buyAmount) {
      return;
    }

    try {
      // 1. Get 0x price for the swap
      const zeroExPrice = await this.zeroExService.getPrice({
        sellToken,
        buyToken,
        sellAmount,
        chainId,
      });

      // 2. Calculate Gas Costs in buyToken units
      const gasPrice = await this.estimateGasPrice(chainId);

      // Safety: Skip if gas is too high (e.g., > 100 Gwei on Mainnet or > 0.1 Gwei on Base)
      const maxGasPrice = chainId === 1 ? 100000000000n : 100000000n;
      if (gasPrice > BigInt(maxGasPrice)) {
        logger.warn(`[Filler] Gas price too high: ${gasPrice.toString()}. Skipping.`);
        return;
      }

      const gasLimit = 250000n;
      const gasCostInWei = gasPrice * gasLimit;

      // Convert gasCostInWei to buyToken units
      const gasCostInBuyToken = await this.convertWeiToToken(gasCostInWei, buyToken, chainId);

      // 3. Profitability Calculation
      const currentAuctionOutput = BigInt(buyAmount);
      const zeroExOutput = BigInt(zeroExPrice.buyAmount);
      const spreadBps = BigInt(process.env.SPREAD_BPS || '0');

      const grossProfit = zeroExOutput - currentAuctionOutput;
      const netProfit = grossProfit - gasCostInBuyToken;

      const minRequiredProfit = (currentAuctionOutput * spreadBps) / 10000n;

      if (netProfit > minRequiredProfit) {
        logger.info(`🔥 Profitable UniswapX Fill! Net Profit: ${netProfit.toString()} ${buyToken} (After ${gasCostInBuyToken.toString()} gas cost)`);
        await this.executeFill(order, chainId);
      } else {
        logger.debug(`[Filler] Order ${order.orderHash} not profitable. Net: ${netProfit.toString()}`);
      }
    } catch (error: any) {
      logger.debug(`[Filler] Evaluation failed for ${order.orderHash}: ${error.message}`);
    }
  }

  private async convertWeiToToken(amountInWei: bigint, tokenAddress: string, chainId: number): Promise<bigint> {
    const NATIVE_ETH = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    if (tokenAddress.toLowerCase() === NATIVE_ETH) return amountInWei;

    try {
        // Fetch price of 0.1 ETH in target token to get a precise conversion rate
        const priceResponse = await this.zeroExService.getPrice({
            sellToken: NATIVE_ETH,
            buyToken: tokenAddress,
            sellAmount: (10n ** 17n).toString(), // 0.1 ETH
            chainId,
        });

        const buyAmountFor01Eth = BigInt(priceResponse.buyAmount);
        // gasCostInToken = (amountInWei * buyAmountFor01Eth) / 0.1 ETH
        return (amountInWei * buyAmountFor01Eth) / (10n ** 17n);
    } catch (error) {
        logger.warn(`Could not fetch ETH price for ${tokenAddress}, using conservative fallback`);
        return amountInWei / 1000n; // Dummy fallback
    }
  }

  private async estimateGasPrice(chainId: number): Promise<bigint> {
    try {
      const client = createPublicClient({
        chain: chainId === 8453 ? base : mainnet,
        transport: http()
      });
      return await client.getGasPrice();
    } catch {
      return 1000000000n;
    }
  }

  private async executeFill(order: any, chainId: number) {
    logger.info(`🚀 EXECUTING FILL: ${order.orderHash}`);
    logger.warn('On-chain execution disabled. Ensure wallet is funded and private key is set.');
  }
}
