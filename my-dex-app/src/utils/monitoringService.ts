import dbConnect from '@/utils/db';
import Position from '@common/models/model.position';
import { getERC20Price } from '@/utils/getERC20Price';
import { executeClosePosition } from '@/utils/tradeEngine';

export async function checkPosition(positionId: string) {
  await dbConnect();

  const position = await Position.findById(positionId);

  if (!position || position.status !== 'open') {
    // Position is already closed or doesn't exist
    return { status: 'not-open' };
  }

  const currentPrice = await getERC20Price(position.tokenAddress);

  let closeReason: 'tp' | 'sl' | 'liquidation' | null = null;

  if (position.type === 'long') {
    if (position.tp && currentPrice >= position.tp) closeReason = 'tp';
    else if (position.sl && currentPrice <= position.sl) closeReason = 'sl';
    else if (currentPrice <= position.liquidationPrice) closeReason = 'liquidation';
  } else { // short
    if (position.tp && currentPrice <= position.tp) closeReason = 'tp';
    else if (position.sl && currentPrice >= position.sl) closeReason = 'sl';
    else if (currentPrice >= position.liquidationPrice) closeReason = 'liquidation';
  }

  if (closeReason) {
    console.log(`Closing position ${positionId} due to ${closeReason}`);
    await executeClosePosition(positionId, closeReason);
    return { status: 'closed', reason: closeReason };
  }

  return { status: 'open', price: currentPrice };
}
