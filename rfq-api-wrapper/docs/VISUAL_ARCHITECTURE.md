# Visual Architecture Guide

This guide provides a structural overview of how your bot suite interacts with the DeFi ecosystem.

---

## 1. The Global Overview (The Hub-and-Spoke)

Your bot suite acts as the brain, **0x API** acts as the heart (liquidity), and the **DEXs** are the nervous system.

```text
                                +-------------------+
                                |   DEFI MARKET     |
                                | (Uniswap, Curve,  |
                                |  Balancer, etc.)  |
                                +---------^---------+
                                          |
                                          |
                                +---------v---------+
                                |    0x API v2      | <--- THE HUB
                                | (Meta-Aggregator) |      (Sources best price)
                                +---------^---------+
                                          |
                                          |
           _______________________________|_______________________________
          |                                                               |
          |                                                               |
+---------v---------+                                           +---------v---------+
|  THE FISHERMAN    |                                           |     THE HUNTER    |
|  (Mirroring Bot)  |                                           |    (Filler Bot)   |
+---------+---------+                                           +---------+---------+
          |                                                               |
          | (PASSIVE)                                                     | (ACTIVE)
          | "I wait for users"                                            | "I find opportunities"
          |                                                               |
+---------v---------+                                           +---------v---------+
|    AGGREGATORS    |                                           |    INTENT NETS    |
| (1inch, ParaSwap) |                                           |  (UniswapX, Enso) |
+---------+---------+                                           +---------+---------+
          |                                                               |
          |                                                               |
    [ USER TRADE ]                                                 [ ATOMIC PROFIT ]
```

---

## 2. The Execution Loop (Zero-Capital)

This diagram shows how you trade $1,000,000 with a $0 balance using the **AtomicBroker**.

```text
[ START ] --> 1. TRACE: Hunter finds profitable UniswapX order.
                 ||
                 vv
              2. BORROW: AtomicBroker takes 0% Flash Loan (Sky/Balancer).
                 ||
                 vv
              3. SWAP:   Bot uses 0x API to convert tokens at best rate.
                 ||
                 vv
              4. FILL:   Bot delivers tokens to User to complete intent.
                 ||
                 vv
              5. REPAY:  Flash loan is returned automatically.
                 ||
                 vv
[ PROFIT ] <-- 6. KEEP:   Leftover "Spread" is sent to your wallet.
```

---

## 3. Strategy Summary

| Strategy | Role | Mode | Visual Analogy |
| :--- | :--- | :--- | :--- |
| **Mirroring** | Fisherman | Passive | Setting a high-quality net in a high-traffic river. |
| **Spatial Arb**| Hunter | Active | A hawk spotting a price gap between two distant pools. |
| **Liquidation**| Hunter | Active | A scavenger capturing collateral from "dying" positions. |
| **Triangular** | Hunter | Active | A snake eating its own tail to grow larger (Looping). |

---

*Note: For a detailed technical breakdown of each strategy, see the specific documentation in the `docs/` folder.*
