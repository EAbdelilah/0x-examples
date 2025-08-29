'use client';

import React, { useState } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';

export default function OpenPositionForm() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState('');
  const [positionType, setPositionType] = useState<'long' | 'short'>('long');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletClient || !address) {
      alert('Please connect your wallet');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/positions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          tokenAddress,
          collateral: parseFloat(collateral),
          leverage: parseInt(leverage),
          positionType,
          tp: parseFloat(takeProfit),
          sl: parseFloat(stopLoss),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get quote');
      }

      const quote = await response.json();

      const hash = await walletClient.sendTransaction({
        to: quote.to,
        data: quote.data,
        value: BigInt(quote.value),
        gasLimit: quote.gas,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      await fetch('/api/positions/update-tx-hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: quote.positionId, txHash: hash, type: 'open' }),
      });

      await fetch('/api/positions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash, status: 'open' }),
      });

      await fetch('/api/positions/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: quote.positionId }),
      });

      alert('Position opened and is being monitored!');
    } catch (error) {
      console.error(error);
      alert(`Error opening position: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">Open New Position</h2>
      <div className="mb-4">
        <label className="block mb-1">Token Address</label>
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Collateral (WETH)</label>
        <input
          type="number"
          value={collateral}
          onChange={(e) => setCollateral(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Leverage</label>
        <input
          type="number"
          value={leverage}
          onChange={(e) => setLeverage(e.target.value)}
          className="w-full p-2 border rounded"
          required
          min="1"
          max="100"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Position Type</label>
        <select
          value={positionType}
          onChange={(e) => setPositionType(e.target.value as 'long' | 'short')}
          className="w-full p-2 border rounded"
        >
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1">Take Profit Price</label>
        <input
          type="number"
          value={takeProfit}
          onChange={(e) => setTakeProfit(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Stop Loss Price</label>
        <input
          type="number"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <button
        type="submit"
        className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Opening...' : 'Open Position'}
      </button>
    </form>
  );
}
