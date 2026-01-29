import { Router, Request, Response, NextFunction } from "express";
import { getZeroExPrice } from "../services/zeroExService";
import { applySpread } from "../utils/math";
import { signRfqOrder, ONE_INCH_RFQ_TYPES, PARASWAP_RFQ_TYPES, KYBERSWAP_RFQ_TYPES, getMakerAddress } from "../utils/signing";
import { z } from "zod";
import logger from "../utils/logger";
import { getContractsForChain } from "../config";
import { authMiddleware } from "../utils/auth";

const router = Router();
const SPREAD_BPS = Number(process.env.SPREAD_BPS || 10);

router.use(authMiddleware);

const CommonQuoteSchema = z.object({
  sellToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  buyToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  sellAmount: z.string().regex(/^\d+$/).optional(),
  buyAmount: z.string().regex(/^\d+$/).optional(),
  taker: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  chainId: z.string().regex(/^\d+$/).default("1"),
}).refine(data => data.sellAmount || data.buyAmount, {
  message: "Either sellAmount or buyAmount must be provided",
});

// 1inch adapter
router.get("/1inch/quote", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q: any = req.query;
    const validated = CommonQuoteSchema.parse({
      sellToken: q.fromTokenAddress,
      buyToken: q.toTokenAddress,
      sellAmount: q.amount,
      taker: q.takerAddress,
      chainId: q.chainId
    });
    const { sellToken, buyToken, sellAmount, taker, chainId } = validated;
    const cId = Number(chainId);

    const price = await getZeroExPrice({ chainId, sellToken, buyToken, sellAmount, taker });
    const adjustedBuyAmount = applySpread(price.buyAmount, SPREAD_BPS, true);
    const adjustedSellAmount = applySpread(price.sellAmount, SPREAD_BPS, false);

    const makerAddress = getMakerAddress();
    if (!makerAddress) throw new Error("Maker address not available");

    const expiration = Math.floor(Date.now() / 1000) + 300;
    const nonce = (BigInt(Date.now()) << 64n) | BigInt(Math.floor(Math.random() * 1000000000));
    const info = (BigInt(expiration) << 192n) | (nonce & ((1n << 192n) - 1n));

    const order = {
      info,
      makerAsset: buyToken as `0x${string}`,
      takerAsset: sellToken as `0x${string}`,
      maker: makerAddress,
      allowedSender: (taker as `0x${string}`) || "0x0000000000000000000000000000000000000000",
      makingAmount: BigInt(adjustedBuyAmount),
      takingAmount: BigInt(adjustedSellAmount),
    };

    const signature = await signRfqOrder(
      { name: "1inch Limit Order Protocol", version: "3", chainId: cId, verifyingContract: getContractsForChain(cId).ONE_INCH },
      ONE_INCH_RFQ_TYPES,
      order,
      "OrderRFQ"
    );

    res.json({ order, signature, quote: { buyAmount: adjustedBuyAmount, sellAmount: adjustedSellAmount, gas: price.gas } });
  } catch (error) { next(error); }
});

// ParaSwap adapter
router.get("/paraswap/quote", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CommonQuoteSchema.parse(req.query);
    const { sellToken, buyToken, sellAmount, buyAmount, taker, chainId } = validated;
    const cId = Number(chainId);

    const price = await getZeroExPrice({ chainId, sellToken, buyToken, sellAmount, buyAmount, taker });
    const adjustedBuyAmount = applySpread(price.buyAmount, SPREAD_BPS, true);
    const adjustedSellAmount = applySpread(price.sellAmount, SPREAD_BPS, false);

    const makerAddress = getMakerAddress();
    if (!makerAddress) throw new Error("Maker address not available");

    const expiry = Math.floor(Date.now() / 1000) + 300;
    const nonce = (BigInt(Date.now()) << 64n) | BigInt(Math.floor(Math.random() * 1000000000));

    const order = {
      nonce,
      expiry: BigInt(expiry),
      makerAsset: buyToken as `0x${string}`,
      takerAsset: sellToken as `0x${string}`,
      maker: makerAddress,
      taker: (taker as `0x${string}`) || "0x0000000000000000000000000000000000000000",
      makerAmount: BigInt(adjustedBuyAmount),
      takerAmount: BigInt(adjustedSellAmount),
    };

    const signature = await signRfqOrder(
      { name: "ParaSwap RFQ", version: "1", chainId: cId, verifyingContract: getContractsForChain(cId).PARASWAP },
      PARASWAP_RFQ_TYPES,
      order,
      "Order"
    );

    res.json({ order, signature, quote: { buyAmount: adjustedBuyAmount, sellAmount: adjustedSellAmount, gas: price.gas } });
  } catch (error) { next(error); }
});

// KyberSwap adapter
router.get("/kyberswap/quote", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CommonQuoteSchema.parse(req.query);
    const { sellToken, buyToken, sellAmount, buyAmount, taker, chainId } = validated;
    const cId = Number(chainId);

    const price = await getZeroExPrice({ chainId, sellToken, buyToken, sellAmount, buyAmount, taker });
    const adjustedBuyAmount = applySpread(price.buyAmount, SPREAD_BPS, true);
    const adjustedSellAmount = applySpread(price.sellAmount, SPREAD_BPS, false);

    const makerAddress = getMakerAddress();
    if (!makerAddress) throw new Error("Maker address not available");

    const salt = (BigInt(Date.now()) << 64n) | BigInt(Math.floor(Math.random() * 1000000000));

    const order = {
      salt,
      makerAsset: buyToken as `0x${string}`,
      takerAsset: sellToken as `0x${string}`,
      maker: makerAddress,
      receiver: makerAddress,
      allowedSender: (taker as `0x${string}`) || "0x0000000000000000000000000000000000000000",
      makingAmount: BigInt(adjustedBuyAmount),
      takingAmount: BigInt(adjustedSellAmount),
      feeConfig: 0n,
      makerAssetData: "0x",
      takerAssetData: "0x",
      getMakerAmount: "0x",
      getTakerAmount: "0x",
    };

    const signature = await signRfqOrder(
      { name: "KyberSwap Limit Order", version: "1", chainId: cId, verifyingContract: getContractsForChain(cId).KYBERSWAP },
      KYBERSWAP_RFQ_TYPES,
      order,
      "Order"
    );

    res.json({ order, signature, quote: { buyAmount: adjustedBuyAmount, sellAmount: adjustedSellAmount, gas: price.gas } });
  } catch (error) { next(error); }
});

// Universal adapter for Enso, OpenOcean and others
router.get("/universal/quote", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CommonQuoteSchema.parse(req.query);
    const { sellToken, buyToken, sellAmount, buyAmount, taker, chainId } = validated;

    const price = await getZeroExPrice({ chainId, sellToken, buyToken, sellAmount, buyAmount, taker });
    const adjustedBuyAmount = applySpread(price.buyAmount, SPREAD_BPS, true);
    const adjustedSellAmount = applySpread(price.sellAmount, SPREAD_BPS, false);

    res.json({
      maker: getMakerAddress(),
      sellToken,
      buyToken,
      sellAmount: adjustedSellAmount,
      buyAmount: adjustedBuyAmount,
      gas: price.gas,
      chainId: Number(chainId),
      validUntil: Math.floor(Date.now() / 1000) + 300,
    });
  } catch (error) { next(error); }
});

export default router;
