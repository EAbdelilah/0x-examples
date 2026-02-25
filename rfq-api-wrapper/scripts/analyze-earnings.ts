import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'bot_data.db');
const db = new Database(dbPath);

interface Order {
    id: number;
    orderHash: string;
    chainId: number;
    status: string;
    txHash: string;
    createdAt: string;
    buyToken: string;
}

function analyzeEarnings() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                💰 ARBITRAGE EARNINGS REPORT                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const orders = db.prepare("SELECT * FROM orders WHERE status = 'filled' ORDER BY createdAt DESC").all() as Order[];

    if (orders.length === 0) {
        console.log('No successfully filled orders found in the database yet.');
        return;
    }

    console.log(`Found ${orders.length} successfully filled orders.\n`);

    orders.forEach((order, index) => {
        const chainName = order.chainId === 8453 ? 'Base' : order.chainId === 137 ? 'Polygon' : `Chain ${order.chainId}`;
        const scannerUrl = order.chainId === 8453 ? `https://basescan.org/tx/${order.txHash}` : `https://polygonscan.com/tx/${order.txHash}`;

        console.log(`${index + 1}. [${chainName}] Hash: ${order.orderHash.slice(0, 10)}...`);
        console.log(`   Transaction: ${order.txHash}`);
        console.log(`   Scanner:     ${scannerUrl}`);
        console.log(`   Filled At:   ${order.createdAt}`);
        console.log('');
    });

    console.log('─────────────────────────────────────────────────────────────────');
    console.log('ℹ️  WHERE ARE MY EARNINGS?');
    console.log('1. All profits were automatically sent to your wallet during execution.');
    console.log('2. The recipient address is the owner of the AtomicBroker contract.');
    console.log('3. Profits are usually in the "Buy Token" (e.g., USDC, WETH, etc.).');
    console.log('\n✅ Check your wallet balance on Basescan/Polygonscan for the tokens above!');
    console.log('─────────────────────────────────────────────────────────────────\n');
}

analyzeEarnings();
db.close();
