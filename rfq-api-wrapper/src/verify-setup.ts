import dotenv from 'dotenv';
import { ZeroExService } from './services/zeroExService';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex, createPublicClient, http } from 'viem';
import logger from './utils/logger';
import { CHAINS } from './config/chains';

dotenv.config();

async function verify() {
    logger.info('--- Comprehensive Setup Verification ---');

    const apiKey = process.env.ZERO_EX_API_KEY;
    if (!apiKey) {
        logger.error('❌ ZERO_EX_API_KEY is missing');
        return;
    }
    logger.info('✅ ZERO_EX_API_KEY is present');

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        logger.error('❌ PRIVATE_KEY is missing');
        return;
    }

    try {
        const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as Hex);
        logger.info(`✅ PRIVATE_KEY is valid. Derived Address: ${account.address}`);

        const mmAddress = process.env.MM_ADDRESS;
        if (mmAddress && account.address.toLowerCase() !== mmAddress.toLowerCase()) {
            logger.warn(`⚠️ Derived address ${account.address} does not match MM_ADDRESS ${mmAddress}`);
        }
    } catch (e) {
        logger.error('❌ PRIVATE_KEY is invalid');
        return;
    }

    const zeroEx = new ZeroExService(apiKey);

    const slippageBps = process.env.SLIPPAGE_BPS || '10';
    logger.info(`✅ SLIPPAGE_BPS is set to ${slippageBps} (0.${parseInt(slippageBps)/10}%)`);

    const chainsToTest = Object.values(CHAINS);

    for (const chain of chainsToTest) {
        try {
            // 1. Test RPC Latency
            const rpcUrl = process.env[`RPC_URL_${chain.chainId}`] || process.env.RPC_URL;
            if (rpcUrl) {
                const client = createPublicClient({ transport: http(rpcUrl) });
                const start = Date.now();
                await client.getBlockNumber();
                const latency = Date.now() - start;

                const isPrivate = rpcUrl.includes('flashbots') || rpcUrl.includes('mev') || rpcUrl.includes('protect');
                const privateStatus = isPrivate ? ' [PRIVATE]' : ' [PUBLIC]';

                logger.info(`✅ RPC Connectivity: ${chain.name} | Latency: ${latency}ms${privateStatus}`);

                if (latency > 500) {
                    logger.warn(`⚠️ High RPC latency for ${chain.name}. Execution may be slow.`);
                }
            }

            // 2. Test 0x API
            const sellToken = chain.tokens.WETH || chain.tokens.weth;
            const buyToken = chain.tokens.USDC || chain.tokens.usdc;

            if (!sellToken || !buyToken) {
                logger.debug(`Skipping ${chain.name} (Missing WETH or USDC in config)`);
                continue;
            }

            await zeroEx.getPrice({
                sellToken,
                buyToken,
                sellAmount: '100000000000000', // 0.0001
                chainId: chain.chainId
            });
            logger.info(`✅ 0x API connectivity successful: ${chain.name} (Chain ${chain.chainId})`);
        } catch (error: any) {
            logger.warn(`⚠️ 0x API connectivity warning: ${chain.name} (Chain ${chain.chainId}): ${error.message}`);
        }
    }

    logger.info('--- Verification Complete ---');
}

verify().catch(err => {
    logger.error('Verification failed:', err);
});
