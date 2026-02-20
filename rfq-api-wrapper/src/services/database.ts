import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

export interface PersistedOrder {
    id?: number;
    orderHash: string;
    chainId: number;
    maker: string;
    sellToken: string;
    buyToken: string;
    sellAmount: string;
    buyAmount: string;
    status: 'pending' | 'filled' | 'failed' | 'cancelled';
    txHash?: string;
    createdAt?: string;
}

export class DatabaseService {
    private db: Database.Database;

    constructor() {
        const dbPath = path.resolve(process.cwd(), 'bot_data.db');
        this.db = new Database(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderHash TEXT UNIQUE,
        chainId INTEGER,
        maker TEXT,
        sellToken TEXT,
        buyToken TEXT,
        sellAmount TEXT,
        buyAmount TEXT,
        status TEXT,
        txHash TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS profits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strategy TEXT,
        chainId INTEGER,
        token TEXT,
        amount TEXT,
        txHash TEXT UNIQUE,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        logger.info('Database initialized at bot_data.db');
    }

    trackProfit(strategy: string, chainId: number, token: string, amount: string, txHash: string) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO profits (strategy, chainId, token, amount, txHash)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(strategy, chainId, token, amount, txHash);
    }

    getTotalProfit(strategy?: string) {
        if (strategy) {
            const stmt = this.db.prepare('SELECT SUM(CAST(amount AS REAL)) as total FROM profits WHERE strategy = ?');
            return stmt.get(strategy);
        }
        const stmt = this.db.prepare('SELECT SUM(CAST(amount AS REAL)) as total FROM profits');
        return stmt.get();
    }

    saveOrder(order: PersistedOrder) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO orders (orderHash, chainId, maker, sellToken, buyToken, sellAmount, buyAmount, status, txHash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(
            order.orderHash,
            order.chainId,
            order.maker,
            order.sellToken,
            order.buyToken,
            order.sellAmount,
            order.buyAmount,
            order.status,
            order.txHash || null
        );
    }

    updateOrderStatus(orderHash: string, status: string, txHash?: string) {
        const stmt = this.db.prepare('UPDATE orders SET status = ?, txHash = ? WHERE orderHash = ?');
        stmt.run(status, txHash || null, orderHash);
    }

    getOrder(orderHash: string): PersistedOrder | undefined {
        const stmt = this.db.prepare('SELECT * FROM orders WHERE orderHash = ?');
        return stmt.get(orderHash) as PersistedOrder | undefined;
    }

    getRecentOrders(limit: number = 10): PersistedOrder[] {
        const stmt = this.db.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT ?');
        return stmt.all(limit) as PersistedOrder[];
    }
}

export const dbService = new DatabaseService();
