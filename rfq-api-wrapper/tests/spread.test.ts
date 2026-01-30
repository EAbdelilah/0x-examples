import { describe, it, expect, vi } from 'vitest';
import { BaseAdapter } from '../src/adapters/baseAdapter';

class TestAdapter extends BaseAdapter {
    constructor(service: any) {
        super('Test', service);
    }
    async handleQuote(req: any) { return {}; }
    // Expose protected method for testing
    public testApplySpread(amount: string) {
        return this.applySpread(amount);
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
});
