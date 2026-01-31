import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import logger from './utils/logger';

dotenv.config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;

async function debugBase() {
    if (!ZERO_EX_API_KEY) {
        logger.error('No API Key found');
        return;
    }

    const zeroEx = new ZeroExService(ZERO_EX_API_KEY);

    const tokens = {
        // Base
        BaseWETH: '0x4200000000000000000000000000000000000006',
        BaseUSDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        BaseUSDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
        NativeETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        // Mainnet
        MainnetWETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        MainnetUSDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    };

    const tests = [
        { name: 'CONTROL: Mainnet WETH -> USDC (1 ETH)', sellToken: tokens.MainnetWETH, buyToken: tokens.MainnetUSDC, amount: '1000000000000000000', chainId: 1 },
        { name: 'TEST: Base Native ETH -> USDC (0.1 ETH)', sellToken: tokens.NativeETH, buyToken: tokens.BaseUSDC, amount: '100000000000000000', chainId: 8453 },
        { name: 'TEST: Base WETH -> USDC (0.1 ETH)', sellToken: tokens.BaseWETH, buyToken: tokens.BaseUSDC, amount: '100000000000000000', chainId: 8453 },
    ];

    logger.info('--- Starting Base Network Price Debug ---');

    for (const t of tests) {
        logger.info(`Testing: ${t.name}`);
        try {
            const price = await zeroEx.getPrice({
                sellToken: t.sellToken,
                buyToken: t.buyToken,
                sellAmount: t.amount,
                chainId: t.chainId,
                // taker: undefined // Explicitly undefined
            });
            logger.info(`✅ SUCCESS: Buy Amount: ${price.buyAmount}`);
        } catch (e: any) {
            logger.error(`❌ FAILED: ${e.message}`);
            if (e.response) {
                logger.error(`Status: ${e.response.status} ${e.response.statusText}`);
                logger.error(`Data: ${JSON.stringify(e.response.data)}`);
            }
        }
        await new Promise(r => setTimeout(r, 1000)); // Rate limit buffer
    }
}

debugBase();
