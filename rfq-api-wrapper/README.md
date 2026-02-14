# RFQ API Wrapper (PMM Adapter for 0x API)

This project acts as an adapter for the 0x Swap API v2, allowing you to use 0x liquidity to provide quotes as a Private Market Maker (PMM) on various aggregators like 1inch, ParaSwap, and Enso.

## Features

- **Multi-Aggregator Support**: Pre-built adapters for 1inch, ParaSwap, and Enso.
- **Powered by 0x**: Uses 0x Swap API v2 for reliable, high-quality pricing.
- **Production-Ready Foundation**:
  - Structured logging with Winston.
  - Security headers with Helmet.
  - Request validation with Zod.
  - Custom error handling.
  - Unit tests with Vitest.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.1.0+)
- A 0x API Key ([Get one here](https://dashboard.0x.org/))
- An Ethereum Private Key (for signing RFQ orders)

### Installation

```bash
cd rfq-api-wrapper
bun install
```

### Configuration

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `ZERO_EX_API_KEY` | Your 0x API Key. |
| `PRIVATE_KEY` | The private key used to sign RFQ orders. |
| `RPC_URL` | RPC URL for the chain you are providing liquidity on. |
| `PORT` | Port for the express server (default: 3000). |
| `MM_ADDRESS` | The address associated with your private key. |
| `SPREAD_BPS` | Your profit margin in Basis Points (100 bps = 1%). Default: 50. |

## How You Make Money (The Spread)

This wrapper generates revenue through a **spread** (a fee).

1. **The Request**: A user wants to swap 1 ETH for USDC.
2. **0x Quote**: Your adapter pings 0x. 0x says it can give you **2000 USDC** for 1 ETH.
3. **Apply Spread**: With `SPREAD_BPS=50` (0.5%), the adapter subtracts 10 USDC (0.5% of 2000).
4. **The Response**: You quote the user **1990 USDC**.
5. **The Profit**: If the user accepts, you swap their 1 ETH at 0x for 2000 USDC, give the user 1990 USDC, and **keep 10 USDC** as profit.

### Optimizing Your Spread
- **High Volume**: Set `SPREAD_BPS=10` to `20`. You will win more quotes but make less per trade.
- **High Margin**: Set `SPREAD_BPS=50` to `100`. You will win fewer quotes but make more per trade.
- **Tip**: Aggregators like 1inch and ParaSwap will only route to you if your price (after your fee) is better than the AMM (Uniswap, etc.).

### Verification (Do this first!)

Before running the bots, verify your setup:

```bash
bun run verify
```

### Running the Server

```bash
# Development mode
bun run dev

# Production mode
bun run start
```

### Running Bots

```bash
# Run the KyberSwap Maker Bot
bun run maker

# Run the UniswapX Filler Bot
bun run filler
```

### Gas Management

If you are running the **UniswapX Filler Bot**, you must have the chain's native token (e.g., ETH on Base, BNB on BSC) in your `MM_ADDRESS` wallet.

**Why is gas needed?**
Unlike "Maker" strategies where you sign an off-chain order that someone else settles, the "Filler" strategy requires *you* to be the transaction sender. You call the UniswapX Reactor contract to execute the trade, which costs gas.

**How much gas do I need?**
- **L2s (Base, Arbitrum, Optimism)**: Very cheap. Keeping **0.05 ETH** is usually enough for hundreds of trades.
- **Mainnet**: Expensive. You should have at least **0.2 - 0.5 ETH** to be safe, as a single fill can cost 0.01 - 0.03 ETH depending on congestion.
- **Estimate**: The bot assumes a gas limit of ~300,000 units per fill.

### Running Tests

```bash
bun run test
```

## How it Works

1. **Aggregator Call**: An aggregator (e.g., 1inch) sends a GET request to your endpoint (e.g., `/quote/1inch`).
2. **0x Quote**: The adapter translates the request and calls the 0x Swap API v2 `/permit2/price` to get a competitive price.
3. **PMM Response**: The adapter formats the 0x response into the specific format expected by the aggregator and returns it.

## RFQ Strategy & Accessibility Roadmap

Based on current market accessibility, here is the recommended order for deploying your RFQ strategy:

### 1. **The Best Entry Point: Enso Finance**
Enso is the most developer-friendly for intent-based models.
- **Action Provider**: You register a smart contract abstraction.
- **The Flow**: You define an "Action" (calling your 0x liquidity). Enso's "Graphers" include your action in routes if your price wins.
- **Status**: semi-permissionless.

### 2. **The Passive Route: KyberSwap (Limit Order API)**
KyberSwap allows you to act as a maker without a formal partnership for their main aggregator.
- **The Flow**: Use the included `KyberLimitOrderService` to sign and post limit orders. Aggregators fill these orders if they offer the best rate.
- **Status**: Permissionless (for posting orders).

### 3. **The Boutique Aggregator: OpenOcean**
OpenOcean is often more willing to work with smaller, specialized liquidity providers.
- **The Flow**: Apply via their portal for PMM status.
- **Status**: Permissioned (but accessible).

### 4. **The Final Bosses: 1inch & ParaSwap**
Highest volume, but highest barriers to entry.
- **Status**: Strictly Permissioned. Requires significant capital and proven reliability.

---

## Permissionless "Filler" Strategies

If you want to start generating revenue **without any whitelisting**, you can participate in Dutch Auctions as a "Filler":

1. **UniswapX**: Monitor auctions and fill them using 0x liquidity when the price decays to a profitable level.
2. **CoW Swap**: Participate in the Solver competition to provide the best clearing prices for user batches.

See `src/services/fillerService.ts` for implementation skeletons.

---

## Whitelisting & Onboarding

| Aggregator | How to Join |
| --- | --- |
| **1inch** | Join the [1inch Network](https://1inch.io/) and apply for PMM whitelisting. |
| **ParaSwap** | Fill out the [ParaSwap PMM Application](https://doc.paraswap.network/liquidity-providers/rfq-market-makers-pmm). |
| **KyberSwap** | Use the Limit Order API or contact them to list a "Reserve." |
| **OpenOcean** | Contact OpenOcean support for RFQ onboarding. |

## Production Considerations

- **Latency**: Aggregators often require response times under 500ms. Ensure your server is located near the aggregator's infrastructure (typically AWS regions like `us-east-1` or `eu-central-1`).
- **Risk Management**: This wrapper passes through 0x quotes directly. In a real production setup, you should add logic to `handleQuote` to apply your own spreads, check your own inventory, and manage risk.
- **Security**: Never expose your `PRIVATE_KEY`. Use a Secret Manager in production environments.
- **Whitelisting**: Most aggregators will require your server's IP address for whitelisting.

## Disclaimer

This project is for educational purposes and is not audited. Use at your own risk. Market making involves significant financial risk.
