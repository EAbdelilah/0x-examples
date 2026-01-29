import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import app from "../src/index";

let server: any;
const PORT = 3001;

// Set dummy env vars for testing
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

  test("1inch adapter - validation failure on missing params", async () => {
    const response = await fetch(`http://localhost:${PORT}/api/v1/1inch/quote`);
    expect(response.status).toBe(400);
    const data: any = await response.json();
    expect(data.error).toBe("Validation failed");
  });

  test("1inch adapter - validation failure on invalid address", async () => {
    const response = await fetch(`http://localhost:${PORT}/api/v1/1inch/quote?fromTokenAddress=invalid&toTokenAddress=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=100`);
    expect(response.status).toBe(400);
  });
});
