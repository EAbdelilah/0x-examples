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
            input: {
              token: '0xuserSell',
              amount: '100',
            },
            outputs: [
              {
                token: '0xuserBuy',
                amount: '90',
              },
            ],
            encodedOrder: '0xencoded',
            signature: '0xsig'
          }
        ]
      }
    });

    // Mock 0x response: we can get 110 for them (User wants 90, 0x gives 110 -> 20 profit)
    mockZeroExService.getPrice.mockResolvedValueOnce({
      buyAmount: '110'
    });

    // Mock 0x response for gas conversion (ETH -> 0xuserBuy)
    // Gas cost is 300,000 * 10 gwei (standard viem mock gas price) = 3,000,000,000,000,000 wei = 0.003 ETH
    // If 1 ETH = 1000 0xuserBuy, then 0.003 ETH = 3 0xuserBuy.
    // profit (20) > gas (3) -> profitable!
    mockZeroExService.getPrice.mockResolvedValueOnce({
      buyAmount: '1000'
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
