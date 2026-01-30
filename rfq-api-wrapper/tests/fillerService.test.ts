import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FillerService } from '../src/services/fillerService';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
            sellToken: '0xuserSell',
            buyToken: '0xuserBuy',
            sellAmount: '100',
            currentOutputs: [{ amount: '90' }], // User wants 90
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

    // We expect log or some action. Since executeFill just logs for now, we'll spy on logger.
    // However, the test will verify the flow doesn't crash and mocks are called.

    await service.monitorUniswapX(1);

    expect(mockedAxios.get).toHaveBeenCalled();
    expect(mockZeroExService.getPrice).toHaveBeenCalledWith(expect.objectContaining({
      sellToken: '0xuserSell',
      buyToken: '0xuserBuy',
      sellAmount: '100'
    }));
  });
});
