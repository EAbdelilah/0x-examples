import { useEffect, useRef } from "react";
import { Order, QuoteResponse } from "../utils/types";
import { useSignTypedData } from "wagmi";
import { executeGaslessTrade } from "../utils/trade";
import qs from "qs";
import { parseUnits } from "ethers";

type UpdateOrderStatus = (orderId: string, status: Order["status"]) => void;

export const useOrderMonitor = (
  orders: Order[],
  updateOrderStatus: UpdateOrderStatus
) => {
  const { signTypedDataAsync } = useSignTypedData();
  const processingOrderIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(async () => {
      const pendingOrders = orders.filter((o) => o.status === "pending");
      if (pendingOrders.length === 0) {
        return;
      }

      for (const order of pendingOrders) {
        if (processingOrderIds.current.has(order.id)) {
          continue;
        }

        try {
          const params = {
            sellToken: order.sellToken.address,
            buyToken: order.buyToken.address,
            sellAmount: parseUnits(order.sellAmount, order.sellToken.decimals).toString(),
            taker: order.taker,
          };
          const response = await fetch(`/api/price?${qs.stringify(params)}`);
          const priceData = await response.json();

          const currentPrice = parseFloat(priceData.buyAmount) / parseFloat(priceData.sellAmount);
          const targetPrice = parseFloat(order.targetPrice);

          let shouldExecute = false;
          if (order.orderType === "Limit") {
            // Buy low
            if (currentPrice <= targetPrice) {
              shouldExecute = true;
            }
          } else if (order.orderType === "Stop-loss") {
            // Sell high to prevent further loss
            if (currentPrice <= targetPrice) {
              shouldExecute = true;
            }
          }

          if (shouldExecute) {
            processingOrderIds.current.add(order.id);
            updateOrderStatus(order.id, "triggered");

            // Get quote and execute
            const quoteResponse = await fetch(`/api/quote?${qs.stringify(params)}`);
            const quote: QuoteResponse = await quoteResponse.json();

            await executeGaslessTrade(quote, signTypedDataAsync, order.chainId);
            updateOrderStatus(order.id, "success");
            processingOrderIds.current.delete(order.id);
          }
        } catch (error) {
          console.error("Error processing order:", error);
          updateOrderStatus(order.id, "failed");
          processingOrderIds.current.delete(order.id);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [orders, signTypedDataAsync, updateOrderStatus]);
};
