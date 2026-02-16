/**
 * Live Monitoring Dashboard
 * Displays real-time bot activity and opportunity detection
 */

import Database from 'better-sqlite3';
import { formatUnits } from 'viem';

const db = new Database('bot_data.db');

function clearScreen() {
    console.clear();
}

function displayDashboard() {
    clearScreen();

    const now = new Date().toISOString();
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║        🤖 ATOMIC ARBITRAGE BOT - LIVE MONITORING              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n⏰ Last Updated: ${now}\n`);

    // Get statistics
    const stats = {
        total: db.prepare('SELECT COUNT(*) as count FROM orders').get(),
        pending: db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get(),
        filled: db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'filled'").get(),
        failed: db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'failed'").get(),
    };

    console.log('📊 OVERALL STATISTICS');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Total Orders Scanned:    ${stats.total.count}`);
    console.log(`Pending Execution:       ${stats.pending.count}`);
    console.log(`Successfully Filled:     ${stats.filled.count} ✅`);
    console.log(`Failed:                  ${stats.failed.count} ❌`);
    console.log('');

    // Recent activity (last 10 orders)
    const recentOrders = db.prepare(`
    SELECT * FROM orders 
    ORDER BY createdAt DESC 
    LIMIT 10
  `).all();

    console.log('📋 RECENT ACTIVITY (Last 10 Orders)');
    console.log('─────────────────────────────────────────────────────────────────');

    if (recentOrders.length === 0) {
        console.log('⏳ No orders detected yet. Bot is actively scanning...');
        console.log('');
        console.log('💡 TIP: UniswapX activity is typically low during:');
        console.log('   • Weekend hours');
        console.log('   • Off-peak trading times (current: 22:09 UTC Sunday)');
        console.log('   • Low volatility periods');
        console.log('');
        console.log('🎯 The bot will automatically execute when profitable orders appear!');
    } else {
        recentOrders.forEach((order, idx) => {
            const statusEmoji = order.status === 'filled' ? '✅' :
                order.status === 'pending' ? '⏳' : '❌';
            console.log(`${idx + 1}. ${statusEmoji} ${order.orderHash.slice(0, 16)}...`);
            console.log(`   Chain: ${order.chainId} | Status: ${order.status}`);
            console.log(`   Created: ${order.createdAt}`);
            console.log('');
        });
    }

    console.log('─────────────────────────────────────────────────────────────────');
    console.log('🔄 Bot Status: RUNNING (scanning every 30 seconds)');
    console.log('🌐 Chains: Polygon, Base, Arbitrum, Ethereum, Unichain');
    console.log('💰 Strategy: Zero-Capital Flash Loan Arbitrage');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('\nPress Ctrl+C to exit monitoring...\n');
}

// Display dashboard every 5 seconds
console.log('Starting live monitoring...\n');
displayDashboard();

const interval = setInterval(displayDashboard, 5000);

// Cleanup on exit
process.on('SIGINT', () => {
    clearInterval(interval);
    db.close();
    console.log('\n\n✅ Monitoring stopped. Bot continues running in background.\n');
    process.exit(0);
});
