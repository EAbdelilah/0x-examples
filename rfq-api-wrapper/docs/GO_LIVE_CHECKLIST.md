# 🚀 Go-Live Production Checklist

Follow this definitive checklist before enabling live trading with real capital.

## 1. Operational Security
- [ ] **Private RPCs**: Are you using Flashbots (Mainnet/Base) or FastLane (Polygon)?
- [ ] **Secret Management**: Is your `PRIVATE_KEY` stored in a Secret Manager (AWS/Doppler) and not in plain text `.env`?
- [ ] **Address Whitelisting**: Have you whitelisted your bot's address in the `AtomicBroker`?

## 2. Risk Management
- [ ] **Dry Run**: Has the bot run in `DRY_RUN=true` for at least 24 hours without unexpected errors?
- [ ] **Spread Check**: Is `SPREAD_BPS` high enough to cover your target chain's gas fees?
- [ ] **Inventory Limits**: Have you configured `MAX_TRADE_SIZE` to prevent oversized risk?
- [ ] **Rebalance Logic**: Is the `RebalanceService` configured to move profits to your stable base asset?

## 3. Monitoring & Alerting
- [ ] **Prometheus**: Is the `/metrics` endpoint reachable by your scraper?
- [ ] **Webhooks**: Have you verified the Discord/Telegram webhook receives the "Simulation Complete" alert?
- [ ] **Logging**: Is structured logging enabled and being sent to a log aggregator (Loki/CloudWatch)?

## 4. Smart Contract Finality
- [ ] **Providers**: Have you called `setProviders` on the `AtomicBroker` with the correct addresses for Sky, Morpho, and Uniswap v4 on your target chain?
- [ ] **Allowance**: Have you granted 0x `Permit2` allowance for the tokens you intend to trade?

## 5. Execution Environment
- [ ] **Resource Check**: Did `bun run verify` pass without hardware warnings?
- [ ] **Co-location**: Is your server geographically close to the RPC nodes to minimize latency?

---

**PRO TIP**: Start with **Spatial Arbitrage on Base**. It has the lowest gas risk and very fragmented liquidity, providing a safe environment to "warm up" the bot before moving to higher-stakes Mainnet Mirroring.
