import Database from 'better-sqlite3';
const db = new Database('bot_data.db');

console.log('=== Multi-Chain Orders Analysis (All Time) ===\n');

// Get all orders
const allOrders = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();

console.log(`Total orders scanned (all time): ${allOrders.length}\n`);

if (allOrders.length === 0) {
    console.log('No orders found in database yet.');
    console.log('The bot is running and will log orders as it finds them.\n');
    db.close();
    process.exit(0);
}

// Group by status
const byStatus = allOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
}, {});

console.log('📊 Orders by Status:');
Object.entries(byStatus).forEach(([status, count]) => {
    const emoji = status === 'filled' ? '✅' : status === 'pending' ? '⏳' : '❌';
    console.log(`  ${emoji} ${status}: ${count}`);
});

// Group by chain
const chainNames = {
    1: 'Ethereum',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
    130: 'Unichain'
};

const byChain = allOrders.reduce((acc, order) => {
    const chainName = chainNames[order.chainId] || `Chain ${order.chainId}`;
    if (!acc[chainName]) {
        acc[chainName] = { total: 0, pending: 0, filled: 0, failed: 0 };
    }
    acc[chainName].total++;
    acc[chainName][order.status]++;
    return acc;
}, {});

console.log('\n🌐 Per-Chain Breakdown:\n');
Object.entries(byChain)
    .sort((a, b) => b[1].total - a[1].total) // Sort by most active
    .forEach(([chain, stats]) => {
        console.log(`${chain}:`);
        console.log(`  Total: ${stats.total}`);
        console.log(`  Pending: ${stats.pending} ⏳`);
        console.log(`  Filled: ${stats.filled} ✅`);
        console.log(`  Failed: ${stats.failed} ❌`);
        console.log('');
    });

// Show chains with no activity
const activeChains = new Set(allOrders.map(o => o.chainId));
const monitoredChains = [1, 137, 8453, 42161, 130];
const inactiveChains = monitoredChains.filter(id => !activeChains.has(id));

if (inactiveChains.length > 0) {
    console.log('💤 Chains with no orders yet:');
    inactiveChains.forEach(id => {
        console.log(`  ${chainNames[id] || `Chain ${id}`}`);
    });
    console.log('');
}

console.log('\n📋 Recent Orders (Last 5):\n');
allOrders.slice(0, 5).forEach((order, idx) => {
    const statusEmoji = order.status === 'filled' ? '✅' :
        order.status === 'pending' ? '⏳' : '❌';
    const chainName = chainNames[order.chainId] || `Chain ${order.chainId}`;

    console.log(`${idx + 1}. ${statusEmoji} ${order.orderHash.slice(0, 16)}...`);
    console.log(`   Chain: ${chainName} (${order.chainId})`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Created: ${order.createdAt}`);
    console.log('');
});

db.close();
