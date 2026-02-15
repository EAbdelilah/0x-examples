import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('bot_data.db');
const db = new Database(dbPath);

function checkOrders() {
    console.log('--- Checking Bot Orders ---');
    try {
        const orders = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT 10').all();
        if (orders.length === 0) {
            console.log('No orders found in database.');
        } else {
            console.table(orders);
        }
    } catch (e) {
        console.error('Failed to query database:', e.message);
    }
}

checkOrders();
