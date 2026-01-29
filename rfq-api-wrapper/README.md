# 0x RFQ API Wrapper

This project acts as a high-performance adapter for the 0x API v2, allowing you to provide liquidity as a Market Maker on various aggregators like 1inch, ParaSwap, Enso, KyberSwap, and OpenOcean.

## Features

- **Aggregator Adapters**: Pre-built endpoints for 1inch, ParaSwap, and KyberSwap RFQ protocols.
- **Universal Adapter**: A flexible endpoint for aggregators like Enso, OpenOcean, and others.
- **Configurable Spread**: Apply spreads (in basis points) to quotes.
- **EIP-712 Signing**: Automated signing of RFQ orders using `viem`.
- **Observability**: Prometheus metrics (`/metrics`) and structured logging.
- **Security**: Rate limiting and API key authentication.
- **Deployment Ready**: Dockerized and ready for containerized environments.

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables (`.env`):
   ```env
   ZERO_EX_API_KEY=your_0x_api_key
   PRIVATE_KEY=your_mm_private_key
   WRAPPER_API_KEY=optional_secret_for_this_wrapper
   PORT=3000
   SPREAD_BPS=10
   LOG_LEVEL=info
   KYBERSWAP_CONTRACT=0x... (optional)
   ```

3. Run the server:
   ```bash
   bun run src/index.ts
   ```

## Aggregator Integration Guide

### 1inch
- **Endpoint**: `GET /api/v1/1inch/quote`
- **Register**: Provide your base URL + `/api/v1/1inch/quote` to the 1inch PMM team.
- **Format**: Returns a signed `OrderRFQ` (v3).

### ParaSwap
- **Endpoint**: `GET /api/v1/paraswap/quote`
- **Register**: Provide your base URL + `/api/v1/paraswap/quote` to the ParaSwap team.
- **Format**: Returns a signed `Order`.

### KyberSwap
- **Endpoint**: `GET /api/v1/kyberswap/quote`
- **Register**: Follow KyberSwap's Maker API registration process using this endpoint.
- **Format**: Returns a signed KyberSwap Limit Order.

### Enso & OpenOcean (Universal)
- **Endpoint**: `GET /api/v1/universal/quote`
- **Use**: This endpoint returns a generic quote (price, amount, validUntil). These aggregators typically fetch quotes first, then request a signature or use a standard format that can be mapped here.

## Observability

- **Metrics**: `GET /metrics` (Prometheus format)
- **Health**: `GET /health`

## Security & Deployment

### Docker
```bash
docker build -t rfq-wrapper .
docker run -p 3000:3000 --env-file .env rfq-wrapper
```

### Production Security
- **Key Management**: Use a secret manager (AWS Secrets Manager, etc.) to inject `PRIVATE_KEY`.
- **Authentication**: Always set a strong `WRAPPER_API_KEY` and provide it to the aggregators in the `x-api-key` header.
- **Hedging**: You must implement your own hedging logic to rebalance your 0x positions when orders are filled.
