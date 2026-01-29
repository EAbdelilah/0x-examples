import express from "express";
import { config } from "dotenv";
import adapterRoutes from "./routes/adapters";

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Adapter routes
app.use("/api/v1", adapterRoutes);

app.listen(PORT, () => {
  console.log(`RFQ API Wrapper listening on port ${PORT}`);
});

export default app;
