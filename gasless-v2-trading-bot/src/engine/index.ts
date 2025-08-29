import TokenMonitor from './monitor';
import {
  createWalletClient,
  http,
  getContract,
  erc20Abi,
  publicActions,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { ZeroExService } from './0xservice';
import getERC20Price from '../utils/getERC20Price';
import { connect, User, Position, Trade } from '../db';
import { Types } from 'mongoose';
import { intro, select } from '@clack/prompts';
import { log } from '@clack/prompts';

// Types
import { SwapData } from '../types/types';

class TradeEngine {
  constructor(
    private contractAddress: `0x${string}`,
    private privateKey: string,
    private stopLoss: string,
    private takeProfit: string,
    private amountETH: string,
    private timeout: string,
    private position: 'long' | 'short',
    private leverage: string,
    private currentPrice: number = 0
  ) {
    this.contractAddress = contractAddress;
    this.privateKey = privateKey;
    this.stopLoss = stopLoss;
    this.takeProfit = takeProfit;
    this.amountETH = amountETH;
    this.timeout = timeout;
    this.position = position;
    this.leverage = leverage;
  }

  private calculateLiquidationPrice(
    entryPrice: number,
    leverage: number,
    position: 'long' | 'short'
  ): number {
    if (position === 'long') {
      return entryPrice * (1 - 1 / leverage);
    } else {
      return entryPrice * (1 + 1 / leverage);
    }
  }

  /**
   * Initiates the trading process. This function connects to the blockchain,
   * retrieves or creates a user, checks for existing incomplete orders, and
   * either continues the previous trade or starts a new one. It also sets up
   * monitoring for take profit, stop loss, and timeout conditions.
   *
   * @async
   * @function
   * @returns {Promise<void>} - A promise that resolves when the trading process is initiated.
   */

  async startTrade() {
    connect();

    const zeroEx = new ZeroExService(this.privateKey);
    const account = privateKeyToAccount(
      `0x${this.privateKey}` as `0x${string}`
    );
    const client = createWalletClient({
      account: account,
      chain: base,
      transport: http(),
    }).extend(publicActions);

    const publicKey = account.address;

    let user = await User.findOne({ walletAddress: publicKey }).populate({
      path: 'orders',
      populate: { path: 'trades' },
    });

    if (!user) {
      user = new User({
        walletAddress: publicKey,
        totalPnl: 0,
        orders: [],
      });
      await user.save(); // Save the new user
    }

    const erc20 = getContract({
      address: this.contractAddress as `0x${string}`,
      abi: erc20Abi,
      client: client,
    });

    const decimals: number = (await erc20.read.decimals()) as number;
    let swapData: SwapData;

    let position = await Position.findOne({
      user: user._id,
      tokenAddress: this.contractAddress,
      status: 'open',
    });

    if (position) {
      intro('🤔 Existing incomplete position found');
      console.info(`
        📃 Trade Info:
        ---------------------------------
        Token Address   : ${position.tokenAddress}
        Timestamp       : ${position.timestamp}
        Type            : ${position.type}
        Leverage        : ${position.leverage}x
        Collateral (ETH): ${position.collateral}
        Take Profit (%) : ${position.tp}
        Stop Loss (%)   : ${position.sl}
        Timeout (sec)   : ${position.timeout}
        Liquidation Price: ${position.liquidationPrice}
        ---------------------------------
      `);

      const continueTrade = await select({
        message: 'Do you want to continue the previous trade?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      });
      if (continueTrade === 'yes') {
        log.info('Continuing previous trade!');
        this.takeProfit =
          position.tp && !isNaN(position.tp)
            ? position.tp.toString()
            : this.takeProfit;
        this.stopLoss =
          position.sl && !isNaN(position.sl)
            ? position.sl.toString()
            : this.stopLoss;
        this.amountETH =
          position.collateral && !isNaN(position.collateral)
            ? position.collateral.toString()
            : this.amountETH;
        this.timeout =
          position.timeout && !isNaN(position.timeout)
            ? position.timeout.toString()
            : this.timeout;
      } else {
        position = null;
      }
    }

    if (!position) {
      const positionSize = +this.amountETH * +this.leverage;
      const entryPrice = await getERC20Price(this.contractAddress, decimals);
      const liquidationPrice = this.calculateLiquidationPrice(
        entryPrice,
        +this.leverage,
        this.position
      );

      log.info(`Opening a ${this.position} position with ${this.leverage}x leverage.`);
      log.info(`Entry price: ${entryPrice}`);
      log.info(`Liquidation price: ${liquidationPrice}`);


      swapData = (await zeroEx.swap(
        this.contractAddress as `0x${string}`,
        positionSize,
        'buy'
      )) as SwapData;

      position = new Position({
        user: user._id, // Assign the user to the order
        tokenAddress: this.contractAddress,
        timestamp: new Date(),
        collateral: +this.amountETH,
        tokenAmount: swapData ? +swapData.quote.buyAmount : 0,
        decimals: decimals,
        tp: parseFloat(this.takeProfit),
        sl: parseFloat(this.stopLoss),
        pnl: 0, // Initial PnL is 0
        timeout: this.timeout,
        status: 'open',
        trades: [],
        leverage: +this.leverage,
        type: this.position,
        liquidationPrice: liquidationPrice,
      });
      await position.save();
      user.orders.push(position._id); // Add the order to the user's orders array
      await user.save(); // make sure to save this

      if (swapData && swapData.hash) {
        const buyTrade = new Trade({
          orderId: position._id,
          txnHash: swapData.hash,
          tokenAddress: this.contractAddress,
          ethAmount: +this.amountETH,
          timestamp: new Date(),
          tokenAmount: +swapData.quote.buyAmount,
          tradeType: 'buy',
        });
        await buyTrade.save();
        position.trades.push(buyTrade._id);
        await position.save();
      }
    }

    this.currentPrice = await getERC20Price(this.contractAddress, decimals);

    const monitor = new TokenMonitor(
      this.contractAddress,
      parseFloat(this.takeProfit),
      parseFloat(this.stopLoss),
      parseInt(this.timeout, 10),
      this.currentPrice,
      decimals,
      position.liquidationPrice,
      position.type
    );

    monitor.on('tpReached', (newPrice: number) => {
      log.success('📈 Take Profit reached:');
      monitor.stopMonitoring();
      this.closePosition(
        publicKey,
        position._id,
        +position.tokenAmount,
        newPrice,
        decimals
      );
    });

    monitor.on('slReached', (newPrice: number) => {
      log.success('📉 Stop Loss reached:, Completing Trade!');
      monitor.stopMonitoring();
      this.closePosition(
        publicKey,
        position._id,
        +position.tokenAmount,
        newPrice,
        decimals
      );
    });

    monitor.on('timeoutReached', (newPrice: number) => {
      log.success('⌚ Timeout Reached');
      monitor.stopMonitoring();
      this.closePosition(
        publicKey,
        position._id,
        +position.tokenAmount,
        newPrice,
        decimals
      );
    });

    monitor.on('liquidationReached', (newPrice: number) => {
      log.success('📉 Liquidation reached:, Completing Trade!');
      monitor.stopMonitoring();
      this.liquidatePosition(
        publicKey,
        position._id,
        +position.tokenAmount,
        newPrice,
        decimals
      );
    });

    monitor.startMonitoring();
  }
  async closePosition(
    publicKey: `0x${string}`,
    positionId: Types.ObjectId,
    amount: number,
    newPrice: number,
    decimals: number
  ) {
    const zeroEx = new ZeroExService(this.privateKey);
    const computedAmount = amount * 10 ** -decimals;

    log.info('Selling ERC20 for WETH');

    const swapData = await zeroEx.swap(
      this.contractAddress as `0x${string}`,
      +computedAmount,
      'sell'
    );
    const position = await Position.findById(positionId);
    if (position && swapData) {
      let pnl;
      if (position.type === 'long') {
        pnl = ((newPrice - this.currentPrice) * amount) / 10 ** decimals;
      } else {
        pnl = ((this.currentPrice - newPrice) * amount) / 10 ** decimals;
      }

      const user = await User.findOne({ walletAddress: publicKey }).populate({
        path: 'orders',
        populate: { path: 'trades' },
      });

      if (user) {
        user.totalPnl += pnl;
        await user.save();
      }

      position.status = 'closed';
      position.pnl = pnl;

      const buyTrade = new Trade({
        orderId: position._id,
        txnHash: swapData.hash,
        tokenAddress: this.contractAddress,
        ethAmount: +this.amountETH,
        timestamp: new Date(),
        tradeType: 'sell',
      });
      await buyTrade.save();
      position.trades.push(buyTrade._id);
      await position.save();

      log.info(`✔️  PnL for the trade: ${pnl} USD`);
    }
    log.success('😊  Trade complete');
    process.exit(0);
  }

  async liquidatePosition(
    publicKey: `0x${string}`,
    positionId: Types.ObjectId,
    amount: number,
    newPrice: number,
    decimals: number
  ) {
    const zeroEx = new ZeroExService(this.privateKey);
    const computedAmount = amount * 10 ** -decimals;

    log.info('Selling ERC20 for WETH');

    const swapData = await zeroEx.swap(
      this.contractAddress as `0x${string}`,
      +computedAmount,
      'sell'
    );
    const position = await Position.findById(positionId);
    if (position && swapData) {
      let pnl;
      if (position.type === 'long') {
        pnl = ((newPrice - this.currentPrice) * amount) / 10 ** decimals;
      } else {
        pnl = ((this.currentPrice - newPrice) * amount) / 10 ** decimals;
      }

      const user = await User.findOne({ walletAddress: publicKey }).populate({
        path: 'orders',
        populate: { path: 'trades' },
      });

      if (user) {
        user.totalPnl += pnl;
        await user.save();
      }

      position.status = 'liquidated';
      position.pnl = pnl;

      const buyTrade = new Trade({
        orderId: position._id,
        txnHash: swapData.hash,
        tokenAddress: this.contractAddress,
        ethAmount: +this.amountETH,
        timestamp: new Date(),
        tradeType: 'sell',
      });
      await buyTrade.save();
      position.trades.push(buyTrade._id);
      await position.save();

      log.info(`✔️  PnL for the trade: ${pnl} USD`);
    }
    log.success('😊  Trade complete');
    process.exit(0);
  }
}

export default TradeEngine;
