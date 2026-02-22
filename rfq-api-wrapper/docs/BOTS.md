# Strategy Bot Suite: Hunters and Fishermen

This repository includes a modular bot suite for executing the high-alpha Zero-Capital strategies identified in our research. The suite operates in two primary modes: **Passive (Fisherman)** and **Active (Hunter)**.

---

## 🎣 The Fisherman (Passive Mirroring)
**Primary Command**: `bun run start` (The RFQ Adapter Server)

In this mode, you act as a Private Market Maker. You provide signed quotes to aggregators and wait for users to take them.

-   **Target Platforms**: 1inch, ParaSwap, Enso.
-   **Visibility**: Monitor performance via `GET /stats/mirroring`.

## 🦅 The Hunter (Active Filling)
**Primary Command**: `bun run filler` or `bun run bot <strategy>`

In this mode, you are actively scanning the blockchain for existing opportunities to pounce on.

-   **Target Platforms**: UniswapX, local DEX pools.

## How to Run

Use the following command format:
```bash
bun run bot <strategy> <chainId>
```

### Running Multiple Strategies Simultaneously
You can run multiple strategies in a single process by passing a comma-separated list. To run the **full suite of 6 strategies** simultaneously:
```bash
bun run bot spatial,liquidate,mirror,triangular,collateral,self-liq 8453
```

### Available Strategies

| Command | Strategy | Description |
| :--- | :--- | :--- |
| `spatial` | **Spatial Arbitrage** | Compares 0x aggregate prices against a local DEX. |
| `liquidate` | **Liquidation** | Monitors lending pools and uses 0x to swap seized collateral. |
| `mirror` | **Mirroring (RFQ)** | Posts limit orders on Kyber/1inch/ParaSwap backed by 0x liquidity. |
| `triangular`| **Triangular Arb** | Executes multi-token loops on a single DEX using 0x to hedge. |
| `collateral`| **Collateral Swap** | Optimizes lending positions by swapping collateral via 0x. |
| `self-liq`  | **Self-Liquidation** | Monitors and pre-emptively repays your own unhealthy debt. |

## Configuration

Ensure your `.env` is configured with:
- `PRIVATE_KEY`: To sign and execute transactions.
- `RPC_URL_<chainId>`: For the specific chain you want to target (e.g., `RPC_URL_8453` for Base).
- `SPREAD_BPS`: Your desired profit margin.

## Bot Architecture

All bots extend the `BaseBot` class in `src/bots/BaseBot.ts`. This ensures consistent:
- **Gas Checking**: Prevents execution if the wallet is low on native tokens.
- **Service Integration**: Easy access to `ZeroExService` and `AtomicBroker`.
- **Structured Logging**: Standardized output for monitoring opportunities.

---

*Note: These bots are provided as high-quality reference implementations. Before running in production, ensure you have provided the specific pool addresses and contract interfaces for the protocols you wish to target.*
