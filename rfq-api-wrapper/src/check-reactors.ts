
import { createPublicClient, http } from 'viem';
import { mainnet, optimism, bsc, polygon, base, arbitrum, linea, scroll, blast, avalanche } from 'viem/chains';
import logger from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const CANDIDATE_REACTORS: Record<string, string> = {
    'V2_DUTCH': '0x00000011F84B9aa48e5f8aA8B9897600006289Be',
    'EXCLUSIVE_DUTCH': '0x6000da47483062A0D734Ba3dc7576Ce6A0B645C4',
    'DUTCH_V3_ARB': '0xB274d5F4b833b61B340b654d600A864fB604a87c',
    'BASE_PRIORITY': '0x000000001Ec5656dcdB24D90DFa42742738De729',
    'BSC_CURRENT': '0xDB9D365b50E62fce747A90515D2bd1254A16EbB9', // From config
};

const CHAINS_TO_CHECK = [
    { chain: mainnet, name: 'Ethereum' },
    { chain: optimism, name: 'Optimism' },
    { chain: bsc, name: 'BSC' },
    { chain: polygon, name: 'Polygon' },
    { chain: base, name: 'Base' },
    { chain: arbitrum, name: 'Arbitrum' },
    { chain: linea, name: 'Linea' },
    { chain: scroll, name: 'Scroll' },
    { chain: blast, name: 'Blast' },
    { chain: avalanche, name: 'Avalanche' },
];

async function checkReactors() {
    logger.info('--- Checking Reactor Deployments ---');

    for (const { chain, name } of CHAINS_TO_CHECK) {
        const client = createPublicClient({
            chain,
            transport: http(),
        });

        logger.info(`Checking ${name} (${chain.id})...`);

        for (const [label, address] of Object.entries(CANDIDATE_REACTORS)) {
            try {
                const code = await client.getBytecode({ address: address as `0x${string}` });
                if (code) {
                    logger.info(`  ✅ ${label} FOUND at ${address}`);
                } else {
                    // logger.debug(`  ❌ ${label} not found`);
                }
            } catch (error: any) {
                logger.warn(`  Instance check failed for ${label}: ${error.message}`);
            }
        }
    }
}

checkReactors().catch(console.error);
