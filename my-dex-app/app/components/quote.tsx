import { useEffect, useState } from "react";
import { formatUnits } from "ethers";
import { useSignTypedData, type BaseError } from "wagmi";
import { Address } from "viem";
import type { PriceResponse, QuoteResponse } from "../../src/utils/types";
import { MAINNET_TOKENS_BY_ADDRESS } from "../../src/constants";
import Image from "next/image";
import qs from "qs";
import { executeGaslessTrade } from "../../src/utils/trade";

export default function QuoteView({
  taker,
  price,
  quote,
  setQuote,
  chainId,
}: {
  taker: Address | undefined;
  price: PriceResponse;
  quote: QuoteResponse | undefined;
  setQuote: (price: any) => void;
  chainId: number;
}) {
  const [tradeHash, setTradeHash] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<any | undefined>();

  const { signTypedDataAsync } = useSignTypedData();

  // Fetch quote data
  useEffect(() => {
    if (!taker || !price) return;
    const params = {
      sellToken: price.sellToken,
      buyToken: price.buyToken,
      sellAmount: price.sellAmount,
      taker,
    };

    async function main() {
      const response = await fetch(`/api/quote?${qs.stringify(params)}`);
      const data = await response.json();
      setQuote(data);
    }
    main();
  }, [taker, price, setQuote]);

  // polling for trade status
  useEffect(() => {
    if (!tradeHash) return;

    setIsConfirming(true);
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/status?tradeHash=${tradeHash}`);
        const data = await response.json();
        if (data.status === "confirmed") {
          setIsConfirmed(true);
          setIsConfirming(false);
          clearInterval(interval);
        }
        if (data.status === "failed") {
          setError({ message: "Transaction failed" });
          setIsConfirming(false);
          clearInterval(interval);
        }
      } catch (e) {
        setError(e);
        setIsConfirming(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [tradeHash]);

  const placeOrder = async () => {
    if (!quote) return;

    setIsSubmitting(true);
    setError(undefined);

    try {
      const hash = await executeGaslessTrade(quote, signTypedDataAsync, chainId);
      setTradeHash(hash);
    } catch (e: any) {
      setError(e);
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quote) {
    return <div>Getting best quote...</div>;
  }

  const sellTokenInfo = MAINNET_TOKENS_BY_ADDRESS[price.sellToken.toLowerCase()];
  const buyTokenInfo = MAINNET_TOKENS_BY_ADDRESS[price.buyToken.toLowerCase()];

  return (
    <div className="p-3 mx-auto max-w-screen-sm ">
      <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-sm mb-3">
        <div className="text-xl mb-2 text-white">You pay</div>
        <div className="flex items-center text-lg sm:text-3xl text-white">
          <Image
            alt={sellTokenInfo.symbol}
            className="h-9 w-9 mr-2 rounded-md"
            src={sellTokenInfo.logoURI}
            width={9}
            height={9}
          />
          <span>
            {formatUnits(quote.sellAmount, sellTokenInfo.decimals)}
          </span>
          <div className="ml-2">{sellTokenInfo.symbol}</div>
        </div>
      </div>

      <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-sm mb-3">
        <div className="text-xl mb-2 text-white">You receive</div>
        <div className="flex items-center text-lg sm:text-3xl text-white">
          <Image
            alt={buyTokenInfo.symbol}
            className="h-9 w-9 mr-2 rounded-md"
            src={buyTokenInfo.logoURI}
            width={9}
            height={9}
          />
          <span>
            {formatUnits(quote.buyAmount, buyTokenInfo.decimals)}
          </span>
          <div className="ml-2">{buyTokenInfo.symbol}</div>
        </div>
      </div>

      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
        disabled={isSubmitting || isConfirming || isConfirmed}
        onClick={placeOrder}
      >
        {isSubmitting
          ? "Submitting..."
          : isConfirming
          ? "Waiting for confirmation..."
          : isConfirmed
          ? "Success!"
          : "Place Order"}
      </button>

      {isConfirmed && (
        <div className="text-center mt-4">
          Transaction Confirmed! 🎉{" "}
          <a
            href={`https://basescan.org/tx/${tradeHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            View on Basescan
          </a>
        </div>
      )}
      {error && (
        <div className="text-red-500 mt-4">
          Error: {(error as BaseError).shortMessage || error.message}
        </div>
      )}
    </div>
  );
}
