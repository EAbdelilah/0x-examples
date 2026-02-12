import { describe, it, expect, vi } from 'vitest';
import { BaseAdapter } from '../src/adapters/baseAdapter';

class TestAdapter extends BaseAdapter {
    constructor(service: any) {
        super('Test', service);
    }
    async handleQuote(req: any) { return {}; }
    // Expose protected method for testing
    public testApplySpread(amount: string, price: string = '1.0') {
        return this.applySpread(amount, 'TEST-PAIR', price);
    }
}

describe('Spread Logic', () => {
    it('should apply spread correctly', () => {
        process.env.SPREAD_BPS = '50'; // 0.5%
        const adapter = new TestAdapter({} as any);

        // 1000 - 0.5% = 995
        expect(adapter.testApplySpread('1000')).toBe('995');

        process.env.SPREAD_BPS = '100'; // 1%
        const adapter2 = new TestAdapter({} as any);
        expect(adapter2.testApplySpread('1000')).toBe('990');
    });

    it('should handle zero spread', () => {
        process.env.SPREAD_BPS = '0';
        const adapter = new TestAdapter({} as any);
        expect(adapter.testApplySpread('1000')).toBe('1000');
    });

    it('should increase spread on high volatility', () => {
        process.env.SPREAD_BPS = '50';
        const adapter = new TestAdapter({} as any);

        // First call sets the price
        adapter.testApplySpread('1000', '1.0');

        // Second call with 2% price change
        // Original spread 50 + 50 surcharge = 100 bps (1%)
        // 1000 - 1% = 990
        expect(adapter.testApplySpread('1000', '1.02')).toBe('990');
    });
});
