import { createPublicClient, http, parseAbi, getAddress, formatUnits } from 'viem';
import { base } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

const client = createPublicClient({ chain: base, transport: http(process.env.RPC_URL_8453) });

const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// Broker configured in first '8453' entry
const BROKER_A = '0xb1dd6c8df28f0780d99b23251e869afb66ec2e2f';
// Broker configured in second '8453'-like entry (found at end of chains.ts)
const BROKER_B = '0x4e552d71d25a31c34d756109b31143eaf3896529';

const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);
const ownerAbi = parseAbi(['function owner() view returns (address)']);

async function check() {
    console.log('MM_ADDRESS:', process.env.MM_ADDRESS);
    console.log('---');

    // 1. Check vault bytecode 
    const vaultCode = await client.getBytecode({ address: BALANCER_VAULT as `0x${string}` });
    console.log('Balancer Vault deployed on Base:', vaultCode && vaultCode.length > 2 ? 'YES' : 'NO (!!!)');

    // 2. Check USDC in vault
    const usdcBal = await client.readContract({ address: USDC as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [BALANCER_VAULT as `0x${string}`] }) as bigint;
    console.log('USDC in Balancer Vault:', formatUnits(usdcBal, 6), 'USDC');
    console.log('---');

    // 3. Broker A
    const codeA = await client.getBytecode({ address: BROKER_A as `0x${string}` });
    console.log(`Broker A (0xb1dd) deployed:`, codeA && codeA.length > 2 ? 'YES' : 'NO');
    if (codeA && codeA.length > 2) {
        try {
            const owner = await client.readContract({ address: getAddress(BROKER_A), abi: ownerAbi, functionName: 'owner' });
            console.log('Broker A owner:', owner);
        } catch (e: any) { console.log('Broker A owner err:', e.shortMessage); }
    }

    // 4. Broker B
    const codeB = await client.getBytecode({ address: BROKER_B as `0x${string}` });
    console.log(`Broker B (0x4e55) deployed:`, codeB && codeB.length > 2 ? 'YES' : 'NO');
    if (codeB && codeB.length > 2) {
        try {
            const owner = await client.readContract({ address: getAddress(BROKER_B), abi: ownerAbi, functionName: 'owner' });
            console.log('Broker B owner:', owner);
        } catch (e: any) { console.log('Broker B owner err:', e.shortMessage); }
    }
}

check().catch(console.error).finally(() => process.exit(0));
