import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import { KyberLimitOrderService } from './services/kyberLimitOrderService';
import logger from './utils/logger';
import { CHAINS } from './config/chains';
import { dbService } from './services/database';
import { notifier } from './services/notificationService';
import {
  createPublicClient,
  http,
  formatUnits,
  parseAbi
} from 'viem';
import {
  mainnet,
  base,
  optimism,
  arbitrum,
  bsc,
  polygon
} from 'viem/chains';

dotenv.config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const TICK_INTERVAL = Number(process.env.TICK_INTERVAL || '60000');
const CHAIN_ID = Number(process.env.CHAIN_ID || '8453'); // Default to Base

const chainConfig = CHAINS[CHAIN_ID];
if (!chainConfig) {
  logger.error(`Unsupported CHAIN_ID: ${CHAIN_ID}`);
  process.exit(1);
}

const zeroExService = new ZeroExService(ZERO_EX_API_KEY);
const kyberService = new KyberLimitOrderService(PRIVATE_KEY, zeroExService);

// Define priority pairs to trade
const SELL_TOKENS = ['WETH', 'WBTC'];
const BUY_TOKENS = ['USDC', 'USDT', 'USDB'];

const ERC20_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);

const publicClient = createPublicClient({
  chain: [mainnet, base, optimism, arbitrum, bsc, polygon].find(c => c.id === CHAIN_ID) || base,
  transport: http(),
});

async function tick() {
  logger.info(`--- Maker Bot Tick (${chainConfig.name}) ---`);

  // Check Gas Balance
  const gasBalance = await publicClient.getBalance({ address: kyberService.getAddress() as `0x${string}` });
  if (gasBalance === 0n) {
    logger.warn(`⚠️ Warning: Gas balance is zero for account ${kyberService.getAddress()}`);
  }

  const availablePairs: Array<{ sell: string, buy: string, sellSymbol: string, buySymbol: string }> = [];
  // ... (availablePairs logic same as before) ...
  for (const sellSymbol of SELL_TOKENS) {
    for (const buySymbol of BUY_TOKENS) {
      const sellAddr = chainConfig.tokens[sellSymbol];
      const buyAddr = chainConfig.tokens[buySymbol];
      if (sellAddr && buyAddr && sellAddr !== buyAddr) {
        availablePairs.push({ sell: sellAddr, buy: buyAddr, sellSymbol, buySymbol });
      }
    }
  }

  for (const pair of availablePairs) {
    try {
      // Adjust amount
      let amount = BigInt(process.env.MAKER_AMOUNT || '100000000000000');
      if (pair.sellSymbol === 'WBTC') amount = amount / 1000000000n || 1000n;

      // Check Token Balance
      const balance = await publicClient.readContract({
        address: pair.sell as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [kyberService.getAddress() as `0x${string}`],
      });

      if (balance < amount) {
        logger.warn(`⚠️ Warning: ${pair.sellSymbol}/${pair.buySymbol} has insufficient balance (${formatUnits(balance, 18)} < ${formatUnits(amount, 18)}). Order may be unfillable on-chain.`);
      }

      logger.info(`Creating order for ${pair.sellSymbol} -> ${pair.buySymbol}`);
      const order = await kyberService.createAndPostOrder({
        makerAsset: pair.sell,
        takerAsset: pair.buy,
        makerAmount: amount.toString(),
        chainId: CHAIN_ID,
        expiry: Math.floor(Date.now() / 1000) + 300,
      });

      if (order && order.orderHash) {
        dbService.saveOrder({
          orderHash: order.orderHash,
          chainId: CHAIN_ID,
          maker: kyberService.getAddress(),
          sellToken: pair.sell,
          buyToken: pair.buy,
          sellAmount: amount.toString(),
          buyAmount: '0',
          status: 'pending'
        });
        await notifier.send(`📈 **New RFQ Order Posted (Kyber)**\nChain: ${CHAIN_ID}\nPair: ${pair.sellSymbol}/${pair.buySymbol}\nAmount: ${formatUnits(amount, 18)}`);
      }
    } catch (error: any) {
      logger.error(`Failed to run maker tick for ${pair.sellSymbol}/${pair.buySymbol}:`, error);
      await notifier.notifyError(`Maker Tick (${pair.sellSymbol})`, error.message);
    }
  }
}

async function main() {
  logger.info(`Starting KyberSwap Multi-Token Maker Bot on ${chainConfig.name} (Chain ${CHAIN_ID})...`);

  // Run immediately
  await tick();

  // Set interval for subsequent runs
  setInterval(tick, TICK_INTERVAL);
}

main().catch(err => {
  logger.error('Critical bot error:', err);
  process.exit(1);
});
