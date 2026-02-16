export interface ArbitragePoolConfig {
    chainId: number;
    address: string;
    dexName: string;
    version: 'v2' | 'v3';
}

export const ARBITRAGE_POOLS: ArbitragePoolConfig[] = [
    // --- Base (Chain 8453) ---
    {
        chainId: 8453,
        address: '0x885f67585f6753177651a28a221f759600a20297', // Example Aerodrome Pool
        dexName: 'Aerodrome',
        version: 'v2'
    },
    {
        chainId: 8453,
        address: '0x4c36388be6f416a29c8d8eee81c771ce6be14b18', // Uniswap V3 USDC/WETH
        dexName: 'Uniswap V3',
        version: 'v3'
    },
    {
        chainId: 8453,
        address: '0x8ad6dc699042b58ef08416d871780004f2f01f02', // Sushiswap
        dexName: 'Sushiswap',
        version: 'v2'
    },
    // --- Polygon (Chain 137) ---
    {
        chainId: 137,
        address: '0xadbF1854e5803eB8ea7BAf573516c0979db12701', // Uniswap V2 (Old)
        dexName: 'Uniswap V2 Clone',
        version: 'v2'
    },
    {
        chainId: 137,
        address: '0x45dda9cb7c25131df268515131f647d726f50608', // Quickswap V3
        dexName: 'Quickswap V3',
        version: 'v3'
    }
];
