import axios from 'axios';
import logger from './utils/logger';

const endpoint = 'https://limit-order.kyberswap.com/write/api/v1/orders/sign-message';

async function debugKyberSign() {
    logger.info('--- KyberSwap Sign Message Debug ---');

    const payload = {
        "chainId": "137",
        "maker": "0x518634753C61342298c3E04326056b3Ce596a566", // My Derived Address
        "makerAsset": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
        "takerAsset": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
        "makingAmount": "10000000000000000", // 0.01 WETH
        "takingAmount": "27000000000000000000", // 27 DAI
        "expiredAt": Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };

    try {
        const response = await axios.post(endpoint, payload);
        logger.info(`Status: ${response.status}`);
        logger.info(`Response Data: ${JSON.stringify(response.data, null, 2)}`);
    } catch (e: any) {
        if (e.response) {
            logger.info(`Status: ${e.response.status} - Msg: ${JSON.stringify(e.response.data)}`);
        } else {
            logger.error(`Error: ${e.message}`);
        }
    }
}

debugKyberSign();
