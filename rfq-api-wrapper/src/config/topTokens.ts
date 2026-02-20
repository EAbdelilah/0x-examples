/**
 * Top ~20 tokens by 30-day DEX trading volume per chain.
 * Excludes: liquid staking tokens (wstETH, rETH, cbETH, stMATIC)
 *           yield/algorithmic stablecoins (FRAX, sUSD, LUSD)
 * Sources: Uniswap Info, DeFiLlama, Dune Analytics (Feb 2026).
 * Keys must match the token symbols in CHAINS[chainId].tokens
 */
export const TOP_TOKENS_BY_CHAIN: Record<number, string[]> = {
    // ── Ethereum Mainnet ──────────────────────────────────────────────────────
    1: [
        'WETH', 'USDC', 'USDT', 'WBTC', 'DAI',
        'LINK', 'UNI', 'AAVE', 'MKR', 'CRV',
        'LDO', 'RPL', 'ONDO', 'ENS', 'GRT',
        'COMP', 'SNX', 'BAL', 'YFI', 'INJ',
    ],

    // ── Arbitrum ──────────────────────────────────────────────────────────────
    42161: [
        'WETH', 'USDC', 'USDT', 'WBTC', 'DAI',
        'ARB', 'LINK', 'UNI', 'AAVE', 'GMX',
        'GRT', 'MAGIC', 'RDNT', 'PENDLE', 'GRAIL',
        'JONES', 'VRTX', 'SUSHI', 'BAL', 'CRV',
    ],

    // ── Base ──────────────────────────────────────────────────────────────────
    8453: [
        'WETH', 'USDC', 'USDT', 'WBTC', 'DAI',
        'AERO', 'DEGEN', 'BRETT', 'VIRTUAL', 'TOSHI',
        'BALD', 'NORMIE', 'HIGHER', 'PRIME', 'WELL',
        'SEAM', 'AAVE', 'UNI', 'LINK', 'CRV',
    ],

    // ── Polygon ───────────────────────────────────────────────────────────────
    137: [
        'WETH', 'USDC', 'USDT', 'WBTC', 'DAI',
        'WMATIC', 'LINK', 'AAVE', 'UNI', 'CRV',
        'QUICK', 'GHST', 'SAND', 'MANA', 'AXS',
        'BAL', 'GRT', 'SUSHI', 'SNX', 'COMP',
    ],

    // ── Optimism ──────────────────────────────────────────────────────────────
    10: [
        'WETH', 'USDC', 'USDT', 'WBTC', 'DAI',
        'OP', 'LINK', 'AAVE', 'UNI', 'SNX',
        'VELO', 'PERP', 'LYRA', 'THALES', 'KWENTA',
        'GRT', 'CRV', 'BAL', 'SUSHI', 'COMP',
    ],

    // ── BSC ───────────────────────────────────────────────────────────────────
    56: [
        'WETH', 'USDC', 'USDT', 'WBTC', 'DAI',
        'BNB', 'BUSD', 'CAKE', 'XVS', 'ALPACA',
        'BAKE', 'BELT', 'EPS', 'MDX', 'AUTO',
        'DODO', 'BURGER', 'SFUND', 'CHESS', 'BANANA',
    ],
};

/**
 * Fallback list used for chains not in the map above.
 */
export const DEFAULT_TOP_TOKENS = ['WETH', 'USDC', 'USDT', 'WBTC', 'DAI'];

/**
 * Returns the top token symbols for a given chain.
 */
export function getTopTokensForChain(chainId: number): string[] {
    return TOP_TOKENS_BY_CHAIN[chainId] ?? DEFAULT_TOP_TOKENS;
}
