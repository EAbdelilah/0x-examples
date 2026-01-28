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

### Running the Server

```bash
# Development mode
bun run dev

# Production mode
bun run start
```

### Running Tests

```bash
bun run test
```

## How it Works

1. **Aggregator Call**: An aggregator (e.g., 1inch) sends a GET request to your endpoint (e.g., `/quote/1inch`).
2. **0x Quote**: The adapter translates the request and calls the 0x Swap API v2 `/permit2/price` to get a competitive price.
3. **PMM Response**: The adapter formats the 0x response into the specific format expected by the aggregator and returns it.

## Applying as a Market Maker

To use this script in production, you must apply to be whitelisted by the respective aggregators:

- **1inch**: Join the [1inch Network](https://1inch.io/) and contact their team for PMM whitelisting.
- **ParaSwap**: Fill out the [ParaSwap PMM Application](https://doc.paraswap.network/liquidity-providers/rfq-market-makers-pmm).
- **Enso**: Contact the Enso team via their [Discord/Docs](https://docs.enso.finance/).

## Production Considerations

- **Latency**: Aggregators often require response times under 500ms. Ensure your server is located near the aggregator's infrastructure (typically AWS regions like `us-east-1` or `eu-central-1`).
- **Risk Management**: This wrapper passes through 0x quotes directly. In a real production setup, you should add logic to `handleQuote` to apply your own spreads, check your own inventory, and manage risk.
- **Security**: Never expose your `PRIVATE_KEY`. Use a Secret Manager in production environments.
- **Whitelisting**: Most aggregators will require your server's IP address for whitelisting.

## Disclaimer

This project is for educational purposes and is not audited. Use at your own risk. Market making involves significant financial risk.
