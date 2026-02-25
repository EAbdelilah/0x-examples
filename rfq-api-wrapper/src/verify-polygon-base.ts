import dotenv from 'dotenv';
import { createPublicClient, http, formatEther } from 'viem';
import { polygon, base } from 'viem/chains';
import logger from './utils/logger.js';

dotenv.config();

async function verify() {
    const MM_ADDRESS = process.env.MM_ADDRESS as `0x${string}`;
    const chains = [
        { id: 137, name: 'Polygon', viemChain: polygon },
        { id: 8453, name: 'Base', viemChain: base }
    ];

    logger.info('--- RPC and Balance Verification ---');

    for (const chain of chains) {
        const rpcUrl = process.env[`RPC_URL_${chain.id}`];
        if (!rpcUrl) {
            logger.error(`❌ No RPC URL found for ${chain.name} (${chain.id})`);
            continue;
        }

        try {
            const client = createPublicClient({
                chain: chain.viemChain,
                transport: http(rpcUrl)
            });

            const blockNumber = await client.getBlockNumber();
            logger.info(`✅ ${chain.name} RPC is responsive. Current block: ${blockNumber}`);

            if (MM_ADDRESS) {
                const balance = await client.getBalance({ address: MM_ADDRESS });
                const symbol = chain.id === 137 ? 'POL/MATIC' : 'ETH';
                logger.info(`💰 ${chain.name} Wallet Balance (${MM_ADDRESS}): ${formatEther(balance)} ${symbol}`);
            } else {
                logger.warn(`⚠️ MM_ADDRESS not configured, skipping balance check for ${chain.name}`);
            }
        } catch (error: any) {
            logger.error(`❌ Error connecting to ${chain.name}: ${error.message}`);
        }
    }
}

verify();
