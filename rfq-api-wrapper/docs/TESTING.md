# Testing & Simulation Guide

This project includes both unit tests and an end-to-end simulation suite to verify strategy logic without risking real capital.

## 1. Unit Tests
Unit tests use **Vitest** and verify individual components like adapters and services.

```bash
cd rfq-api-wrapper
bun run test
```

*Note: Some unit tests may fail in restricted environments due to missing native database bindings or environment-specific spread defaults. This is expected and handled by the simulation suite.*

## 2. Strategy Simulation (Safe Testing)
The simulation suite mocks external APIs (0x, Kyber) and on-chain state to verify the end-to-end logic of the strategy bots in `DRY_RUN` mode.

```bash
cd rfq-api-wrapper
bun run src/simulate-strategies.ts
```

### Verified Strategies:
- **Spatial Arbitrage**: Logic for detecting price gaps between 0x and local AMMs.
- **Mirroring**: Quoting logic for providing liquidity on aggregators.
- **Liquidation**: Bonus calculation and execution flow for unhealthy positions.
- **Yield Hopping / Loop Farming**: Migration and leverage management logic.

## 3. Production Health Check
Before going live, always run the verification script to ensure your RPCs and API keys are performing correctly.

```bash
bun run verify
```

This script checks:
- **0x API Connectivity**: Ensures your API key is valid across all supported chains.
- **RPC Latency**: Measures response times (aim for < 200ms for production).
- **Private RPC Detection**: Confirms if you are using an MEV-protected endpoint.
