// RPC & API
export const RPC_URL = 'https://rpc.hyperliquid.xyz/evm';
export const API_URL = 'https://api.hyperliquid.xyz/info';
export const CHAIN_ID = 999;

// Contracts
export const CORE_WRITER = '0x3333333333333333333333333333333333333333';

// Precompiles - All L1Read addresses (0x800 - 0x810)
export const PRECOMPILES = {
  // User state queries
  position: { address: '0x0000000000000000000000000000000000000800', name: 'Position', description: 'User perp position', inputTypes: ['address', 'uint16'] },
  spotBalance: { address: '0x0000000000000000000000000000000000000801', name: 'Spot Balance', description: 'Spot token balance', inputTypes: ['address', 'uint64'] },
  vaultEquity: { address: '0x0000000000000000000000000000000000000802', name: 'Vault Equity', description: 'User vault equity', inputTypes: ['address', 'address'] },
  withdrawable: { address: '0x0000000000000000000000000000000000000803', name: 'Withdrawable', description: 'Perp withdrawable', inputTypes: ['address'] },
  delegations: { address: '0x0000000000000000000000000000000000000804', name: 'Delegations', description: 'Staking delegations', inputTypes: ['address'] },
  delegatorSummary: { address: '0x0000000000000000000000000000000000000805', name: 'Delegator Summary', description: 'Delegator info', inputTypes: ['address'] },

  // Price queries (Perp Index → /10 for USD)
  markPx: { address: '0x0000000000000000000000000000000000000806', name: 'Mark Price', description: 'Perp mark price (/10)', inputTypes: ['uint32'] },
  oraclePx: { address: '0x0000000000000000000000000000000000000807', name: 'Oracle Price', description: 'Oracle price (/10)', inputTypes: ['uint32'] },

  // Spot queries (Pair Index → /1e6 for USD)
  spotPx: { address: '0x0000000000000000000000000000000000000808', name: 'Spot Price', description: 'Spot pair price (/1e6)', inputTypes: ['uint32'] },

  // System queries
  l1BlockNumber: { address: '0x0000000000000000000000000000000000000809', name: 'L1 Block', description: 'HyperCore block', inputTypes: [] },

  // Asset info queries (returns structs)
  perpAssetInfo: { address: '0x000000000000000000000000000000000000080a', name: 'Perp Asset Info', description: 'Perp asset metadata', inputTypes: ['uint32'] },
  spotPairInfo: { address: '0x000000000000000000000000000000000000080b', name: 'Spot Pair Info', description: 'Spot pair metadata', inputTypes: ['uint32'] },
  tokenInfo: { address: '0x000000000000000000000000000000000000080c', name: 'Token Info', description: 'Token metadata (decimals)', inputTypes: ['uint64'] },

  // User existence check
  coreUserExists: { address: '0x0000000000000000000000000000000000000810', name: 'Core User Exists', description: 'Check if user exists', inputTypes: ['address'] },

  // Best Bid/Offer
  bbo: { address: '0x000000000000000000000000000000000000080e', name: 'BBO', description: 'Best bid/offer (perp)', inputTypes: ['uint32'] },

  // Token Supply
  tokenSupply: { address: '0x000000000000000000000000000000000000080d', name: 'Token Supply', description: 'Token supply info', inputTypes: ['uint32'] },

  // Account Margin Summary
  accountMarginSummary: { address: '0x000000000000000000000000000000000000080f', name: 'Account Margin', description: 'User margin summary', inputTypes: ['uint32', 'address'] },

  // Portfolio Margin (Pre-Alpha)
  borrowLendUserState: { address: '0x0000000000000000000000000000000000000811', name: 'Borrow/Lend User', description: 'Portfolio Margin user state', inputTypes: ['address', 'uint64'] },
  borrowLendReserveState: { address: '0x0000000000000000000000000000000000000812', name: 'Borrow/Lend Reserve', description: 'Portfolio Margin reserve', inputTypes: ['uint64'] },
} as const;

