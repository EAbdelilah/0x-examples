export interface SpokeDEX {
    name: string;
    factory: string;
    router: string;
    type: 'v2' | 'v3' | 'solidly';
}

export const SPOKES: Record<number, SpokeDEX[]> = {
    1: [ // Ethereum
        { name: 'Uniswap V2', factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', type: 'v2' },
        { name: 'SushiSwap', factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac', router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', type: 'v2' },
        { name: 'Uniswap V3', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', type: 'v3' },
    ],
    137: [ // Polygon
        { name: 'QuickSwap V2', factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', router: '0xa5E0829CaCEd8fFDD03942104615c1a7f9936024', type: 'v2' },
        { name: 'Uniswap V3', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', type: 'v3' },
    ],
    8453: [ // Base
        { name: 'Aerodrome', factory: '0x420DD3807E0e1055ADED9F0cb93231df9d1d1140', router: '0xcF77a3Ba9A5CA399DF728445A7303c82Be33469d', type: 'solidly' },
        { name: 'BaseSwap', factory: '0xF9f390F17f7263b6197298642784537E385D757A', router: '0x327Df1E6de5dA67521C6c0f1F9C60f12d1476d3e', type: 'v2' },
        { name: 'Uniswap V3', factory: '0x33128a8fC170d9361767E28C47862175916399D0', router: '0x26213694098749EE73250f38E78fE18617f6D491', type: 'v3' },
    ],
    42161: [ // Arbitrum
        { name: 'Camelot V2', factory: '0x6EcCab422D763aC031210895C81766E97e1d2850', router: '0xc873fEcbd354f5A56E00E710B90EF42d40544BD5', type: 'v2' },
        { name: 'Uniswap V3', factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984', router: '0xE592427A0AEce92De3Edee1F18E0157C05861564', type: 'v3' },
    ],
};
