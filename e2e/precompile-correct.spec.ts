import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';

const RPC_URL = 'https://rpc.hyperliquid.xyz/evm';
const TEST_ADDRESS = '0x4eb7A94dfd3e27B30dA3BB3a2498675aaF7F6fe4';
const VAULT_ADDRESS = '0xdfc24b077bc1425ad1dea75bcb6f8158e10df303';

// Correct precompile addresses!
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
} as const;

test.describe('Precompile Correct Addresses', () => {

  test('Position (0x800) - address, uint16', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['address', 'uint16'], [TEST_ADDRESS, 0]); // BTC

    console.log('=== Position (0x800) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.position,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      // Decode: int64 size, uint64 entryPx, int64 pnl, uint32 leverage, bool isLong
      const decoded = abiCoder.decode(['int64', 'uint64', 'int64', 'uint32', 'bool'], result);
      console.log('Size:', Number(decoded[0]) / 1e8);
      console.log('Entry Px:', Number(decoded[1]) / 1e6);
      console.log('Leverage:', decoded[3].toString());
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Spot Balance (0x801) - address, uint64', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    // Spot Balance: (address, uint64) - token index
    const data = abiCoder.encode(['address', 'uint64'], [TEST_ADDRESS, 0]); // USDC (index 0)

    console.log('=== Spot Balance (0x801) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.spotBalance,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      // Decode: uint64 total, uint64 hold, uint64 entryNtl
      const decoded = abiCoder.decode(['uint64', 'uint64', 'uint64'], result);
      console.log('Total:', (Number(decoded[0]) / 1e6).toFixed(6));
      console.log('Hold:', (Number(decoded[1]) / 1e6).toFixed(6));
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Vault Equity (0x802) - address, address', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    // Vault Equity: (address user, address vault)
    const data = abiCoder.encode(['address', 'address'], [TEST_ADDRESS, VAULT_ADDRESS]);

    console.log('=== Vault Equity (0x802) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.vaultEquity,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      // Decode: uint64 equity, uint64 withdrawable
      const decoded = abiCoder.decode(['uint64', 'uint64'], result);
      console.log('Equity:', (Number(decoded[0]) / 1e6).toFixed(2));
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Withdrawable (0x803) - address', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);

    console.log('=== Withdrawable (0x803) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.withdrawable,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['uint64'], result);
      console.log('Withdrawable:', (Number(decoded[0]) / 1e6).toFixed(6));
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Delegations (0x804) - address', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);

    console.log('=== Delegations (0x804) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.delegations,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['tuple(address,uint64,uint64)[]'], result);
      console.log('Delegations count:', decoded[0].length);
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Delegator Summary (0x805) - address', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['address'], [TEST_ADDRESS]);

    console.log('=== Delegator Summary (0x805) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.delegatorSummary,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['uint64', 'uint64', 'uint64', 'uint64'], result);
      console.log('Delegated:', (Number(decoded[0]) / 1e18).toFixed(4), 'HYPE');
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Mark Price (0x806) - uint32', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['uint32'], [0]); // BTC

    console.log('=== Mark Price (0x806) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.markPx,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['uint64'], result);
      console.log('Mark Price:', '$' + (Number(decoded[0]) / 1e6).toLocaleString());
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Oracle Price (0x807) - uint32', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['uint32'], [0]); // BTC

    console.log('=== Oracle Price (0x807) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.oraclePx,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['uint64'], result);
      console.log('Oracle Price:', '$' + (Number(decoded[0]) / 1e6).toLocaleString());
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('Spot Price (0x808) - uint32', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    const data = abiCoder.encode(['uint32'], [0]); // Pair index 0

    console.log('=== Spot Price (0x808) ===');
    console.log('Input:', data);

    try {
      const result = await provider.call({
        to: PRECOMPILES.spotPx,
        data: data,
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['uint64'], result);
      console.log('Spot Price:', '$' + (Number(decoded[0]) / 1e8).toFixed(8));
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });

  test('L1 Block Number (0x809) - no input', async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abiCoder = new ethers.AbiCoder();

    console.log('=== L1 Block Number (0x809) ===');
    console.log('Input: 0x (empty)');

    try {
      const result = await provider.call({
        to: PRECOMPILES.l1BlockNumber,
        data: '0x',
      });
      console.log('✅ Success! Result:', result);

      const decoded = abiCoder.decode(['uint64'], result);
      console.log('L1 Block:', decoded[0].toString());
    } catch (error: any) {
      console.error('❌ Error:', error.info?.error?.message || error.message);
    }
  });
});
