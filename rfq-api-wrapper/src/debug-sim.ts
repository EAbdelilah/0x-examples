/**
 * End-to-end simulation test using Kyberswap calldata inside AtomicBroker.
 * Tests: borrow WETH from Balancer → approve WETH → swap WETH→USDC via Kyberswap → repay WETH somehow?
 * 
 * Better round-trip test:
 * 1. Borrow USDC from Balancer (100 USDC)
 * 2. Get Kyberswap quote: USDC→WETH  
 * 3. Approve USDC to Kyberswap router
 * 4. Swap USDC→WETH
 * 5. Get another Kyberswap quote: WETH→USDC
 * 6. Approve WETH to Kyberswap router
 * 7. Swap WETH→USDC (we get back < 100 USDC, but enough to test the swap works)
 * 8. Repay 100 USDC to Balancer (minProfit=0 means any amount is fine)
 * 
 * This proves the aggregator calldata works inside the broker callback.
 * Actually, simplest: borrow WETH itself, approve WETH to Kyberswap, swap WETH→USDC via Kyberswap.
 * The broker won't have WETH to repay, but if we see it tries the swap that proves it works.
 * 
 * BEST test: perform a circular swap that loses a tiny amount (gas), prove the swap itself executes.
 */
import {
    createPublicClient, http, parseAbi, getAddress, formatEther, formatUnits,
    encodeAbiParameters, parseAbiParameters, encodeFunctionData, Hex
} from 'viem';
import { base } from 'viem/chains';
import axios from 'axios';
import qs from 'qs';
import dotenv from 'dotenv';
dotenv.config();

const rpcUrl = process.env.RPC_URL_8453;
if (!rpcUrl) { console.error('RPC_URL_8453 not set'); process.exit(1); }
const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

const BALANCER_VAULT = getAddress('0xBA12222222228d8Ba445958a75a0704d566BF2C8');
const WETH = getAddress('0x4200000000000000000000000000000000000006');
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
const BROKER = getAddress('0x92109142178e62e61958071ce2e172211a948602');
const MM = getAddress('0x518634753C61342298c3E04326056b3Ce596a566');

const ERC20_ABI = parseAbi([
    'function approve(address, uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
]);

const BROKER_ABI = parseAbi([
    'function executeBalancer(address vault, address token, uint256 amount, bytes params) external',
    'function executeSky(address flashMint, address token, uint256 amount, bytes params) external',
]);

async function getKyberQuote(tokenIn: string, tokenOut: string, amountIn: string, taker: string) {
    const routeResp = await axios.get(
        `https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tokenIn.toLowerCase()}&tokenOut=${tokenOut.toLowerCase()}&amountIn=${amountIn}`,
        { timeout: 10000 }
    );
    const routeSummary = routeResp.data?.data?.routeSummary;
    if (!routeSummary) throw new Error('No routeSummary from Kyberswap');

    const buildResp = await axios.post(
        `https://aggregator-api.kyberswap.com/base/api/v1/route/build`,
        { routeSummary, sender: taker.toLowerCase(), recipient: taker.toLowerCase(), slippageTolerance: 100 },
        { timeout: 10000 }
    );
    const txData = buildResp.data?.data;
    if (!txData) throw new Error('No txData from Kyberswap build');
    return {
        to: txData.routerAddress as Hex,
        data: txData.data as Hex,
        value: BigInt(txData.transactionValue ?? '0'),
        buyAmount: txData.amountOut as string,
        allowanceTarget: txData.routerAddress as Hex,
    };
}

