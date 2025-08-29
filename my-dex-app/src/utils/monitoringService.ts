import dbConnect from './db';
import Position from '../models/model.position';
import { getERC20Price } from './getERC20Price';
import { executeClosePosition } from './tradeEngine'; // This function needs to be created

const monitoredPositions: string[] = [];

async function checkPositions() {
  await dbConnect();

  for (const positionId of monitoredPositions) {
    const position = await Position.findById(positionId);

    if (!position || position.status !== 'open') {
      // Remove from monitoring if position is closed or doesn't exist
      const index = monitoredPositions.indexOf(positionId);
      if (index > -1) {
        monitoredPositions.splice(index, 1);
      }
      continue;
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

      const index = monitoredPositions.indexOf(positionId);
      if (index > -1) {
        monitoredPositions.splice(index, 1);
      }
    }
  }
}

// Start the monitoring loop
setInterval(checkPositions, 15000); // Check every 15 seconds

export function startMonitoring(positionId: string) {
  if (!monitoredPositions.includes(positionId)) {
    monitoredPositions.push(positionId);
    console.log(`Started monitoring position: ${positionId}`);
  }
}