// CoreWriter Action Documentation
export const ACTION_DOCS: Record<number, {
  description: string;
  calldata: string;
  params: Array<{ name: string; type: string; desc: string }>;
  notes?: string[];
}> = {
  1: {
    description: 'Place a limit order on the perp market',
    calldata: 'Header(01 00 00 01) + abi.encode(asset, isBuy, limitPx, sz, reduceOnly, encodedTif, cloid)',
    params: [
      { name: 'asset', type: 'uint32', desc: 'Perp asset index (0=BTC, 1=ETH, ...)' },
      { name: 'isBuy', type: 'bool', desc: 'true=Long, false=Short' },
      { name: 'limitPx', type: 'uint64', desc: 'Price × 10 (e.g., $50000 = 500000)' },
      { name: 'sz', type: 'uint64', desc: 'Size in szDecimals (dynamic per asset)' },
      { name: 'reduceOnly', type: 'bool', desc: 'Reduce-only order flag' },
      { name: 'encodedTif', type: 'uint8', desc: '1=GTC, 2=IOC, 3=ALO' },
      { name: 'cloid', type: 'uint128', desc: 'Client order ID (0 for none)' },
    ],
    notes: ['szDecimals varies by asset - check perpAssetInfo precompile'],
  },
  2: {
    description: 'Deposit or withdraw USD to/from a vault',
    calldata: 'Header(01 00 00 02) + abi.encode(vault, isDeposit, usd)',
    params: [
      { name: 'vault', type: 'address', desc: 'Vault contract address' },
      { name: 'isDeposit', type: 'bool', desc: 'true=Deposit, false=Withdraw' },
      { name: 'usd', type: 'uint64', desc: 'USD amount × 1e6 (6 decimals)' },
    ],
  },
  3: {
    description: 'Delegate or undelegate HYPE to a validator',
    calldata: 'Header(01 00 00 03) + abi.encode(validator, wei, isUndelegate)',
    params: [
      { name: 'validator', type: 'address', desc: 'Validator address' },
      { name: 'wei', type: 'uint64', desc: 'HYPE amount × 1e8 (8 decimals)' },
      { name: 'isUndelegate', type: 'bool', desc: 'true=Undelegate, false=Delegate' },
    ],
    notes: ['Undelegation has a cooldown period'],
  },
  4: {
    description: 'Deposit HYPE for staking (moves from spot to staking balance)',
    calldata: 'Header(01 00 00 04) + abi.encode(wei)',
    params: [
      { name: 'wei', type: 'uint64', desc: 'HYPE amount × 1e8 (8 decimals)' },
    ],
    notes: ['Requires HYPE in spot balance first'],
  },
  5: {
    description: 'Withdraw HYPE from staking (moves from staking to spot balance)',
    calldata: 'Header(01 00 00 05) + abi.encode(wei)',
    params: [
      { name: 'wei', type: 'uint64', desc: 'HYPE amount × 1e8 (8 decimals)' },
    ],
  },
  6: {
    description: 'Send spot tokens to another address on HyperCore',
    calldata: 'Header(01 00 00 06) + abi.encode(destination, token, wei)',
    params: [
      { name: 'destination', type: 'address', desc: 'Recipient address' },
      { name: 'token', type: 'uint64', desc: 'Token index (0=USDC, 1=PURR, 150=HYPE, ...)' },
      { name: 'wei', type: 'uint64', desc: 'Amount in token decimals (USDC: 8, HYPE: 18)' },
    ],
    notes: ['Token decimals vary - check tokenInfo precompile (0x80C)'],
  },
  7: {
    description: 'Transfer USD between spot and perp balance',
    calldata: 'Header(01 00 00 07) + abi.encode(ntl, toPerp)',
    params: [
      { name: 'ntl', type: 'uint64', desc: 'USD amount × 1e6 (6 decimals)' },
      { name: 'toPerp', type: 'bool', desc: 'true=Spot→Perp, false=Perp→Spot' },
    ],
    notes: ['Most common action for moving funds between trading modes'],
  },
  9: {
    description: 'Register an API wallet for programmatic trading',
    calldata: 'Header(01 00 00 09) + abi.encode(wallet, name)',
    params: [
      { name: 'wallet', type: 'address', desc: 'API wallet address to authorize' },
      { name: 'name', type: 'string', desc: 'Name for the API wallet' },
    ],
    notes: ['API wallet can trade on behalf of your account', 'Generate a new wallet for security'],
  },
  10: {
    description: 'Cancel an order by its order ID (OID)',
    calldata: 'Header(01 00 00 0a) + abi.encode(asset, oid)',
    params: [
      { name: 'asset', type: 'uint32', desc: 'Perp asset index' },
      { name: 'oid', type: 'uint64', desc: 'Order ID from order response' },
    ],
  },
  11: {
    description: 'Cancel an order by client order ID (CLOID)',
    calldata: 'Header(01 00 00 0b) + abi.encode(asset, cloid)',
    params: [
      { name: 'asset', type: 'uint32', desc: 'Perp asset index' },
      { name: 'cloid', type: 'uint128', desc: 'Client order ID you specified' },
    ],
  },
  12: {
    description: 'Approve a builder to collect fees from your trades',
    calldata: 'Header(01 00 00 0c) + abi.encode(maxFeeRate, builder)',
    params: [
      { name: 'maxFeeRate', type: 'uint64', desc: 'Max fee in basis points × 100 (10000 = 1%)' },
      { name: 'builder', type: 'address', desc: 'Builder address to approve' },
    ],
  },
};