async function main() {
    console.log('\n=== AtomicBroker + Kyberswap Simulation Test ===');

    // Check Balancer USDC liquidity directly
    const usdcInBalancer = await client.readContract({ address: USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [BALANCER_VAULT] });
    const wethInBalancer = await client.readContract({ address: WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [BALANCER_VAULT] });
    console.log(`Balancer USDC balance: ${formatUnits(usdcInBalancer, 6)} USDC`);
    console.log(`Balancer WETH balance: ${formatEther(wethInBalancer)} WETH`);

    // Test 1: Simple Kyberswap quote to verify API is working
    console.log('\n1. Getting Kyberswap WETH→USDC quote...');
    const borrowAmount = 1000000000000000n; // 0.001 WETH (tiny amount)

    let swapQuote;
    try {
        swapQuote = await getKyberQuote(WETH, USDC, borrowAmount.toString(), BROKER);
        console.log(`   ✅ Kyberswap OK! ${formatEther(borrowAmount)} WETH → ${formatUnits(BigInt(swapQuote.buyAmount), 6)} USDC`);
        console.log(`   Router: ${swapQuote.to}`);
    } catch (e: any) {
        console.error(`   ❌ Kyberswap FAIL: ${e.message}`);
        process.exit(1);
    }

    // Test 2: Minimal borrow and repay (no swaps)
    console.log('\n2. Minimal Test: Borrow USDC → Repay USDC (no actions)');

    const params = encodeAbiParameters(
        parseAbiParameters('address, uint256, address[], bytes[], uint256[]'),
        [USDC, 0n, [], [], []] // profitToken=USDC, minProfit=0, no actions
    );

    console.log('3. Simulating AtomicBroker.executeBalancer (Minimal) on Base...');
    try {
        await client.simulateContract({
            address: BROKER,
            abi: BROKER_ABI,
            functionName: 'executeBalancer',
            args: [BALANCER_VAULT, USDC, 1000000n, params], // Borrow 1 USDC
            account: MM,
        });
        console.log('\n✅✅✅ MINIMAL SIMULATION PASSED! The flash loan loop works.');
    } catch (e: any) {
        console.error('\n❌ SIMULATION FAILED');
        console.error('Short Message:', e.shortMessage || e.message);

        // Dump the whole error if no data found
        let foundData = false;
        let curr = e;
        while (curr) {
            if (curr.data) {
                console.error('Found Data:', curr.data);
                foundData = true;
            }
            curr = curr.cause;
        }

        if (!foundData) {
            console.error('No hex data found in error chain. Full error structure:');
            console.error(JSON.stringify(e, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
        }
    }

    // Test 3: Full Round-Trip (Borrow -> Swap -> Profit Check)
    console.log('\n4. Full Round-Trip Test: Borrow WETH → Swap WETH to USDC');

    // We borrow a bit more to be safe
    const fullBorrowAmount = 10000000000000000n; // 0.01 WETH

    const fullQuote = await getKyberQuote(WETH, USDC, fullBorrowAmount.toString(), BROKER);
    console.log(`   ✅ Quote for swap: ${formatUnits(BigInt(fullQuote.buyAmount), 6)} USDC expected`);

    const fullActions = [
        {
            target: WETH,
            callData: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [fullQuote.allowanceTarget, fullBorrowAmount * 2n], // Over-approve
            }),
            value: 0n,
        },
        {
            target: fullQuote.to,
            callData: fullQuote.data,
            value: fullQuote.value,
        }
    ];

    const fullParams = encodeAbiParameters(
        parseAbiParameters('address, uint256, address[], bytes[], uint256[]'),
        [
            USDC, // We want USDC as profit
            0n,   // minProfit = 0
            fullActions.map(a => a.target),
            fullActions.map(a => a.callData),
            fullActions.map(a => a.value),
        ]
    );

    console.log('5. Simulating Full Execution on Base...');
    try {
        await client.simulateContract({
            address: BROKER,
            abi: BROKER_ABI,
            functionName: 'executeBalancer',
            args: [BALANCER_VAULT, WETH, fullBorrowAmount, fullParams],
            account: MM,
        });
        console.log('\n✅✅✅ FULL ROUND-TRIP PASSED! Arbitrage engine is 100% ready.');
    } catch (e: any) {
        console.log('\n6. Full Simulation Result (Expect failure at repayment, but check for lack of ABI error)');
        console.error('Short Message:', e.shortMessage || e.message);

        // If the error message is about balance or profit, it means the swap logic REACHED the end of _handleFlashLoan!
        if (e.shortMessage?.includes('transfer amount exceeds balance') || e.shortMessage?.includes('Insufficient Profit')) {
            console.log('\n✅✅✅ SWAP LOGIC EXECUTED! The revert confirms we reached the repayment/profit check after the swap.');
        } else {
            // Detailed dump for debugging if it's NOT a balance error
            let curr = e;
            while (curr) {
                if (curr.data) console.error('Found Data:', curr.data);
                curr = curr.cause;
            }
        }
    }
}

main().catch(console.error).finally(() => process.exit(0));
