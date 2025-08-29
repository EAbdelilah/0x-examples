import { NextRequest, NextResponse } from 'next/server';
import { checkPosition } from '@/utils/monitoringService';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ message: 'Position ID is required' }, { status: 400 });
  }

  try {
    const result = await checkPosition(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Failed to check position', error: error.message },
      { status: 500 }
    );
  }
}
