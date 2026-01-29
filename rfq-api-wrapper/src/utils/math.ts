export const applySpread = (amount: string, spreadBps: number, isBuyAmount: boolean): string => {
  const amountBI = BigInt(amount);
  const spreadBI = BigInt(spreadBps);
  const tenThousandBI = BigInt(10000);

  if (isBuyAmount) {
    // If it's the amount the taker receives, we decrease it
    // buyAmount = buyAmount * (10000 - spreadBps) / 10000
    return ((amountBI * (tenThousandBI - spreadBI)) / tenThousandBI).toString();
  } else {
    // If it's the amount the taker sells, we increase it
    // sellAmount = sellAmount * (10000 + spreadBps) / 10000
    return ((amountBI * (tenThousandBI + spreadBI)) / tenThousandBI).toString();
  }
};
