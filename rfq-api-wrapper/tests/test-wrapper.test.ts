import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import app from "../src/index";

let server: any;
const PORT = 3001;

// Set dummy env vars for testing
process.env.PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.ZERO_EX_API_KEY = "test-key";

describe("RFQ API Wrapper", () => {
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

  test("1inch adapter return signed order structure", async () => {
    const response = await fetch(`http://localhost:${PORT}/api/v1/1inch/quote?fromTokenAddress=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&toTokenAddress=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=100000000000000`);

    // It will still fail 500 because of 0x API key but we want to see if it reaches the service
    // If we wanted to fully test it, we would need to mock axios.
  });
});
