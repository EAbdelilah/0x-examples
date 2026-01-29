import { Request, Response, NextFunction } from "express";
import logger from "./logger";

const WRAPPER_API_KEY = process.env.WRAPPER_API_KEY;

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!WRAPPER_API_KEY) {
    return next(); // If no key set, skip auth (for easy setup, but warn in README)
  }

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== WRAPPER_API_KEY) {
    logger.warn("Unauthorized access attempt", { path: req.path, ip: req.ip });
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};
