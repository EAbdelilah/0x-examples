
import axios from 'axios';
import logger from './utils/logger';

const CHAINS_TO_CHECK = [
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
];

async function checkApi() {
    logger.info('--- Checking UniswapX API Support ---');

    for (const { id, name } of CHAINS_TO_CHECK) {
        try {
            await axios.get('https://api.uniswap.org/v2/orders', {
                params: { chainId: id, orderStatus: 'open' },
                timeout: 5000
            });
            logger.info(`✅ API Supported for ${name} (${id})`);
        } catch (error: any) {
            if (error.response) {
                logger.warn(`❌ API Failed for ${name} (${id}): Status ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else {
                logger.warn(`❌ API Failed for ${name} (${id}): ${error.message}`);
            }
        }
    }
}

checkApi();
