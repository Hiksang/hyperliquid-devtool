# HyperEVM Precompiles Technical Specification

## Overview

HyperEVM provides read-only precompiles (L1Read) that allow smart contracts and dApps to query HyperCore state directly from the EVM layer. This document covers all available precompiles, their encoding formats, and usage patterns.

---

## Precompile Address Map

| Address | Name | Description |
|---------|------|-------------|
| `0x0000000000000000000000000000000000000800` | Position | Perp position info |
| `0x0000000000000000000000000000000000000801` | Spot Balance | Spot token balance |
| `0x0000000000000000000000000000000000000802` | User Vault Equity | Vault equity for user |
| `0x0000000000000000000000000000000000000803` | Withdrawable | Withdrawable perp balance |
| `0x0000000000000000000000000000000000000804` | Delegations | Staking delegations list |
| `0x0000000000000000000000000000000000000805` | Delegator Summary | Staking summary |
| `0x0000000000000000000000000000000000000806` | Mark Price | Perp mark price |
| `0x0000000000000000000000000000000000000807` | Oracle Price | Oracle price (Pyth) |
| `0x0000000000000000000000000000000000000808` | Spot Price | Spot mid price |
| `0x0000000000000000000000000000000000000809` | L1 Block Number | Current HyperCore block |
| `0x000000000000000000000000000000000000080a` | Perp Asset Info | Perp asset metadata |
| `0x000000000000000000000000000000000000080b` | Spot Info | Spot pair metadata |
| `0x000000000000000000000000000000000000080c` | Token Info | Token metadata |
| `0x000000000000000000000000000000000000080d` | Token Supply | Token supply info |
| `0x000000000000000000000000000000000000080e` | BBO | Best bid/offer |
| `0x000000000000000000000000000000000000080f` | Account Margin Summary | Margin summary |
| `0x0000000000000000000000000000000000000810` | Core User Exists | Check if user exists |
| `0x0000000000000000000000000000000000000811` | Borrow Lend User State | Portfolio Margin user state |
| `0x0000000000000000000000000000000000000812` | Borrow Lend Reserve State | Portfolio Margin reserve state |

---

## Precompile Details

### Position (0x800)
**Input:** `(address user, uint16 perpAssetIndex)`
**Output:** `(int64 szi, uint64 entryNtl, int64 isolatedRawUsd, uint32 leverage, bool isIsolated)`

```solidity
// szi: position size (szDecimals varies by asset, e.g., 5 for BTC)
// entryNtl: entry notional (6 decimals)
// isolatedRawUsd: isolated margin collateral (6 decimals)
// leverage: leverage multiplier (direct value, e.g., 25 = 25x)
// isIsolated: true = isolated margin, false = cross margin
```

### Spot Balance (0x801)
**Input:** `(address user, uint64 tokenIndex)`
**Output:** `(uint64 total, uint64 hold, uint64 entryNtl)`

```solidity
// total: total balance (weiDecimals from tokenInfo)
// hold: held/locked balance
// entryNtl: entry notional in USD (6 decimals)
```

### Withdrawable (0x803)
**Input:** `(address user)`
**Output:** `(uint64 withdrawable)`

```solidity
// withdrawable: available to withdraw (6 decimals, USD)
```

### Delegations (0x804)
**Input:** `(address user)`
**Output:** `(tuple(address validator, uint64 amount)[])`

### Delegator Summary (0x805)
**Input:** `(address user)`
**Output:** `(uint64 totalDelegated, uint64 pendingRewards, uint64 claimableRewards, uint64 nDelegations)`

```solidity
// All amounts in 8 decimals (HYPE on HyperCore)
```

### Mark Price (0x806)
**Input:** `(uint32 perpAssetIndex)`
**Output:** `(uint64 markPx, uint64 timestamp)`

```solidity
// markPx: 6 decimals
```

### Oracle Price (0x807)
**Input:** `(uint32 perpAssetIndex)`
**Output:** `(uint64 oraclePx, uint64 timestamp)`

```solidity
// oraclePx: 6 decimals
```

### Spot Price (0x808)
**Input:** `(uint32 spotPairIndex)` ⚠️ Uses spot PAIR index, not token index
**Output:** `(uint64 midPx)`

```solidity
// midPx: 8 decimals
// Note: Spot pair index 0 = PURR/USDC, etc.
```

