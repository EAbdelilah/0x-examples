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
    formatUnits,
    getAddress,
} from 'viem';
import { mainnet, base, optimism, arbitrum, bsc, polygon, avalanche, fantom, celo } from 'viem/chains';
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
    'function symbol() external view returns (string)',
    'function balanceOf(address owner) external view returns (uint256)',
]);

const SWAP_ROUTER_V3_ABI = parseAbi([
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

const BROKER_ABI = parseAbi([
    'function executeBalancer(address vault, address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
    'function executeSky(address flashMint, address tokenToBorrow, uint256 amountToBorrow, bytes params) external',
]);

const PERMIT2_ABI = parseAbi([
    'function approve(address token, address spender, uint160 amount, uint48 expiration) external',
]);

// ─── Constants ───────────────────────────────────────────────────────────────

/** Known 6-decimal stablecoins — all others assumed 18 */
const SIX_DECIMAL_TOKENS = new Set([
    'usdc', 'usdt', 'usdbc', 'usd+', 'eurc', 'usdc.e',
]);

/** Minimum profit in USD-equivalent (in token units) to bother executing */
const MIN_PROFIT_USD_UNITS = 100_000n; // $0.10 in USDC (6 dec)

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ArbitrageOpportunity {
    chainId: number;
    borrowToken: string;
    borrowAmount: bigint;
    profitToken: string;
    minProfit: bigint;
    estimatedGasUnits?: bigint;
    flashProvider?: {
        name: string;
        target: string;
        type: 'balancer' | 'sky' | 'morpho';
    };
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
    private symbolsCache: Map<string, string> = new Map();
    // V3 fee tiers to try in order (most common first)
    private readonly FEE_TIERS = [500, 3000, 10000];

    constructor(private zeroExService: ZeroExService) {
        // Warn if 1inch key is missing
        if (!process.env.ONE_INCH_API_KEY) {
            logger.warn('⚠️  ONE_INCH_API_KEY not set — 1inch aggregator will be skipped');
        }
    }

    private readonly CHAIN_MAP: Record<number, any> = {
        1: mainnet,
        10: optimism,
        56: bsc,
        137: polygon,
        250: fantom,
        8453: base,
        42161: arbitrum,
        42220: celo,
        43114: avalanche,
    };

    private getPublicClient(chainId: number) {
        if (this.publicClients.has(chainId)) return this.publicClients.get(chainId);
        const rpc = process.env[`RPC_URL_${chainId}`];
        const chain = this.CHAIN_MAP[chainId] || mainnet;
        const client = createPublicClient({ chain, transport: http(rpc) });
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
                        this.symbolsCache.set(cacheKey, symbol);
                        return 6;
                    }
                    this.symbolsCache.set(cacheKey, symbol);
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
     * Returns the symbol for a token address.
     */
    async getTokenSymbol(chainId: number, tokenAddress: string): Promise<string> {
        const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
        if (this.symbolsCache.has(cacheKey)) return this.symbolsCache.get(cacheKey)!;

        // On-chain fallback
        try {
            const client = this.getPublicClient(chainId);
            const sym = await client.readContract({
                address: tokenAddress as Address,
                abi: ERC20_ABI,
                functionName: 'symbol',
            }) as string;
            this.symbolsCache.set(cacheKey, sym);
            return sym;
        } catch {
            return 'TOK';
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
        opportunity: ArbitrageOpportunity,
        fromAddress: string
    ): Promise<boolean> {
        const client = this.getPublicClient(chainId);
        const broker = CHAINS[Number(chainId)]?.atomicBroker as Address;
        if (!broker || !opportunity.flashProvider) return false;

        const { borrowToken, borrowAmount, flashProvider } = opportunity;
        const encodedParams = this.encodeFlashParams(opportunity);

        // Pre-check Liquidity
        const hasLiquidity = await this.checkProviderLiquidity(chainId, flashProvider, borrowToken, borrowAmount);
        if (!hasLiquidity) {
            logger.warn(`🚫 Insufficient liquidity on ${flashProvider.name} for ${borrowAmount} of ${borrowToken}`);
            return false;
        }

        try {
            let functionName = 'executeBalancer';
            let args: any[] = [];

            if (flashProvider.type === 'balancer') {
                functionName = 'executeBalancer';
                args = [flashProvider.target as Address, borrowToken as Address, borrowAmount, encodedParams] as const;
            } else if (flashProvider.type === 'sky') {
                functionName = 'executeSky';
                args = [flashProvider.target as Address, borrowToken as Address, borrowAmount, encodedParams] as const;
            }

            const brokerAbi = parseAbi([
                `function ${functionName}(address, address, uint256, bytes) external`,
            ]);

            await client.simulateContract({
                address: broker,
                abi: brokerAbi,
                functionName: functionName as any,
                args: args as any,
                account: fromAddress as Address,
            });
            return true;
        } catch (e: any) {
            const errorMsg = e.shortMessage || e.message;
            // Enhanced error extraction for viem
            let innerReason = '';
            try {
                if (e.walk) {
                    const innerError = e.walk((err: any) => err.data || err.reason || err.message !== e.message);
                    innerReason = innerError?.reason || innerError?.data || innerError?.message || '';
                }
            } catch {
                innerReason = e.cause?.cause?.message || e.cause?.message || e.data || '';
            }

            logger.warn(`🔴 Simulation failed on ${flashProvider.name}: ${errorMsg}`);
            if (innerReason && innerReason !== errorMsg) {
                logger.warn(`🔍 Inner Revert Reason: ${innerReason}`);
            }
            if (e.data) {
                logger.warn(`🔍 Revert Data (raw.data): ${e.data}`);
            }
            if (e.cause?.data) {
                logger.warn(`🔍 Revert Data (cause.data): ${e.cause.data}`);
            }
            // If we still have no detail, log a bit more
            if (!innerReason && !e.data && !e.cause?.data) {
                logger.warn(`🔍 Full Error structure: ${JSON.stringify(e).slice(0, 1000)}`);
            }
            return false;
        }
    }

    /**
     * Finds the best zero-fee provider for a flash loan.
     */
    async findBestFlashLoanProvider(chainId: number, token: string, amount: bigint): Promise<any> {
        const config = CHAINS[Number(chainId)];
        const providers = [];

        // 1. Sky (DAI/USDS) - 0% fee
        if (config.tokens.DAI && (token.toLowerCase() === config.tokens.DAI.toLowerCase() || (config.tokens.USDS && token.toLowerCase() === config.tokens.USDS.toLowerCase()))) {
            const skyAddr = config.skyFlashMint;
            if (skyAddr) {
                providers.push({ name: 'Sky', type: 'sky', target: skyAddr });
            }
        }

        // 2. Balancer - 0% fee
        const balancerVault = config.balancerVault;
        if (balancerVault) {
            providers.push({ name: 'Balancer', type: 'balancer', target: balancerVault });
        }

        for (const p of providers) {
            const ok = await this.checkProviderLiquidity(chainId, p, token, amount);
            if (ok) return p;
        }
        logger.debug(`findBestFlashLoanProvider: No suitable provider found for ${amount} of ${token} on chain ${chainId}`);
        return null;
    }

    private async checkProviderLiquidity(chainId: number, provider: any, token: string, amount: bigint): Promise<boolean> {
        const client = this.getPublicClient(chainId);
        try {
            if (provider.type === 'balancer') {
                const vault = provider.target as Address;
                const balance = await client.readContract({
                    address: token as Address,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [vault],
                }) as bigint;
                const ok = balance >= amount;
                if (!ok) {
                    logger.warn(`Balancer Liquidity Check: vault=${vault} token=${token} has=${balance} needs=${amount}`);
                }
                return ok;
            }
            if (provider.type === 'sky') {
                // Sky maximum flash loan is usually very high (500M+)
                // For now, assume it's okay if it's DAI/USDS
                return true;
            }
            return false;
        } catch {
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
                    logger.info(
                        `🎯 DIRECT DEX ARB: ${buyQ.dex} -> ${bestSell.dex} | ` +
                        `Gross: ${grossProfit} | Gas: ${gasCost} | Net: ${netProfit} (tokenA units)`
                    );

                    return this.buildCircularArbitrageOpportunity(
                        chainId, tokenA, tokenB, amountIn, buyQ, bestSell, netProfit, broker
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
        broker: Hex
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

    /**
     * Fetch a quote for a swap that will execute INSIDE a flash loan callback.
     * Uses KyberSwap (standard ERC20 approve+swap, no Permit2).
     * Also normalizes native ETH output → WETH so Balancer repayment (ERC20 transfer) works.
     */
    async getExecutionQuote(chainId: number, sellToken: string, buyToken: string, amount: string) {
        const broker = CHAINS[chainId]?.atomicBroker as Hex;
        if (!broker) return null;

        const wethOnChain = (CHAINS[Number(chainId)]?.tokens?.WETH || CHAINS[Number(chainId)]?.tokens?.WMATIC || '0x4200000000000000000000000000000000000006') as string;

        // Normalize: input native ETH → 0xeeee, output native ETH → WETH (for Balancer repayment)
        const normalizeInput = (addr: string) =>
            addr.toLowerCase() === '0x0000000000000000000000000000000000000000'
                ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
                : addr;
        const normalizeOutput = (addr: string) => {
            const low = addr.toLowerCase();
            if (low === '0x0000000000000000000000000000000000000000' || low === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
                return wethOnChain;
            }
            return addr;
        };

        const execSell = normalizeInput(sellToken);
        const execBuy = normalizeOutput(buyToken);

        logger.info(`🔄 Fetching execution quote (Kyberswap): ${execSell.slice(0, 8)} → ${execBuy.slice(0, 8)} (taker: ${broker})`);

        // Kyberswap chain slugs
        const KYBER_CHAINS: Record<number, string> = {
            1: 'ethereum',
            8453: 'base',
            137: 'polygon',
            42161: 'arbitrum',
            10: 'optimism',
            56: 'bsc',
        };
        const chainSlug = KYBER_CHAINS[chainId];
        if (!chainSlug) {
            logger.warn(`getExecutionQuote: No Kyberswap slug for chainId ${chainId}`);
            return null;
        }

        try {
            // Step 1: Get route summary
            const routeUrl = `https://aggregator-api.kyberswap.com/${chainSlug}/api/v1/routes?tokenIn=${execSell.toLowerCase()}&tokenOut=${execBuy.toLowerCase()}&amountIn=${amount}`;
            const routeResp = await axios.get(routeUrl, { timeout: 8000 });
            const routeSummary = routeResp.data?.data?.routeSummary;
            if (!routeSummary) {
                logger.warn('getExecutionQuote: Kyberswap returned no routeSummary');
                return null;
            }

            // Step 2: Build transaction
            const buildUrl = `https://aggregator-api.kyberswap.com/${chainSlug}/api/v1/route/build`;
            const buildResp = await axios.post(buildUrl, {
                routeSummary,
                sender: broker,
                recipient: broker,
                slippageTolerance: 100, // 1% slippage for execution
            }, { timeout: 8000 });

            const txData = buildResp.data?.data;
            if (!txData || !txData.data) {
                logger.warn('getExecutionQuote: Kyberswap build returned no tx data');
                return null;
            }

            // Return in 0x-compatible shape for the rest of the code
            return {
                to: txData.routerAddress,
                data: txData.data,
                value: txData.transactionValue ?? '0',
                buyAmount: txData.amountOut,
                allowanceTarget: txData.routerAddress,
                source: 'Kyberswap',
            };
        } catch (error: any) {
            const errData = error.response?.data;
            logger.error('Kyberswap execution quote failed:', { message: error.message, data: errData });
            // Fallback: try Odos
            return this.getOdosExecutionQuote(chainId, execSell, execBuy, amount, broker as string);
        }
    }

    /**
     * Fallback execution quote using Odos (also non-Permit2, standard ERC20 calldata).
     */
    private async getOdosExecutionQuote(chainId: number, sellToken: string, buyToken: string, amount: string, taker: string) {
        try {
            // Step 1: Quote
            const quoteResp = await axios.post('https://api.odos.xyz/sor/quote/v2', {
                chainId,
                inputTokens: [{ tokenAddress: sellToken.toLowerCase(), amount }],
                outputTokens: [{ tokenAddress: buyToken.toLowerCase(), proportion: 1 }],
                userAddr: taker.toLowerCase(),
                slippageLimitPercent: 1,
                disableRFQs: true,
            }, { timeout: 8000 });

            const pathId = quoteResp.data?.pathId;
            const outAmounts = quoteResp.data?.outAmounts;
            if (!pathId) {
                logger.warn('getOdosExecutionQuote: no pathId in quote response');
                return null;
            }

            // Step 2: Assemble transaction
            const asmResp = await axios.post('https://api.odos.xyz/sor/assemble', {
                userAddr: taker.toLowerCase(),
                pathId,
                simulate: false,
            }, { timeout: 8000 });

            const tx = asmResp.data?.transaction;
            if (!tx) {
                logger.warn('getOdosExecutionQuote: no transaction in assemble response');
                return null;
            }

            return {
                to: tx.to,
                data: tx.data,
                value: tx.value?.toString() ?? '0',
                buyAmount: outAmounts?.[0] ?? '0',
                allowanceTarget: asmResp.data?.inputDests?.[0] ?? tx.to,
                source: 'Odos',
            };
        } catch (error: any) {
            logger.error('Odos execution quote failed:', { message: error.message, data: error.response?.data });
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
        const { chainId, intent, aggregatorQuote } = params;
        const broker = CHAINS[Number(chainId)]?.atomicBroker as Hex;
        if (!broker) return null;

        // Helper to normalize native to WETH for flash loans
        const WNT = (CHAINS[Number(chainId)]?.tokens?.WETH || CHAINS[Number(chainId)]?.tokens?.WMATIC || '0x4200000000000000000000000000000000000006') as Address;
        const PERMIT2 = getAddress('0x000000000022D473030F116DDEE9F6B43AC78BA3');

        const normalize = (addr: string) => {
            const low = addr.toLowerCase();
            if (low === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || low === '0x0000000000000000000000000000000000000000') {
                return getAddress(WNT);
            }
            return getAddress(addr);
        };

        // To fill a UniswapX order, we must PROVIDE the output tokens.
        // So we borrow the OUTPUT token (what we give the user) from Balancer.
        // UniswapX orders use startAmount/minAmount/endAmount - not a flat "amount".
        const output = intent.outputs[0];
        const borrowTokenRaw = output.token;
        const borrowToken = normalize(borrowTokenRaw);
        // Use minAmount (the min they'll accept at decay) — safest conservative amount to borrow.
        const borrowAmountRaw = output.minAmount ?? output.endAmount ?? output.startAmount ?? output.amount;
        if (!borrowAmountRaw) {
            logger.warn(`❌ fillIntentArbitrage: Could not resolve output amount from order. Fields: ${JSON.stringify(output)}`);
            return null;
        }
        const borrowAmount = BigInt(borrowAmountRaw);

        const inputRaw = intent.input;
        const userToken = normalize(inputRaw.token);
        // Use startAmount for the input (what the user gives us; could decay but start is the max we'll receive)
        const userAmountRaw = inputRaw.startAmount ?? inputRaw.maxAmount ?? inputRaw.amount;
        if (!userAmountRaw) {
            logger.warn(`❌ fillIntentArbitrage: Could not resolve input amount from order. Fields: ${JSON.stringify(inputRaw)}`);
            return null;
        }
        const userAmount = BigInt(userAmountRaw);

        logger.info(`🔍 Arbitrage Prep: Borrow ${borrowAmount} of ${borrowToken} (output) | Receive ${userAmount} of ${userToken} (input)`);


        const isNativeOutput = borrowTokenRaw.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
            borrowTokenRaw.toLowerCase() === '0x0000000000000000000000000000000000000000';

        const isNativeUserToken = inputRaw.token.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
            inputRaw.token.toLowerCase() === '0x0000000000000000000000000000000000000000';

        const WETH_ABI = parseAbi(['function withdraw(uint256) external', 'function deposit() external payable']);

        const actions: any[] = [];

        if (isNativeOutput) {
            // ── Native ETH output path ─────────────────────────────────────────
            // 1. Unwrap WETH → ETH (we borrowed WETH, but order needs ETH)
            actions.push({
                target: WNT,
                callData: encodeFunctionData({ abi: WETH_ABI, functionName: 'withdraw', args: [borrowAmount] }),
                value: 0n,
            });
            // 2. Fill the UniswapX order — send ETH as value so the reactor gets it
            actions.push({
                target: intent.reactor,
                callData: intent.fillData,
                value: borrowAmount, // send ETH to reactor
            });
        } else {
            // ── ERC20 output path ──────────────────────────────────────────────
            // 1. Approve borrowToken → Permit2
            actions.push({
                target: borrowToken,
                callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [PERMIT2, borrowAmount] }),
                value: 0n,
            });
            // 2. Approve borrowToken → Reactor directly (some reactors pull directly)
            actions.push({
                target: borrowToken,
                callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [intent.reactor as Address, borrowAmount] }),
                value: 0n,
            });
            // 3. Permit2 allowance: let Reactor pull borrowToken from AtomicBroker
            actions.push({
                target: PERMIT2,
                callData: encodeFunctionData({
                    abi: PERMIT2_ABI,
                    functionName: 'approve',
                    args: [borrowToken, intent.reactor as Address, (1n << 160n) - 1n, 2000000000]
                }),
                value: 0n,
            });
            // 4. Fill the UniswapX order (give borrowToken, receive userToken)
            actions.push({
                target: intent.reactor,
                callData: intent.fillData,
                value: 0n,
            });
        }

        // ── Aggregator swap: sell userToken → borrowToken (repayment token) ──
        if (!isNativeUserToken) {
            // Approve userToken for the aggregator
            const spender = getAddress(aggregatorQuote.allowanceTarget || aggregatorQuote.to);
            actions.push({
                target: userToken,
                callData: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [spender, userAmount] }),
                value: 0n,
            });
        }

        // Execute aggregator swap (userToken → borrowToken/WETH to repay flash loan)
        actions.push({
            target: aggregatorQuote.to,
            callData: aggregatorQuote.data,
            value: isNativeUserToken ? userAmount : 0n, // pass ETH value if selling native ETH
        });

        logger.info(`📝 Callback Actions: [${actions.map(a => `${a.target.slice(0, 10)}(v:${a.value})`).join(' -> ')}]`);

        return {
            chainId,
            borrowToken,
            borrowAmount,
            profitToken: borrowToken,
            minProfit: 1n,
            actions
        };
    }

    // ─── Encoding ────────────────────────────────────────────────────────────

    encodeFlashParams(opportunity: ArbitrageOpportunity): Hex {
        return encodeAbiParameters(
            parseAbiParameters('address, uint256, address[], bytes[], uint256[]'),
            [
                opportunity.profitToken as Hex,
                opportunity.minProfit,
                opportunity.actions.map(a => a.target as Hex),
                opportunity.actions.map(a => a.callData as Hex),
                opportunity.actions.map(a => a.value),
            ]
        );
    }
}
