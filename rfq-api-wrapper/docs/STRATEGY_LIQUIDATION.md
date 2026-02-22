# Strategy Detail: Zero-Capital Liquidation

**Liquidation** is a high-margin strategy where the bot repays the debt of an "under-collateralized" user in a lending protocol and, in exchange, receives that user's collateral at a discount (typically 5%–10%).

---

## 1. The Zero-Capital Model

Traditionally, a liquidator must hold a large balance of "Debt Tokens" (e.g., USDC or DAI) to cover positions. Our `LiquidationBot` uses the **AtomicBroker** to eliminate this requirement:

1.  **Flash Loan**: Borrow the required debt tokens (e.g., 1,000 USDC) at 0% fee from providers like **Sky** or **Balancer**.
2.  **Repay & Seize**: Submit the debt to the lending protocol (e.g., Aave) and seize the discounted collateral (e.g., $1,050 worth of WETH).
3.  **Hedge via 0x**: Use the **0x API v2** to swap the seized WETH back into USDC immediately.
4.  **Repay Flash Loan**: Use the resulting USDC to repay the initial 1,000 USDC loan.
5.  **Profit**: Keep the remaining 50 USDC (minus gas) as pure profit.

---

## 2. Technical Execution Flow

### Step 1: Monitoring Health Factors
The bot scans lending protocols (Aave, Morpho, Spark) for users whose **Health Factor** has dropped below 1.0.
-   *Note*: This requires monitoring "UserAccountData" events or using a dedicated liquidation subgraph/indexer.

### Step 2: Bonus Calculation
The bot identifies:
-   **Debt to Cover**: The amount of debt the protocol allows us to repay.
-   **Liquidation Bonus**: The percentage of extra collateral we receive (e.g., 1.05x the debt value).

### Step 3: Profitability Check (The 0x Leg)
Before sending the transaction, the bot pings **0x API v2** to ensure it can swap the seized collateral back to the debt token at a rate that covers the flash loan and gas fees.
-   *Condition*: `(0x Output Amount) > (Debt to Repay + Gas + Minimum Profit Threshold)`

### Step 4: Atomic Execution
The bot calls `AtomicBroker.executeBalancer` (or `executeSky`). The broker ensures the entire sequence happens in **one block**:
-   If the 0x swap fails or the price slips such that we can't repay the flash loan, the **transaction reverts**.
-   This ensures you never lose capital; you only lose the gas fee on a failed attempt.

---

## 3. Targeted Protocols

The suite is designed to target major lending hubs where 0x liquidity is deepest:

| Protocol | Typical Bonus | Best Chain |
| :--- | :--- | :--- |
| **Aave V3** | 5% - 10% | Base / Polygon / Arbitrum |
| **Morpho Blue** | Variable (Efficient) | Ethereum / Base |
| **Spark Protocol** | 5% (Stables focus) | Ethereum / Gnosis |

---

## 4. Why 0x is Essential for Liquidation

Liquidation bonuses are often large chunks of capital. Swapping them on a single DEX (like Uniswap) can cause significant price impact (slippage), eating into your bonus.

**0x API v2** solves this by:
1.  **Splitting the Trade**: Routing the seized collateral across 100+ sources to get the absolute best clearing price.
2.  **RFQ Liquidity**: Tapping into PMMs (Private Market Makers) who often provide better "off-market" rates for large liquidation events.
3.  **Atomic Safety**: Providing the `transformERC20` data needed to execute the swap within the broker's callback.

---

## 5. Risk Management

-   **Gas Wars**: Liquidations are highly competitive. The `TransactionMonitor` uses an aggressive priority fee strategy to ensure the bot's transaction is processed first.
-   **Slippage Guard**: The bot sets a strict `SLIPPAGE_BPS` (e.g., 10 bps) in the 0x quote to ensure execution only happens at the expected profitable rate.
