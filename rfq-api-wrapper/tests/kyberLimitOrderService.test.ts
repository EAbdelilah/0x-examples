import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { KyberLimitOrderService } from '../src/services/kyberLimitOrderService';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KyberLimitOrderService', () => {
  let service: KyberLimitOrderService;
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    service = new KyberLimitOrderService('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', mockZeroExService);
  });

  it('should create and sign a limit order', async () => {
    process.env.SPREAD_BPS = '0';
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '2000',
    });

    mockedAxios.post.mockImplementation(async (url: string) => {
      if (url.includes('sign-message')) {
        return {
          data: {
            data: {
              domain: {},
              types: {
                EIP712Domain: [],
                Order: [
                    { name: 'makingAmount', type: 'uint256' },
                    { name: 'takingAmount', type: 'uint256' },
                ]
              },
              message: { makingAmount: '1000', takingAmount: '2000' },
              primaryType: 'Order'
            }
          }
        };
      }
      return {
        data: {
          status: 'OK',
          data: {
            order: { makerAmount: 1000n, takerAmount: 2000n },
            signature: '0xsignature'
          }
        }
      };
    });

    const result = await service.createAndPostOrder({
      makerAsset: '0x1111111111111111111111111111111111111111',
      takerAsset: '0x2222222222222222222222222222222222222222',
      makerAmount: '1000',
      chainId: 1,
    });

    expect(result.data.order.makerAmount).toBe(1000n);
    expect(result.data.order.takerAmount).toBe(2000n);
    expect(result.data.signature).toBeDefined();
  });
});
