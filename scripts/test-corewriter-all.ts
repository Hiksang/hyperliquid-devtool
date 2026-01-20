import { ethers } from 'ethers';
import { buildAction, buildHeader, sendAction, actions } from '../src/lib/corewriter';
import { RPC_URL, CORE_WRITER, PRECOMPILES, COREWRITER_ACTIONS } from '../src/lib/constants';

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY not found');
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const abiCoder = new ethers.AbiCoder();

  console.log('=== CoreWriter All Actions Test ===');
  console.log(`Wallet: ${wallet.address}`);
  console.log('');

  // List all actions
  console.log('=== Available Actions ===');
  COREWRITER_ACTIONS.forEach(action => {
    console.log(`  ${action.id.toString().padStart(2)}: ${action.name} (${action.status})`);
  });
  console.log('');

  // Helper to get current state
  const getState = async () => {
    const withdrawableData = abiCoder.encode(['address'], [wallet.address]);
    const withdrawableResult = await provider.call({ to: PRECOMPILES.withdrawable.address, data: withdrawableData });
    const withdrawable = Number(BigInt(withdrawableResult)) / 1e6;

    const spotData = abiCoder.encode(['address', 'uint64'], [wallet.address, 0]);
    const spotResult = await provider.call({ to: PRECOMPILES.spotBalance.address, data: spotData });
    const spotDecoded = abiCoder.decode(['uint64', 'uint64', 'uint64'], spotResult);
    const spotBalance = Number(spotDecoded[0]) / 1e8;

    return { withdrawable, spotBalance };
  };

  // Test 1: USD Class Transfer (Perp → Spot)
  console.log('=== Test: USD Class Transfer (Perp → Spot) ===');
  const before1 = await getState();
  console.log(`Before: Perp=$${before1.withdrawable.toFixed(6)}, Spot=${before1.spotBalance.toFixed(8)}`);

  const action1 = actions.usdClassTransfer(BigInt(1000), false); // toPerp = false (Perp → Spot)
  try {
    const tx1 = await sendAction(wallet, action1.id, action1.types, action1.values);
    console.log(`TX: ${tx1.hash}`);
    await tx1.wait();
    await new Promise(r => setTimeout(r, 3000));

    const after1 = await getState();
    console.log(`After:  Perp=$${after1.withdrawable.toFixed(6)}, Spot=${after1.spotBalance.toFixed(8)}`);
    console.log(`Change: Perp=${(after1.withdrawable - before1.withdrawable).toFixed(6)}, Spot=${(after1.spotBalance - before1.spotBalance).toFixed(8)}`);
    console.log('✅ Success\n');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message?.slice(0, 100)}\n`);
  }

  // Test 2: Spot Send (to self - safe test)
  console.log('=== Test: Spot Send (to self) ===');
  const before2 = await getState();
  console.log(`Before: Spot=${before2.spotBalance.toFixed(8)}`);

  // Send 0.0001 USDC to self
  const spotSendAction = actions.spotSend(wallet.address, BigInt(0), BigInt(10000)); // 0.0001 USDC (weiDecimals=8)
  try {
    const tx2 = await sendAction(wallet, spotSendAction.id, spotSendAction.types, spotSendAction.values);
    console.log(`TX: ${tx2.hash}`);
    await tx2.wait();
    await new Promise(r => setTimeout(r, 3000));

    const after2 = await getState();
    console.log(`After:  Spot=${after2.spotBalance.toFixed(8)}`);
    console.log(`Change: Spot=${(after2.spotBalance - before2.spotBalance).toFixed(8)} (should be ~0 for self-send)`);
    console.log('✅ Success\n');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message?.slice(0, 100)}\n`);
  }

  // Test 3: Vault Transfer (Deposit to a vault)
  console.log('=== Test: Vault Transfer (Deposit 0.001 USD) ===');
  const before3 = await getState();
  console.log(`Before: Perp=$${before3.withdrawable.toFixed(6)}`);

  // Deposit 0.001 USD to a known vault
  const vaultAddr = '0xdfc24b077bc1425ad1dea75bcb6f8158e10df303';
  const vaultAction = actions.vaultTransfer(vaultAddr, true, BigInt(1000)); // 0.001 USD
  try {
    const tx3 = await sendAction(wallet, vaultAction.id, vaultAction.types, vaultAction.values);
    console.log(`TX: ${tx3.hash}`);
    await tx3.wait();
    await new Promise(r => setTimeout(r, 3000));

    const after3 = await getState();
    console.log(`After:  Perp=$${after3.withdrawable.toFixed(6)}`);
    console.log(`Change: Perp=${(after3.withdrawable - before3.withdrawable).toFixed(6)}`);
    console.log('✅ Success\n');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message?.slice(0, 100)}\n`);
  }

  // Test 4: Vault Transfer (Withdraw from vault)
  console.log('=== Test: Vault Transfer (Withdraw 0.001 USD) ===');
  const before4 = await getState();
  console.log(`Before: Perp=$${before4.withdrawable.toFixed(6)}`);

  const vaultWithdrawAction = actions.vaultTransfer(vaultAddr, false, BigInt(1000)); // withdraw 0.001 USD
  try {
    const tx4 = await sendAction(wallet, vaultWithdrawAction.id, vaultWithdrawAction.types, vaultWithdrawAction.values);
    console.log(`TX: ${tx4.hash}`);
    await tx4.wait();
    await new Promise(r => setTimeout(r, 3000));

    const after4 = await getState();
    console.log(`After:  Perp=$${after4.withdrawable.toFixed(6)}`);
    console.log(`Change: Perp=${(after4.withdrawable - before4.withdrawable).toFixed(6)}`);
    console.log('✅ Success\n');
  } catch (e: any) {
    console.log(`❌ Failed: ${e.message?.slice(0, 100)}\n`);
  }

  // Final state
  console.log('=== Final State ===');
  const final = await getState();
  console.log(`Withdrawable (Perp): $${final.withdrawable.toFixed(6)}`);
  console.log(`Spot USDC: ${final.spotBalance.toFixed(8)}`);
}

main().catch(console.error);
