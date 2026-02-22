# Strategy Detail: Spatial Arbitrage

**Spatial Arbitrage** is the core alpha-seeking strategy of this bot suite. It exploits price discrepancies for the same asset pair across different trading venues (DEXs) within the same blockchain network and block.

---

## 1. The "Hub-and-Spoke" Model

Our implementation uses a **Hub-and-Spoke** architecture to ensure maximum efficiency:

-   **The Hub (0x API v2)**: Acts as the global liquidity aggregator. 0x monitors 100+ DEXs simultaneously (Uniswap, Curve, Balancer, etc.) and provides a single, best-in-market price.
-   **The Spokes (Local DEXs)**: Specific liquidity pools (e.g., Aerodrome on Base, Camelot on Arbitrum) that may temporarily deviate from the global price due to a large trade or low liquidity.

---

## 2. Technical Execution Flow

The `SpatialArbBot` follows a precise 5-step process for every execution:

### Step 1: Real-time Monitoring
The bot uses the `PriceStreamService` to monitor the price of a token pair (e.g., WETH/USDC) every 2 seconds.
-   It fetches the **Hub Price** from 0x.
-   It fetches the **Local Price** from a specific Spoke (DEX pool).

### Step 2: Opportunity Evaluation
The bot calculates the potential profit:
`Profit = (Local Buy Price - Hub Sell Price) - Gas Fees`
-   It checks the `SPREAD_BPS` (minimum desired margin).
-   It verifies `checkSafety()` (max trade size limits).

### Step 3: Atomic Transaction Preparation
If profitable, the bot requests a **firm quote** from 0x. This quote is valid for ~60 seconds and guarantees the execution price. It then encodes the call data for the `AtomicBroker`.

### Step 4: Zero-Capital Execution (The Flash Loan)
The bot submits a single transaction to the `AtomicBroker` contract:
1.  **Flash Loan**: Borrow `Token A` (e.g., 100,000 USDC) from a 0% fee provider (Sky/Balancer/Uni v4).
2.  **Buy Low**: Use the borrowed USDC to buy `Token B` (WETH) on the **Local DEX (Spoke)**.
3.  **Sell High**: Use the **0x API (Hub)** to sell that WETH back for USDC at the global best price.
4.  **Repay**: Repay the 100,000 USDC flash loan.
5.  **Profit**: The surplus USDC is kept in your wallet.

### Step 5: Post-Trade Monitoring
The `TransactionMonitor` tracks the on-chain status. If successful, the profit is recorded in the `profits` table of the database for your PnL reports.

---

## 3. Why This Strategy is "Production-Ready"

### 🛡️ Atomic Revert Protection
The entire Step 4 happens in **one single transaction**.
If the price moves on the Local DEX *between* the time the bot sends the TX and the time it's mined, the transaction will **atomically revert**.
-   **You lose**: Only the gas fee.
-   **You save**: Your principal capital and the flash loan.

### ⚡ Low Latency
By using event-driven price updates instead of slow polling, the bot can react to price gaps within the same block or the very next block.

### 🕵️ MEV Security
When run with a **Private RPC** (like Flashbots), your "Buy Low" and "Sell High" steps are invisible to front-running bots in the public mempool.

---

## 4. Operational Parameters

| Parameter | Recommended Setting | Reason |
| :--- | :--- | :--- |
| `MIN_PROFIT_BPS` | 10 - 20 (0.1% - 0.2%) | To ensure profit exceeds L2 gas costs. |
| `MAX_TRADE_SIZE` | 10 - 50 ETH | To avoid moving the price too much on the Spoke. |
| `SCAN_INTERVAL` | 2000ms | To catch gaps before CEX-DEX bots. |
