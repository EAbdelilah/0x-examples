import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export const ONE_INCH_RFQ_TYPES = {
  OrderRFQ: [
    { name: "info", type: "uint256" },
    { name: "makerAsset", type: "address" },
    { name: "takerAsset", type: "address" },
    { name: "maker", type: "address" },
    { name: "allowedSender", type: "address" },
    { name: "makingAmount", type: "uint256" },
    { name: "takingAmount", type: "uint256" },
  ],
};

export const PARASWAP_RFQ_TYPES = {
  Order: [
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "makerAsset", type: "address" },
    { name: "takerAsset", type: "address" },
    { name: "maker", type: "address" },
    { name: "taker", type: "address" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
  ],
};

export const signRfqOrder = async (
  privateKey: `0x${string}`,
  domain: any,
  types: any,
  message: any,
  primaryType: string
) => {
  const account = privateKeyToAccount(privateKey);
  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });

  const signature = await client.signTypedData({
    domain,
    types,
    primaryType,
    message,
  });

  return signature;
};
