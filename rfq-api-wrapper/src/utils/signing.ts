import { createWalletClient, http, WalletClient } from "viem";
import { privateKeyToAccount, Account } from "viem/accounts";
import { mainnet } from "viem/chains";

let _account: Account | null = null;
let _client: any = null;

const getClient = () => {
  if (_client) return { client: _client, account: _account };

  const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
  if (!PRIVATE_KEY) return { client: null, account: null };

  _account = privateKeyToAccount(PRIVATE_KEY);
  _client = createWalletClient({
    account: _account,
    chain: mainnet,
    transport: http(),
  });

  return { client: _client, account: _account };
};

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

export const KYBERSWAP_RFQ_TYPES = {
  Order: [
    { name: "salt", type: "uint256" },
    { name: "makerAsset", type: "address" },
    { name: "takerAsset", type: "address" },
    { name: "maker", type: "address" },
    { name: "receiver", type: "address" },
    { name: "allowedSender", type: "address" },
    { name: "makingAmount", type: "uint256" },
    { name: "takingAmount", type: "uint256" },
    { name: "feeConfig", type: "uint256" },
    { name: "makerAssetData", type: "bytes" },
    { name: "takerAssetData", type: "bytes" },
    { name: "getMakerAmount", type: "bytes" },
    { name: "getTakerAmount", type: "bytes" },
  ],
};

export const getMakerAddress = () => getClient().account?.address;

export const signRfqOrder = async (
  domain: any,
  types: any,
  message: any,
  primaryType: string
) => {
  const { client } = getClient();
  if (!client) throw new Error("Wallet client not initialized. Check PRIVATE_KEY.");

  const signature = await client.signTypedData({
    domain,
    types,
    primaryType,
    message,
  });

  return signature;
};
