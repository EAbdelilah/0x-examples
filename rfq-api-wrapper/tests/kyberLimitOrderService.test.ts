import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KyberLimitOrderService } from '../src/services/kyberLimitOrderService';
import axios from 'axios';

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
    vi.clearAllMocks();
  });

  it('should create and sign a limit order', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '2000',
    });

    // Mock KyberSwap sign-message response
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          types: {
            EIP712Domain: [],
            Order: [{ name: 'maker', type: 'address' }]
          },
          domain: {},
          message: {
            maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            makerAsset: '0x1111111111111111111111111111111111111111',
            takerAsset: '0x2222222222222222222222222222222222222222',
            makingAmount: '1000',
            takingAmount: '2000',
            salt: '1',
            expiredAt: 1234567890
          },
          primaryType: 'Order'
        }
      }
    });

    // Mock KyberSwap post order response
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        status: 'SUCCESS',
        data: {
          order: {
            makingAmount: '1000',
            takingAmount: '2000',
          },
          signature: '0xsignature'
        }
      }
    });

    const result = await service.createAndPostOrder({
      makerAsset: '0x1111111111111111111111111111111111111111',
      takerAsset: '0x2222222222222222222222222222222222222222',
      makerAmount: '1000',
      chainId: 1,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.data.order.makingAmount).toBe('1000');
    expect(result.data.order.takingAmount).toBe('2000');
    expect(result.data.signature).toBeDefined();
  });
});
