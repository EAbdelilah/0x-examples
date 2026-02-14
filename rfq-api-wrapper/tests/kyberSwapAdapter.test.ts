import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KyberSwapAdapter } from '../src/adapters/kyberSwapAdapter';

describe('KyberSwapAdapter', () => {
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
  });

  it('should handle quote request and generate a signature', async () => {
    const adapter = new KyberSwapAdapter(mockZeroExService, '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    mockZeroExService.getPrice.mockResolvedValue({ buyAmount: '1000' });

    const query = {
      sellToken: '0x1111111111111111111111111111111111111111',
      buyToken: '0x2222222222222222222222222222222222222222',
      sellAmount: '500',
      chainId: 1
    };

    const result = await adapter.handleQuote(query);
    expect(result.status).toBe('OK');
    expect(result.order.buyAmount).toBe('1000');
    expect(result.signature).toBeDefined();
    expect(result.signature).toMatch(/^0x/);
  });
});
