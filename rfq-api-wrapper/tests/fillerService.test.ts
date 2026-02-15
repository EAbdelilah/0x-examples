import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FillerService } from '../src/services/fillerService';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            getBlockNumber: vi.fn().mockResolvedValue(123456n),
            getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
            getGasPrice: vi.fn().mockResolvedValue(1000000000n),
            readContract: vi.fn().mockResolvedValue(18),
        })),
    };
});

describe('FillerService', () => {
  let service: FillerService;
  let mockZeroExService: any;

  beforeEach(() => {
    process.env.PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    mockZeroExService = {
      getPrice: vi.fn(),
    };
    service = new FillerService(mockZeroExService);
    vi.clearAllMocks();
  });

  it('should monitor UniswapX and find profitable opportunities', async () => {
    process.env.SPREAD_BPS = '0';
    // Mock UniswapX API response
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        orders: [
          {
            orderHash: '0xhash1',
            input: { token: '0xuserSell', amount: '100' },
            outputs: [{ token: '0xuserBuy', amount: '90' }],
            encodedOrder: '0xencoded',
            signature: '0xsig'
          }
        ]
      }
    });

    // Mock 0x response: we can get 110 for them (profitable)
    mockZeroExService.getPrice.mockResolvedValue({
      buyAmount: '110'
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
