import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ZeroExService } from '../src/services/zeroExService';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZeroExService', () => {
  let service: ZeroExService;

  beforeEach(() => {
    service = new ZeroExService('test-api-key');
    vi.clearAllMocks();
  });

  it('should fetch price successfully', async () => {
    const mockResponse = { data: { buyAmount: '1000' } };
    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const params = {
      sellToken: '0x123',
      buyToken: '0x456',
      sellAmount: '100',
      taker: '0xtaker',
      chainId: 1,
    };

    const result = await service.getPrice(params);
    expect(result).toEqual(mockResponse.data);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('https://api.0x.org/swap/permit2/price'),
      expect.any(Object)
    );
  });

  it('should throw ExternalApiError on failure', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { reason: 'Invalid parameters' },
      },
    });

    const params = {
      sellToken: '0x123',
      buyToken: '0x456',
      taker: '0xtaker',
      chainId: 1,
    };

    await expect(service.getPrice(params)).rejects.toThrow('Invalid parameters');
  });
});
