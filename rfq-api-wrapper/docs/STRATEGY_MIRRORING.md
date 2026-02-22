# Strategy Detail: Atomic Liquidity Mirroring (Zero-Capital XEMM)

**Atomic Liquidity Mirroring** is a zero-capital version of Cross-Exchange Market Making (XEMM). Instead of posting passive limit orders that require inventory, the bot actively "fills" user intents (like Dutch Auctions) using flash-loaned liquidity sourced from **0x Protocol**.

---

## 1. The Atomic Mirroring Model

Our implementation focuses on **Intent-based platforms** (UniswapX, 1inch Fusion) to ensure $0 upfront capital:

1.  **Intent Monitoring**: The bot monitors platforms for user intents (e.g., a UniswapX auction where a user wants to sell 1 ETH for at least 2,490 USDC).
2.  **0x Price Discovery**: The bot pings 0x to see if it can buy 2,490 USDC for less than 1 ETH (or sell 1 ETH for more than 2,500 USDC).
3.  **Spread Application**: The bot ensures the 0x price is better than the intent price by at least the `SPREAD_BPS`.
4.  **Atomic Fill**: If profitable, the bot executes a single transaction:
    -   **Flash Loan** the required tokens.
    -   **Swap** via 0x to capture the price difference.
    -   **Fill** the user's intent on the target platform (e.g., UniswapX).
    -   **Repay** the flash loan and keep the profit.

---

## 2. Technical Execution Flow

### Step 1: Inventory Sync
Before quoting, the bot checks its own wallet balance using the `InventoryService`.
-   **Rule**: Never quote an amount larger than what is currently held in the wallet. This ensures the bot can always honor a fill.

### Step 2: 0x Price Discovery
The bot fetches a real-time price from the **0x Hub**.
-   Example: 0x says 1 ETH = 2,500 USDC.

### Step 3: Limit Order Creation
The bot applies the `SPREAD_BPS` and prepares a signed EIP-712 limit order.
-   If `SPREAD_BPS = 50`, the bot quotes 1 ETH = 2,487.5 USDC (buying ETH cheaper) or 1 ETH = 2,512.5 USDC (selling ETH higher).
-   The order is posted to the aggregator's off-chain order book.

### Step 4: Just-In-Time Hedging
When the limit order is filled on-chain:
1.  We receive the user's tokens.
2.  We immediately use the **0x API** to swap those tokens back into our original asset at the global market price.
3.  The difference between our "Mirrored Quote" and the "0x Hedge Price" is our profit.

---

## 3. Why This Strategy is "Zero-Inventory Risk"

Unlike traditional market making where you might get "stuck" with a large position if the price moves, Mirroring is **instantly hedged**:

-   **0x Guarantee**: 0x aggregates over 100 sources. Even if one DEX price moves, 0x's Smart Order Routing (SOR) finds another venue to hedge your trade.
-   **RFQ Synergy**: By using 0x RFQ for the hedging leg, you get a **guaranteed execution price** with zero slippage, ensuring your spread is never eaten by market volatility.

---

## 4. Key Performance Indicators (KPIs)

| Metric | Target | Reason |
| :--- | :--- | :--- |
| **Fill Rate** | 2% - 5% | Competitive, but zero risk. You only execute when profit is guaranteed. |
| **Average Spread** | 10 - 30 bps | Tighter spreads are possible because there is zero inventory risk or capital cost. |
| **Execution Latency** | < 500ms | Critical for winning Dutch Auctions before other fillers. |

---

## 5. Zero-Capital Platforms

To run this strategy with $0 capital, use:
- **UniswapX**: Fully automated in our `FillerService`.
- **Enso Finance**: Semi-automated via our `EnsoAdapter`.
- **1inch Fusion**: Requires Resolver whitelist.

*Note: KyberSwap Limit Orders are NOT zero-capital and require holding inventory.*

---

## 6. 0x Protocol Synergy

The `MirrorBot` is uniquely empowered by specific 0x API v2 features:

1.  **SOR (Smart Order Routing)**: Ensures that the hedging leg of the trade is always executed at the best possible price across all of DeFi.
2.  **RFQ Liquidity**: Allows the bot to source liquidity from other professional makers to hedge its own "Mirrored" positions, creating a chain of liquidity.
3.  **Permit2**: Enables the bot to manage its inventory and execute hedges with minimal gas cost, as it doesn't need to send multiple `approve` transactions.

## 6. Risk Management & Hardening

To be production-ready, the `MirrorBot` implements the following safeguards:

-   **Stale Quotes**: Every limit order has a short `expiredAt` timestamp (60s). This prevents "Pick-off risk" where an arbitrageur fills a quote after the market has moved.
-   **Inventory Check**: The bot pings the `InventoryService` before every quote. If it doesn't hold the tokens to honor a fill, it **skips** quoting to protect reputation and avoid failed transactions.
-   **Volatility Guard**: Via the `SpreadService`, the bot can automatically widen the spread during periods of high price volatility to compensate for increased hedging risk.
-   **Atomic Rebalancing**: Uses the `RebalanceService` to periodically swap profit tokens (e.g., small ETH amounts) back into the base liquidity asset (e.g., USDC).
