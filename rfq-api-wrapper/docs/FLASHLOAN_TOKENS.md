# Flashloanable Tokens & Providers

This document outlines the tokens that can be flashloaned on the supported networks for RFQ and arbitrage strategies, based on current liquidity and protocol deployments.

## 1. Supported Liquidity Protocols (Flashloan Providers)

## 1. Supported Liquidity Protocols (Flashloan Providers)

**🏆 Primary Choice: Balancer V2**
*   **Fee**: **0%** (Flash Loans are free on Balancer V2).
*   **Availability**: Polygon, Arbitrum, Base, Optimism, Mainnet.
*   **Contract**: `Vault` (Address is typically `0xBA12222222228d8Ba445958a75a0704d566BF2C8` across most chains).

**Backup Options:**
*   **Aave V3**: 
    *   **Fee**: ~0.05% - 0.09%.
    *   **Use Case**: When Balancer liquidity is insufficient or unavailable (e.g., specific tokens, or networks like Unichain if Balancer isn't there).
*   **Uniswap V3**: 
    *   **Fee**: Pool fee (0.05%, 0.3%, 1%).
    *   **Use Case**: "Flash Swaps". Good for sourcing tokens if you are going to swap on that pool anyway, but expensive for pure borrowing. Primary option for **Unichain**.

## 2. Recommended Tokens by Chain

These tokens are already configured in `src/config/chains.ts` and are highly liquid, making them ideal candidates for flashloans.

### 🟣 Polygon (Chain ID: 137)
*   **WETH** (`0x7ceB...`) - High liquidity on Aave/Balancer.
*   **USDC** (`0x3c49...`) - Bridged USDC (Note: Check for native USDC `0x2791...` as well).
*   **USDT** (`0xc213...`)
*   **WBTC** (`0x1BFD...`)

### 🔵 Arbitrum (Chain ID: 42161)
*   **WETH** (`0x82af...`)
*   **USDC** (`0xaf88...`) - Native USDC.
*   **USDT** (`0xFd08...`)
*   **WBTC** (`0x2f2a...`)

### 🔵 Base (Chain ID: 8453)
*   **WETH** (`0x4200...`)
*   **USDC** (`0x8335...`)
*   **USDT** (`0xfde4...`) -- *Verify Aave market existence as USDT liquidity can be fragmented on Base.*
*   **WBTC** (`0x0555...`)

### 🦄 Unichain (Chain ID: 130)
*   **WETH** (`0x4200...`)
*   **USDC** (`0x078D...`)
*   **WBTC** (`0x0555...`)
*   *Note: Unichain is newer. Uniswap V3 pools are the primary source for "Flash Swaps".*

## 3. Balancer V2 Specialization
Balancer is unique because all tokens are held in a single **Vault** contract. This means you can flashloan **any token** that exists in **any** Balancer pool, as long as the Vault has enough consolidated balance.

**Key Tokens with Deep Balancer Liquidity:**
*   **LSTs (Liquid Staking Tokens)**: Balancer is dominant for LSTs like **wstETH**, **rETH**, **cbETH**, **sfrxETH**.
*   **Stablecoins**: USDC, USDT, DAI (often in "Boosted Pools").
*   **Majors**: WETH, WBTC, ARB, OP, MATIC/POL.
*   **DeFi Bluechips**: AAVE, BAL, GMX (on Arbitrum), RDNT.

**Base Network Specifics:**
*   On Base, Balancer (via Aerodrome or direct forks like Beetx, or official friendly forks) supports **USDbC**, **WETH**, **cbETH**, and meme tokens like **DEGEN** if pools exist. *Note: Official Balancer deployment on Base is active.*

## 4. Implementation Strategy

To implement flashloans:
1.  **Select a Provider**: Aave V3 is generally preferred for standard flashloans due to deep liquidity for majors (WETH, USDC). Balancer is a great backup. u
2.  **Contract Interface**: You will need to interact with the Aave `Pool` contract or Balancer `Vault` contract.
3.  **Callback**: Your bot contract must implement the specific callback interface required by the provider (e.g., `IFlashLoanSimpleReceiver` for Aave).

## 5. Next Steps
- [ ] Verify Aave V3 contract addresses for Base and Unichain (if applicable).
- [ ] Add `IFlashLoanSimpleReceiver` interface to the `contracts/` directory.
- [ ] Implement a `FlashloanArbitrage` contract that can be called by the bot.
