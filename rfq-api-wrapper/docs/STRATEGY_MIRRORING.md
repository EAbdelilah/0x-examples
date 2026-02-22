# Strategy Detail: Liquidity Mirroring (XEMM)

**Liquidity Mirroring**, also known as **Cross-Exchange Market Making (XEMM)**, is a strategy where the bot acts as a "Maker" (Liquidity Provider) on one exchange by "mirroring" the liquidity and price from another, more liquid exchange.

---

## 1. The Mirroring Model

In this suite, the `MirrorBot` uses **0x API v2** as the source of truth and **KyberSwap (Limit Order API)** as the target venue:

1.  **Price Discovery**: The bot pings 0x to find the "True" market price for a pair (e.g., WETH/USDC).
2.  **Spread Application**: The bot adds a small profit margin (the **Spread**, e.g., 50 bps) to that price.
3.  **Quote Posting**: The bot signs and posts a **Limit Order** on the target aggregator (KyberSwap).
4.  **Passive Execution**: If a user on KyberSwap wants to trade at that price, they "fill" our order.
5.  **Instant Hedge**: Since we are mirrored from 0x, we can instantly execute a swap on 0x to replace the tokens we just sold, locking in the spread as profit.

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
| **Fill Rate** | 5% - 10% | You won't win every quote, but high volume comes from being slightly better than the AMM price. |
| **Average Spread** | 20 - 50 bps | Needs to cover the 0x protocol fee (typically 15 bps) and gas. |
| **Inventory Turnover** | High | The faster you hedge on 0x, the more often you can provide new quotes. |

---

## 5. 0x Protocol Synergy

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
