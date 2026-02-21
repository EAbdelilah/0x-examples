import logger from '../utils/logger';

export class MockDatabaseService {
    constructor() {
        logger.info('Using Mock Database Service');
    }

    saveOrder(order: any) {
        logger.info(`[MockDB] Saved order: ${order.orderHash}`);
    }

    updateOrderStatus(orderHash: string, status: string, txHash?: string) {
        logger.info(`[MockDB] Updated order ${orderHash} to ${status}`);
    }

    getOrder(orderHash: string) {
        return undefined;
    }

    trackProfit(strategy: string, chainId: number, token: string, amount: string, txHash: string) {
        logger.info(`[MockDB] Tracked profit: ${amount} ${token} for ${strategy}`);
    }

    getTotalProfit(strategy?: string) {
        return { total: '0' };
    }

    getRecentOrders(limit: number = 10) {
        return [];
    }
}
