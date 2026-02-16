import Database from 'better-sqlite3';
const db = new Database('bot_data.db');

console.log('=== Checking for Ethereum Orders ===\n');

const ethOrders = db.prepare(`
  SELECT * FROM orders 
  WHERE chainId = 1 
  ORDER BY createdAt DESC 
  LIMIT 10
`).all();

if (ethOrders.length === 0) {
    console.log('No Ethereum orders found in database.');
    console.log('The order at 21:52:12 was likely evaluated but not saved (not profitable).\n');
} else {
    console.log(`Found ${ethOrders.length} Ethereum orders:\n`);
    ethOrders.forEach((order, idx) => {
        console.log(`${idx + 1}. ${order.orderHash.slice(0, 20)}...`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('');
    });
}

db.close();
