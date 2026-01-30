import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnsoAdapter } from '../src/adapters/ensoAdapter';
import { OpenOceanAdapter } from '../src/adapters/openOceanAdapter';

describe('Enso and OpenOcean Adapters', () => {
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
  });

  it('EnsoAdapter should handle quote request', async () => {
    const adapter = new EnsoAdapter(mockZeroExService);
    mockZeroExService.getPrice.mockResolvedValue({ buyAmount: '1000' });

    const query = {
      fromToken: '0x123',
      toToken: '0x456',
      amount: '500',
      chainId: 1
    };

    const result = await adapter.handleQuote(query);
    expect(result.amountOut).toBe('1000');
    expect(mockZeroExService.getPrice).toHaveBeenCalledWith(expect.objectContaining({
      sellToken: '0x123',
      buyToken: '0x456',
      sellAmount: '500'
    }));
  });

  it('OpenOceanAdapter should handle quote request', async () => {
    const adapter = new OpenOceanAdapter(mockZeroExService);
    mockZeroExService.getPrice.mockResolvedValue({ buyAmount: '2000' });

    const query = {
      inTokenAddress: '0xabc',
      outTokenAddress: '0xdef',
      amount: '1000',
      chainId: 137
    };

    const result = await adapter.handleQuote(query);
    expect(result.outAmount).toBe('2000');
    expect(mockZeroExService.getPrice).toHaveBeenCalledWith(expect.objectContaining({
      sellToken: '0xabc',
      buyToken: '0xdef',
      chainId: 137
    }));
  });
});
