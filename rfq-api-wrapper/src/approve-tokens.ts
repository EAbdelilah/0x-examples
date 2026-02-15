
import dotenv from 'dotenv';
import axios from 'axios';
import {
    createPublicClient,
    createWalletClient,
    http,
    parseAbi,
    formatUnits,
    Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, optimism, bsc, polygon, base, arbitrum, linea, scroll, avalanche, fantom, blast } from 'viem/chains';
import { CHAINS } from './config/chains';
import logger from './utils/logger';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    logger.error('❌ PRIVATE_KEY is missing');
    process.exit(1);
}

const account = privateKeyToAccount(`0x${PRIVATE_KEY.replace('0x', '')}` as Hex);

// Map chainId to viem chains
const chainMap: Record<number, any> = {
    1: mainnet,
    10: optimism,
    56: bsc,
    137: polygon,
    250: fantom,
    8453: base,
    42161: arbitrum,
    43114: avalanche,
    59144: linea,
    81457: blast,
    534352: scroll,
    130: { id: 130, name: 'Unichain', network: 'unichain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.unichain.org'] }, public: { http: ['https://mainnet.unichain.org'] } } },
};

async function getSpenderAddress(chainId: number): Promise<string | null> {
    try {
        const url = `https://limit-order.kyberswap.com/read-ks/api/v1/configs/contract-address?chainId=${chainId}`;
        const response = await axios.get(url);
        if (response.data && response.data.data && response.data.data.latest) {
            return response.data.data.latest;
        }
    } catch (error) {
        logger.warn(`Failed to fetch spender for chain ${chainId}`);
    }
    return null;
}

const ERC20_ABI = parseAbi([
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
]);

async function approveTokens() {
    logger.info(`--- Approving Tokens for Maker Bot (${account.address}) ---`);

    // Get chains from config
    // Prioritize Polygon (137) and Arbitrum (42161)
    const priorityChains = [137, 42161];
    const otherChains = Object.values(CHAINS).filter(c => !priorityChains.includes(c.chainId)).map(c => c.chainId);
    const sortedChainIds = [...priorityChains, ...otherChains];

    for (const chainId of sortedChainIds) {
        const chainConfig = CHAINS[chainId];
        if (!chainConfig) continue;

        const chain = chainMap[chainId];

        if (!chain) {
            logger.warn(`Skipping Chain ${chainId} (Not configured in script map)`);
            continue;
        }

        const spender = await getSpenderAddress(chainId);
        if (!spender) {
            logger.error(`❌ Could not find KyberSwap Spender for ${chainConfig.name} (${chainId})`);
            continue;
        }

        logger.info(`Checking approval for ${chainConfig.name} (Spender: ${spender})`);

        const publicClient = createPublicClient({ chain, transport: http() });
        const walletClient = createWalletClient({ account, chain, transport: http() });

        const tokensToApprove = [
            chainConfig.tokens.WETH,
            chainConfig.tokens.USDC,
            chainConfig.tokens.USDT,
            chainConfig.tokens.WBTC,
            chainConfig.tokens.USDB // Blast specific
        ].filter(t => t); // Filter undefined

        for (const tokenAddress of tokensToApprove) {
            if (!tokenAddress) continue;

            try {
                // 1. Check Allowance
                const allowance = await publicClient.readContract({
                    address: tokenAddress as Hex,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [account.address, spender as Hex]
                });

                // 2. Get Symbol (for logging)
                const symbol = await publicClient.readContract({
                    address: tokenAddress as Hex,
                    abi: ERC20_ABI,
                    functionName: 'symbol'
                }).catch(() => 'TOKEN');

                if (allowance < BigInt('1000000000000000000000')) { // Check if < large amount
                    logger.info(`Approving ${symbol} on ${chainConfig.name}...`);

                    const hash = await walletClient.writeContract({
                        chain,
                        address: tokenAddress as Hex,
                        abi: ERC20_ABI,
                        functionName: 'approve',
                        args: [spender as Hex, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')], // Max Uint256
                    });

                    logger.info(`✅ Approved ${symbol}: ${hash}`);

                    // Optional: Wait for confirmation to avoid nonce issues if running sequentially strictly
                    await publicClient.waitForTransactionReceipt({ hash });
                } else {
                    logger.info(`✅ ${symbol} already approved`);
                }

            } catch (error: any) {
                logger.error(`Failed to approve ${tokenAddress} on ${chainConfig.name}: ${error.message}`);
            }
        }
    }
}

approveTokens().catch(console.error);
