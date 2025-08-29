import { Schema, model } from 'mongoose';

// Position Schema
/**
 * Schema definition for a Position.
 *
 * @property {ObjectId} user - Reference to the User who placed the order. Required.
 * @property {string} tokenAddress - The address of the token involved in the order. Required.
 * @property {Date} timestamp - The timestamp when the order was created. Defaults to the current date and time.
 * @property {number} collateral - The amount of user funds allocated to the position. Required.
 * @property {number} tokenAmount - The amount of tokens involved in the position. Required.
 * @property {number} decimals - The number of decimal places for the token amount. Required.
 * @property {number} [tp] - The take profit value for the order. Optional.
 * @property {number} [sl] - The stop loss value for the order. Optional.
 * @property {number} pnl - The profit and loss value for the order. Required.
 * @property {number} timeout - The timeout value for the order. Required.
 * @property {string} status - The current status of the position ('open', 'closed', or 'liquidated'). Required.
 * @property {ObjectId[]} trades - Array of references to Trade documents associated with the order.
 * @property {number} leverage - The leverage used for the position. Required.
 * @property {string} type - The position type ('long' or 'short'). Required.
 * @property {number} liquidationPrice - The price at which the position will be liquidated. Required.
 */
const positionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tokenAddress: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  collateral: {
    type: Number,
    required: true,
  },
  tokenAmount: {
    type: Number,
    required: true,
  },
  decimals: {
    type: Number,
    required: true,
  },
  tp: {
    type: Number,
  },
  sl: {
    type: Number,
  },
  pnl: {
    type: Number,
    required: true,
  },
  timeout: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    required: true,
    default: 'open',
  },
  trades: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Trade',
    },
  ],
  leverage: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  liquidationPrice: {
    type: Number,
    required: true,
  },
  openTxHash: {
    type: String,
  },
  closeTxHash: {
    type: String,
  },
});

const Position = model('Position', positionSchema);
export default Position;
