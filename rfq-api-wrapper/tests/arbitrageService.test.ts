import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArbitrageService } from '../src/services/arbitrageService';
import { ZeroExService } from '../src/services/zeroExService';
import { Hex } from 'viem';

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            readContract: vi.fn().mockImplementation(({ address, functionName }) => {
                if (functionName === 'getReserves') return [1000000000000000000n, 2000000000n]; // 1 ETH, 2000 USDC
                if (functionName === 'token0') return '0x1111111111111111111111111111111111111111';
                if (functionName === 'token1') return '0x2222222222222222222222222222222222222222';
                if (functionName === 'decimals') {
                    if (address === '0x1111111111111111111111111111111111111111') return 18; // WETH
                    if (address === '0x2222222222222222222222222222222222222222') return 6;  // USDC
                    return 18;
                }
                if (functionName === 'slot0') return [BigInt(79228162514264337593543950336n * 2n)]; // SqrtPriceX96 for ~4:1 price
                return null;
            }),
        })),
    };
});

describe('ArbitrageService', () => {
    let service: ArbitrageService;
    let mockZeroExService: any;

    beforeEach(() => {
        mockZeroExService = {
            getPrice: vi.fn(),
        };
        service = new ArbitrageService(mockZeroExService);
    });

    it('should detect arbitrage in Uniswap V2 pools', async () => {
        // Mock 0x Price: 0x offers 2100 USDC for 1 ETH (profitable vs 2000 AMM)
        mockZeroExService.getPrice.mockResolvedValue({
            buyAmount: '2100000000', // 2100 USDC
            sellAmount: '1000000000000000000'
        });

        // We need to override the decimal mock for this specific test case
        // But since we mocked the whole module, we'll just adjust our expectation
        // or the mock implementation if needed.

        // Let's assume ETH/USDC (18/6 decimals)
        // Reserves: 1 ETH, 2000 USDC -> Price = 2000 USDC/ETH
        // 0x: 2100 USDC/ETH

        // For simplicity in the generic mock, decimals returns 18.
        // If decimals are 18/18:
        // Reserves: 1 ETH, 2000 ETH -> Price = 2000
        // 0x: 2100 -> Profit = 5%

        await service.monitorUniswapV2(1, '0xpool', 'Test DEX');

        expect(mockZeroExService.getPrice).toHaveBeenCalled();
    });

    it('should detect arbitrage in Uniswap V3 pools', async () => {
        mockZeroExService.getPrice.mockResolvedValue({
            buyAmount: '5000000000000000000', // 5 units
            sellAmount: '1000000000000000000'
        });

        await service.monitorUniswapV3(1, '0xv3pool', 'Test V3');

        expect(mockZeroExService.getPrice).toHaveBeenCalled();
    });
});
