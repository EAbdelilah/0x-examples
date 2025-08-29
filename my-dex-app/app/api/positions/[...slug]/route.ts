import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import User from '@common/models/model.user';
import Position from '@common/models/model.position';
import { closePosition } from '@/utils/tradeEngine';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  await dbConnect();
  const [action, id] = params.slug;
  const { searchParams } = new URL(req.url);
  const userAddress = searchParams.get('userAddress');

  if (action === 'get' && id) {
    // Logic to get a specific position
    try {
      const position = await Position.findById(id);
      if (!position) {
        return NextResponse.json({ message: 'Position not found' }, { status: 404 });
      }
      return NextResponse.json(position);
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to get position', error: error.message },
        { status: 500 }
      );
    }
  } else if (action === 'get' && userAddress) {
    // Logic to get all positions for a user
    try {
      const user = await User.findOne({ walletAddress: userAddress });
      if (!user) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 });
      }
      const positions = await Position.find({ user: user._id, status: { $in: ['open', 'pending'] } });
      return NextResponse.json(positions);
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to get positions', error: error.message },
        { status: 500 }
      );
    }
  } else if (action === 'get-close-quote' && id) {
    const userAddress = searchParams.get('userAddress');
    if (!userAddress) {
      return NextResponse.json({ message: 'userAddress is required' }, { status: 400 });
    }
    try {
      const quote = await closePosition(id, userAddress);
      return NextResponse.json(quote);
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to get close quote', error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Invalid action or missing parameters' }, { status: 400 });
}

import { openPosition } from '@/utils/tradeEngine';

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [action] = params.slug;

  if (action === 'create') {
    try {
      const body = await req.json();
      const quote = await openPosition(body);
      return NextResponse.json(quote);
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to create position', error: error.message },
        { status: 500 }
      );
    }
  } else if (action === 'confirm-open') {
    try {
      const { positionId, txHash } = await req.json();
      const position = await Position.findById(positionId);
      if (!position) {
        return NextResponse.json({ message: 'Position not found' }, { status: 404 });
      }
      position.status = 'open';
      position.openTxHash = txHash;
      await position.save();
      return NextResponse.json(position);
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to confirm position', error: error.message },
        { status: 500 }
      );
    }
  } else if (action === 'confirm-close') {
    try {
      const { positionId, txHash, exitPrice } = await req.json();
      const position = await Position.findById(positionId);
      if (!position) {
        return NextResponse.json({ message: 'Position not found' }, { status: 404 });
      }

      const positionSize = position.collateral * position.leverage;
      let pnl;
      if (position.type === 'long') {
        pnl = (exitPrice - position.entryPrice) * positionSize;
      } else {
        pnl = (position.entryPrice - exitPrice) * positionSize;
      }

      position.status = 'closed';
      position.closeTxHash = txHash;
      position.pnl = pnl;
      await position.save();
      return NextResponse.json(position);
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to confirm close', error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
}

import { executeClosePosition } from '@/utils/tradeEngine';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const [action, id] = params.slug;

  if (action === 'close' && id) {
    try {
      await executeClosePosition(id, 'manual');
      return NextResponse.json({ message: 'Position is being closed' });
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { message: 'Failed to close position', error: error.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
}
