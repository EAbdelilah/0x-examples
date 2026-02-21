import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KyberLimitOrderService } from '../src/services/kyberLimitOrderService';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as any;

describe('KyberLimitOrderService', () => {
  let service: KyberLimitOrderService;
  let mockZeroExService: any;

  beforeEach(() => {
    process.env.SPREAD_BPS = '0';
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    service = new KyberLimitOrderService('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', mockZeroExService);
  });

  it('should create and sign a limit order', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '2000',
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          types: {
            EIP712Domain: [],
            Order: [{ name: 'maker', type: 'address' }]
          },
          domain: {},
          message: { makerAmount: '1000', takerAmount: '2000' },
          primaryType: 'Order'
        }
      }
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        order: { makerAmount: 1000n, takerAmount: 2000n },
        signature: '0x123'
      }
    });

    const result = await service.createAndPostOrder({
      makerAsset: '0x1111111111111111111111111111111111111111',
      takerAsset: '0x2222222222222222222222222222222222222222',
      makerAmount: '1000',
      chainId: 1,
    });

    expect(result.order.makerAmount).toBe(1000n);
    expect(result.order.takerAmount).toBe(2000n);
    expect(result.signature).toBeDefined();
    expect(result.signature).toMatch(/^0x/);
  });
});
