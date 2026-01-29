# 0x RFQ API Wrapper

This project acts as an adapter for the 0x API v2, allowing you to provide liquidity as a Market Maker on various aggregators like 1inch, ParaSwap, Enso, KyberSwap, and OpenOcean.

## Features

- **Aggregator Adapters**: Pre-built endpoints that map aggregator-specific request formats to 0x API.
- **Configurable Spread**: Easily apply a spread (in basis points) to the quotes you provide to ensure profitability.
- **EIP-712 Signing**: Built-in support for signing RFQ orders using your private key.
- **Production Ready Foundation**: Includes input validation, structured logging, and robust error handling.

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
   LOG_LEVEL=info
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

## Testing

Run all tests:
```bash
bun test
```

## Production Readiness Checklist

While this wrapper provides a solid foundation, consider the following before deploying to production:

1.  **Key Management**: Use a secure Vault (like AWS KMS, HashiCorp Vault, or Google Secret Manager) instead of storing your `PRIVATE_KEY` in a `.env` file.
2.  **Rate Limiting**: Implement rate limiting (e.g., `express-rate-limit`) to protect your service from spam or DoS attacks.
3.  **Monitoring & Alerting**: Integrate with tools like Datadog, Sentry, or Prometheus to monitor errors, latency, and system health.
4.  **Security Audit**: Have the code audited by a security professional, especially the signing logic and integration with aggregators.
5.  **Infrastructure**: Deploy on a highly available infrastructure with load balancing and auto-scaling.
6.  **Compliance**: Ensure you follow all regulatory requirements for acting as a liquidity provider in your jurisdiction.
7.  **Liquidity Management**: Ensure your wallet has sufficient balances of the tokens you are quoting.
