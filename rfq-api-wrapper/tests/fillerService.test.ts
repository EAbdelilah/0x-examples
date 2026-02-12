import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FillerService } from '../src/services/fillerService';

vi.mock('axios');
const mockedAxios = axios as any;

// Mock viem to avoid network calls
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getGasPrice: vi.fn().mockResolvedValue(1000000000n),
    })),
  };
});

describe('FillerService', () => {
  let service: FillerService;
  let mockZeroExService: any;

  beforeEach(() => {
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    service = new FillerService(mockZeroExService);
    vi.clearAllMocks();
  });

  it('should monitor UniswapX and find profitable opportunities', async () => {
    // Mock UniswapX API response
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        orders: [
          {
            orderHash: '0xhash1',
            input: {
              token: '0xuserSell',
              amount: '100'
            },
            outputs: [{
              token: '0xuserBuy',
              amount: '90'
            }],
            encodedOrder: '0xencoded',
            signature: '0xsig'
          }
        ]
      }
    });

    // Mock 0x response: we can get 100 for them
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '100'
    });

    await service.monitorUniswapX(1);

    expect(mockedAxios.get).toHaveBeenCalled();
    expect(mockZeroExService.getPrice).toHaveBeenCalledWith(expect.objectContaining({
      sellToken: '0xuserSell',
      buyToken: '0xuserBuy',
      sellAmount: '100'
    }));
  });
});
