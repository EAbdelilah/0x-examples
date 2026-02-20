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
