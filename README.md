# HyperLiquid DevTools

A dashboard application for testing HyperEVM Precompiles and CoreWriter.

## Features

- **Wallet Connection**: MetaMask integration with automatic HyperEVM network switching
- **Balance Display**: Query Perp/Spot balances using L1Read Precompile
- **Precompile Testing**: Test all 5 Precompile contracts
  - `0x0000...0801`: userState
  - `0x0000...0802`: spotState
  - `0x0000...0803`: getWithdrawable
  - `0x0000...0804`: getPositions
  - `0x0000...0805`: getDelegations
- **CoreWriter Testing**: Test 15 CoreWriter Actions
- **Transaction Logs**: Real-time transaction status monitoring

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- ethers.js v6
- lucide-react (icons)

## Getting Started

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build
```

## Network Configuration

- **Chain ID**: 999 (HyperEVM Mainnet)
- **RPC URL**: https://rpc.hyperliquid.xyz/evm
- **Explorer**: https://explorer.hyperliquid.xyz

## CoreWriter Actions

| ID | Action | Status |
|----|--------|--------|
| 1 | Limit Order | Tested |
| 2 | Vault Transfer | Tested ($5 minimum) |
| 3 | Token Delegate | Tested |
| 4 | Staking Deposit | Tested |
| 5 | Staking Withdraw | Tested |
| 6 | Spot Send | Tested |
| 7 | USD Class Transfer | Tested |
| 8 | Finalize EVM Contract | Skip (HIP-1) |
| 9 | Add API Wallet | Tested |
| 10 | Cancel Order by OID | Tested |
| 11 | Cancel Order by CLOID | Tested |
| 12 | Approve Builder Fee | Tested |
| 13 | Send Asset | Skip |
| 14 | Reflect EVM Supply | Skip (HIP-1) |
| 15 | Borrow Lend Op | Testnet Only |

## Action Encoding Format

```
[1 byte: 0x01] version
[3 bytes: action_id] big-endian
[remaining: params] ABI-encoded
```

## Examples

Check out the `examples/` folder for code samples in various languages:
- **JavaScript**: CoreWriter and Multicall examples
- **TypeScript**: CoreWriter SDK and Multicall with viem
- **Python**: CoreWriter and Multicall examples
- **Solidity**: CoreWriterHelper and MulticallReader contracts

## License

MIT
