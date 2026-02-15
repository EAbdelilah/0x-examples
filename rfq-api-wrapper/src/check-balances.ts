import dotenv from 'dotenv';
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { polygon, arbitrum } from 'viem/chains';
import logger from './utils/logger';
import { CHAINS } from './config/chains';

dotenv.config();

const MM_ADDRESS = process.env.MM_ADDRESS as `0x${string}`;
const ERC20_ABI = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']);

async function checkBalances() {
    logger.info(`--- Checking Balances for ${MM_ADDRESS} ---`);

    const chainsToTest = [
        { config: CHAINS[137], viemChain: polygon, rpc: process.env.RPC_URL_137 },
        { config: CHAINS[42161], viemChain: arbitrum, rpc: process.env.RPC_URL_42161 }
    ];

    for (const { config, viemChain, rpc } of chainsToTest) {
        if (!rpc) {
            logger.warn(` Skipping ${config.name}: RPC_URL_${config.chainId} missing in .env`);
            continue;
        }

        logger.info(`Checking ${config.name}...`);
        const client = createPublicClient({
            chain: viemChain,
            transport: http(rpc),
        });

        try {
            // Gas Balance
            const gasBalance = await client.getBalance({ address: MM_ADDRESS });
            logger.info(`  Gas (${viemChain.nativeCurrency.symbol}): ${formatUnits(gasBalance, 18)}`);

            // Token Balances
            for (const [symbol, address] of Object.entries(config.tokens)) {
                try {
                    const balance = await client.readContract({
                        address: address as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [MM_ADDRESS],
                    });
                    const decimals = await client.readContract({
                        address: address as `0x${string}`,
                        abi: ERC20_ABI,
                        functionName: 'decimals',
                    });
                    logger.info(`  ${symbol}: ${formatUnits(balance, decimals)}`);
                } catch (e: any) {
                    logger.warn(`  Could not fetch balance for ${symbol}: ${e.message}`);
                }
            }
        } catch (error: any) {
            logger.error(` Failed to check ${config.name}: ${error.message}`);
        }
    }
}

checkBalances().catch(console.error);
