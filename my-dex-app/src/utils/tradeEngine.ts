import dbConnect from './db';
import Position from '../models/model.position';
import User from '../models/model.user';
import { getQuote } from './zeroEx';
import { getERC20Price } from './getERC20Price'; // This function needs to be created

export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  positionType: 'long' | 'short'
): number {
  if (positionType === 'long') {
    return entryPrice * (1 - 1 / leverage);
  } else {
    return entryPrice * (1 + 1 / leverage);
  }
}

export async function openPosition(params: {
  userAddress: string;
  tokenAddress: string;
  collateral: number;
  leverage: number;
  positionType: 'long' | 'short';
  tp?: number;
  sl?: number;
  slippagePercentage?: string;
}) {
  await dbConnect();

  const {
    userAddress,
    tokenAddress,
    collateral,
    leverage,
    positionType,
    tp,
    sl,
    slippagePercentage,
  } = params;

  // This function needs to be created, for now we will use a placeholder
  const entryPrice = await getERC20Price(tokenAddress);
  const liquidationPrice = calculateLiquidationPrice(
    entryPrice,
    leverage,
    positionType
  );
  const positionSize = collateral * leverage;

  const quote = await getQuote({
    sellToken: 'WETH', // Assuming WETH is the collateral token
    buyToken: tokenAddress,
    sellAmount: positionSize.toString(),
    takerAddress: userAddress,
    slippagePercentage,
  });

  let user = await User.findOne({ walletAddress: userAddress });
  if (!user) {
    user = new User({ walletAddress: userAddress });
  }

  const position = new Position({
    user: user._id,
    tokenAddress,
    collateral,
    leverage,
    type: positionType,
    entryPrice,
    liquidationPrice,
    tp,
    sl,
    status: 'pending', // The position is pending until the transaction is confirmed
    quote: quote, // Storing the quote for the frontend to use
  });

  user.orders.push(position._id);
  await user.save();
  await position.save();

  return { ...quote, positionId: position._id };
}

export async function closePosition(positionId: string, userAddress: string) {
  await dbConnect();

  const position = await Position.findById(positionId);

  if (!position) {
    throw new Error('Position not found');
  }

  if (position.status !== 'open') {
    throw new Error('Position is not open');
  }

  // Assuming the position was opened by selling WETH for the token.
  // To close the position, we need to sell the token back for WETH.
  const quote = await getQuote({
    sellToken: position.tokenAddress,
    buyToken: 'WETH',
    sellAmount: position.tokenAmount.toString(),
    takerAddress: userAddress,
  });

  // The quote will be sent to the frontend to be signed and submitted.
  // Once the transaction is confirmed, we will need another endpoint
  // to update the position's status to 'closed' and record the PnL.
  // For now, we will just return the quote.

  return quote;
}

import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

export async function executeClosePosition(positionId: string, closeReason: 'tp' | 'sl' | 'liquidation' | 'manual') {
  await dbConnect();
  const position = await Position.findById(positionId).populate('user');

  if (!position) throw new Error('Position not found');
  if (position.status !== 'open') throw new Error('Position is not open');

  const user = position.user as any;
  const quote = await getQuote({
    sellToken: position.tokenAddress,
    buyToken: 'WETH',
    sellAmount: position.tokenAmount.toString(),
    takerAddress: user.walletAddress,
  });

  const botWallet = createWalletClient({
    account: privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`),
    chain: base,
    transport: http(),
  }).extend(publicActions);

  const hash = await botWallet.sendTransaction({
    to: quote.to,
    data: quote.data,
    value: BigInt(quote.value),
    gasLimit: quote.gas,
  });

  await botWallet.waitForTransactionReceipt({ hash });

  const exitPrice = parseFloat(quote.price);
  let pnl;
  if (position.type === 'long') {
    pnl = (exitPrice - position.entryPrice) * position.tokenAmount;
  } else {
    pnl = (position.entryPrice - exitPrice) * position.tokenAmount;
  }

  position.status = closeReason === 'liquidation' ? 'liquidated' : 'closed';
  position.pnl = pnl;
  position.closeTxHash = hash;
  await position.save();

  console.log(`Position ${positionId} closed. PnL: ${pnl}`);
}
