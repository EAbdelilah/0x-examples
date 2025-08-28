"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { v4 as uuidv4 } from "uuid";

import PriceView from "./components/price";
import QuoteView from "./components/quote";
import PendingOrdersView from "./components/PendingOrdersView";
import { useOrderMonitor } from "../src/hooks/useOrderMonitor";

import type { PriceResponse, Order, OrderType, Token } from "../src/utils/types";

function Page() {
  const { address } = useAccount();
  const chainId = useChainId() || 1;

  const [finalize, setFinalize] = useState(false);
  const [price, setPrice] = useState<PriceResponse | undefined>();
  const [quote, setQuote] = useState();
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

  const TABS: OrderType[] = ["Market", "Limit", "Stop-loss"];

  const addOrder = (
    sellToken: Token,
    buyToken: Token,
    sellAmount: string,
    targetPrice: string
  ) => {
    if (!address) return;

    const newOrder: Order = {
      id: uuidv4(),
      taker: address,
      sellToken,
      buyToken,
      sellAmount,
      orderType,
      targetPrice,
      status: "pending",
      chainId,
    };
    setPendingOrders((prev) => [...prev, newOrder]);
  };

  const updateOrderStatus = (orderId: string, status: Order["status"]) => {
    setPendingOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status } : order
      )
    );
  };

  useOrderMonitor(pendingOrders, updateOrderStatus);

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-24">
      <div className="w-full max-w-screen-sm">
        <div className="flex justify-center mb-4 border-b border-gray-200 dark:border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setOrderType(tab)}
              className={`px-4 py-2 text-lg font-medium ${
                orderType === tab
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {finalize && price ? (
            <QuoteView
              taker={address}
              price={price}
              quote={quote}
              setQuote={setQuote}
              chainId={chainId}
            />
          ) : (
            <PriceView
              taker={address}
              price={price}
              setPrice={setPrice}
              setFinalize={setFinalize}
              chainId={chainId}
              orderType={orderType}
              addOrder={addOrder}
            />
          )}
        </div>
        <PendingOrdersView orders={pendingOrders} />
      </div>
    </div>
  );
}

export default Page;
