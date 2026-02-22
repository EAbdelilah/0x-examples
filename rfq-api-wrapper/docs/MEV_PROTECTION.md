# MEV Protection Guide for 0x Strategies

When executing arbitrage or liquidation strategies, your greatest threat is **MEV (Maximal Extractable Value)**. Searchers running sophisticated bots scan the public mempool for profitable transactions and attempt to "sandwich" or front-run them.

## Why You Need Protection
If you submit a trade to the public mempool:
1. **Front-running**: A searcher sees your trade and submits the same trade with a higher gas fee to be included before you.
2. **Sandwiching**: A searcher buys the asset before you (pushing the price up), lets you buy at the higher price, and then sells immediately after you.

## How to Protect Your Strategy

### 1. Use Private RPCs (The Most Important Step)
Private RPCs send your transaction directly to builders, bypassing the public mempool.

| Network | Recommended Private RPC |
| :--- | :--- |
| **Ethereum** | [Flashbots Protect](https://docs.flashbots.net/flashbots-protect/overview) |
| **Base** | [Nethermind](https://docs.nethermind.io/) / [Flashbots](https://docs.flashbots.net/) |
| **Polygon** | [FastLane](https://www.fastlane.finance/) |
| **Arbitrum** | Arbitrum has a sequencer that provides native FCFS (First-Come, First-Served) protection, but MEV still exists in bundles. |

### 2. Set Tight Slippage Limits
In your 0x API calls, always specify a `slippagePercentage`.
- **Reference**: Our `ZeroExService` defaults to 1% slippage. For production arb, consider **0.1% to 0.5%**.

### 3. Use Atomic Reverts
The `AtomicBroker.sol` implementation uses `require(success)` for every step. If a searcher manages to front-run you and the price moves such that your trade is no longer profitable, the transaction will **revert**.
- **Benefit**: You only lose the gas fee, not the principal capital.

### 4. Implementation in code
When initializing your `BaseBot`, use the private RPC URL in your `.env`:

```bash
# .env
RPC_URL_1=https://rpc.flashbots.net  # Ethereum Private RPC
RPC_URL_8453=https://...             # Base Private RPC
```

## Summary
Never run a profitable arbitrage strategy on the public mempool. The cost of a private RPC is usually $0 or a small subscription, but the cost of being "sandwiched" is 100% of your strategy's Alpha.

---

## 🔒 Technical Security Proof: Are these bots secure?

Yes, the 0x Strategy Suite implements a **Defense-in-Depth** model with 4 independent layers of security.

### Layer 1: Operational Security (Private RPCs)
By using `RPC_URL` endpoints like Flashbots Protect, your transactions are hidden from the public mempool.
- **Effect**: MEV bots cannot even see your trade to attempt a front-run or sandwich.

### Layer 2: Atomic Guard (Smart Contract)
The `AtomicBroker.sol` contract includes a strict profit verification check:
```solidity
uint256 profit = IERC20(params.buyToken).balanceOf(address(this));
require(profit >= params.minBuyAmount, "Insufficient Profit");
```
- **Effect**: If the price moves against you (e.g. by a front-run), the transaction **reverts atomically**. Your principal capital is never at risk because the flash loan is only repaid if the profit check passes.

### Layer 3: Slippage Protection (0x API v2)
Every execution call specifies a `slippagePercentage` (configurable via `SLIPPAGE_BPS`).
- **Effect**: The 0x swap leg will fail on-chain if the execution price deviates beyond your limit, triggering the Layer 2 Atomic Revert.

### Layer 4: Capital Risk Mitigation (Flash Loans)
By utilizing 0% fee flash loans (Balancer, Sky, Uni v4), you execute trades with **zero upfront capital**.
- **Effect**: In the worst-case scenario (a reverted transaction), you only lose the gas fee. Your main wallet balance remains untouched.

### Summary of Protections
| Threat | Mitigation | Layer |
| :--- | :--- | :--- |
| **Sandwich Attack** | Private RPC + Atomic Revert | 1 & 2 |
| **Front-running** | Private RPC | 1 |
| **Price Volatility** | Slippage Limits | 3 |
| **Smart Contract Risk**| Atomic Revert + 0% Flash | 2 & 4 |

---

## 📍 Strategy-Specific Hardening: Spatial Arbitrage

Spatial Arbitrage is particularly sensitive to **latency** and **sandwich attacks**.

1.  **Strict minBuyAmount**: Our `SpatialArbBot` calculates the exact output required to repay the flash loan + 10 bps profit. This is passed into the `AtomicBroker`. If an MEV bot sandwiches the "Buy Low" leg, the `minBuyAmount` check will fail and the TX will revert.
2.  **Price Staleness Check**: 0x quotes include an expiration. The bot will never attempt to execute a quote that is more than 60 seconds old.
3.  **Private RPC Priority**: For Spatial Arb, we recommend setting a higher `maxPriorityFeePerGas` (handled by our `TransactionMonitor`) to ensure your private bundle is picked up by the very first available builder.
