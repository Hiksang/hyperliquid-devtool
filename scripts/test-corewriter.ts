import { ethers } from 'ethers';
import { buildAction, buildHeader, sendAction, actions } from '../src/lib/corewriter';
import { RPC_URL, CORE_WRITER, PRECOMPILES } from '../src/lib/constants';

const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY not found in .env');
  process.exit(1);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const abiCoder = new ethers.AbiCoder();

  console.log('=== CoreWriter Test ===');
  console.log(`Wallet: ${wallet.address}`);
  console.log(`CoreWriter: ${CORE_WRITER}`);
  console.log('');

  // Check current state using precompiles
  console.log('=== Current State (Before) ===');

  // Check withdrawable balance
  const withdrawableData = abiCoder.encode(['address'], [wallet.address]);
  const withdrawableResult = await provider.call({ to: PRECOMPILES.withdrawable.address, data: withdrawableData });
  const withdrawable = Number(BigInt(withdrawableResult)) / 1e6;
  console.log(`Withdrawable (Perp): $${withdrawable.toFixed(6)}`);

  // Check spot balance (USDC = token 0)
  const spotData = abiCoder.encode(['address', 'uint64'], [wallet.address, 0]);
  const spotResult = await provider.call({ to: PRECOMPILES.spotBalance.address, data: spotData });
  const spotDecoded = abiCoder.decode(['uint64', 'uint64', 'uint64'], spotResult);
  const spotBalance = Number(spotDecoded[0]) / 1e8;
  console.log(`Spot USDC Balance: ${spotBalance.toFixed(8)}`);
  console.log('');

  // Test 1: Build action data (dry run)
  console.log('=== Test 1: Build Action Data ===');

  // USD Class Transfer: Move 0.001 USD from Spot to Perp
  const usdAmount = BigInt(1000); // 0.001 USD * 1e6
  const action = actions.usdClassTransfer(usdAmount, true); // toPerp = true
  const actionData = buildAction(action.id, action.types, action.values);

  console.log(`Action: USD Class Transfer`);
  console.log(`  Amount: 0.001 USD`);
  console.log(`  Direction: Spot → Perp`);
  console.log(`  Action ID: ${action.id}`);
  console.log(`  Header: ${buildHeader(action.id)}`);
  console.log(`  Full Calldata: ${actionData}`);
  console.log('');

  // Test 2: Estimate gas
  console.log('=== Test 2: Estimate Gas ===');
  const coreWriterContract = new ethers.Contract(
    CORE_WRITER,
    ['function sendRawAction(bytes) external'],
    wallet
  );

  try {
    const gasEstimate = await coreWriterContract.sendRawAction.estimateGas(actionData);
    console.log(`Estimated Gas: ${gasEstimate.toString()}`);
  } catch (e: any) {
    console.log(`Gas estimation failed: ${e.message?.slice(0, 100)}`);
  }
  console.log('');

  // Test 3: Actually send the transaction
  console.log('=== Test 3: Send Transaction ===');
  console.log('Sending USD Class Transfer (0.001 USD Spot → Perp)...');

  try {
    const tx = await sendAction(wallet, action.id, action.types, action.values);
    console.log(`TX Hash: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`Status: ${receipt?.status === 1 ? '✅ Success' : '❌ Failed'}`);
    console.log(`Block: ${receipt?.blockNumber}`);
    console.log(`Gas Used: ${receipt?.gasUsed.toString()}`);
    console.log('');

    // Wait a bit for L1 to process
    console.log('Waiting 3s for HyperCore to process...');
    await new Promise(r => setTimeout(r, 3000));

    // Check state after
    console.log('=== Current State (After) ===');
    const withdrawableResult2 = await provider.call({ to: PRECOMPILES.withdrawable.address, data: withdrawableData });
    const withdrawable2 = Number(BigInt(withdrawableResult2)) / 1e6;
    console.log(`Withdrawable (Perp): $${withdrawable2.toFixed(6)}`);

    const spotResult2 = await provider.call({ to: PRECOMPILES.spotBalance.address, data: spotData });
    const spotDecoded2 = abiCoder.decode(['uint64', 'uint64', 'uint64'], spotResult2);
    const spotBalance2 = Number(spotDecoded2[0]) / 1e8;
    console.log(`Spot USDC Balance: ${spotBalance2.toFixed(8)}`);

    console.log('');
    console.log('=== Change ===');
    console.log(`Withdrawable: ${(withdrawable2 - withdrawable).toFixed(6)} USD`);
    console.log(`Spot USDC: ${(spotBalance2 - spotBalance).toFixed(8)}`);

  } catch (e: any) {
    console.log(`Transaction failed: ${e.message}`);
  }
}

main().catch(console.error);
