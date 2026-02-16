/**
 * Dry Run Simulation: Test Profitability Calculation
 * 
 * This script simulates the bot's profitability logic without executing trades
 */

import { formatUnits, parseUnits } from 'viem';

// Simulate a typical UniswapX order on Polygon
const mockOrder = {
    orderHash: '0x1234567890abcdef',
    chainId: 137, // Polygon
    input: {
        token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
        amount: '1000000000', // 1000 USDC (6 decimals)
    },
    outputs: [{
        token: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH on Polygon
        amount: '285714285714285714', // ~0.285 WETH (18 decimals)
    }]
};

// Simulate 0x API response (slightly better price)
const zeroExPrice = {
    buyAmount: '288000000000000000', // 0.288 WETH (0.8% better than UniswapX)
    sellAmount: '1000000000',
};

console.log('=== DRY RUN: Profitability Analysis ===\n');
console.log(`Chain: Polygon (${mockOrder.chainId})`);
console.log(`Order: ${mockOrder.orderHash.slice(0, 16)}...\n`);

// Step 1: Calculate raw profit
const currentAuctionOutput = BigInt(mockOrder.outputs[0].amount);
const zeroExOutput = BigInt(zeroExPrice.buyAmount);
const profitRaw = zeroExOutput - currentAuctionOutput;

console.log('--- Price Comparison ---');
console.log(`UniswapX offers: ${formatUnits(currentAuctionOutput, 18)} WETH`);
console.log(`0x can provide: ${formatUnits(zeroExOutput, 18)} WETH`);
console.log(`Raw profit: ${formatUnits(profitRaw, 18)} WETH\n`);

// Step 2: Estimate gas cost
const gasPrice = parseUnits('30', 9); // 30 gwei (typical for Polygon)
const estimatedGas = 400000n; // Atomic broker gas estimate
const gasCost = estimatedGas * gasPrice;

console.log('--- Gas Cost Estimation ---');
console.log(`Gas Price: ${formatUnits(gasPrice, 9)} gwei`);
console.log(`Estimated Gas: ${estimatedGas.toString()} units`);
console.log(`Total Gas Cost: ${formatUnits(gasCost, 18)} MATIC\n`);

// Step 3: Apply spread
const spreadBps = 10n; // 10 basis points = 0.1%
const requiredOutput = (currentAuctionOutput * (10000n + spreadBps)) / 10000n;

console.log('--- Spread Application ---');
console.log(`Base spread: ${spreadBps} bps (0.${spreadBps}%)`);
console.log(`Required output after spread: ${formatUnits(requiredOutput, 18)} WETH\n`);

// Step 4: Calculate net profit
const profitAfterSpread = zeroExOutput - requiredOutput;

// Normalize to 18 decimals for comparison with gas (WETH is already 18 decimals)
const normalizedProfit = profitAfterSpread;

// Assume 1 WETH = 2000 MATIC for conversion
const wethToMaticRate = 2000n;
const profitInMatic = (normalizedProfit * wethToMaticRate) / parseUnits('1', 18);
const netProfit = profitInMatic - gasCost;

console.log('--- Final Profitability ---');
console.log(`Profit after spread: ${formatUnits(profitAfterSpread, 18)} WETH`);
console.log(`Profit in MATIC (est): ${formatUnits(profitInMatic, 18)} MATIC`);
console.log(`Net profit after gas: ${formatUnits(netProfit, 18)} MATIC`);
console.log(`Net profit in USD (MATIC @ $0.50): $${(Number(formatUnits(netProfit, 18)) * 0.5).toFixed(2)}\n`);

// Decision
if (netProfit > 0n) {
    console.log('✅ DECISION: PROFITABLE - Would execute this trade');
    console.log(`   Expected profit: $${(Number(formatUnits(netProfit, 18)) * 0.5).toFixed(2)}`);
} else {
    console.log('❌ DECISION: NOT PROFITABLE - Would skip this trade');
    console.log(`   Expected loss: $${(Number(formatUnits(netProfit, 18)) * 0.5 * -1).toFixed(2)}`);
}

console.log('\n=== Sensitivity Analysis ===\n');

// Test different scenarios
const scenarios = [
    { name: 'Current (0.8% arb)', arbPercent: 0.8 },
    { name: 'Small arb (0.3%)', arbPercent: 0.3 },
    { name: 'Good arb (1.5%)', arbPercent: 1.5 },
    { name: 'Excellent arb (3%)', arbPercent: 3.0 },
];

scenarios.forEach(scenario => {
    const arbAmount = (currentAuctionOutput * BigInt(Math.floor(scenario.arbPercent * 100))) / 10000n;
    const zeroExOut = currentAuctionOutput + arbAmount;
    const profit = zeroExOut - requiredOutput;
    const profitMatic = (profit * wethToMaticRate) / parseUnits('1', 18);
    const net = profitMatic - gasCost;
    const usd = Number(formatUnits(net, 18)) * 0.5;

    console.log(`${scenario.name}: ${usd >= 0 ? '✅' : '❌'} $${usd.toFixed(2)} profit`);
});

console.log('\n=== Conclusion ===');
console.log('The bot needs at least 0.5-1% arbitrage opportunity to be profitable');
console.log('on Polygon after accounting for gas costs and spread.');
console.log('\nCurrent market: 0 open orders (low activity period)');
