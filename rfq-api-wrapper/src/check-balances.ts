import dotenv from 'dotenv';
import { createPublicClient, http, formatUnits, parseAbi } from 'viem';
import { polygon, base } from 'viem/chains';
import logger from './utils/logger';
import { CHAINS } from './config/chains';

dotenv.config();

const MM_ADDRESS = process.env.MM_ADDRESS as `0x${string}`;
const ERC20_ABI = parseAbi(['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)']);

async function checkBalances() {
    logger.info(`--- Checking Balances for ${MM_ADDRESS} ---`);

    const chainsToTest = [
        { id: 137, viemChain: polygon },
        { id: 8453, viemChain: base }
    ];

    for (const { id, viemChain } of chainsToTest) {
        const config = CHAINS[id];
        const rpc = process.env[`RPC_URL_${id}`];

        if (!rpc) {
            logger.warn(` Skipping ${config.name}: RPC_URL_${id} missing in .env`);
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
            const tokensToCheck = ['USDC', 'WETH', 'USDT', 'WBTC'];
            for (const symbol of tokensToCheck) {
                const address = config.tokens[symbol];
                if (!address) continue;

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
                    if (balance > 0n) {
                        logger.info(`  ${symbol}: ${formatUnits(balance, decimals)}`);
                    }
                } catch (e: any) {
                    // logger.warn(`  Could not fetch balance for ${symbol}: ${e.message}`);
                }
            }
        } catch (error: any) {
            logger.error(` Failed to check ${config.name}: ${error.message}`);
        }
    }
}

checkBalances().catch(console.error);
