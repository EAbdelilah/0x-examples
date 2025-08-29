import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/db';
import Position from '@common/models/model.position';
import { checkPosition } from '@/utils/monitoringService';
import fs from 'fs';
import path from 'path';

// In a production environment, this should be replaced with a call to a secret manager.
function getSecrets() {
  // For local development, we are reading from a file. This is not secure for production.
  // Replace this with a call to your secrets management service.
  try {
    const secretsPath = path.resolve(process.cwd(), 'src/config/secrets.json');
    const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    return secrets;
  } catch (error) {
    console.error('Error reading secrets file:', error);
    return {
      BOT_PRIVATE_KEY: '',
      CRON_SECRET: '',
    };
  }
}

export async function GET(req: NextRequest) {
  const secrets = getSecrets();
  // It's a good practice to secure this endpoint, e.g., with a secret key
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secrets.CRON_SECRET}`) {
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
