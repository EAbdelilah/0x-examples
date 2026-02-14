import dotenv from 'dotenv';
import { createPublicClient, http } from 'viem';
import { mainnet, base, optimism, arbitrum, bsc, polygon, avalanche, celo, linea, blast, scroll, mantle, mode } from 'viem/chains';
import logger from './utils/logger';

dotenv.config();

async function checkRPCs() {
    logger.info('--- Starting RPC Verification ---');

    const envVars = Object.keys(process.env).filter(key => key.startsWith('RPC_URL_'));

    if (envVars.length === 0) {
        logger.warn('No RPC_URL_[ID] variables found in .env');
        return;
    }

    const results: { chainId: string; status: string; details: string }[] = [];

    for (const key of envVars) {
        const expectedChainId = key.replace('RPC_URL_', '');
        const rpcUrl = process.env[key];

        if (!rpcUrl) {
            results.push({ chainId: expectedChainId, status: '❌ Empty', details: 'URL is missing' });
            continue;
        }

        try {
            const client = createPublicClient({
                transport: http(rpcUrl),
            });

            // 1. Check Connection / Block Number
            const blockNumber = await client.getBlockNumber();

            // 2. Verify Chain ID
            const actualChainId = await client.getChainId();

            if (actualChainId.toString() === expectedChainId) {
                results.push({
                    chainId: expectedChainId,
                    status: '✅ Valid',
                    details: `Block: ${blockNumber}, Latency: Found`
                });
                logger.info(`✅ ${key}: Valid (Chain ${actualChainId}, Block ${blockNumber})`);
            } else {
                results.push({
                    chainId: expectedChainId,
                    status: '⚠️ Mismatch',
                    details: `Found Chain ID ${actualChainId} instead of ${expectedChainId}`
                });
                logger.warn(`⚠️ ${key}: Chain ID mismatch! Expected ${expectedChainId}, got ${actualChainId}`);
            }
        } catch (error: any) {
            results.push({
                chainId: expectedChainId,
                status: '❌ Error',
                details: error.message
            });
            logger.error(`❌ ${key}: Failed - ${error.message}`);
        }
    }

    console.log('\n--- RPC Verification Summary ---');
    console.table(results);
    logger.info('--- Verification Complete ---');
}

checkRPCs().catch(err => {
    logger.error('Critical failure in verification script:', err);
});
