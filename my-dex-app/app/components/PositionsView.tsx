'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';

interface Position {
  _id: string;
  tokenAddress: string;
  type: 'long' | 'short';
  leverage: number;
  collateral: number;
  entryPrice: number;
  liquidationPrice: number;
  tp?: number;
  sl?: number;
  status: string;
  pnl?: number;
}

export default function PositionsView() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const fetchPositions = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/positions/get?userAddress=${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      const data = await response.json();
      setPositions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    // Refresh positions every 30 seconds
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, [address]);

  const handleClosePosition = async (positionId: string) => {
    try {
      await fetch(`/api/positions/close/${positionId}`, {
        method: 'DELETE',
      });
      alert('Position is being closed.');
      fetchPositions(); // Refresh the list
    } catch (error) {
      console.error(error);
      alert(`Error closing position: ${error.message}`);
    }
  };

  if (!address) {
    return <div>Please connect your wallet to see your positions.</div>;
  }

  if (isLoading) {
    return <div>Loading positions...</div>;
  }

  return (
    <div className="p-4 border rounded-lg mt-4">
      <h2 className="text-xl font-bold mb-4">Your Open Positions</h2>
      {positions.length === 0 ? (
        <p>You have no open positions.</p>
      ) : (
        <div className="space-y-4">
          {positions.map((pos) => (
            <div key={pos._id} className="p-4 border rounded-md">
              <p><strong>Token:</strong> {pos.tokenAddress}</p>
              <p><strong>Type:</strong> {pos.type}</p>
              <p><strong>Leverage:</strong> {pos.leverage}x</p>
              <p><strong>Collateral:</strong> {pos.collateral} WETH</p>
              <p><strong>Entry Price:</strong> ${pos.entryPrice.toFixed(2)}</p>
              <p><strong>Liquidation Price:</strong> ${pos.liquidationPrice.toFixed(2)}</p>
              {pos.tp && <p><strong>Take Profit:</strong> ${pos.tp.toFixed(2)}</p>}
              {pos.sl && <p><strong>Stop Loss:</strong> ${pos.sl.toFixed(2)}</p>}
              <p><strong>Status:</strong> {pos.status}</p>
              {pos.pnl && <p><strong>PnL:</strong> ${pos.pnl.toFixed(2)}</p>}
              <button
                onClick={() => handleClosePosition(pos._id)}
                className="mt-2 p-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Close Position
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
