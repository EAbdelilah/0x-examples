import logger from '../utils/logger';

export interface SpreadConfig {
    baseSpreadBps: number;
    volatilityMultiplier: number;
    minSpreadBps: number;
    maxSpreadBps: number;
}

export interface TokenVolatility {
    symbol: string;
    priceChangePercent24h: number;
    lastUpdated: number;
}

export class SpreadService {
    private config: SpreadConfig;
    private volatilityCache: Map<string, TokenVolatility> = new Map();
    private readonly CACHE_TTL_MS = 300000; // 5 minutes

    constructor() {
        this.config = {
            baseSpreadBps: Number(process.env.SPREAD_BPS || '10'),
            volatilityMultiplier: Number(process.env.VOLATILITY_MULTIPLIER || '2'),
            minSpreadBps: Number(process.env.MIN_SPREAD_BPS || '5'),
            maxSpreadBps: Number(process.env.MAX_SPREAD_BPS || '100'),
        };
    }

    /**
     * Calculate dynamic spread based on multiple factors
     */
    calculateSpread(params: {
        sellToken: string;
        buyToken: string;
        sellAmount: string;
        chainId: number;
    }): number {
        let spread = this.config.baseSpreadBps;

        // 1. Volatility Adjustment
        const volatilityAdjustment = this.getVolatilityAdjustment(params.buyToken);
        spread += volatilityAdjustment;

        // 2. Trade Size Adjustment (larger trades = higher spread for risk)
        const sizeAdjustment = this.getTradeSizeAdjustment(params.sellAmount);
        spread += sizeAdjustment;

        // 3. Time-of-Day Adjustment (lower liquidity = higher spread)
        const timeAdjustment = this.getTimeOfDayAdjustment();
        spread += timeAdjustment;

        // 4. Chain-Specific Adjustment (L2s can afford tighter spreads due to lower gas)
        const chainAdjustment = this.getChainAdjustment(params.chainId);
        spread += chainAdjustment;

        // Clamp to min/max
        spread = Math.max(this.config.minSpreadBps, Math.min(this.config.maxSpreadBps, spread));

        logger.debug(`Calculated spread: ${spread} bps (base: ${this.config.baseSpreadBps}, vol: ${volatilityAdjustment}, size: ${sizeAdjustment}, time: ${timeAdjustment}, chain: ${chainAdjustment})`);

        return spread;
    }

    /**
     * Volatility-based adjustment
     * Higher volatility = wider spread to protect against adverse price movements
     */
    private getVolatilityAdjustment(tokenAddress: string): number {
        const cached = this.volatilityCache.get(tokenAddress.toLowerCase());

        if (!cached || Date.now() - cached.lastUpdated > this.CACHE_TTL_MS) {
            // Default to moderate volatility if no data
            return this.config.baseSpreadBps * 0.5;
        }

        const absChange = Math.abs(cached.priceChangePercent24h);

        // Scale: 0-5% change = 0 bps, 5-10% = +5 bps, 10%+ = +10 bps
        if (absChange < 5) return 0;
        if (absChange < 10) return 5;
        return Math.min(20, absChange * this.config.volatilityMultiplier);
    }

    /**
     * Trade size adjustment
     * Larger trades require wider spreads due to slippage risk
     */
    private getTradeSizeAdjustment(sellAmount: string): number {
        const amount = BigInt(sellAmount);

        // Thresholds (assuming 18 decimals for simplicity)
        const small = BigInt(10) ** BigInt(18); // 1 token
        const medium = BigInt(100) ** BigInt(18); // 100 tokens
        const large = BigInt(1000) ** BigInt(18); // 1000 tokens

        if (amount < small) return -2; // Tighter spread for tiny trades
        if (amount < medium) return 0;
        if (amount < large) return 3;
        return 5; // Wider spread for large trades
    }

    /**
     * Time-of-day adjustment
     * Lower liquidity during off-hours = wider spread
     */
    private getTimeOfDayAdjustment(): number {
        const hour = new Date().getUTCHours();

        // Peak hours (8 AM - 8 PM UTC): tighter spreads
        if (hour >= 8 && hour < 20) return 0;

        // Off-hours: +3 bps
        return 3;
    }

    /**
     * Chain-specific adjustment
     * L2s have lower gas costs, so we can afford tighter spreads
     */
    private getChainAdjustment(chainId: number): number {
        const l2Chains = [137, 8453, 42161, 10, 130]; // Polygon, Base, Arbitrum, Optimism, Unichain

        if (l2Chains.includes(chainId)) {
            return -2; // Tighter spread on L2s
        }

        return 0; // Mainnet keeps base spread
    }

    /**
     * Update volatility data for a token
     * This would typically be called by a background service that fetches price data
     */
    updateVolatility(tokenAddress: string, priceChangePercent24h: number) {
        this.volatilityCache.set(tokenAddress.toLowerCase(), {
            symbol: tokenAddress,
            priceChangePercent24h,
            lastUpdated: Date.now(),
        });
    }

    /**
     * Apply spread to a buy amount
     */
    applySpread(buyAmount: string, spreadBps: number): string {
        const amount = BigInt(buyAmount);
        const multiplier = BigInt(10000 - spreadBps);
        const result = (amount * multiplier) / 10000n;
        return result.toString();
    }
}

export const spreadService = new SpreadService();