### L1 Block Number (0x809)
**Input:** `(none)`
**Output:** `(uint64 blockNumber)`

### Perp Asset Info (0x80A)
**Input:** `(uint32 perpAssetIndex)`
**Output:** `(string name, uint32 szDecimals, uint32 maxLeverage)`

### Spot Info (0x80B)
**Input:** `(uint32 spotPairIndex)` ⚠️ Uses spot PAIR index, not token index
**Output:** `(string name, uint64[2] tokens)`

```solidity
// name: pair name (e.g., "PURR/USDC")
// tokens: [baseTokenIndex, quoteTokenIndex]
```

### Token Info (0x80C)
**Input:** `(uint32 tokenIndex)`
**Output:** `(string name, uint64[] spots, uint64 deployerTradingFeeShare, address deployer, address evmContract, uint8 szDecimals, uint8 weiDecimals, int8 evmExtraWeiDecimals)`

```solidity
// name: token symbol (e.g., "USDC", "PURR")
// spots: spot pair indices this token is part of
// weiDecimals: raw balance decimals (like ERC20 decimals)
// szDecimals: size decimals for display
```

### Token Supply (0x80D)
**Input:** `(uint32 tokenIndex)`
**Output:** `(uint64 maxSupply, uint64 totalSupply, uint64 circulatingSupply, uint64 hyperliquiditySupply, tuple(address, uint64)[] topHolders)`

```solidity
// All supply values in 8 decimals
```

### BBO (0x80E)
**Input:** `(uint32 perpAssetIndex)` ⚠️ Uses PERP asset index
**Output:** `(uint64 bidPx, uint64 askPx)`

```solidity
// Prices in 6 decimals (same as mark/oracle price)
```

### Account Margin Summary (0x80F)
**Input:** `(uint32 dexIndex, address user)`
**Output:** `(int64 accountValue, uint64 totalMarginUsed, uint64 totalNtlPos, int64 totalRawUsd)`

```solidity
// All values in 6 decimals (USD)
// dexIndex: 0 for main DEX
```

### Core User Exists (0x810)
**Input:** `(address user)`
**Output:** `(bool exists)`

### Borrow Lend User State (0x811) - Portfolio Margin
**Input:** `(address user, uint64 tokenIndex)`
**Output:** `(tuple(uint64 principal, uint64 value) borrowed, tuple(uint64 principal, uint64 value) supplied)`

```solidity
// value: current value with interest (6 decimals for USDC/USDH)
// Currently supported: USDC (0), USDH (360), HYPE (150), UBTC (197)
```

### Borrow Lend Reserve State (0x812) - Portfolio Margin
**Input:** `(uint64 tokenIndex)`
**Output:** `(uint64 borrowAPR, uint64 supplyAPY, uint64 totalBorrowed, uint64 utilization, uint64 ltv, uint64 liquidationThreshold, uint64 totalSupplied, uint64 availableLiquidity)`

```solidity
// APR/APY: divide by 100 for percentage (e.g., 500 = 5.00%)
// utilization: divide by 100 for percentage
```

---

## Asset Index Reference

### Spot Token Indexes (from API)

| Index | Token | Notes |
|-------|-------|-------|
| 0 | USDC | Base stablecoin |
| 1 | PURR | First spot token |
| 2 | HFUN | |
| 5 | JEFF | |
| 10 | TRUMP | |
| 12 | PEPE | |
| 150 | HYPE | Native token, Portfolio Margin collateral |
| 197 | UBTC | Portfolio Margin collateral |
| 360 | USDH | Portfolio Margin borrowable |

> **Note:** Token indexes are not sequential. Use the API to get current mappings:
> ```bash
> curl -X POST https://api.hyperliquid.xyz/info \
>   -H "Content-Type: application/json" \
>   -d '{"type": "spotMeta"}'
> ```

### Perp Asset Indexes

| Index | Asset |
|-------|-------|
| 0 | BTC |
| 1 | ETH |
| 2 | ATOM |
| 3 | MATIC |
| 4 | DYDX |
| 5 | SOL |
| 6 | AVAX |
| 7 | BNB |
| 8 | APE |
| 9 | OP |
| 10 | LTC |
| 11 | ARB |
| 12 | DOGE |
| 13 | INJ |
| 14 | SUI |
| 15 | kPEPE |
| 18 | LINK |

