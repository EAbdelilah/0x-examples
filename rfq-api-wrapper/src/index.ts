import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { ZeroExService } from './services/zeroExService';
import { OneInchAdapter } from './adapters/oneInchAdapter';
import { ParaSwapAdapter } from './adapters/paraSwapAdapter';
import { EnsoAdapter } from './adapters/ensoAdapter';
import { KyberSwapAdapter } from './adapters/kyberSwapAdapter';
import { OpenOceanAdapter } from './adapters/openOceanAdapter';
import { AppError } from './utils/errors';

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!ZERO_EX_API_KEY || !PRIVATE_KEY) {
  logger.error('Missing ZERO_EX_API_KEY or PRIVATE_KEY in environment variables');
  process.exit(1);
}

const zeroExService = new ZeroExService(ZERO_EX_API_KEY);
const adapters = [
  new OneInchAdapter(zeroExService, PRIVATE_KEY, process.env.ONE_INCH_ROUTER_ADDRESS),
  new ParaSwapAdapter(zeroExService, PRIVATE_KEY),
  new EnsoAdapter(zeroExService),
  new KyberSwapAdapter(zeroExService, PRIVATE_KEY),
  new OpenOceanAdapter(zeroExService),
];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Register adapter routes
adapters.forEach(adapter => {
  const route = `/quote/${adapter.name.toLowerCase()}`;

  const handler = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      // Support both query params (GET) and body (POST)
      const data = req.method === 'GET' ? req.query : req.body;
      const quote = await adapter.handleQuote(data);
      res.json(quote);
    } catch (error) {
      next(error);
    }
  };

  app.get(route, handler);
  app.post(route, handler);

  logger.info(`Registered GET/POST routes: ${route}`);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
  } else if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: err.errors,
    });
  } else {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

app.listen(PORT, () => {
  logger.info(`RFQ API Wrapper listening on port ${PORT}`);
});
