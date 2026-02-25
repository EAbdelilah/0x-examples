import dotenv from 'dotenv';
import { createPublicClient, http, parseAbi } from 'viem';
import { polygon, base } from 'viem/chains';
import { CHAINS } from './config/chains';

dotenv.config();

const MM_ADDRESS = process.env.MM_ADDRESS;

async function verifyOwnership() {
    console.log(`Checking ownership for wallet: ${MM_ADDRESS}`);

    const chains = [
        { id: 137, chain: polygon },
        { id: 8453, chain: base }
    ];

    const abi = parseAbi(['function owner() view returns (address)']);

    for (const { id, chain } of chains) {
        const rpc = process.env[`RPC_URL_${id}`];
        if (!rpc) {
            console.log(`[${chain.name}] RPC_URL_${id} missing`);
            continue;
        }

        const client = createPublicClient({ chain, transport: http(rpc) });
        const broker = (CHAINS as any)[id].atomicBroker;

        try {
            const owner = await client.readContract({ address: broker, abi, functionName: 'owner' });
            const isOwner = owner.toLowerCase() === MM_ADDRESS?.toLowerCase();
            console.log(`[${chain.name}] Broker: ${broker}`);
            console.log(`[${chain.name}] Owner:  ${owner} ${isOwner ? '✅ (MATCHES)' : '❌ (MISMATCH)'}`);
        } catch (e: any) {
            console.log(`[${chain.name}] Error: ${e.message}`);
        }
    }
}

verifyOwnership().catch(console.error);
