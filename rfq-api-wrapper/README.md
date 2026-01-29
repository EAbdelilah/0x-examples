# 0x RFQ API Wrapper

This project acts as a high-performance adapter for the 0x API v2, allowing you to provide liquidity as a Market Maker on various aggregators like 1inch, ParaSwap, Enso, KyberSwap, and OpenOcean.

## Features

- **Aggregator Adapters**: Pre-built endpoints for 1inch and ParaSwap RFQ protocols.
- **Configurable Spread**: Apply spreads (in basis points) to quotes.
- **EIP-712 Signing**: Automated signing of RFQ orders using `viem`.
- **Observability**: Prometheus metrics (`/metrics`) and structured logging.
- **Security**: Rate limiting and API key authentication.
- **Validation**: Schema validation using `Zod`.
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
   ```

3. Run the server:
   ```bash
   bun run src/index.ts
   ```

## API Endpoints

All adapter endpoints are protected by `x-api-key` header if `WRAPPER_API_KEY` is set.

### 1inch
`GET /api/v1/1inch/quote?fromTokenAddress=...&toTokenAddress=...&amount=...&chainId=...`

### ParaSwap
`GET /api/v1/paraswap/quote?sellToken=...&buyToken=...&sellAmount=...&chainId=...`

## Observability

- **Metrics**: `GET /metrics` (Prometheus format)
- **Health**: `GET /health`

## Security & Deployment

### Docker
Build and run with Docker:
```bash
docker build -t rfq-wrapper .
docker run -p 3000:3000 --env-file .env rfq-wrapper
```

### Production Security
- **Key Management**: In production, do not use `.env`. Use a secret manager (AWS Secrets Manager, etc.) to inject `PRIVATE_KEY`.
- **Authentication**: Always set a strong `WRAPPER_API_KEY`.
- **Hedging**: Remember that this wrapper only provides quotes. You must implement a separate logic to hedge your positions on 0x or other venues when your orders are filled on-chain.
- **Rate Limiting**: Default rate limit is 100 requests per 15 minutes. Adjust in `src/index.ts` based on your expected traffic from aggregators.
