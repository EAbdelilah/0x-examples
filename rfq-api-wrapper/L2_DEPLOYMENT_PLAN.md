# L2 Deployment Plan

## Target Chains (Excluding Ethereum Mainnet)

We're focusing on cost-effective L2s where gas costs won't eat into profits:

| Chain | Chain ID | Gas Cost | Priority | Status |
|-------|----------|----------|----------|--------|
| **Polygon** | 137 | ~$0.01 | ✅ HIGH | ✅ Deployed (`0xf4f4484fe47fac600ee3cb88eba1b7fd2757f0fa`) |
| **Base** | 8453 | ~$0.05 | 🟡 MEDIUM | ❌ Not deployed |
| **Arbitrum** | 42161 | ~$0.20 | 🟡 MEDIUM | ❌ Not deployed |
| **Unichain** | 130 | ~$0.05 | 🟢 LOW | ❌ Not deployed |

**Ethereum Mainnet (Chain 1)**: ❌ EXCLUDED - Gas costs ($5-50) would eliminate all profits

## Deployment Requirements

### What You Need:

1. **ETH for Gas** (on each chain):
   - Base: ~0.002 ETH (~$6)
   - Arbitrum: ~0.003 ETH (~$9)
   - Unichain: ~0.002 ETH (~$6)

2. **Deployment Command** (for each chain):
   ```bash
   npx hardhat run scripts/deploy.cjs --network <network-name>
   ```

### Network Configuration

Your `hardhat.config.cjs` already has:
- ✅ Polygon configured
- ✅ Base configured
- ❌ Arbitrum needs to be added
- ❌ Unichain needs to be added

## Recommended Deployment Order

### Phase 1: Polygon Only (Current)
- ✅ Already deployed and running
- Monitor performance for 24-48 hours
- Validate profitability

### Phase 2: Add Base (Next)
- Base has good UniswapX volume
- Very low gas costs (~$0.05)
- Deploy when you have 0.002 ETH on Base

### Phase 3: Add Arbitrum (Optional)
- Higher gas than Base but still reasonable
- Good for larger trades
- Deploy when you have 0.003 ETH on Arbitrum

### Phase 4: Add Unichain (Future)
- Newest chain, lower volume
- Very low gas costs
- Deploy when Unichain activity picks up

## Current Bot Configuration

The bot now:
- ✅ **Excludes Ethereum mainnet** (too expensive)
- ✅ **Monitors Polygon** (contract deployed)
- ⏸️ **Scans Base, Arbitrum, Unichain** (will find orders but can't execute yet)

## Next Steps

1. **Option A - Keep Polygon Only**:
   - Bot runs as-is
   - Only executes on Polygon
   - Safest approach

2. **Option B - Deploy to Base**:
   - Get 0.002 ETH on Base
   - Run: `npx hardhat run scripts/deploy.cjs --network base`
   - Update `chains.ts` with new address
   - Restart bot

Would you like me to help you deploy to Base next?
