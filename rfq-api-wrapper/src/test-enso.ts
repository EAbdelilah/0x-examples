import axios from 'axios';
import logger from './utils/logger';

async function testEnso() {
    logger.info('--- Starting Enso Finance Adapter Test ---');

    const baseUrl = 'http://localhost:3000/quote/enso';
    const testCases = [
        {
            name: 'Ethereum Mainnet (WETH -> USDC)',
            params: {
                fromToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                toToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                amount: '1000000000000000000', // 1 WETH
                chainId: 1
            }
        },
        {
            name: 'Base (WETH -> USDC)',
            params: {
                fromToken: '0x4200000000000000000000000000000000000006',
                toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                amount: '100000000000000', // 0.0001 WETH
                chainId: 8453
            }
        },
        {
            name: 'Monad (WMON -> USDC)',
            params: {
                fromToken: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
                toToken: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
                amount: '100000000000000000', // 0.1 WMON
                chainId: 143
            }
        }
    ];

    for (const test of testCases) {
        logger.info(`Testing ${test.name}...`);
        try {
            const response = await axios.get(baseUrl, { params: test.params });
            logger.info(`✅ Success: ${JSON.stringify(response.data)}`);
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            logger.error(`❌ Failed: ${JSON.stringify(errorData)}`);
        }
    }

    logger.info('--- Enso Finance Test Complete ---');
}

testEnso().catch(console.error);
