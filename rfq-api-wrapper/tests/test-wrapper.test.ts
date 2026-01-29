import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import app from "../src/index";

let server: any;
const PORT = 3001;

process.env.PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.ZERO_EX_API_KEY = "test-key";

describe("RFQ API Wrapper Integration", () => {
  beforeAll(() => {
    server = app.listen(PORT);
  });

  afterAll(() => {
    server.close();
  });

  test("Health check", async () => {
    const response = await fetch(`http://localhost:${PORT}/health`);
    const data: any = await response.json();
    expect(data.status).toBe("ok");
  });

  const endpoints = [
    "/api/v1/1inch/quote",
    "/api/v1/paraswap/quote",
    "/api/v1/kyberswap/quote",
    "/api/v1/universal/quote"
  ];

  for (const endpoint of endpoints) {
    test(`${endpoint} - validation failure on missing params`, async () => {
      const response = await fetch(`http://localhost:${PORT}${endpoint}`);
      expect(response.status).toBe(400);
    });
  }

  test("Universal adapter reaches ZeroEx service", async () => {
    const response = await fetch(`http://localhost:${PORT}/api/v1/universal/quote?sellToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&buyToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&sellAmount=100`);
    // Should be 401 because of the invalid test API key, proving it reached the service
    expect(response.status).toBe(401);
  });
});
