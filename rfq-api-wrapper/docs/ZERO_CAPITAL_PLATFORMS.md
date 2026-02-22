# Zero-Capital Execution Platforms

To achieve **Zero-Capital Arbitrage and Mirroring**, you must use platforms where the **Filler (you)** initiates the transaction. This allows you to use a **Flash Loan** to acquire tokens atomically within the same transaction.

---

## 1. Atomic vs. Passive Execution

### Passive Execution (Requires Inventory)
In traditional systems, you post an order and wait for a user to fill it.
- **Platforms**: KyberSwap Limit Orders, ParaSwap RFQ, 1inch PMM.
- **Why it needs Capital**: The **User** (Taker) sends the transaction. The blockchain pulls tokens from your wallet. You cannot "flash loan" into someone else's transaction.
- **Wallet Requirement**: You must hold the tokens you are selling.

### Atomic Execution (Zero-Capital)
In modern intent-based systems, you find a user's intent (e.g., a Dutch Auction) and "fill" it yourself.
- **Platforms**: UniswapX, 1inch Fusion, CoW Swap, Enso Finance.
- **Why it's Zero-Capital**: **You** send the transaction. You can call the `AtomicBroker` to:
    1. Borrow 1,000,000 USDC (Flash Loan).
    2. Swap USDC for ETH via 0x.
    3. Use that ETH to fill the user's UniswapX order.
    4. Repay the USDC loan.
- **Wallet Requirement**: **$0.00** (plus a small amount for gas).

---

## 2. Definitive Platform List for 2027

| Platform | Role | Zero-Capital? | Accessibility | Barrier to Entry |
| :--- | :--- | :--- | :--- | :--- |
| **UniswapX** | Filler | ✅ Yes | **Semi-Permissionless**| Low (Anyone can fill after decay) |
| **Enso Finance** | Provider | ✅ Yes | **Semi-Permissionless**| Med (Requires Action registration) |
| **1inch Fusion** | Resolver | ✅ Yes | **Strictly Permissioned**| High (Staking + Whitelist) |
| **CoW Swap** | Solver | ✅ Yes | **Strictly Permissioned**| High (Bonding + Voting) |
| **KyberSwap** | Maker | ❌ No | **Permissionless** | Low (But needs inventory) |
| **ParaSwap RFQ** | PMM | ❌ No | **Permissioned** | Med (But needs inventory) |

---

## 3. Accessibility & Whitelisting (Deep Dive)

### 🦄 UniswapX: The "Open Field"
UniswapX is the best place to start for a new Zero-Capital bot.
- **Model**: On chains like **Base** and **Arbitrum**, filling is an open competition. On **Ethereum**, orders have a short exclusivity window for winning RFQ quoters, but then they become **open to everyone**.
- **Strategy**: Monitor the public Orders API and use 0x to fill "Open" orders as soon as they decay to a profitable level.

### 🕸️ Enso Finance: The "Shortcut" Action
Enso is unique because you don't "fill" orders yourself. You register an **Action**.
- **Model**: You deploy a smart contract that calls our `AtomicBroker`. If Enso's graphers find that your action is the most efficient way to complete a user's swap, they will include your contract in their transaction.
- **Strategy**: Semi-passive. Once registered, your bot earns the 0x spread whenever you are selected as the best route.

### 🛡️ 1inch Fusion & CoW Swap: The "Professional" Tier
These platforms handle the highest volume but are **NOT** immediately accessible.
- **1inch Fusion**: To become a Resolver, you must stake 1INCH tokens to gain "Unicorn Power" and be among the top performers to get whitelisted.
- **CoW Swap**: Requires a significant bond and passing a governance vote to become a "Solver."
- **Path**: Use UniswapX and Enso to build a "Proof of Performance" and accumulate profit before applying for these tiers.

---

## 4. Implementation Strategy

For our **0x Strategy Bot Suite**, we prioritize the following for Zero-Capital operations:

1.  **Primary Target**: **UniswapX**. Its Dutch Auction model is perfectly suited for atomic filling. If 0x provides a better price than the decaying auction, we fill it immediately using a flash loan.
2.  **Secondary Target**: **Enso Finance**. By registering an "Action" that utilizes our `AtomicBroker`, we can be included in Enso routes with $0 upfront balance.
3.  **Advanced Target**: **1inch Fusion**. Once your bot has a proven track record, apply for Resolver status to access 1inch's massive intent volume.

---

## 5. How the AtomicBroker Handles it

Our `AtomicBroker.sol` is specifically designed for these platforms. It implements the `callback` functions required by **Balancer**, **Sky**, and **Uniswap v4** to ensure that if the strategy doesn't result in a net profit after the fill, the entire transaction reverts.
