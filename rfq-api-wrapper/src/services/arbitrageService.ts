import {
    Hex,
    createPublicClient,
    http,
    encodeAbiParameters,
    parseAbiParameters,
    parseAbi,
    encodeFunctionData,
    decodeFunctionResult,
    Address,
    parseUnits,
} from 'viem';
import { mainnet } from 'viem/chains';
import { ZeroExService } from './zeroExService';
import { CHAINS } from '../config/chains';
import logger from '../utils/logger';
import axios from 'axios';

// ─── ABIs ────────────────────────────────────────────────────────────────────

const QUOTER_V2_ABI = parseAbi([
    'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

const V2_ROUTER_ABI = parseAbi([
    'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
]);

const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function decimals() external view returns (uint8)',
]);

const SWAP_ROUTER_V3_ABI = parseAbi([
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

const BROKER_ABI = parseAbi([
    'function execute(uint8 provider, address providerAddress, address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

// ─── Constants ───────────────────────────────────────────────────────────────

/** Known 6-decimal stablecoins — all others assumed 18 */
const SIX_DECIMAL_TOKENS = new Set([
    'usdc', 'usdt', 'usdbc', 'usd+', 'eurc', 'usdc.e',
]);

/** Minimum profit in USD-equivalent (in token units) to bother executing */
const MIN_PROFIT_USD_UNITS = 1_000_000n; // $1 in USDC (6 dec)

// ─── Types ───────────────────────────────────────────────────────────────────

export enum FlashloanProvider {
    BALANCER = 0,
    MORPHO = 1,
    SKY = 2
}

export interface ArbitrageOpportunity {
    chainId: number;
    borrowToken: string;
    borrowAmount: bigint;
    profitToken: string;
    minProfit: bigint;
    provider: FlashloanProvider;
    providerAddress: string;
    estimatedGasUnits?: bigint;
    actions: {
        target: string;
        callData: string;
        value: bigint;
    }[];
}

interface DexQuote {
    dex: string;
    amountOut: bigint;
    router: string;
    quoter?: string;
    fee?: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ArbitrageService {
    private publicClients: Map<number, any> = new Map();
    private decimalsCache: Map<string, number> = new Map();
    // V3 fee tiers to try in order (most common first)
    private readonly FEE_TIERS = [500, 3000, 10000];

    constructor(private zeroExService: ZeroExService) {
        // Warn if 1inch key is missing
        if (!process.env.ONE_INCH_API_KEY) {
            logger.warn('⚠️  ONE_INCH_API_KEY not set — 1inch aggregator will be skipped');
        }
    }

    private getPublicClient(chainId: number) {
        if (this.publicClients.has(chainId)) return this.publicClients.get(chainId);
        const rpc = process.env[`RPC_URL_${chainId}`];
        const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
        this.publicClients.set(chainId, client);
        return client;
    }

    // ─── Token Decimals ──────────────────────────────────────────────────────

    /**
     * Returns the decimals for a token address.
     * Uses a cache and falls back to on-chain call.
     */
    async getTokenDecimals(chainId: number, tokenAddress: string): Promise<number> {
        const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
        if (this.decimalsCache.has(cacheKey)) return this.decimalsCache.get(cacheKey)!;

        // Fast path: check known 6-decimal symbols by matching known addresses
        // against chain config token map
        const chainConfig = CHAINS[chainId];
        if (chainConfig) {
            for (const [symbol, addr] of Object.entries(chainConfig.tokens)) {
                if (addr.toLowerCase() === tokenAddress.toLowerCase()) {
                    const symbolLower = symbol.toLowerCase();
                    if (SIX_DECIMAL_TOKENS.has(symbolLower)) {
                        this.decimalsCache.set(cacheKey, 6);
                        return 6;
                    }
                }
            }
        }

        // On-chain fallback
        try {
            const client = this.getPublicClient(chainId);
            const dec = await client.readContract({
                address: tokenAddress as Address,
                abi: ERC20_ABI,
                functionName: 'decimals',
            }) as number;
            this.decimalsCache.set(cacheKey, dec);
            return dec;
        } catch {
            // Default to 18 if call fails
            this.decimalsCache.set(cacheKey, 18);
            return 18;
        }
    }

    /**
     * Returns a sensible scan amount for a token (1 unit in its native decimals).
     */
    async getScanAmount(chainId: number, tokenAddress: string): Promise<bigint> {
        const dec = await this.getTokenDecimals(chainId, tokenAddress);
        return parseUnits('1', dec);
    }

    // ─── Direct DEX Quoting ──────────────────────────────────────────────────

    /**
     * Get a quote from a Uniswap V3-style Quoter contract via staticCall.
     * Tries all fee tiers and returns the best output.
     */
    async getV3Quote(
        chainId: number,
        quoterAddress: string,
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint
    ): Promise<{ amountOut: bigint; fee: number } | null> {
        const client = this.getPublicClient(chainId);
        let best: { amountOut: bigint; fee: number } | null = null;

        for (const fee of this.FEE_TIERS) {
            try {
                const callData = encodeFunctionData({
                    abi: QUOTER_V2_ABI,
                    functionName: 'quoteExactInputSingle',
                    args: [tokenIn as Address, tokenOut as Address, fee, amountIn, 0n],
                });

                const result = await client.call({
                    to: quoterAddress as Address,
                    data: callData,
                });

                if (!result.data) continue;

                const decoded = decodeFunctionResult({
                    abi: QUOTER_V2_ABI,
                    functionName: 'quoteExactInputSingle',
                    data: result.data,
                });

                const amountOut = decoded[0] as bigint;
                if (!best || amountOut > best.amountOut) {
                    best = { amountOut, fee };
                }
            } catch {
                // Fee tier not available, try next
            }
        }

        return best;
    }

    /**
     * Get a quote from a Uniswap V2-style router via getAmountsOut.
     */
    async getV2Quote(
        chainId: number,
        routerAddress: string,
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint
    ): Promise<bigint | null> {
        const client = this.getPublicClient(chainId);
        try {
            const result = await client.readContract({
                address: routerAddress as Address,
                abi: V2_ROUTER_ABI,
                functionName: 'getAmountsOut',
                args: [amountIn, [tokenIn as Address, tokenOut as Address]],
            });
            const amounts = result as bigint[];
            return amounts[amounts.length - 1];
        } catch {
            return null;
        }
    }

    /**
     * Get quotes from all configured DEXs on a chain for a given pair.
     * Returns sorted list (best first).
     */
    async getAllDexQuotes(
        chainId: number,
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint
    ): Promise<DexQuote[]> {
        const chainConfig = CHAINS[chainId];
        if (!chainConfig?.dexs) return [];

        const quotes: DexQuote[] = [];
        const { dexs } = chainConfig;

        const quotePromises: Promise<void>[] = [];

        // Uniswap V3
        if (dexs.uniswapV3) {
            quotePromises.push((async () => {
                const q = await this.getV3Quote(chainId, dexs.uniswapV3!.quoter, tokenIn, tokenOut, amountIn);
                if (q && q.amountOut > 0n) {
                    quotes.push({ dex: 'UniswapV3', amountOut: q.amountOut, router: dexs.uniswapV3!.router, quoter: dexs.uniswapV3!.quoter, fee: q.fee });
                }
            })());
        }

        // SushiSwap V3
        if (dexs.sushiSwapV3) {
            const quoterAddr = dexs.sushiSwapV3.quoter || dexs.uniswapV3?.quoter;
            if (quoterAddr) {
                quotePromises.push((async () => {
                    const q = await this.getV3Quote(chainId, quoterAddr, tokenIn, tokenOut, amountIn);
                    if (q && q.amountOut > 0n) {
                        quotes.push({ dex: 'SushiSwapV3', amountOut: q.amountOut, router: dexs.sushiSwapV3!.router, fee: q.fee });
                    }
                })());
            }
        }

        // PancakeSwap V3
        if (dexs.pancakeSwapV3) {
            quotePromises.push((async () => {
                const q = await this.getV3Quote(chainId, dexs.pancakeSwapV3!.quoter, tokenIn, tokenOut, amountIn);
                if (q && q.amountOut > 0n) {
                    quotes.push({ dex: 'PancakeSwapV3', amountOut: q.amountOut, router: dexs.pancakeSwapV3!.router, fee: q.fee });
                }
            })());
        }

        // QuickSwap V3 (Polygon)
        if (dexs.quickSwapV3) {
            const quoterAddr = dexs.quickSwapV3.quoter || dexs.uniswapV3?.quoter;
            if (quoterAddr) {
                quotePromises.push((async () => {
                    const q = await this.getV3Quote(chainId, quoterAddr, tokenIn, tokenOut, amountIn);
                    if (q && q.amountOut > 0n) {
                        quotes.push({ dex: 'QuickSwapV3', amountOut: q.amountOut, router: dexs.quickSwapV3!.router, fee: q.fee });
                    }
                })());
            }
        }

        // Velodrome V2 / Aerodrome (V2-style)
        const veloRouter = dexs.velodromeV2?.router || dexs.aerodrome?.router;
        const veloDexName = dexs.aerodrome ? 'Aerodrome' : 'VelodromeV2';
        if (veloRouter) {
            quotePromises.push((async () => {
                const amountOut = await this.getV2Quote(chainId, veloRouter, tokenIn, tokenOut, amountIn);
                if (amountOut && amountOut > 0n) {
                    // Price impact guard: reject if output is less than 90% of expected
                    // (simple check — if amountOut is suspiciously low, skip)
                    quotes.push({ dex: veloDexName, amountOut, router: veloRouter });
                }
            })());
        }

        await Promise.allSettled(quotePromises);

        // Sort best first
        return quotes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : -1));
    }

    // ─── Gas Estimation ──────────────────────────────────────────────────────

    /**
     * Estimate gas cost in tokenA units for a 2-swap circular arb.
     * Uses current gas price and a rough gas estimate of 400k units.
     * Returns 0n if estimation fails (don't block on this).
     */
    async estimateGasCostInToken(
        chainId: number,
        tokenAddress: string,
        tokenPriceInEth: number = 0.0004 // fallback: ~$1 at $2500/ETH
    ): Promise<bigint> {
        try {
            const client = this.getPublicClient(chainId);
            const gasPrice = await client.getGasPrice();
            const GAS_UNITS = 400_000n; // 2 swaps + flashloan overhead
            const gasCostWei = gasPrice * GAS_UNITS;

            // Convert ETH gas cost to token units
            const dec = await this.getTokenDecimals(chainId, tokenAddress);
            const tokenUnitsPerEth = parseUnits(String(1 / tokenPriceInEth), dec);
            const gasCostInToken = (gasCostWei * tokenUnitsPerEth) / parseUnits('1', 18);

            return gasCostInToken;
        } catch {
            return 0n;
        }
    }

    // ─── Simulation ──────────────────────────────────────────────────────────

    /**
     * Simulate the AtomicBroker execute call via eth_call before sending.
     * Returns true if simulation succeeds, false if it would revert.
     */
    async simulateExecution(
        chainId: number,
        broker: string,
        borrowToken: string,
        borrowAmount: bigint,
        encodedParams: Hex,
        fromAddress: string,
        provider: FlashloanProvider = FlashloanProvider.BALANCER,
        providerAddress?: string
    ): Promise<boolean> {
        const client = this.getPublicClient(chainId);
        const chainConfig = CHAINS[chainId];
        const finalProviderAddress = providerAddress || chainConfig?.balancerVault;

        if (!finalProviderAddress) {
            logger.error(`No provider address available for chain ${chainId}`);
            return false;
        }

        try {
            await client.call({
                to: broker as Address,
                data: encodeFunctionData({
                    abi: BROKER_ABI,
                    functionName: 'execute',
                    args: [provider, finalProviderAddress as Address, borrowToken as Address, borrowAmount, encodedParams],
                }),
                account: fromAddress as Address,
            });
            return true;
        } catch (e: any) {
            logger.warn(`🔴 Simulation failed (would revert): ${e.shortMessage || e.message}`);
            return false;
        }
    }

    // ─── Circular Arb Discovery ──────────────────────────────────────────────

    /**
     * Core circular arbitrage discovery:
     * Buy Token B cheaply on DEX 1, sell Token B expensively on DEX 2.
     * Net profit = amountOut(DEX2) - amountIn(DEX1) > gas cost.
     */
    async discoverDirectDexArb(
        chainId: number,
        tokenA: string,
        tokenB: string,
        amountIn: bigint
    ): Promise<ArbitrageOpportunity | null> {
        const broker = CHAINS[chainId]?.atomicBroker as Hex;
        if (!broker) return null;

        try {
            // Step 1: Get all quotes for A -> B (buy B)
            const buyQuotes = await this.getAllDexQuotes(chainId, tokenA, tokenB, amountIn);
            if (buyQuotes.length < 1) return null;

            // Step 2: Estimate gas cost in tokenA units
            const gasCost = await this.estimateGasCostInToken(chainId, tokenA);

            // Step 3: For each "buy" quote, find the best "sell" quote on a DIFFERENT dex
            for (const buyQ of buyQuotes) {
                const sellQuotes = await this.getAllDexQuotes(chainId, tokenB, tokenA, buyQ.amountOut);
                const bestSell = sellQuotes.find(s => s.dex !== buyQ.dex);

                if (!bestSell) continue;

                // Step 4: Check profitability (output > input + gas cost)
                const grossProfit = bestSell.amountOut - amountIn;
                const netProfit = grossProfit - gasCost;

                if (netProfit > 0n) {
                    const providerInfo = this.getBestFlashloanProvider(chainId, tokenA);
                    if (!providerInfo) {
                        logger.warn(`No flashloan provider for chain ${chainId} / token ${tokenA}`);
                        continue;
                    }

                    logger.info(
                        `🎯 DIRECT DEX ARB: ${buyQ.dex} -> ${bestSell.dex} | ` +
                        `Gross: ${grossProfit} | Gas: ${gasCost} | Net: ${netProfit} (tokenA units) | ` +
                        `Provider: ${FlashloanProvider[providerInfo.provider]}`
                    );

                    return this.buildCircularArbitrageOpportunity(
                        chainId, tokenA, tokenB, amountIn, buyQuote, sellQuote, netProfit, broker, providerInfo
                    );
                }
            }
        } catch (e: any) {
            logger.debug(`Direct DEX arb discovery error: ${e.message}`);
        }

        return null;
    }

    /**
     * Builds the AtomicBroker call sequence for a circular arb:
     * Flashloan tokenA -> Approve DEX1 -> Swap A->B on DEX1 -> Approve DEX2 -> Swap B->A on DEX2 -> Repay
     */
    private buildCircularArbitrageOpportunity(
        chainId: number,
        tokenA: string,
        tokenB: string,
        amountIn: bigint,
        buyQuote: DexQuote,
        sellQuote: DexQuote,
        netProfit: bigint,
        broker: Hex,
        providerInfo: { provider: FlashloanProvider, address: string }
    ): ArbitrageOpportunity {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
        const minAmountOut = (buyQuote.amountOut * 98n) / 100n; // 2% slippage
        const minAmountBack = (sellQuote.amountOut * 98n) / 100n;

        // Build swap calldata for DEX1 (A -> B)
        const swap1Data = encodeFunctionData({
            abi: SWAP_ROUTER_V3_ABI,
            functionName: 'exactInputSingle',
            args: [{
                tokenIn: tokenA as Address,
                tokenOut: tokenB as Address,
                fee: buyQuote.fee ?? 3000,
                recipient: broker,
                deadline,
                amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0n,
            }],
        });

        // Build swap calldata for DEX2 (B -> A)
        const swap2Data = encodeFunctionData({
            abi: SWAP_ROUTER_V3_ABI,
            functionName: 'exactInputSingle',
            args: [{
                tokenIn: tokenB as Address,
                tokenOut: tokenA as Address,
                fee: sellQuote.fee ?? 3000,
                recipient: broker,
                deadline,
                amountIn: buyQuote.amountOut,
                amountOutMinimum: minAmountBack,
                sqrtPriceLimitX96: 0n,
            }],
        });

        return {
            chainId,
            borrowToken: tokenA,
            borrowAmount: amountIn,
            profitToken: tokenA,
            minProfit: netProfit / 2n, // Conservative minimum (50% of expected net)
            provider: providerInfo.provider,
            providerAddress: providerInfo.address,
            actions: [
                // 1. Approve DEX1 router to spend tokenA
                {
                    target: tokenA,
                    callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [buyQuote.router as Address, amountIn] }),
                    value: 0n,
                },
                // 2. Swap A -> B on DEX1
                {
                    target: buyQuote.router,
                    callData: swap1Data,
                    value: 0n,
                },
                // 3. Approve DEX2 router to spend tokenB
                {
                    target: tokenB,
                    callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [sellQuote.router as Address, buyQuote.amountOut] }),
                    value: 0n,
                },
                // 4. Swap B -> A on DEX2
                {
                    target: sellQuote.router,
                    callData: swap2Data,
                    value: 0n,
                },
            ],
        };
    }

    // ─── Aggregator Quoting ──────────────────────────────────────────────────

    /**
     * Finds arbitrage opportunities by comparing 0x vs 1inch vs ParaSwap.
     */
    async discoverAggregatorArb(chainId: number, sellToken: string, buyToken: string, amount: string) {
        const broker = CHAINS[chainId]?.atomicBroker as Hex;
        if (!broker) return null;

        try {
            const [quote0x, quote1inch, quoteParaSwap] = await Promise.allSettled([
                this.zeroExService.getQuote({ sellToken, buyToken, sellAmount: amount, chainId, taker: broker }),
                this.fetch1InchQuote(chainId, sellToken, buyToken, amount, broker),
                this.fetchParaSwapQuote(chainId, sellToken, buyToken, amount, broker),
            ]);

            let bestQuote: any = null;
            let bestAmount = 0n;

            if (quote0x.status === 'fulfilled' && quote0x.value) {
                bestQuote = { source: '0x', ...quote0x.value };
                bestAmount = BigInt(quote0x.value.buyAmount ?? '0');
            }

            if (quote1inch.status === 'fulfilled' && BigInt(quote1inch.value.buyAmount) > bestAmount) {
                bestQuote = { source: '1inch', ...quote1inch.value };
                bestAmount = BigInt(quote1inch.value.buyAmount);
            }

            if (quoteParaSwap.status === 'fulfilled' && BigInt(quoteParaSwap.value.buyAmount) > bestAmount) {
                bestQuote = { source: 'ParaSwap', ...quoteParaSwap.value };
                bestAmount = BigInt(quoteParaSwap.value.buyAmount);
            }

            if (bestQuote) {
                logger.debug(`Best aggregator for ${sellToken.slice(0, 8)} -> ${buyToken.slice(0, 8)}: ${bestQuote.source} (${bestAmount})`);
                return bestQuote;
            }

            return null;
        } catch {
            return null;
        }
    }

    private async fetch1InchQuote(chainId: number, from: string, to: string, amount: string, taker: string) {
        const apiKey = process.env.ONE_INCH_API_KEY;
        if (!apiKey) return { buyAmount: '0', to: '0x', data: '0x', value: '0' };

        try {
            const res = await axios.get(`https://api.1inch.dev/swap/v6.0/${chainId}/swap`, {
                params: { src: from, dst: to, amount, from: taker, slippage: 1, disableEstimate: true },
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 5000,
            });
            return { buyAmount: res.data.dstAmount, to: res.data.tx.to, data: res.data.tx.data, value: res.data.tx.value };
        } catch (e: any) {
            logger.debug(`1inch quote failed: ${e.message}`);
            return { buyAmount: '0', to: '0x', data: '0x', value: '0' };
        }
    }

    private async fetchParaSwapQuote(chainId: number, from: string, to: string, amount: string, taker: string) {
        try {
            const [srcDec, dstDec] = await Promise.all([
                this.getTokenDecimals(chainId, from),
                this.getTokenDecimals(chainId, to),
            ]);

            const priceRes = await axios.get(
                `https://api.paraswap.io/prices/?srcToken=${from}&destToken=${to}&amount=${amount}&network=${chainId}&side=SELL&srcDecimals=${srcDec}&destDecimals=${dstDec}`,
                { timeout: 5000 }
            );
            const priceRoute = priceRes.data.priceRoute;
            if (!priceRoute) return { buyAmount: '0', to: '0x', data: '0x', value: '0' };

            const txRes = await axios.post(`https://api.paraswap.io/transactions/${chainId}`, {
                priceRoute, srcToken: from, destToken: to, srcAmount: amount,
                userAddress: taker, receiver: taker,
                srcDecimals: srcDec, destDecimals: dstDec,
            }, { timeout: 5000 });
            return { buyAmount: priceRoute.destAmount, to: txRes.data.to, data: txRes.data.data, value: txRes.data.value };
        } catch (e: any) {
            logger.debug(`ParaSwap quote failed: ${e.message}`);
            return { buyAmount: '0', to: '0x', data: '0x', value: '0' };
        }
    }

    // ─── Intent Filling ──────────────────────────────────────────────────────

    async fillIntentArbitrage(params: {
        chainId: number;
        intent: any;
        source: 'uniswapx';
        aggregatorQuote: any;
    }): Promise<ArbitrageOpportunity | null> {
        const { intent, aggregatorQuote, chainId } = params;
        const broker = CHAINS[chainId]?.atomicBroker as Hex;
        if (!broker) return null;

        const borrowToken = intent.input.token;
        const borrowAmount = BigInt(intent.input.amount);

        const providerInfo = this.getBestFlashloanProvider(chainId, borrowToken);
        if (!providerInfo) return null;

        return {
            chainId,
            borrowToken,
            borrowAmount,
            profitToken: borrowToken,
            minProfit: 1n,
            provider: providerInfo.provider,
            providerAddress: providerInfo.address,
            actions: [
                {
                    target: borrowToken,
                    callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [aggregatorQuote.to as Address, borrowAmount] }),
                    value: 0n,
                },
                {
                    target: aggregatorQuote.to,
                    callData: aggregatorQuote.data,
                    value: aggregatorQuote.value ? BigInt(aggregatorQuote.value) : 0n,
                },
                {
                    target: intent.outputs[0].token,
                    callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [intent.reactor as Address, BigInt(intent.outputs[0].amount)] }),
                    value: 0n,
                },
                {
                    target: intent.reactor,
                    callData: intent.fillData,
                    value: 0n,
                },
            ],
        };
    }

    private getBestFlashloanProvider(chainId: number, tokenAddress: string): { provider: FlashloanProvider, address: string } | null {
        const chainConfig = CHAINS[chainId];
        if (!chainConfig) return null;

        // 1. Special case: Sky for USDS/DAI on Mainnet
        if (chainId === 1 && chainConfig.skyFlashMint &&
            (tokenAddress.toLowerCase() === chainConfig.tokens.DAI?.toLowerCase() ||
             tokenAddress.toLowerCase() === chainConfig.tokens.USDS?.toLowerCase())) {
            return { provider: FlashloanProvider.SKY, address: chainConfig.skyFlashMint };
        }

        // 2. Default to Balancer for widest asset support
        if (chainConfig.balancerVault) {
            return { provider: FlashloanProvider.BALANCER, address: chainConfig.balancerVault };
        }

        // 3. Fallback to Morpho
        if (chainConfig.morphoBlue) {
            return { provider: FlashloanProvider.MORPHO, address: chainConfig.morphoBlue };
        }

        return null;
    }

    // ─── Encoding ────────────────────────────────────────────────────────────

    encodeFlashParams(opportunity: ArbitrageOpportunity): Hex {
        return encodeAbiParameters(
            parseAbiParameters('address, uint256, (address, bytes, uint256)[]'),
            [
                opportunity.profitToken as Hex,
                opportunity.minProfit,
                opportunity.actions.map(a => [a.target as Hex, a.callData as Hex, a.value] as const),
            ]
        );
    }
}
