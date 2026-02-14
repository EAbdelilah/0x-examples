export interface ChainConfig {
    name: string;
    chainId: number;
    tokens: {
        [symbol: string]: string;
    };
    uniswapXReactor?: string;
}

export const CHAINS: Record<number, ChainConfig> = {
    1: {
        name: 'Ethereum',
        chainId: 1,
        tokens: {
            WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        },
        uniswapXReactor: '0x00000011F84B9aa48e5f8aA8B9897600006289Be',
    },
    10: {
        name: 'Optimism',
        chainId: 10,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
            USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            WBTC: '0x68f180fcCe6836688e9084f035309E29BFd0a2095',
        },
    },
    56: {
        name: 'BSC',
        chainId: 56,
        tokens: {
            WETH: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
            USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            USDT: '0x55d398326f99059ff775485246999027b3197955',
            WBTC: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
        },
    },
    137: {
        name: 'Polygon',
        chainId: 137,
        tokens: {
            WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
            USDC: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
            USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        },
        uniswapXReactor: '0x6000da47483062A0D734Ba3dc7576Ce6A0B645C4',
    },
    250: {
        name: 'Fantom',
        chainId: 250,
        tokens: {
            WETH: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
            USDC: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
            USDT: '0x049d68029688eabf473097a2fc38ef61633a3c7a',
            WBTC: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
        },
    },
    480: {
        name: 'Worldchain',
        chainId: 480,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
            WBTC: '0x03c7054bcb39f7b2e5b2c7acb37583e32d70cfa3',
        },
    },
    2741: {
        name: 'Abstract',
        chainId: 2741,
        tokens: {
            WETH: '0x3439153EB7AF838Ad19d56E1571FBD09333C2809',
            USDC: '0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1',
        },
    },
    5000: {
        name: 'Mantle',
        chainId: 5000,
        tokens: {
            WETH: '0x78c1b0c116c139709c7480932180540aae329438',
            USDC: '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9',
            USDT: '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
            WBTC: '0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2',
        },
    },
    8453: {
        name: 'Base',
        chainId: 8453,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            USDT: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
            WBTC: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
        },
        uniswapXReactor: '0x000000001Ec5656dcdB24D90DFa42742738De729',
    },
    34443: {
        name: 'Mode',
        chainId: 34443,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0xd988097fb8612cc24eeC14542bC03424c656005f',
            USDT: '0xf0F161fDA2712DB8b566946122a5af183995e2eD',
            WBTC: '0xcDd475325D6F564d27247D1DddBb0DAc6fA0a5CF',
        },
    },
    42161: {
        name: 'Arbitrum',
        chainId: 42161,
        tokens: {
            WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            WBTC: '0x2f2a2543B76A92837466Cc2A9AB68e52bD69AAE4',
        },
        uniswapXReactor: '0xB274d5F4b833b61B340b654d600A864fB604a87c',
    },
    43114: {
        name: 'Avalanche',
        chainId: 43114,
        tokens: {
            WETH: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
            USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
            WBTC: '0x50b7545627a5162f82a992c33b87adc75187b218',
        },
    },
    42220: {
        name: 'Celo',
        chainId: 42220,
        tokens: {
            WETH: '0x471EcE3750Da237f93B8E2997253961114131291',
            USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
            USDT: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
        },
    },
    59144: {
        name: 'Linea',
        chainId: 59144,
        tokens: {
            WETH: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
            USDC: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
            USDT: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
            WBTC: '0x3aAb2285a73E4b789d713C7c2514300f8623A9d0',
        },
    },
    81457: {
        name: 'Blast',
        chainId: 81457,
        tokens: {
            WETH: '0x4300000000000000000000000000000000000004',
            USDC: '0x4300000000000000000000000000000000000003',
            USDT: '0x4300000000000000000000000000000000000003', // Note: Blast USDT is same as USDC for some pools, but let's be careful. Actually 0x43...3 is USDB.
            USDB: '0x4300000000000000000000000000000000000003',
            WBTC: '0xF7bc58b8D8f97ADC129cfC4c9f45Ce3C0E1D2692',
        },
    },
    534352: {
        name: 'Scroll',
        chainId: 534352,
        tokens: {
            WETH: '0x5300000000000000000000000000000000000004',
            USDC: '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4',
            USDT: '0xf55bec9c4b7a2d44099df', // Bridged
            WBTC: '0x3c1bca5a2ca82285ddb40e4f20387b92f72daca6',
        },
    },
    10143: {
        name: 'MonadTestnet',
        chainId: 10143,
        tokens: {
            WETH: '0x760AfE868A0abf4700021667A5BB969Af6786638',
            USDC: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        },
    },
    130: {
        name: 'Unichain',
        chainId: 130,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
            WBTC: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
        },
        uniswapXReactor: '0x00000006021a6Bce796be7ba509BBBA71e956e37',
    },
    80094: {
        name: 'Berachain',
        chainId: 80094,
        tokens: {
            WETH: '0x6969696969696969696969696969696969696969',
            USDC: '0xFCBD14DC51f0A4d49d5E53C2E0950e0bC26d0Dce',
            WBTC: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
        },
    },
    57073: {
        name: 'Ink',
        chainId: 57073,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0x2d270e6886d130d724215a266106e6832161eaed',
        },
    },
    9745: {
        name: 'Plasma',
        chainId: 9745,
        tokens: {
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0xcccccccc7021b32ebb4e8c08314bd62f7c653ec4',
        },
    },
    143: {
        name: 'Monad',
        chainId: 143,
        tokens: {
            WETH: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
            USDC: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
            WBTC: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
        },
    },
    146: {
        name: 'Sonic',
        chainId: 146,
        tokens: {
            WETH: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
            USDC: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
            USDT: '0x6047828dc181963ba44974801ff68e538da5eaf9',
            WBTC: '0xe2dafd676ab908eed01d34b0243ccaf04ecfdef3',
        },
    },
};
