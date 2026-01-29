# 0x RFQ API Wrapper

This project acts as an adapter for the 0x API v2, allowing you to provide liquidity as a Market Maker on various aggregators like 1inch, ParaSwap, Enso, KyberSwap, and OpenOcean.

## Features

- **Aggregator Adapters**: Pre-built endpoints that map aggregator-specific request formats to 0x API.
- **Configurable Spread**: Easily apply a spread (in basis points) to the quotes you provide to ensure profitability.
- **EIP-712 Signing**: Built-in support for signing RFQ orders using your private key.
- **Extensible**: Add new aggregator adapters by creating new routes.

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables in a `.env` file:
   ```env
   ZERO_EX_API_KEY=your_0x_api_key
   PRIVATE_KEY=your_mm_private_key
   PORT=3000
   SPREAD_BPS=10
   ```

3. Run the server:
   ```bash
   bun run src/index.ts
   ```

## API Endpoints

### 1inch
`GET /api/v1/1inch/quote?fromTokenAddress=...&toTokenAddress=...&amount=...&takerAddress=...&chainId=...`

### ParaSwap
`GET /api/v1/paraswap/quote?sellToken=...&buyToken=...&sellAmount=...&taker=...&chainId=...`

### Generic
`GET /api/v1/quote?sellToken=...&buyToken=...&sellAmount=...&taker=...&chainId=...`

## Testing

Run tests with:
```bash
bun test
```
