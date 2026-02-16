import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAdapter } from '../src/adapters/baseAdapter';
import { dbService } from '../src/services/database';

class TestAdapter extends BaseAdapter {
    constructor(service: any) {
        super('Test', service);
    }
    async handleQuote(req: any) { return {}; }
    // Expose protected method for testing
    public async testApplySpread(buyAmount: string, sellAmount: string, sellToken: string, buyToken: string, chainId: number) {
        return this.applySpread(buyAmount, sellAmount, sellToken, buyToken, chainId);
    }
}

describe('Spread Logic', () => {
    beforeEach(() => {
        dbService.clearAllPrices();
    });

    it('should apply spread correctly', async () => {
        process.env.SPREAD_BPS = '50'; // 0.5%
        const adapter = new TestAdapter({} as any);

        // 1000 - 0.5% = 995
        expect(await adapter.testApplySpread('1000', '1000', '0xabc', '0x123', 1)).toBe('995');

        process.env.SPREAD_BPS = '100'; // 1%
        const adapter2 = new TestAdapter({} as any);
        expect(await adapter2.testApplySpread('1000', '1000', '0xabc', '0x456', 1)).toBe('990');
    });

    it('should handle zero spread', async () => {
        process.env.SPREAD_BPS = '0';
        const adapter = new TestAdapter({} as any);
        expect(await adapter.testApplySpread('1000', '1000', '0xabc', '0x789', 1)).toBe('1000');
    });
});
