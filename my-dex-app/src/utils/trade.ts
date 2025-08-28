import { Hex } from "viem";
import { QuoteResponse } from "./types";
import { SignatureType, splitSignature } from "./signature";
import { WalletClient } from "wagmi";

type SignTypedDataAsync = (
  ...args: Parameters<WalletClient["signTypedData"]>
) => Promise<Hex>;

export const executeGaslessTrade = async (
  quote: QuoteResponse,
  signTypedDataAsync: SignTypedDataAsync,
  chainId: number
): Promise<string> => {
  let approvalSignature: Hex | undefined;
  let approvalDataToSubmit: any;

  // if gasless approval is available, sign the approval object
  if (quote.approval) {
    approvalSignature = await signTypedDataAsync({
      domain: quote.approval.eip712.domain,
      types: quote.approval.eip712.types,
      primaryType: quote.approval.eip712.primaryType,
      message: quote.approval.eip712.message,
    });

    const approvalSplitSig = await splitSignature(approvalSignature);
    approvalDataToSubmit = {
      type: quote.approval.type,
      eip712: quote.approval.eip712,
      signature: {
        ...approvalSplitSig,
        v: Number(approvalSplitSig.v),
        signatureType: SignatureType.EIP712,
      },
    };
  }

  // sign the trade object
  const tradeSignature = await signTypedDataAsync({
    domain: quote.trade.eip712.domain,
    types: quote.trade.eip712.types,
    primaryType: quote.trade.eip712.primaryType,
    message: quote.trade.eip712.message,
  });

  const tradeSplitSig = await splitSignature(tradeSignature);
  const tradeDataToSubmit = {
    type: quote.trade.type,
    eip712: quote.trade.eip712,
    signature: {
      ...tradeSplitSig,
      v: Number(tradeSplitSig.v),
      signatureType: SignatureType.EIP712,
    },
  };

  // submit the trade
  const response = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trade: tradeDataToSubmit,
      approval: approvalDataToSubmit,
      chainId: chainId,
    }),
  });

  const data = await response.json();
  if (response.status !== 200) {
    throw new Error(data.message || "Submission failed");
  }

  return data.tradeHash;
};
