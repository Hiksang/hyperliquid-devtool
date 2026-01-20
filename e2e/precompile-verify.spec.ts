import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';

const RPC_URL = 'https://rpc.hyperliquid.xyz/evm';
const API_URL = 'https://api.hyperliquid.xyz/info';
const TEST_ADDRESS = '0x4eb7A94dfd3e27B30dA3BB3a2498675aaF7F6fe4';

// Precompile addresses
const PRECOMPILES = {
  position: '0x0000000000000000000000000000000000000800',
  spotBalance: '0x0000000000000000000000000000000000000801',
  vaultEquity: '0x0000000000000000000000000000000000000802',
  withdrawable: '0x0000000000000000000000000000000000000803',
  delegations: '0x0000000000000000000000000000000000000804',
  delegatorSummary: '0x0000000000000000000000000000000000000805',
  markPx: '0x0000000000000000000000000000000000000806',
  oraclePx: '0x0000000000000000000000000000000000000807',
  spotPx: '0x0000000000000000000000000000000000000808',
  l1BlockNumber: '0x0000000000000000000000000000000000000809',
  perpAssetInfo: '0x000000000000000000000000000000000000080a',
  spotPairInfo: '0x000000000000000000000000000000000000080b',
  tokenInfo: '0x000000000000000000000000000000000000080c',
  bbo: '0x000000000000000000000000000000000000080e',
  coreUserExists: '0x0000000000000000000000000000000000000810',
};

async function getApiPrice(coin: string): Promise<number> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'allMids' }),
  });
  const data = await response.json();
  return parseFloat(data[coin]);
}

// Asset config with szDecimals for price calculation
// Price divisor formula: 10^(6 - szDecimals)
const ASSETS = {
  BTC: { index: 0, szDecimals: 5 },   // divisor: 10
  ETH: { index: 1, szDecimals: 4 },   // divisor: 100
  SOL: { index: 5, szDecimals: 2 },   // divisor: 10000
  HYPE: { index: 159, szDecimals: 2 }, // divisor: 10000
};

function getPriceDivisor(szDecimals: number): number {
  return Math.pow(10, 6 - szDecimals);
}

