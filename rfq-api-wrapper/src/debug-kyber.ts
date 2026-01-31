import axios from 'axios';
import logger from './utils/logger';

const endpoint = 'https://limit-order.kyberswap.com/write/api/v1/orders';

async function debugKyber() {
    logger.info('--- KyberSwap Structure Debug ---');

    const variations = [
        {
            name: 'Nested Order (camelCase)',
            payload: {
                chainId: '137',
                order: { makerAsset: '0x...', makerAmount: '1000' }
            }
        },
        {
            name: 'Nested Order (PascalCase)',
            payload: {
                chainId: '137',
                order: { MakerAsset: '0x...', MakerAmount: '1000' } // If keys need to be Caps
            }
        },
        {
            name: 'Flat (PascalCase)',
            payload: {
                chainId: '137',
                MakerAsset: '0x...',
                MakerAmount: '1000'
            }
        },
        {
            name: 'Flat (camelCase)',
            payload: {
                chainId: '137',
                makerAsset: '0x...',
                makerAmount: '1000'
            }
        }
    ];

    for (const v of variations) {
        try {
            const response = await axios.post(endpoint, v.payload);
            logger.info(`[${v.name}] Status: ${response.status}`);
        } catch (e: any) {
            if (e.response) {
                logger.info(`[${v.name}] Status: ${e.response.status} - Msg: ${JSON.stringify(e.response.data)}`);
            } else {
                logger.error(`[${v.name}] Error: ${e.message}`);
            }
        }
    }
}

debugKyber();
