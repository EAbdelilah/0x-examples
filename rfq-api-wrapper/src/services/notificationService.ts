import axios from 'axios';
import logger from '../utils/logger';

export class NotificationService {
    private webhookUrl: string | undefined;

    constructor() {
        this.webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
    }

    async send(message: string) {
        logger.info(`Notification: ${message}`);

        if (!this.webhookUrl) return;

        try {
            if (this.webhookUrl.includes('discord.com')) {
                await axios.post(this.webhookUrl, { content: message });
            } else if (this.webhookUrl.includes('api.telegram.org')) {
                await axios.post(this.webhookUrl, { text: message });
            } else {
                await axios.post(this.webhookUrl, { message });
            }
        } catch (error: any) {
            logger.error('Failed to send notification:', error.message);
        }
    }

    async notifyFill(txHash: string, chainId: number, profit?: string) {
        const profitStr = profit ? ` - Profit: ${profit}` : '';
        await this.send(`🚀 **Order Filled On-Chain!**\nChain: ${chainId}\nTx: ${txHash}${profitStr}`);
    }

    async notifyError(task: string, error: string) {
        await this.send(`⚠️ **Bot Error Alert**\nTask: ${task}\nError: ${error}`);
    }
}

export const notifier = new NotificationService();
