import express, { Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import adapterRoutes from "./routes/adapters";
import logger from "./utils/logger";
import { z } from "zod";
import { ZeroExError } from "./services/zeroExService";

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Adapter routes
app.use("/api/v1", adapterRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    logger.warn("Validation error", { errors: err.errors });
    return res.status(400).json({ error: "Validation failed", details: err.errors });
  }

  if (err instanceof ZeroExError) {
    return res.status(err.status).json({ error: err.message });
  }

  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`RFQ API Wrapper listening on port ${PORT}`);
});

export default app;