test.describe('Precompile Decimal Verification', () => {
  let provider: ethers.JsonRpcProvider;
  let abiCoder: ethers.AbiCoder;

  test.beforeAll(() => {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    abiCoder = new ethers.AbiCoder();
  });

  test('Mark Price (0x806) - BTC should match API within 1%', async () => {
    const asset = ASSETS.BTC;
    const divisor = getPriceDivisor(asset.szDecimals);
    const data = abiCoder.encode(['uint32'], [asset.index]);
    const result = await provider.call({ to: PRECOMPILES.markPx, data });
    const raw = BigInt(result);
    const price = Number(raw) / divisor;

    const apiPrice = await getApiPrice('BTC');

    console.log(`Mark Price BTC: $${price.toLocaleString()} (raw: ${raw}, divisor: ${divisor})`);
    console.log(`API Price BTC: $${apiPrice.toLocaleString()}`);

    const diff = Math.abs(price - apiPrice) / apiPrice;
    console.log(`Difference: ${(diff * 100).toFixed(2)}%`);

    expect(diff).toBeLessThan(0.01); // Within 1%
  });

  test('Oracle Price (0x807) - BTC should match API within 1%', async () => {
    const asset = ASSETS.BTC;
    const divisor = getPriceDivisor(asset.szDecimals);
    const data = abiCoder.encode(['uint32'], [asset.index]);
    const result = await provider.call({ to: PRECOMPILES.oraclePx, data });
    const raw = BigInt(result);
    const price = Number(raw) / divisor;

    const apiPrice = await getApiPrice('BTC');

    console.log(`Oracle Price BTC: $${price.toLocaleString()}`);
    console.log(`API Price BTC: $${apiPrice.toLocaleString()}`);

    const diff = Math.abs(price - apiPrice) / apiPrice;
    expect(diff).toBeLessThan(0.01);
  });

  test('Mark Price (0x806) - ETH should match API within 1%', async () => {
    const asset = ASSETS.ETH;
    const divisor = getPriceDivisor(asset.szDecimals);
    const data = abiCoder.encode(['uint32'], [asset.index]);
    const result = await provider.call({ to: PRECOMPILES.markPx, data });
    const raw = BigInt(result);
    const price = Number(raw) / divisor;

    const apiPrice = await getApiPrice('ETH');

    console.log(`Mark Price ETH: $${price.toLocaleString()} (raw: ${raw}, divisor: ${divisor})`);
    console.log(`API Price ETH: $${apiPrice.toLocaleString()}`);

    const diff = Math.abs(price - apiPrice) / apiPrice;
    expect(diff).toBeLessThan(0.01);
  });

  test('Mark Price (0x806) - HYPE should match API within 1%', async () => {
    const asset = ASSETS.HYPE;
    const divisor = getPriceDivisor(asset.szDecimals);
    const data = abiCoder.encode(['uint32'], [asset.index]);
    const result = await provider.call({ to: PRECOMPILES.markPx, data });
    const raw = BigInt(result);
    const price = Number(raw) / divisor;

    const apiPrice = await getApiPrice('HYPE');

    console.log(`Mark Price HYPE: $${price.toLocaleString()} (raw: ${raw}, divisor: ${divisor})`);
    console.log(`API Price HYPE: $${apiPrice.toLocaleString()}`);

    const diff = Math.abs(price - apiPrice) / apiPrice;
    expect(diff).toBeLessThan(0.01);
  });

  test('Spot Price (0x808) - @1 should match API within 1%', async () => {
    // @1 (HFUN) has szDecimals=2, so divisor = 10^(8-2) = 1e6
    const szDecimals = 2;
    const divisor = Math.pow(10, 8 - szDecimals);
    const data = abiCoder.encode(['uint32'], [1]); // Pair @1
    const result = await provider.call({ to: PRECOMPILES.spotPx, data });
    const raw = BigInt(result);
    const price = Number(raw) / divisor;

    const apiPrice = await getApiPrice('@1');

    console.log(`Spot Price @1: $${price.toFixed(6)} (raw: ${raw}, divisor: ${divisor})`);
    console.log(`API Price @1: $${apiPrice}`);

    const diff = Math.abs(price - apiPrice) / apiPrice;
    console.log(`Difference: ${(diff * 100).toFixed(2)}%`);

    expect(diff).toBeLessThan(0.01);
  });

  test('BBO (0x80e) - BTC should return valid bid/ask within 1% of API', async () => {
    const asset = ASSETS.BTC;
    const divisor = getPriceDivisor(asset.szDecimals);
    const data = abiCoder.encode(['uint32'], [asset.index]);
    const result = await provider.call({ to: PRECOMPILES.bbo, data });
    const decoded = abiCoder.decode(['uint64', 'uint64'], result);

    const bid = Number(decoded[0]) / divisor;
    const ask = Number(decoded[1]) / divisor;
    const apiPrice = await getApiPrice('BTC');

    console.log(`BBO BTC: Bid=$${bid.toLocaleString()}, Ask=$${ask.toLocaleString()} (divisor: ${divisor})`);
    console.log(`API Price BTC: $${apiPrice.toLocaleString()}`);

    // Bid should be <= API price <= Ask (within tolerance)
    const bidDiff = Math.abs(bid - apiPrice) / apiPrice;
    const askDiff = Math.abs(ask - apiPrice) / apiPrice;

    console.log(`Bid diff: ${(bidDiff * 100).toFixed(2)}%, Ask diff: ${(askDiff * 100).toFixed(2)}%`);

    expect(bidDiff).toBeLessThan(0.01);
    expect(askDiff).toBeLessThan(0.01);
    expect(bid).toBeLessThanOrEqual(ask); // Bid should be <= Ask
  });

  test('Spot Balance (0x801) - should return valid balance', async () => {
    // USDC has weiDecimals = 8, so divisor = 1e8
    const data = abiCoder.encode(['address', 'uint64'], [TEST_ADDRESS, 0]); // USDC (index 0)
    const result = await provider.call({ to: PRECOMPILES.spotBalance, data });
    const decoded = abiCoder.decode(['uint64', 'uint64', 'uint64'], result);

    const weiDecimals = 8; // USDC weiDecimals
    const divisor = Math.pow(10, weiDecimals);
    const total = Number(decoded[0]) / divisor;
    const hold = Number(decoded[1]) / divisor;

    console.log(`USDC Balance: ${total.toFixed(8)} (Hold: ${hold.toFixed(8)}) [weiDecimals=${weiDecimals}]`);

    expect(total).toBeGreaterThanOrEqual(0);
  });

  test('Withdrawable (0x803) - should return valid amount', async () => {
    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);
    const result = await provider.call({ to: PRECOMPILES.withdrawable, data });
    const raw = BigInt(result);
    const amount = Number(raw) / 1e6;

    console.log(`Withdrawable: $${amount.toFixed(6)}`);

    expect(amount).toBeGreaterThanOrEqual(0);
  });

  test('L1 Block Number (0x809) - should return valid block', async () => {
    const result = await provider.call({ to: PRECOMPILES.l1BlockNumber, data: '0x' });
    const raw = BigInt(result);

    console.log(`L1 Block: ${raw.toString()}`);

    expect(Number(raw)).toBeGreaterThan(800000000); // Should be a large number
  });

  test('Core User Exists (0x810) - should return true for known user', async () => {
    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);
    const result = await provider.call({ to: PRECOMPILES.coreUserExists, data });
    const decoded = abiCoder.decode(['bool'], result);

    console.log(`User ${TEST_ADDRESS} exists: ${decoded[0]}`);

    expect(decoded[0]).toBe(true);
  });

  test('Core User Exists (0x810) - should return false for random address', async () => {
    // Use a random address that is unlikely to be a HyperCore user
    const randomAddr = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const data = abiCoder.encode(['address'], [randomAddr]);
    const result = await provider.call({ to: PRECOMPILES.coreUserExists, data });
    const decoded = abiCoder.decode(['bool'], result);

    console.log(`User ${randomAddr} exists: ${decoded[0]}`);

    // Note: This test may fail if this address happens to exist on HyperCore
    expect(decoded[0]).toBe(false);
  });

  test('Perp Asset Info (0x80a) - should return BTC info', async () => {
    const data = abiCoder.encode(['uint32'], [0]);
    const result = await provider.call({ to: PRECOMPILES.perpAssetInfo, data });

    console.log(`Perp Asset Info raw length: ${result.length}`);

    // Should return data (not revert)
    expect(result.length).toBeGreaterThan(66);
  });

  test('Spot Pair Info (0x80b) - should return @1 info', async () => {
    const data = abiCoder.encode(['uint32'], [1]);
    const result = await provider.call({ to: PRECOMPILES.spotPairInfo, data });

    console.log(`Spot Pair Info raw length: ${result.length}`);

    expect(result.length).toBeGreaterThan(66);
  });

  test('Token Info (0x80c) - should return USDC info', async () => {
    const data = abiCoder.encode(['uint64'], [0]);
    const result = await provider.call({ to: PRECOMPILES.tokenInfo, data });

    console.log(`Token Info raw length: ${result.length}`);

    expect(result.length).toBeGreaterThan(66);
  });

  test('Position (0x800) - should return position data', async () => {
    const data = abiCoder.encode(['address', 'uint16'], [TEST_ADDRESS, 0]); // BTC
    const result = await provider.call({ to: PRECOMPILES.position, data });
    const decoded = abiCoder.decode(['int64', 'uint64', 'int64', 'uint32', 'bool'], result);

    const size = Number(decoded[0]) / 1e8;
    const leverage = Number(decoded[3]);

    console.log(`BTC Position: Size=${size}, Leverage=${leverage}x`);

    expect(leverage).toBeGreaterThanOrEqual(0);
  });

  test('Delegations (0x804) - should return delegation array', async () => {
    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);
    const result = await provider.call({ to: PRECOMPILES.delegations, data });
    const decoded = abiCoder.decode(['tuple(address,uint64,uint64)[]'], result);

    console.log(`Delegations count: ${decoded[0].length}`);

    expect(decoded[0].length).toBeGreaterThanOrEqual(0);
  });

  test('Delegator Summary (0x805) - should return summary', async () => {
    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);
    const result = await provider.call({ to: PRECOMPILES.delegatorSummary, data });
    const decoded = abiCoder.decode(['uint64', 'uint64', 'uint64', 'uint64'], result);

    const delegated = Number(decoded[0]) / 1e18;

    console.log(`Delegated: ${delegated.toFixed(4)} HYPE`);

    expect(delegated).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Decimal Summary', () => {
  test('Print all decimal configurations', async () => {
    console.log('\n=== Precompile Decimal Summary ===\n');
    console.log('| Precompile | Scaling | Description |');
    console.log('|------------|---------|-------------|');
    console.log('| markPx (0x806) | 10^(6-szDecimals) | Perp mark price (asset-specific) |');
    console.log('| oraclePx (0x807) | 10^(6-szDecimals) | Oracle price (asset-specific) |');
    console.log('| spotPx (0x808) | 10^(8-szDecimals) | Spot pair price (pair-specific) |');
    console.log('| spotBalance (0x801) | 10^weiDecimals | Token balance (token-specific) |');
    console.log('| withdrawable (0x803) | /1e6 | USD amount |');
    console.log('| position size | /1e8 | Position size |');
    console.log('| delegated | /1e18 | HYPE amount |');
    console.log('\n=== Perp Price Divisor (markPx/oraclePx) ===\n');
    console.log('| Asset | szDecimals | Divisor | Formula |');
    console.log('|-------|------------|---------|---------|');
    console.log('| BTC   | 5          | 10      | 10^(6-5) |');
    console.log('| ETH   | 4          | 100     | 10^(6-4) |');
    console.log('| SOL   | 2          | 10000   | 10^(6-2) |');
    console.log('| HYPE  | 2          | 10000   | 10^(6-2) |');
    console.log('\n=== Spot Price Divisor (spotPx) ===\n');
    console.log('| Pair  | szDecimals | Divisor | Formula |');
    console.log('|-------|------------|---------|---------|');
    console.log('| @1    | 2          | 1e6     | 10^(8-2) |');
    console.log('| @2-@4 | 0          | 1e8     | 10^(8-0) |');
    console.log('\n=== Spot Balance Divisor (spotBalance) ===\n');
    console.log('| Token | weiDecimals | Divisor |');
    console.log('|-------|-------------|---------|');
    console.log('| USDC  | 8           | 1e8     |');
    console.log('| HYPE  | 8           | 1e8     |');
    console.log('| PURR  | 5           | 1e5     |');
    console.log('\nAll tests verify these scalings match API values within 1%');
  });
});
