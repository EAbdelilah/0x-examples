import { NextRequest, NextResponse } from 'next/server';
import { startMonitoring } from '../../../../utils/monitoringService';

export async function POST(req: NextRequest) {
  try {
    const { positionId } = await req.json();

    if (!positionId) {
      return NextResponse.json({ message: 'Missing positionId' }, { status: 400 });
    }

    startMonitoring(positionId);

    return NextResponse.json({ message: 'Monitoring started' });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Failed to start monitoring', error: error.message },
      { status: 500 }
    );
  }
}
