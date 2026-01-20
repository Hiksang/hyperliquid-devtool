/**
 * HyperCore CoreWriter SDK (TypeScript)
 *
 * HyperEVM에서 HyperCore로 트랜잭션을 보내는 SDK
 *
 * CoreWriter 시스템 컨트랙트: 0x3333333333333333333333333333333333333333
 * Gas 소비: ~47,000 gas (기본 호출)
 * 지연: 주문 및 vault 전송은 몇 초간 지연됨
 *
 * Action Encoding Format:
 *   [1 byte: version=0x01] [3 bytes: action_id (big-endian)] [remaining: ABI-encoded params]
 */

import { ethers, AbiCoder, Contract, JsonRpcProvider, Wallet, ContractTransactionReceipt } from 'ethers';

// ============================================
// Constants
// ============================================

// RPC 설정
export const RPC_URL = 'https://rpc.hyperliquid.xyz/evm';

// CoreWriter 시스템 컨트랙트 주소
export const CORE_WRITER_ADDRESS = '0x3333333333333333333333333333333333333333';

// CoreWriter ABI
export const CORE_WRITER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'data', type: 'bytes' },
    ],
    name: 'RawAction',
    type: 'event',
  },
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'sendRawAction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// Action IDs
export const ActionId = {
  LIMIT_ORDER: 1,
  VAULT_TRANSFER: 2,
  TOKEN_DELEGATE: 3,
  STAKING_DEPOSIT: 4,
  STAKING_WITHDRAW: 5,
  SPOT_SEND: 6,
  USD_CLASS_TRANSFER: 7,
  FINALIZE_EVM_CONTRACT: 8,
  ADD_API_WALLET: 9,
  CANCEL_ORDER_BY_OID: 10,
  CANCEL_ORDER_BY_CLOID: 11,
  APPROVE_BUILDER_FEE: 12,
  SEND_ASSET: 13,
  REFLECT_EVM_SUPPLY: 14,
  BORROW_LEND_OP: 15,
} as const;

// Finalize EVM Contract variants
export const FinalizeVariant = {
  CREATE: 1,
  FIRST_STORAGE_SLOT: 2,
  CUSTOM_STORAGE_SLOT: 3,
} as const;

// Borrow Lend operations
export const BorrowLendOp = {
  DEPOSIT: 0,
  WITHDRAW: 1,
  BORROW: 2,
  REPAY: 3,
} as const;

// Action encoding version
const VERSION = 0x01;

// ============================================
// Type Definitions
// ============================================

export interface LimitOrderParams {
  asset: number; // uint32
  isBuy: boolean;
  limitPx: bigint; // uint64 - raw price value
  sz: bigint; // uint64 - raw size value
  reduceOnly: boolean;
  encodedTif: number; // uint8 - Time in Force
  cloid: bigint; // uint128 - client order ID (0 if none)
}

export interface VaultTransferParams {
  vault: string; // address
  isDeposit: boolean;
  usd: bigint; // uint64 - raw USD amount (6 decimals)
}

export interface TokenDelegateParams {
  validator: string; // address
  wei: bigint; // uint64
  isUndelegate: boolean;
}

export interface StakingParams {
  wei: bigint; // uint64
}

export interface SpotSendParams {
  destination: string; // address
  token: bigint; // uint64 - token index
  wei: bigint; // uint64
}

export interface UsdClassTransferParams {
  ntl: bigint; // uint64 - raw USD amount
  toPerp: boolean; // true: Spot→Perp, false: Perp→Spot
}

export interface FinalizeEvmContractParams {
  token: bigint; // uint64 - token index
  variant: number; // uint8 - 1=Create, 2=FirstStorageSlot, 3=CustomStorageSlot
  createNonce: bigint; // uint64
}

export interface AddApiWalletParams {
  wallet: string; // address
  name: string;
}

export interface CancelOrderByOidParams {
  asset: number; // uint32
  oid: bigint; // uint64 - order ID
}

export interface CancelOrderByCloidParams {
  asset: number; // uint32
  cloid: bigint; // uint128 - client order ID
}

export interface ApproveBuilderFeeParams {
  maxFeeRate: bigint; // uint64
  builder: string; // address
}

export interface SendAssetParams {
  dest: string; // address
  subAccount: string; // address
  srcDex: number; // uint32
  destDex: number; // uint32
  token: bigint; // uint64
  wei: bigint; // uint64
}

export interface ReflectEvmSupplyParams {
  token: bigint; // uint64
  wei: bigint; // uint64
  isMint: boolean;
}

export interface BorrowLendOpParams {
  operation: number; // uint8 - 0=Deposit, 1=Withdraw, 2=Borrow, 3=Repay
  token: bigint; // uint64
  wei: bigint; // uint64
}

