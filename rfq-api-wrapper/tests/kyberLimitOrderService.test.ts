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
  });

  it('should create and sign a limit order', async () => {
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '2000',
    });

    mockedAxios.post.mockImplementation((url) => {
      if (url.includes('/sign-message')) {
        return Promise.resolve({
          data: {
            data: {
              types: {
                Order: [
                  { name: 'maker', type: 'address' },
                  { name: 'makerAsset', type: 'address' },
                  { name: 'takerAsset', type: 'address' },
                  { name: 'makingAmount', type: 'uint256' },
                  { name: 'takingAmount', type: 'uint256' },
                  { name: 'expiredAt', type: 'uint256' },
                ],
              },
              domain: {
                name: 'KyberSwap Limit Order',
                version: '1',
                chainId: 1,
                verifyingContract: '0x6198f3Ff277a0F302482387B443B0068D2e379F2',
              },
              message: {
                maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                makerAsset: '0x1111111111111111111111111111111111111111',
                takerAsset: '0x2222222222222222222222222222222222222222',
                makingAmount: '1000',
                takingAmount: '2000',
                expiredAt: 1700000000,
              },
              primaryType: 'Order',
            }
          }
        });
      }
      return Promise.resolve({ data: { status: 'OK', orderHash: '0xhash' } });
    });

    const result = await service.createAndPostOrder({
      makerAsset: '0x1111111111111111111111111111111111111111',
      takerAsset: '0x2222222222222222222222222222222222222222',
      makerAmount: '1000',
      chainId: 1,
    });

    expect(result.orderHash).toBe('0xhash');
    expect(result.signature).toBeDefined();
    expect(result.signature).toMatch(/^0x/);
  });
});
