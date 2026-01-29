import { expect, test, describe } from "bun:test";
// Set env before import
process.env.PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
import { signRfqOrder, ONE_INCH_RFQ_TYPES, KYBERSWAP_RFQ_TYPES } from "../src/utils/signing";

describe("Signing Utility", () => {
  test("signs a 1inch RFQ order", async () => {
    const order = {
      info: 123n,
      makerAsset: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as `0x${string}`,
      takerAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      maker: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      allowedSender: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      makingAmount: 1000n,
      takingAmount: 2000n,
    };

    const signature = await signRfqOrder(
      {
        name: "1inch Limit Order Protocol",
        version: "3",
        chainId: 1,
        verifyingContract: "0x1111111254EEB25477B68fb85Ed929f73A960582",
      },
      ONE_INCH_RFQ_TYPES,
      order,
      "OrderRFQ"
    );

    expect(signature).toBeDefined();
    expect(signature.startsWith("0x")).toBe(true);
  });

  test("signs a KyberSwap RFQ order", async () => {
    const order = {
      salt: 1n,
      makerAsset: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as `0x${string}`,
      takerAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      maker: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      receiver: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      allowedSender: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      makingAmount: 1000n,
      takingAmount: 2000n,
      feeConfig: 0n,
      makerAssetData: "0x" as `0x${string}`,
      takerAssetData: "0x" as `0x${string}`,
      getMakerAmount: "0x" as `0x${string}`,
      getTakerAmount: "0x" as `0x${string}`,
    };

    const signature = await signRfqOrder(
      {
        name: "KyberSwap Limit Order",
        version: "1",
        chainId: 1,
        verifyingContract: "0x1111111254EEB25477B68fb85Ed929f73A960582",
      },
      KYBERSWAP_RFQ_TYPES,
      order,
      "Order"
    );

    expect(signature).toBeDefined();
    expect(signature.startsWith("0x")).toBe(true);
  });
});
