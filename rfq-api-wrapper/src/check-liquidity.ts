/**
 * Check WETH balance in Balancer vault on Base + verify the broker contract
 */
import {
    createPublicClient, http, parseAbi, getAddress, formatEther
} from 'viem';
import { base } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

const client = createPublicClient({ chain: base, transport: http(process.env.RPC_URL_8453) });

const BALANCER_VAULT = getAddress('0xBA12222222228d8Ba445958a75a0704d566BF2C8');
const WETH_BASE = getAddress('0x4200000000000000000000000000000000000006');
const USDC_BASE = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const BROKER = getAddress('0xb1dd6c8df28f0780d99b23251e869afb66ec2e2f');
const MM = getAddress('0x518634753C61342298c3E04326056b3Ce596a566');

const ERC20_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);
const OWNABLE_ABI = parseAbi(['function owner() view returns (address)']);

async function main() {
    // 1. Check Balancer vault WETH balance
    const wethBalance = await client.readContract({ address: WETH_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [BALANCER_VAULT] });
    const usdcBalance = await client.readContract({ address: USDC_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [BALANCER_VAULT] });

    console.log('=== Balancer Vault Balances on Base ===');
    console.log(`WETH: ${formatEther(wethBalance)} WETH`);
    console.log(`USDC: ${(Number(usdcBalance) / 1e6).toFixed(2)} USDC`);

    // 2. Verify broker ownership
    try {
        const brokerOwner = await client.readContract({ address: BROKER, abi: OWNABLE_ABI, functionName: 'owner' });
        console.log(`\n=== Broker Info ===`);
        console.log(`Owner: ${brokerOwner}`);
        console.log(`MM:    ${MM}`);
        console.log(`Owner matches MM: ${brokerOwner.toLowerCase() === MM.toLowerCase()}`);
    } catch (e: any) {
        console.log(`Broker owner check failed: ${e.message}`);
    }

    // 3. Check broker WETH balance
    const brokerWeth = await client.readContract({ address: WETH_BASE, abi: ERC20_ABI, functionName: 'balanceOf', args: [BROKER] });
    console.log(`\nBroker WETH balance: ${formatEther(brokerWeth)} WETH`);

    // 4. Try to get bytecode to confirm broker is deployed
    const code = await client.getBytecode({ address: BROKER });
    console.log(`Broker deployed: ${code && code !== '0x' ? 'YES' : 'NO'} (bytecode length: ${code ? code.length : 0})`);
}

main().catch(console.error).finally(() => process.exit(0));
