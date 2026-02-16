# Advanced Spread Logic Configuration

The bot now uses dynamic spread calculation based on multiple market factors.

## Environment Variables

### Core Spread Settings
- **`SPREAD_BPS`** (default: 10): Base spread in basis points (1 bps = 0.01%)
- **`MIN_SPREAD_BPS`** (default: 5): Minimum allowed spread
- **`MAX_SPREAD_BPS`** (default: 100): Maximum allowed spread
- **`VOLATILITY_MULTIPLIER`** (default: 2): How aggressively to widen spreads during high volatility

## How Dynamic Spreads Work

The `SpreadService` calculates spreads using the following formula:

```
Final Spread = Base Spread + Volatility Adjustment + Size Adjustment + Time Adjustment + Chain Adjustment
```

### 1. Volatility Adjustment
- **0-5% 24h price change**: +0 bps
- **5-10% change**: +5 bps
- **10%+ change**: Up to +20 bps

### 2. Trade Size Adjustment
- **< 1 token**: -2 bps (tighter for small trades)
- **1-100 tokens**: 0 bps
- **100-1000 tokens**: +3 bps
- **> 1000 tokens**: +5 bps

### 3. Time-of-Day Adjustment
- **Peak hours (8 AM - 8 PM UTC)**: 0 bps
- **Off-hours**: +3 bps (lower liquidity)

### 4. Chain-Specific Adjustment
- **L2s (Polygon, Base, Arbitrum, Optimism)**: -2 bps (lower gas costs)
- **Ethereum Mainnet**: 0 bps

## Example Scenarios

### Scenario 1: Small USDC trade on Polygon during peak hours
- Base: 10 bps
- Volatility (USDC is stable): +0 bps
- Size (small): -2 bps
- Time (peak): +0 bps
- Chain (L2): -2 bps
- **Final Spread: 6 bps** (0.06%)

### Scenario 2: Large volatile token trade on Ethereum at night
- Base: 10 bps
- Volatility (15% 24h change): +20 bps
- Size (large): +5 bps
- Time (off-hours): +3 bps
- Chain (mainnet): +0 bps
- **Final Spread: 38 bps** (0.38%)

## Benefits

1. **Better Fill Rates**: Tighter spreads on low-risk trades increase competitiveness
2. **Risk Protection**: Wider spreads on volatile/large trades protect against adverse price movements
3. **Profit Optimization**: Automatically adjusts to market conditions without manual intervention
