import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

const ERC20_ABI = parseAbi([
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
]);

async function main() {
    const client = createPublicClient({
        chain: base,
        transport: http('https://base-mainnet.g.alchemy.com/v2/onokvlYLhtJtIUSpPcGl9czcNtVp902e'),
    });

    const token = '0xA601877977340862Ca67f816eb079958E5bd0BA3';
    try {
        const [symbol, name, decimals] = await Promise.all([
            client.readContract({ address: token, abi: ERC20_ABI, functionName: 'symbol' }),
            client.readContract({ address: token, abi: ERC20_ABI, functionName: 'name' }),
            client.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }),
        ]);
        console.log(`Token: ${name} (${symbol})`);
        console.log(`Decimals: ${decimals}`);
        console.log(`Address: ${token}`);
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

main();
