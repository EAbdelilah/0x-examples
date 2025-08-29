import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../utils/db';
import User from '../../../../models/model.user';
import Position from '../../../../models/model.position';

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
  }

  return NextResponse.json({ message: 'Invalid action or missing parameters' }, { status: 400 });
}

import { openPosition } from '../../../../utils/tradeEngine';

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
  }

  return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
}

import { executeClosePosition } from '../../../../utils/tradeEngine';

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