> **Note:** Use the API to get current mappings:
> ```bash
> curl -X POST https://api.hyperliquid.xyz/info \
>   -H "Content-Type: application/json" \
>   -d '{"type": "meta"}'
> ```

---

## Calldata Encoding

### Using ethers.js

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
const abiCoder = new ethers.AbiCoder();

// Example: Query spot balance
const SPOT_BALANCE = '0x0000000000000000000000000000000000000801';
const tokenIndex = 0; // USDC
const userAddress = '0x...';

// 1. Encode calldata
const data = abiCoder.encode(
  ['uint64', 'address'],
  [tokenIndex, userAddress]
);

// 2. Call precompile
const result = await provider.call({
  to: SPOT_BALANCE,
  data
});

// 3. Decode response
const [total, hold] = abiCoder.decode(['uint64', 'uint64'], result);
console.log(`Balance: ${Number(total) / 1e8}`);
```

### Using viem

```typescript
import { createPublicClient, http, encodeAbiParameters, decodeAbiParameters } from 'viem';

const client = createPublicClient({
  transport: http('https://rpc.hyperliquid.xyz/evm')
});

const data = encodeAbiParameters(
  [{ type: 'uint64' }, { type: 'address' }],
  [0n, '0x...']
);

const result = await client.call({
  to: '0x0000000000000000000000000000000000000801',
  data
});

const [total, hold] = decodeAbiParameters(
  [{ type: 'uint64' }, { type: 'uint64' }],
  result.data
);
```

### From Solidity

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IL1Read {
    function spotBalance(uint64 tokenIndex, address user) external view returns (uint64 total, uint64 hold);
    function withdrawable(address user) external view returns (uint64);
    function markPx(uint32 assetIndex) external view returns (uint64 price, uint64 timestamp);
}

contract Example {
    IL1Read constant SPOT_BALANCE = IL1Read(0x0000000000000000000000000000000000000801);
    IL1Read constant WITHDRAWABLE = IL1Read(0x0000000000000000000000000000000000000803);

    function getUSDCBalance(address user) external view returns (uint64) {
        (uint64 total, ) = SPOT_BALANCE.spotBalance(0, user);
        return total;
    }
}
```

---

## Portfolio Margin (Pre-Alpha)

### Overview
Portfolio Margin unifies spot and perpetual trading for capital efficiency. Spot balances can collateralize perp positions, and users can borrow against their collateral.

### Supported Assets

| Type | Token | Index |
|------|-------|-------|
| Borrowable | USDC | 0 |
| Borrowable | USDH | 360 |
| Collateral | HYPE | 150 |
| Collateral | UBTC | 197 |

### Key Parameters
- **LTV (HYPE):** 0.5 (50%)
- **Liquidation Threshold:** 0.95
- **Interest Rate:** `0.05 + 4.75 × max(0, utilization - 0.8)` APY
- **Protocol Fee:** 10% of interest (liquidation buffer)

### Pre-Alpha Caps (per user)
- `borrow_cap(USDC) = 1000`
- `supply_cap(HYPE) = 200`

### Related Precompiles
- `0x811` - borrowLendUserState: User's borrow/supply position
- `0x812` - borrowLendReserveState: Pool state (APR, utilization, etc.)

---

## API Endpoints

### Spot Metadata
```bash
curl -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type": "spotMeta"}'
```

### Perp Metadata
```bash
curl -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type": "meta"}'
```

### User Spot State
```bash
curl -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type": "spotClearinghouseState", "user": "0x..."}'
```

---

## RPC Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| HyperEVM Mainnet | 999 (0x3E7) | https://rpc.hyperliquid.xyz/evm |
| Block Explorer | - | https://explorer.hyperliquid.xyz |

---

## Decimal Reference

| Value Type | Decimals | Example |
|------------|----------|---------|
| USD (perp margin, withdrawable) | 6 | 1000000 = $1.00 |
| Spot token balance | 8 | 100000000 = 1.0 token |
| Spot price | 8 | 100000000 = $1.00 |
| Mark/Oracle price | 6 | 1000000 = $1.00 |
| HYPE (staking) | 8 | 1e8 = 1 HYPE |
| Position size | 8 | 100000000 = 1.0 contract |
| APR/APY | 2 | 500 = 5.00% |

---

## References

- [HyperLiquid Docs](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [Portfolio Margin](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-margin)
- [API Info Endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- [HyperEVM Explorer](https://explorer.hyperliquid.xyz)
