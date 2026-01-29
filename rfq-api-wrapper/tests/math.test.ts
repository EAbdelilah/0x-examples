import { expect, test, describe } from "bun:test";
import { applySpread } from "../src/utils/math";

describe("Math Utility - applySpread", () => {
  test("decreases buy amount (taker receives less)", () => {
    const amount = "10000";
    const spreadBps = 100; // 1%
    const result = applySpread(amount, spreadBps, true);
    expect(result).toBe("9900");
  });

  test("increases sell amount (taker pays more)", () => {
    const amount = "10000";
    const spreadBps = 100; // 1%
    const result = applySpread(amount, spreadBps, false);
    expect(result).toBe("10100");
  });

  test("handles zero spread", () => {
    const amount = "10000";
    const spreadBps = 0;
    const result = applySpread(amount, spreadBps, true);
    expect(result).toBe("10000");
  });

  test("handles large amounts", () => {
    const amount = "1000000000000000000000000";
    const spreadBps = 50; // 0.5%
    const result = applySpread(amount, spreadBps, true);
    expect(result).toBe("995000000000000000000000");
  });
});
