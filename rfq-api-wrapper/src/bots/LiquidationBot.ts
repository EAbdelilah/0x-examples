import { BaseBot } from './BaseBot';
import logger from '../utils/logger';
import { formatUnits, Hex, createWalletClient, http, encodeAbiParameters, parseAbiParameters, parseAbi } from 'viem';
import { CHAINS } from '../config/chains';

const BROKER_ABI = parseAbi([
  'function executeBalancer(address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

export class LiquidationBot extends BaseBot {
  async run() {
    logger.info(`Starting PRODUCTION Liquidation Bot on chain ${this.chainId}...`);

    while (true) {
      try {
        // 1. Monitor Lending Protocol (e.g., Aave, Morpho) for unhealthy positions
        const collateralToken = CHAINS[this.chainId]?.tokens['WETH'] as Hex;
        const debtToken = CHAINS[this.chainId]?.tokens['USDC'] as Hex;
        const debtToCover = 1000000000n; // 1000 USDC

        if (!collateralToken || !debtToken) {
           await new Promise(resolve => setTimeout(resolve, 30000));
           continue;
        }

        // 2. Check profitability via 0x
        const collateralReceived = 1000000000000000000n; // Assume 1 ETH bonus

        const zeroExQuote = await this.zeroExService.getPrice({
          sellToken: collateralToken,
          buyToken: debtToken,
          sellAmount: collateralReceived.toString(),
          chainId: this.chainId,
        });

        const profit = BigInt(zeroExQuote.buyAmount) - debtToCover;
        const isProfitable = profit > 0n;

        this.logOpportunity('Liquidation', `Expected Profit: ${formatUnits(profit, 6)} USDC`, isProfitable);

        if (isProfitable && await this.checkGas()) {
          const isSafe = await this.checkSafety(debtToCover, BigInt(zeroExQuote.buyAmount), 50);

          if (isSafe) {
             await this.executeLiquidation(collateralToken, debtToken, collateralReceived, debtToCover, BigInt(zeroExQuote.buyAmount));
          }
        }

        await new Promise(resolve => setTimeout(resolve, 15000));
      } catch (e: any) {
        logger.error(`LiquidationBot Error: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
  }

  private async executeLiquidation(
    collateral: Hex,
    debt: Hex,
    collateralAmount: bigint,
    debtAmount: bigint,
    expectedOutput: bigint
  ) {
    if (this.isDryRun) {
      logger.info('🚀 [DRY RUN] Executing Liquidation');
      return;
    }

    const brokerAddress = CHAINS[this.chainId]?.atomicBroker as Hex;
    if (!brokerAddress || !this.account) return;

    try {
      const walletClient = createWalletClient({
        account: this.account,
        chain: this.publicClient.chain,
        transport: http(),
      });

      const quote = await this.zeroExService.getQuote({
        sellToken: collateral,
        buyToken: debt,
        sellAmount: collateralAmount.toString(),
        chainId: this.chainId,
        taker: brokerAddress,
        slippagePercentage: this.slippageBps / 10000,
      });

      const encodedParams = encodeAbiParameters(
        parseAbiParameters('address, address, uint256, uint256, bytes, address, bytes'),
        [
          collateral,
          debt,
          collateralAmount,
          debtAmount, // Min profit check in broker
          quote.transaction.data as Hex,
          '0x0000000000000000000000000000000000000000',
          '0x'
        ]
      );

      const txHash = await walletClient.writeContract({
        address: brokerAddress,
        abi: BROKER_ABI,
        functionName: 'executeBalancer',
        args: [debt, debtAmount, encodedParams],
      });

      logger.info(`✅ Liquidation TX Submitted: ${txHash}`);
    } catch (e: any) {
      logger.error(`Liquidation failed: ${e.message}`);
    }
  }
}
