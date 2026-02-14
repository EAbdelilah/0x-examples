
import axios from 'axios';
import logger from './utils/logger';

const SUPPORTED_CHAINS = [
    { id: 1, name: 'Ethereum' },
    { id: 10, name: 'Optimism' },
    { id: 56, name: 'BSC' },
    { id: 137, name: 'Polygon' },
    { id: 8453, name: 'Base' },
    { id: 42161, name: 'Arbitrum' },
    { id: 43114, name: 'Avalanche' },
    { id: 59144, name: 'Linea' },
    { id: 81457, name: 'Blast' },
    { id: 534352, name: 'Scroll' },
    { id: 130, name: 'Unichain' },
    { id: 250, name: 'Fantom' },
];

async function checkKyberSupport() {
    logger.info('--- Checking KyberSwap Limit Order Support (Partner Endpoint) ---');

    for (const { id: chainId, name } of SUPPORTED_CHAINS) {
        try {
            // Using the read-partner endpoint to fetch pairs. If this returns 200, the chain is supported.
            const url = `https://limit-order.kyberswap.com/read-partner/api/v1/orders/pairs?chainId=${chainId}`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.status === 200 && response.data.code === 0) {
                logger.info(`✅ Supported: ${name} (Chain ${chainId})`);
            } else {
                logger.warn(`❌ Not Supported: ${name} (Chain ${chainId}) - Code: ${response.data?.code}`);
            }
        } catch (error: any) {
            if (error.response && error.response.status === 404) {
                logger.warn(`❌ Not Supported: ${name} (Chain ${chainId}) - 404 Endpoint not found`);
            } else {
                logger.warn(`⚠️ Warning for ${name} (Chain ${chainId}): ${error.message}`);
            }
        }
    }
}

checkKyberSupport();
