import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as any;

import { KyberLimitOrderService } from '../src/services/kyberLimitOrderService';

describe('KyberLimitOrderService', () => {
  let service: KyberLimitOrderService;
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    service = new KyberLimitOrderService('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', mockZeroExService);
    vi.clearAllMocks();
  });

  it('should create and sign a limit order', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '2000',
    });

    mockedAxios.post.mockImplementation(async (url: string) => {
        if (url.includes('sign-message')) {
            return {
                data: {
                    data: {
                        types: {
                            Order: [
                                { name: 'maker', type: 'address' },
                                { name: 'makerAmount', type: 'uint256' },
                                { name: 'takerAmount', type: 'uint256' }
                            ]
                        },
                        domain: {
                            name: 'KyberSwap',
                            version: '1',
                            chainId: 1,
                            verifyingContract: '0x1111111111111111111111111111111111111111'
                        },
                        message: {
                            maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                            makerAmount: 1000n,
                            takerAmount: 2000n
                        },
                        primaryType: 'Order'
                    }
                }
            };
        }
        return { data: { status: 'OK' } };
    });

    const result = await service.createAndPostOrder({
      makerAsset: '0x1111111111111111111111111111111111111111',
      takerAsset: '0x2222222222222222222222222222222222222222',
      makerAmount: '1000',
      chainId: 1,
    });

    expect(result.status).not.toBe('FAILED');
    expect(result.order).toBeDefined();
    expect(result.order.makerAmount).toBe(1000n);
    expect(result.order.takerAmount).toBe(2000n);
    expect(result.signature).toBeDefined();
    expect(result.signature).toMatch(/^0x/);
  });
});
