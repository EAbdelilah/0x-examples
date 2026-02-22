# Bot Architecture: Hunter vs. Fisherman

This suite operates in two fundamentally different modes. Understanding these modes is critical to choosing the right strategy for your capital and risk tolerance.

---

## 1. The Fisherman (Passive Mirroring)
**Primary Process**: `bun run start` (The RFQ Adapter Server)

In this mode, the bot acts as a **Private Market Maker (PMM)**. You are "fishing" for trades by placing quotes in aggregator order books.

-   **Analogy**: You set a "bait" (a price) and wait for a "fish" (a taker/user) to bite.
-   **Mechanism**:
    1.  Aggregator (1inch/ParaSwap) pings your server: "What is your price for 1 ETH?"
    2.  Bot checks 0x, adds a spread, and replies: "I'll give you 2,500 USDC."
    3.  If the user accepts, they send a transaction that includes your signed quote.
    4.  You hedge the trade on 0x immediately.
-   **Key Advantage**: Zero execution effort. You only trade when a user explicitly chooses your price.
-   **Zero-Capital?**: Requires inventory if using traditional RFQ (Kyber), but can be zero-capital if using **RFQ with Exclusivity** (UniswapX RFQ).

---

## 2. The Hunter (Active Filling)
**Primary Process**: `bun run filler` (The Hunter Bot)

In this mode, the bot acts as an **Atomic Filler**. You are actively searching the market for profitable opportunities that already exist.

-   **Analogy**: You are a hawk circling the market, looking for "prey" (undervalued auctions or intents).
-   **Mechanism**:
    1.  Bot continuously polls APIs (UniswapX, Enso) for open orders.
    2.  It monitors Dutch Auctions as they decay (the price the user is willing to accept decreases over time).
    3.  When the auction price decays below the 0x execution price, the bot "pounces."
    4.  It executes an atomic transaction: **Flash Loan -> Swap via 0x -> Fill User Order**.
-   **Key Advantage**: 100% Zero-Capital. Since **you** initiate the transaction, you can use flash loans to cover the trade.
-   **Risk**: High competition. You are racing against thousands of other "Hunters" to fill the same order.

---

## Which one is "Mirroring"?

Strictly speaking, **Mirroring** is the Fisherman model. You are "mirroring" the 0x price onto other aggregators.

**Filling** is a specialized form of arbitrage.

| Feature | Fisherman (Mirroring) | Hunter (Filling) |
| :--- | :--- | :--- |
| **Command** | `bun run start` | `bun run filler` |
| **Philosophy** | Proactive / Liquidity Provision | Reactive / Opportunity Capture |
| **Volume** | ⚡ High (if whitelisted) | 💧 Low (High competition) |
| **Complexity** | Med (Server maintenance) | High (Execution speed) |
| **Synergy** | 0x RFQ Hub | 0x SOR / Aggregator |

### The "Pro" Recommendation
Run **both**. The Fisherman (`start`) provides steady, low-risk income, while the Hunter (`filler`) captures high-alpha opportunities during market volatility.
