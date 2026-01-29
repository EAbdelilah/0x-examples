import express, { Request, Response, NextFunction } from "express";
import { config } from "dotenv";
import adapterRoutes from "./routes/adapters";
import logger from "./utils/logger";
import { z } from "zod";
import { ZeroExError } from "./services/zeroExService";
import { rateLimit } from "express-rate-limit";
import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Prometheus Metrics setup
const register = new Registry();
collectDefaultMetrics({ register });

export const httpRequestCounter = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route"],
  registers: [register],
});

app.use(express.json());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// Request logging and metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route: req.path }, duration);
    logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}s`);
  });
  next();
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
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