// CoreWriter Actions
export const COREWRITER_ACTIONS = [
  { id: 1, name: 'Limit Order', status: 'tested' as const, params: ['asset', 'isBuy', 'limitPx', 'sz', 'reduceOnly', 'encodedTif', 'cloid'], types: ['uint32', 'bool', 'uint64', 'uint64', 'bool', 'uint8', 'uint128'] },
  { id: 2, name: 'Vault Transfer', status: 'tested' as const, params: ['vault', 'isDeposit', 'usd'], types: ['address', 'bool', 'uint64'] },
  { id: 3, name: 'Token Delegate', status: 'tested' as const, params: ['validator', 'wei', 'isUndelegate'], types: ['address', 'uint64', 'bool'] },
  { id: 4, name: 'Staking Deposit', status: 'tested' as const, params: ['wei'], types: ['uint64'] },
  { id: 5, name: 'Staking Withdraw', status: 'tested' as const, params: ['wei'], types: ['uint64'] },
  { id: 6, name: 'Spot Send', status: 'tested' as const, params: ['destination', 'token', 'wei'], types: ['address', 'uint64', 'uint64'] },
  { id: 7, name: 'USD Class Transfer', status: 'tested' as const, params: ['ntl', 'toPerp'], types: ['uint64', 'bool'] },
  { id: 8, name: 'Finalize EVM Contract', status: 'skip' as const, params: ['token', 'variant', 'createNonce'], types: ['uint64', 'uint8', 'uint64'] },
  { id: 9, name: 'Add API Wallet', status: 'tested' as const, params: ['wallet', 'name'], types: ['address', 'string'] },
  { id: 10, name: 'Cancel by OID', status: 'tested' as const, params: ['asset', 'oid'], types: ['uint32', 'uint64'] },
  { id: 11, name: 'Cancel by CLOID', status: 'tested' as const, params: ['asset', 'cloid'], types: ['uint32', 'uint128'] },
  { id: 12, name: 'Approve Builder Fee', status: 'tested' as const, params: ['maxFeeRate', 'builder'], types: ['uint64', 'address'] },
  { id: 13, name: 'Send Asset', status: 'skip' as const, params: ['dest', 'subAccount', 'srcDex', 'destDex', 'token', 'wei'], types: ['address', 'address', 'uint32', 'uint32', 'uint64', 'uint64'] },
  { id: 14, name: 'Reflect EVM Supply', status: 'skip' as const, params: ['token', 'wei', 'isMint'], types: ['uint64', 'uint64', 'bool'] },
  { id: 15, name: 'Borrow Lend Op', status: 'skip' as const, params: ['operation', 'token', 'wei'], types: ['uint8', 'uint64', 'uint64'] },
];
