import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import Position from '@common/models/model.position';
import { checkPosition } from '@/utils/monitoringService';

export async function GET(req: NextRequest) {
  // It's a good practice to secure this endpoint, e.g., with a secret key
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const openPositions = await Position.find({ status: 'open' });

  for (const position of openPositions) {
    try {
      await checkPosition(position._id.toString());
    } catch (error) {
      console.error(`Failed to check position ${position._id}:`, error);
    }
  }

  return NextResponse.json({ message: 'Checked all open positions.' });
}
