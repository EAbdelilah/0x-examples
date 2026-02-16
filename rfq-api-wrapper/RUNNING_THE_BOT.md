# 🤖 Running the Atomic Arbitrage Bot

This guide shows you how to start and monitor your multi-chain atomic arbitrage bot.

## Prerequisites

✅ Node.js installed  
✅ Dependencies installed (`npm install`)  
✅ `.env` file configured with your API keys and RPC URLs  
✅ Gas tokens on your wallet for the chains you want to monitor

## Quick Start

### 1. Start the Bot

Open your terminal in the project directory and run:

```powershell
npm run filler
```

**What this does:**
- Starts monitoring 5 chains in parallel (Polygon, Base, Arbitrum, Ethereum, Unichain)
- Scans for UniswapX orders every 30 seconds
- Automatically executes profitable trades using flash loans
- Logs all activity to the console and database

### 2. Monitor Activity (Optional)

In a **separate terminal**, run the live monitoring dashboard:

```powershell
npx tsx scripts/live-monitor.js
```

This shows:
- Total orders scanned
- Successful fills
- Failed attempts
- Recent activity

Press `Ctrl+C` to exit the monitor (bot keeps running).

### 3. Check Database

To view historical orders:

```powershell
npx tsx scripts/analyze-orders.js
```

## What to Expect

### Normal Operation

You'll see logs like this:

```
[INFO] --- Multi-Chain Filler Bot Tick ---
[INFO] Chain 137: Monitoring Enso Intents...
[INFO] Chain 8453: Monitoring Enso Intents...
[INFO] Chain 137: Scanned 0 open orders.
[INFO] Chain 8453: Scanned 0 open orders.
[INFO] Chain 1: Processing batch of 1 orders (Total: 1).
[INFO] Chain 1: Order 0x1234abc... | Potential Net: -0.002 native | ❄️ Skip
[INFO] Chain 1: Scanned 1 open orders.
```

### When a Profitable Order is Found

```
[INFO] Chain 137: Order 0x5678def... | Potential Net: 0.008 native | 🔥 PROFITABLE
[INFO] 🚀 EXECUTION TRIGGERED! Expected Profit: 0.008 native-equivalent
```

### Current Market Status

- **0 open orders**: Normal during off-peak hours (weekends, nights)
- **Orders found but skipped**: The bot is working! It's evaluating opportunities but they're not profitable enough
- **Orders executed**: 🎉 You're making money!

## Peak Activity Times

UniswapX orders are most common during:

- **US Market Hours**: 14:00-22:00 UTC (9 AM - 5 PM EST)
- **High Volatility**: Major news, token launches
- **New DEX Activity**: Especially on Base and Polygon

## Stopping the Bot

Press `Ctrl+C` in the terminal where the bot is running.

Or kill all Node processes:

```powershell
taskkill /F /IM node.exe /T
```

## Running 24/7 (Production)

For continuous operation, use PM2:

```powershell
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start "npx tsx src/filler.ts" --name "atomic-bot"

# View logs
pm2 logs atomic-bot

# Stop the bot
pm2 stop atomic-bot

# Restart the bot
pm2 restart atomic-bot
```

## Troubleshooting

### "Insufficient gas balance"
- Add native tokens (MATIC, ETH, etc.) to your wallet on the chains you're monitoring

### "RPC health check failed"
- Check your RPC URLs in `.env`
- Verify your Alchemy/Infura API keys are valid

### "0 orders for hours"
- This is normal during low-activity periods
- The bot is working correctly, just waiting for opportunities

## Configuration

Edit `.env` to adjust:

```env
SPREAD_BPS=10              # Base spread (10 = 0.1%)
MIN_SPREAD_BPS=5           # Minimum spread
MAX_SPREAD_BPS=100         # Maximum spread
VOLATILITY_MULTIPLIER=2    # Volatility adjustment factor
```

## Support Scripts

- **`scripts/live-monitor.js`**: Real-time dashboard
- **`scripts/analyze-orders.js`**: Historical analysis
- **`scripts/dry-run-corrected.js`**: Profitability simulation
- **`scripts/check-db.js`**: Database query tool

## Expected Profitability

Based on simulations:

| Arbitrage % | Net Profit (1000 USDC trade) |
|-------------|------------------------------|
| 0.2%        | ~$1                          |
| 0.5%        | ~$4                          |
| 1.0%        | ~$9                          |
| 2.0%        | ~$19                         |
| 5.0%        | ~$49                         |

**Remember**: The bot only executes when profitable. Zero capital is at risk thanks to flash loans!
