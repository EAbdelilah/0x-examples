import React from 'react';
import { Order } from '../utils/types';

interface PendingOrdersViewProps {
  orders: Order[];
}

const PendingOrdersView: React.FC<PendingOrdersViewProps> = ({ orders }) => {
  if (orders.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 w-full max-w-screen-sm">
      <h2 className="text-xl font-bold mb-4 text-white">Pending Orders</h2>
      <div className="bg-slate-800 p-4 rounded-md">
        {orders.map((order) => (
          <div key={order.id} className="border-b border-slate-700 last:border-b-0 py-2">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold text-white">{order.orderType}</span>
                <span className="text-gray-400 ml-2">
                  {order.sellAmount} {order.sellToken.symbol} for {order.buyToken.symbol}
                </span>
              </div>
              <div className="text-right">
                <div className="text-white">
                  Target: {order.targetPrice} {order.buyToken.symbol}/{order.sellToken.symbol}
                </div>
                <div className="text-sm text-gray-500">{order.status}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingOrdersView;