export interface TxResult {
  hash: string;
  receipt: ContractTransactionReceipt | null;
}

// ============================================
// HyperCoreWriter Class
// ============================================

export class HyperCoreWriter {
  private provider: JsonRpcProvider;
  private abiCoder: AbiCoder;
  private coreWriter: Contract;

  constructor(rpcUrl: string = RPC_URL) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.abiCoder = new AbiCoder();
    this.coreWriter = new Contract(CORE_WRITER_ADDRESS, CORE_WRITER_ABI, this.provider);
  }

  // ============================================
  // Internal: Header Encoding
  // ============================================

  /**
   * 버전 + action ID 헤더 생성 (4 bytes)
   */
  private encodeHeader(actionId: number): Uint8Array {
    const header = new Uint8Array(4);
    header[0] = VERSION;
    // action ID를 big-endian 3바이트로 인코딩
    header[1] = (actionId >> 16) & 0xff;
    header[2] = (actionId >> 8) & 0xff;
    header[3] = actionId & 0xff;
    return header;
  }

  /**
   * 헤더 + ABI 인코딩 데이터 결합
   */
  private concatBytes(header: Uint8Array, data: string): string {
    const headerHex = '0x' + Buffer.from(header).toString('hex');
    // data는 '0x'로 시작하는 hex string
    return headerHex + data.slice(2);
  }

  // ============================================
  // Action Builders
  // ============================================

  /**
   * Build Limit Order action data
   */
  buildLimitOrder(params: LimitOrderParams): string {
    const header = this.encodeHeader(ActionId.LIMIT_ORDER);
    const data = this.abiCoder.encode(
      ['uint32', 'bool', 'uint64', 'uint64', 'bool', 'uint8', 'uint128'],
      [params.asset, params.isBuy, params.limitPx, params.sz, params.reduceOnly, params.encodedTif, params.cloid]
    );
    return this.concatBytes(header, data);
  }

  /**
   * Build Vault Transfer action data
   */
  buildVaultTransfer(params: VaultTransferParams): string {
    const header = this.encodeHeader(ActionId.VAULT_TRANSFER);
    const data = this.abiCoder.encode(['address', 'bool', 'uint64'], [params.vault, params.isDeposit, params.usd]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Token Delegate action data
   */
  buildTokenDelegate(params: TokenDelegateParams): string {
    const header = this.encodeHeader(ActionId.TOKEN_DELEGATE);
    const data = this.abiCoder.encode(
      ['address', 'uint64', 'bool'],
      [params.validator, params.wei, params.isUndelegate]
    );
    return this.concatBytes(header, data);
  }

  /**
   * Build Staking Deposit action data
   */
  buildStakingDeposit(params: StakingParams): string {
    const header = this.encodeHeader(ActionId.STAKING_DEPOSIT);
    const data = this.abiCoder.encode(['uint64'], [params.wei]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Staking Withdraw action data
   */
  buildStakingWithdraw(params: StakingParams): string {
    const header = this.encodeHeader(ActionId.STAKING_WITHDRAW);
    const data = this.abiCoder.encode(['uint64'], [params.wei]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Spot Send action data
   * ⚠️ 주의: 다른 주소로 토큰 전송 - 자금 손실 위험
   */
  buildSpotSend(params: SpotSendParams): string {
    const header = this.encodeHeader(ActionId.SPOT_SEND);
    const data = this.abiCoder.encode(
      ['address', 'uint64', 'uint64'],
      [params.destination, params.token, params.wei]
    );
    return this.concatBytes(header, data);
  }

  /**
   * Build USD Class Transfer action data
   */
  buildUsdClassTransfer(params: UsdClassTransferParams): string {
    const header = this.encodeHeader(ActionId.USD_CLASS_TRANSFER);
    const data = this.abiCoder.encode(['uint64', 'bool'], [params.ntl, params.toPerp]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Finalize EVM Contract action data
   */
  buildFinalizeEvmContract(params: FinalizeEvmContractParams): string {
    const header = this.encodeHeader(ActionId.FINALIZE_EVM_CONTRACT);
    const data = this.abiCoder.encode(
      ['uint64', 'uint8', 'uint64'],
      [params.token, params.variant, params.createNonce]
    );
    return this.concatBytes(header, data);
  }

  /**
   * Build Add API Wallet action data
   */
  buildAddApiWallet(params: AddApiWalletParams): string {
    const header = this.encodeHeader(ActionId.ADD_API_WALLET);
    const data = this.abiCoder.encode(['address', 'string'], [params.wallet, params.name]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Cancel Order by OID action data
   */
  buildCancelOrderByOid(params: CancelOrderByOidParams): string {
    const header = this.encodeHeader(ActionId.CANCEL_ORDER_BY_OID);
    const data = this.abiCoder.encode(['uint32', 'uint64'], [params.asset, params.oid]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Cancel Order by CLOID action data
   */
  buildCancelOrderByCloid(params: CancelOrderByCloidParams): string {
    const header = this.encodeHeader(ActionId.CANCEL_ORDER_BY_CLOID);
    const data = this.abiCoder.encode(['uint32', 'uint128'], [params.asset, params.cloid]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Approve Builder Fee action data
   */
  buildApproveBuilderFee(params: ApproveBuilderFeeParams): string {
    const header = this.encodeHeader(ActionId.APPROVE_BUILDER_FEE);
    const data = this.abiCoder.encode(['uint64', 'address'], [params.maxFeeRate, params.builder]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Send Asset action data
   * ⚠️ 주의: 다른 주소로 자산 전송 - 자금 손실 위험
   */
  buildSendAsset(params: SendAssetParams): string {
    const header = this.encodeHeader(ActionId.SEND_ASSET);
    const data = this.abiCoder.encode(
      ['address', 'address', 'uint32', 'uint32', 'uint64', 'uint64'],
      [params.dest, params.subAccount, params.srcDex, params.destDex, params.token, params.wei]
    );
    return this.concatBytes(header, data);
  }

  /**
   * Build Reflect EVM Supply action data
   */
  buildReflectEvmSupply(params: ReflectEvmSupplyParams): string {
    const header = this.encodeHeader(ActionId.REFLECT_EVM_SUPPLY);
    const data = this.abiCoder.encode(['uint64', 'uint64', 'bool'], [params.token, params.wei, params.isMint]);
    return this.concatBytes(header, data);
  }

  /**
   * Build Borrow Lend Op action data (Testnet Only)
   */
  buildBorrowLendOp(params: BorrowLendOpParams): string {
    const header = this.encodeHeader(ActionId.BORROW_LEND_OP);
    const data = this.abiCoder.encode(['uint8', 'uint64', 'uint64'], [params.operation, params.token, params.wei]);
    return this.concatBytes(header, data);
  }

  // ============================================
  // Transaction Senders
  // ============================================

  /**
   * Raw action 전송
   */
  async sendRawAction(signer: Wallet, actionData: string): Promise<TxResult> {
    const contract = this.coreWriter.connect(signer) as Contract;
    const tx = await contract.sendRawAction(actionData);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  /**
   * Send Limit Order
   */
  async sendLimitOrder(signer: Wallet, params: LimitOrderParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildLimitOrder(params));
  }

  /**
   * Send Vault Transfer
   */
  async sendVaultTransfer(signer: Wallet, params: VaultTransferParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildVaultTransfer(params));
  }

  /**
   * Send Token Delegate
   */
  async sendTokenDelegate(signer: Wallet, params: TokenDelegateParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildTokenDelegate(params));
  }

  /**
   * Send Staking Deposit
   */
  async sendStakingDeposit(signer: Wallet, params: StakingParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildStakingDeposit(params));
  }

  /**
   * Send Staking Withdraw
   */
  async sendStakingWithdraw(signer: Wallet, params: StakingParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildStakingWithdraw(params));
  }

  /**
   * Send Spot Send
   * ⚠️ 주의: 다른 주소로 토큰 전송 - 자금 손실 위험
   */
  async sendSpotSend(signer: Wallet, params: SpotSendParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildSpotSend(params));
  }

  /**
   * Send USD Class Transfer
   */
  async sendUsdClassTransfer(signer: Wallet, params: UsdClassTransferParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildUsdClassTransfer(params));
  }

  /**
   * Send Finalize EVM Contract
   */
  async sendFinalizeEvmContract(signer: Wallet, params: FinalizeEvmContractParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildFinalizeEvmContract(params));
  }

  /**
   * Send Add API Wallet
   */
  async sendAddApiWallet(signer: Wallet, params: AddApiWalletParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildAddApiWallet(params));
  }

  /**
   * Send Cancel Order by OID
   */
  async sendCancelOrderByOid(signer: Wallet, params: CancelOrderByOidParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildCancelOrderByOid(params));
  }

  /**
   * Send Cancel Order by CLOID
   */
  async sendCancelOrderByCloid(signer: Wallet, params: CancelOrderByCloidParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildCancelOrderByCloid(params));
  }

  /**
   * Send Approve Builder Fee
   */
  async sendApproveBuilderFee(signer: Wallet, params: ApproveBuilderFeeParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildApproveBuilderFee(params));
  }

  /**
   * Send Asset
   * ⚠️ 주의: 다른 주소로 자산 전송 - 자금 손실 위험
   */
  async sendSendAsset(signer: Wallet, params: SendAssetParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildSendAsset(params));
  }

  /**
   * Send Reflect EVM Supply
   */
  async sendReflectEvmSupply(signer: Wallet, params: ReflectEvmSupplyParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildReflectEvmSupply(params));
  }

  /**
   * Send Borrow Lend Op (Testnet Only)
   */
  async sendBorrowLendOp(signer: Wallet, params: BorrowLendOpParams): Promise<TxResult> {
    return this.sendRawAction(signer, this.buildBorrowLendOp(params));
  }

  /**
   * Batch send multiple actions
   */
  async sendBatchActions(signer: Wallet, actions: string[]): Promise<TxResult[]> {
    const results: TxResult[] = [];
    for (const action of actions) {
      const result = await this.sendRawAction(signer, action);
      results.push(result);
    }
    return results;
  }

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Create a wallet from private key
   */
  createWallet(privateKey: string): Wallet {
    return new Wallet(privateKey, this.provider);
  }

  /**
   * Get provider
   */
  getProvider(): JsonRpcProvider {
    return this.provider;
  }

  /**
   * Decode action data (for debugging)
   */
  decodeAction(data: string): { version: number; actionId: number; params: string } {
    const bytes = Buffer.from(data.slice(2), 'hex');
    const version = bytes[0];
    const actionId = (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const params = '0x' + bytes.slice(4).toString('hex');
    return { version, actionId, params };
  }
}

// ============================================
// Utility: Convert USD to raw value
// ============================================

/**
 * USD를 raw value로 변환 (6 decimals)
 * @param usd USD 금액 (예: 10.5)
 * @returns raw value (예: 10500000n)
 */
export function usdToRaw(usd: number): bigint {
  return BigInt(Math.floor(usd * 1e6));
}

/**
 * Raw value를 USD로 변환
 * @param raw raw value
 * @returns USD 금액
 */
export function rawToUsd(raw: bigint): number {
  return Number(raw) / 1e6;
}

/**
 * Price를 raw value로 변환 (8 decimals for prices)
 * @param price 가격 (예: 105000.50)
 * @returns raw value
 */
export function priceToRaw(price: number): bigint {
  return BigInt(Math.floor(price * 1e8));
}

/**
 * Size를 raw value로 변환 (szDecimals 적용)
 * @param size 수량
 * @param szDecimals szDecimals (BTC=5, ETH=4, etc.)
 * @returns raw value
 */
export function sizeToRaw(size: number, szDecimals: number): bigint {
  return BigInt(Math.floor(size * Math.pow(10, szDecimals)));
}

// ============================================
// Example Usage
// ============================================

async function main() {
  const coreWriter = new HyperCoreWriter();

  console.log('='.repeat(60));
  console.log('HyperCore CoreWriter SDK Example');
  console.log('='.repeat(60));

  // Action data 인코딩 예제 (전송 없이)
  console.log('\n1. USD Class Transfer 인코딩 예제');
  const usdTransferData = coreWriter.buildUsdClassTransfer({
    ntl: usdToRaw(1.0), // 1 USD
    toPerp: true, // Spot → Perp
  });
  console.log(`   Encoded data: ${usdTransferData}`);
  console.log(`   Decoded: `, coreWriter.decodeAction(usdTransferData));

  console.log('\n2. Limit Order 인코딩 예제');
  const limitOrderData = coreWriter.buildLimitOrder({
    asset: 0, // BTC
    isBuy: true,
    limitPx: priceToRaw(105000), // $105,000
    sz: sizeToRaw(0.001, 5), // 0.001 BTC (szDecimals=5)
    reduceOnly: false,
    encodedTif: 0, // GTC
    cloid: 0n,
  });
  console.log(`   Encoded data: ${limitOrderData}`);
  console.log(`   Decoded: `, coreWriter.decodeAction(limitOrderData));

  console.log('\n3. Staking Deposit 인코딩 예제');
  const stakingData = coreWriter.buildStakingDeposit({
    wei: BigInt('1000000000000000000'), // 1 token (18 decimals)
  });
  console.log(`   Encoded data: ${stakingData}`);

  console.log('\n실제 트랜잭션 전송은 테스트 스크립트를 사용하세요.');
  console.log('scripts/test-corewriter.js');
}

// Run example if executed directly
main().catch(console.error);

// Export all
export {
  CORE_WRITER_ADDRESS as COREWRITER_ADDRESS,
  CORE_WRITER_ABI as COREWRITER_ABI,
};
