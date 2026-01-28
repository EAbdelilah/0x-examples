import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OneInchAdapter } from '../src/adapters/oneInchAdapter';
import { ZeroExService } from '../src/services/zeroExService';

describe('OneInchAdapter', () => {
  let adapter: OneInchAdapter;
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    // Dummy private key (Account #0 from Anvil/Hardhat)
    adapter = new OneInchAdapter(mockZeroExService, '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  });

  it('should handle quote request and generate a signature', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '2000',
    });

    const query = {
      fromTokenAddress: '0x1111111111111111111111111111111111111111',
      toTokenAddress: '0x2222222222222222222222222222222222222222',
      amount: '1000',
      chainId: 1,
    };

    const result = await adapter.handleQuote(query);

    expect(result.data.takingAmount).toBe('1000');
    expect(result.data.makingAmount).toBe('2000');
    expect(result.signature).toBeDefined();
    expect(result.signature).toMatch(/^0x/);
    expect(result.orderHash).toBeDefined();
  });
});
