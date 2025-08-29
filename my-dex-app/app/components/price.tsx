import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState, ChangeEvent } from "react";
import { formatUnits, parseUnits } from "ethers";
import { useBalance } from "wagmi";
import { Address } from "viem";
import {
  MAINNET_TOKENS,
  MAINNET_TOKENS_BY_SYMBOL,
} from "../../src/constants";
import Image from "next/image";
import qs from "qs";
import type { Token } from "../../src/utils/types";

type OrderType = "Market" | "Limit" | "Stop-loss";

export default function PriceView({
  price,
  taker,
  setPrice,
  setFinalize,
  chainId,
  orderType,
  addOrder,
}: {
  price: any;
  taker: Address | undefined;
  setPrice: (price: any) => void;
  setFinalize: (finalize: boolean) => void;
  chainId: number;
  orderType: OrderType;
  addOrder: (
    sellToken: Token,
    buyToken: Token,
    sellAmount: string,
    targetPrice: string
  ) => void;
}) {
  const [sellToken, setSellToken] = useState("weth");
  const [buyToken, setBuyToken] = useState("usdc");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [tradeDirection, setTradeDirection] = useState("sell");
  const [error, setError] = useState([]);
  const [limitPrice, setLimitPrice] = useState("");

  const handleSellTokenChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSellToken(e.target.value);
  };
  function handleBuyTokenChange(e: ChangeEvent<HTMLSelectElement>) {
    setBuyToken(e.target.value);
  }

  const tokensByChain = (chainId: number) => {
    if (chainId === 1) {
      return MAINNET_TOKENS_BY_SYMBOL;
    }
    return MAINNET_TOKENS_BY_SYMBOL;
  };

  const sellTokenObject = tokensByChain(chainId)[sellToken];
  const buyTokenObject = tokensByChain(chainId)[buyToken];

  const sellTokenDecimals = sellTokenObject.decimals;
  const buyTokenDecimals = buyTokenObject.decimals;

  const parsedSellAmount =
    sellAmount && tradeDirection === "sell"
      ? parseUnits(sellAmount, sellTokenDecimals).toString()
      : undefined;

  useEffect(() => {
    const params = {
      sellToken: sellTokenObject.address,
      buyToken: buyTokenObject.address,
      sellAmount: parsedSellAmount,
      taker,
    };

    async function main() {
      const response = await fetch(`/api/price?${qs.stringify(params)}`);
      const data = await response.json();

      if (data?.validationErrors?.length > 0) {
        setError(data.validationErrors);
      } else {
        setError([]);
      }
      if (data.buyAmount) {
        setBuyAmount(formatUnits(data.buyAmount, buyTokenDecimals));
        setPrice(data);
      }
    }

    if (sellAmount !== "" && parsedSellAmount) {
      main();
    }
  }, [
    sellTokenObject.address,
    buyTokenObject.address,
    parsedSellAmount,
    taker,
    buyTokenDecimals,
    setPrice,
    sellAmount,
  ]);

  const { data: balanceData } = useBalance({
    address: taker,
    token: sellTokenObject.address,
  });

  const inSufficientBalance =
    balanceData && sellAmount
      ? parseUnits(sellAmount, sellTokenDecimals) > balanceData.value
      : true;

  const handlePlaceOrder = () => {
    if (orderType === "Market") {
      setFinalize(true);
    } else {
      addOrder(sellTokenObject, buyTokenObject, sellAmount, limitPrice);
      setSellAmount("");
      setBuyAmount("");
      setLimitPrice("");
    }
  };

  return (
    <div>
      <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-md mb-3">
        <div className="flex justify-between items-center mb-4">
          <label htmlFor="sell" className="text-gray-300">
            You sell
          </label>
          {taker && balanceData && (
            <span className="text-sm text-gray-400">
              Balance: {parseFloat(balanceData.formatted).toFixed(4)}
            </span>
          )}
        </div>
        <section className="flex items-center">
          <div className="flex-grow">
            <input
              id="sell-amount"
              value={sellAmount}
              className="w-full h-12 rounded-md bg-slate-700 text-white text-2xl p-2"
              type="number"
              placeholder="0"
              onChange={(e) => {
                setTradeDirection("sell");
                setSellAmount(e.target.value);
              }}
            />
          </div>
          <div className="ml-4">
            <select
              value={sellToken}
              onChange={handleSellTokenChange}
              className="h-12 rounded-md bg-slate-700 text-white p-2"
            >
              {MAINNET_TOKENS.map((token) => (
                <option key={token.symbol} value={token.symbol.toLowerCase()}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-md mb-3">
        <label htmlFor="buy" className="text-gray-300 mb-2">
          You buy
        </label>
        <section className="flex items-center mt-2">
          <div className="flex-grow">
            <input
              id="buy-amount"
              value={buyAmount}
              className="w-full h-12 rounded-md bg-slate-700 text-white text-2xl p-2 cursor-not-allowed"
              type="number"
              placeholder="0"
              disabled
            />
          </div>
          <div className="ml-4">
            <select
              value={buyToken}
              onChange={handleBuyTokenChange}
              className="h-12 rounded-md bg-slate-700 text-white p-2"
            >
              {MAINNET_TOKENS.map((token) => (
                <option key={token.symbol} value={token.symbol.toLowerCase()}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      {orderType !== "Market" && (
        <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-md mb-3">
          <label
            htmlFor="limit-price"
            className="text-gray-300 mb-2"
          >
            {orderType === "Limit" ? "Limit Price" : "Stop Price"} ({buyTokenObject.symbol} per {sellTokenObject.symbol})
          </label>
          <input
            id="limit-price"
            value={limitPrice}
            className="w-full h-12 rounded-md bg-slate-700 text-white text-2xl p-2 mt-2"
            type="number"
            placeholder="0"
            onChange={(e) => setLimitPrice(e.target.value)}
          />
        </div>
      )}

      {taker ? (
        <button
          type="button"
          onClick={handlePlaceOrder}
          disabled={inSufficientBalance || !price}
          className="w-full bg-blue-500 text-white p-3 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {inSufficientBalance
            ? "Insufficient Balance"
            : orderType === "Market"
            ? "Review Trade"
            : "Place Order"}
        </button>
      ) : (
        <ConnectButton />
      )}
    </div>
  );
}
