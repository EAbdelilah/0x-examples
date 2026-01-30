import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParaSwapAdapter } from '../src/adapters/paraSwapAdapter';
import { ZeroExService } from '../src/services/zeroExService';

describe('ParaSwapAdapter', () => {
  let adapter: ParaSwapAdapter;
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    adapter = new ParaSwapAdapter(mockZeroExService, '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  });

  it('should handle indicative quote', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '3000',
    });

    const query = {
      from: '0x123',
      to: '0x456',
      amount: '1000',
      network: 1,
    };

    const result = await adapter.handleQuote(query);
    expect(result.price).toBe('3000');
    expect(result.signature).toBeUndefined();
  });

  it('should handle firm quote and sign it', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '3000',
    });

    const query = {
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      amount: '1000',
      network: 1,
      isFirmQuote: 'true',
    };

    const result = await adapter.handleQuote(query);
    expect(result.price).toBe('3000');
    expect(result.signature).toBeDefined();
    expect(result.order).toBeDefined();
  });
});
