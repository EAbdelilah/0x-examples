# Competitive Pricing Strategy for PMMs

To be competitive as a Private Market Maker (PMM) while using 0x as your liquidity source, you need to understand the "Spread Math."

## 1. The Cost Baseline
Before you make any profit, you must cover your costs.
*   **0x Protocol Fee**: 0x Swap API v2 typically charges a volume-based fee. On the standard tier, this is often around **15 Basis Points (0.15%)**.
*   **Gas Costs**: On L2s like **Base** or **Polygon**, gas is negligible (~$0.01). On **Ethereum Mainnet**, gas can be $10-$50, which makes small RFQ trades impossible to win unless your spread is huge.

## 2. Recommended Spread Settings (`SPREAD_BPS`)

| Strategy | `SPREAD_BPS` | Goal | Competitive Level |
| --- | --- | --- | --- |
| **The "Volume Eater"** | **20 - 25** | Win as many quotes as possible. | **High**. You are beating most AMMs (0.3%) and matching specialized MMs. |
| **The "Sweet Spot"** | **40 - 50** | Balance between winning and decent profit. | **Moderate**. You will win when AMMs are imbalanced or have high slippage. |
| **The "Yield Farmer"** | **80 - 100** | High profit per trade, low frequency. | **Low**. You will only win "lazy" trades or extremely volatile pairs. |

## 3. Strategy by Chain

### **Base / Arbitrum / Polygon (Recommended Start)**
*   **Advice**: Set `SPREAD_BPS=25`.
*   **Why**: Because gas is low, you can compete on tiny margins. You want to build "Fill History" (reputation) with 1inch and ParaSwap. High reliability and low spreads are how you get moved up their whitelist tiers.

### **Ethereum Mainnet**
*   **Advice**: Set `SPREAD_BPS=100+`.
*   **Why**: You are competing against "Toxic Flow" (arbitrageurs) and high gas. Unless the trade is >$50,000, a small spread won't cover the gas to settle the trade.

## 4. Understanding "Toxic Flow"
In RFQ, you are sometimes "picked off" by sophisticated bots (Arbitrageurs) who know the price is about to change before you do.
*   **The Risk**: 0x gives you a price, you quote the user, and by the time the trade settles, the market price has moved against you.
*   **Mitigation**:
    *   Keep your `expiry` short (the adapters I built use 60-120 seconds).
    *   Increase your spread during high volatility (e.g., during major news events).

## 5. Who Pays Gas?

This is a critical part of your revenue calculation.

### **Phase 1: RFQ & Limit Orders (Standard)**
*   **Who Pays**: The **User (Taker)**.
*   **Mechanic**: You provide a **signed quote off-chain**. This consumes **ZERO GAS**.
*   **When Gas is Used**: Only when the user decides your price is the best and submits the trade to the blockchain. The gas fee is subtracted from the user's wallet, not yours.
*   **Why this is good**: You can provide 1,000,000 quotes a day and pay $0 in gas.

### **Phase 2: The "Filler" Strategy (Arbitrage)**
*   **Who Pays**: **You (The Maker/Filler)**.
*   **Mechanic**: In UniswapX or CoW Swap, you are "filling" the user's order. You must submit the transaction to the blockchain.
*   **Requirement**: Your 0x profit must be greater than the gas fee you pay to settle the trade.
*   **Implementation**: This is why the `filler.ts` logic is "Advanced"—it requires a funded wallet to pay for gas.

## 6. How to Level Up
1.  **Upgrade 0x Tier**: As your volume grows, 0x will reduce your fees. This allows you to lower your `SPREAD_BPS` and win even more trades.
2.  **Inventory Management**: Instead of just using 0x, eventually hold your own "Inventory" (e.g., hold 10 ETH and 20,000 USDC). Quoting from your own wallet is **15 bps cheaper** than quoting from 0x.

**Final Recommendation**: Start on **Base** with **`SPREAD_BPS=30`**. It’s safe, covers your 0x costs, and is competitive enough to start seeing volume.
