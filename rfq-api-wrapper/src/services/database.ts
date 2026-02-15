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

export interface PersistedPrice {
    id?: number;
    chainId: number;
    tokenAddress: string;
    priceInNative: string;
    createdAt?: string;
}

export class DatabaseService {
    private db: Database.Database;

    constructor(dbPath?: string) {
        const pathStr = dbPath || path.resolve(process.cwd(), 'bot_data.db');
        this.db = new Database(pathStr);
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
      CREATE TABLE IF NOT EXISTS prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chainId INTEGER,
        tokenAddress TEXT,
        priceInNative TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        logger.info('Database initialized at bot_data.db');
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

    savePrice(chainId: number, tokenAddress: string, priceInNative: string) {
        const stmt = this.db.prepare(`
            INSERT INTO prices (chainId, tokenAddress, priceInNative)
            VALUES (?, ?, ?)
        `);
        stmt.run(chainId, tokenAddress, priceInNative);
    }

    getRecentPrices(chainId: number, tokenAddress: string, limit: number = 10): PersistedPrice[] {
        const stmt = this.db.prepare(`
            SELECT * FROM prices
            WHERE chainId = ? AND tokenAddress = ?
            ORDER BY createdAt DESC
            LIMIT ?
        `);
        return stmt.all(chainId, tokenAddress, limit) as PersistedPrice[];
    }

    clearOldPrices(days: number = 7) {
        const stmt = this.db.prepare("DELETE FROM prices WHERE createdAt < datetime('now', ?)");
        stmt.run(`-${days} days`);
    }

    clearAllPrices() {
        this.db.prepare("DELETE FROM prices").run();
    }
}

export const dbService = new DatabaseService();
