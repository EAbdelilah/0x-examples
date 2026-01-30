import axios from 'axios';
import logger from '../utils/logger';
import { ZeroExService } from './zeroExService';
import { Hex } from 'viem';

export class FillerService {
  private readonly UNISWAPX_API = 'https://api.uniswap.org/v2/orders';

  constructor(private zeroExService: ZeroExService) {}

  /**
   * Functional logic for a UniswapX Filler
   */
  async monitorUniswapX(chainId: number) {
    logger.info(`Checking UniswapX for filler opportunities on chain ${chainId}...`);

    try {
      // 1. Fetch open orders from UniswapX API
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
        1: '0x00000011F84B9aa48e5f8aA8B9897600006289Be', // V2 Dutch Order Reactor
        8453: '0x000000001Ec5656dcdB24D90DFa42742738De729', // Priority Order Reactor
    };

    const reactor = UNISWAPX_REACTORS[chainId];
    if (!reactor) return;

    const { encodedOrder, orderStatus } = order;

    // Simplified evaluation logic
    // In a real filler, you would decode the EIP-712 order to get tokens and amounts
    // and calculate the current price based on the Dutch Auction decay.

    const sellToken = order.sellToken;
    const buyToken = order.buyToken;
    const sellAmount = order.sellAmount; // Amount user is selling

    try {
      // 2. Fetch 0x quote to see if we can cover this order
      const zeroExPrice = await this.zeroExService.getPrice({
        sellToken,
        buyToken,
        sellAmount,
        taker: '0x0000000000000000000000000000000000000000', // We are the filler
        chainId,
      });

      const currentAuctionOutput = BigInt(order.currentOutputs[0].amount);
      const zeroExOutput = BigInt(zeroExPrice.buyAmount);

      // 3. Profitability check: zeroExOutput - currentAuctionOutput > GasCost
      // For this example, we'll assume a fixed gas cost or just check if 0x is better.
      if (zeroExOutput > currentAuctionOutput) {
        logger.info(`Profitable opportunity found! 0x: ${zeroExOutput}, UniswapX: ${currentAuctionOutput}`);

        // 4. Submit filler transaction to the UniswapX Reactor contract
        // This requires the Filler's private key and calling the Reactor contract.
        this.executeFill(order);
      }
    } catch (error: any) {
      // Common if 0x doesn't have a route or price is worse
      logger.debug(`Order not profitable or no route: ${error.message}`);
    }
  }

  private executeFill(order: any) {
    // Logic to sign and send transaction to UniswapX Reactor
    logger.info(`Executing fill for order ${order.orderHash} on-chain...`);

    /**
     * IN PRODUCTION:
     * 1. Decode the encodedOrder to ensure it hasn't changed.
     * 2. Construct the transaction for the Reactor contract.
     * 3. Submit using your filler's wallet.
     *
     * Example with viem:
     * await walletClient.writeContract({
     *   address: reactorAddress,
     *   abi: reactorAbi,
     *   functionName: 'execute',
     *   args: [order.encodedOrder, order.signature]
     * });
     */
    logger.warn('On-chain execution requires a funded wallet and Reactor contract ABI.');
  }

  /**
   * CoW Swap Solver (Keep as skeleton as it requires specific solver whitelisting)
   */
  async monitorCoWSwap() {
    logger.info('Monitoring CoW Swap for solver opportunities...');
    logger.warn('CoW Swap Solver requires being whitelisted in the CoW Protocol Solver Competition.');
  }
}
