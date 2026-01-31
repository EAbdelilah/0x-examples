import dotenv from 'dotenv';
import axios from 'axios';
import qs from 'qs';
import logger from './utils/logger';

dotenv.config();

const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;

async function debugBaseAlt() {
    if (!ZERO_EX_API_KEY) {
        logger.error('No API Key found');
        return;
    }

    const baseParams = {
        sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native ETH
        buyToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        sellAmount: '100000000000000000', // 0.1 ETH
        chainId: 8453
    };

    const tests = [
        {
            name: 'V2 via Main Endpoint (api.0x.org + chainId=8453)',
            url: 'https://api.0x.org/swap/permit2/price'
        },
        {
            name: 'V1 via Base Endpoint (base.api.0x.org/swap/v1/price)',
            url: 'https://base.api.0x.org/swap/v1/price'
        }
    ];

    logger.info('--- Starting Base Network Alternative Debug ---');

    for (const t of tests) {
        logger.info(`Testing: ${t.name}`);
        const query = qs.stringify({ ...baseParams, chainId: 8453 }); // Ensure chainId is query for main endpoint
        const url = `${t.url}?${query}`;
        logger.info(`Requesting: ${url}`);

        try {
            const response = await axios.get(url, {
                headers: { '0x-api-key': ZERO_EX_API_KEY }
            });
            logger.info(`✅ SUCCESS: Buy Amount: ${response.data.buyAmount}`);
        } catch (e: any) {
            logger.error(`❌ FAILED: ${e.message}`);
            if (e.response) {
                logger.error(`Status: ${e.response.status}`);
                logger.error(`Data: ${JSON.stringify(e.response.data)}`);
            }
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

debugBaseAlt();
