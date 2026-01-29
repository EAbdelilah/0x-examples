import { Router, Request, Response } from "express";
import { getZeroExPrice } from "../services/zeroExService";
import { applySpread } from "../utils/math";
import { signRfqOrder, ONE_INCH_RFQ_TYPES, PARASWAP_RFQ_TYPES } from "../utils/signing";
import { privateKeyToAccount } from "viem/accounts";

const router = Router();
const SPREAD_BPS = Number(process.env.SPREAD_BPS || 10);
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

const ONE_INCH_CONTRACT = "0x1111111254EEB25477B68fb85Ed929f73A960582";
const PARASWAP_CONTRACT = "0xDEF171Fe48CF0148B1a80588e83D549d94446C18";

// 1inch adapter
router.get("/1inch/quote", async (req: Request, res: Response) => {
  try {
    const { fromTokenAddress, toTokenAddress, amount, takerAddress, chainId } = req.query;

    const price = await getZeroExPrice({
      chainId: (chainId as string) || "1",
      sellToken: fromTokenAddress as string,
      buyToken: toTokenAddress as string,
      sellAmount: amount as string,
      taker: takerAddress as string,
    });

    const adjustedBuyAmount = applySpread(price.buyAmount, SPREAD_BPS, true);
    const makerAddress = privateKeyToAccount(PRIVATE_KEY).address;

    // Construct 1inch RFQ Order
    // info: uint256 - packed (expiration 64 bits, nonce 192 bits)
    const expiration = Math.floor(Date.now() / 1000) + 300; // 5 mins
    const nonce = BigInt(Math.floor(Math.random() * 1000000));
    const info = (BigInt(expiration) << 192n) | nonce;

    const order = {
      info,
      makerAsset: toTokenAddress as `0x${string}`,
      takerAsset: fromTokenAddress as `0x${string}`,
      maker: makerAddress,
      allowedSender: (takerAddress as `0x${string}`) || "0x0000000000000000000000000000000000000000",
      makingAmount: BigInt(adjustedBuyAmount),
      takingAmount: BigInt(amount as string),
    };

    const signature = await signRfqOrder(
      PRIVATE_KEY,
      {
        name: "1inch Limit Order Protocol",
        version: "3",
        chainId: Number(chainId || 1),
        verifyingContract: ONE_INCH_CONTRACT,
      },
      ONE_INCH_RFQ_TYPES,
      order,
      "OrderRFQ"
    );

    res.json({
      order,
      signature,
      quote: {
        buyAmount: adjustedBuyAmount,
        gas: price.gas,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ParaSwap adapter
router.get("/paraswap/quote", async (req: Request, res: Response) => {
  try {
    const { sellToken, buyToken, sellAmount, taker, chainId } = req.query;

    const price = await getZeroExPrice({
      chainId: (chainId as string) || "1",
      sellToken: sellToken as string,
      buyToken: buyToken as string,
      sellAmount: sellAmount as string,
      taker: taker as string,
    });

    const adjustedBuyAmount = applySpread(price.buyAmount, SPREAD_BPS, true);
    const makerAddress = privateKeyToAccount(PRIVATE_KEY).address;

    const expiry = Math.floor(Date.now() / 1000) + 300;
    const nonce = BigInt(Math.floor(Math.random() * 1000000));

    const order = {
      nonce,
      expiry: BigInt(expiry),
      makerAsset: buyToken as `0x${string}`,
      takerAsset: sellToken as `0x${string}`,
      maker: makerAddress,
      taker: (taker as `0x${string}`) || "0x0000000000000000000000000000000000000000",
      makerAmount: BigInt(adjustedBuyAmount),
      takerAmount: BigInt(sellAmount as string),
    };

    const signature = await signRfqOrder(
      PRIVATE_KEY,
      {
        name: "ParaSwap RFQ",
        version: "1",
        chainId: Number(chainId || 1),
        verifyingContract: PARASWAP_CONTRACT,
      },
      PARASWAP_RFQ_TYPES,
      order,
      "Order"
    );

    res.json({
      order,
      signature,
      quote: {
        buyAmount: adjustedBuyAmount,
        gas: price.gas,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
