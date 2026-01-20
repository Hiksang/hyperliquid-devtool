/**
 * HyperCore CoreWriter 예제 (JavaScript)
 *
 * HyperEVM에서 HyperCore로 트랜잭션을 보내는 예제
 *
 * CoreWriter 시스템 컨트랙트: 0x3333333333333333333333333333333333333333
 * Gas 소비: ~47,000 gas (기본 호출)
 * 지연: 주문 및 vault 전송은 몇 초간 지연됨
 *
 * Requirements:
 *   npm install ethers dotenv
 */

const { ethers } = require('ethers');

// ============================================
// Constants
// ============================================

const RPC_URL = 'https://rpc.hyperliquid.xyz/evm';
const CORE_WRITER_ADDRESS = '0x3333333333333333333333333333333333333333';

const CORE_WRITER_ABI = [
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
const ActionId = {
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
};

// Action encoding version
const VERSION = 0x01;

// ============================================
// HyperCoreWriter Class
// ============================================

class HyperCoreWriter {
  constructor(rpcUrl = RPC_URL) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.abiCoder = new ethers.AbiCoder();
    this.coreWriter = new ethers.Contract(CORE_WRITER_ADDRESS, CORE_WRITER_ABI, this.provider);
  }

  /**
   * 버전 + action ID 헤더 생성 (4 bytes)
   * @private
   */
  _encodeHeader(actionId) {
    const header = new Uint8Array(4);
    header[0] = VERSION;
    header[1] = (actionId >> 16) & 0xff;
    header[2] = (actionId >> 8) & 0xff;
    header[3] = actionId & 0xff;
    return header;
  }

  /**
   * 헤더 + ABI 인코딩 데이터 결합
   * @private
   */
  _concatBytes(header, data) {
    const headerHex = '0x' + Buffer.from(header).toString('hex');
    return headerHex + data.slice(2);
  }

  // ============================================
  // Action Builders
  // ============================================

  /**
   * Build Limit Order action data
   * @param {Object} params
   * @param {number} params.asset - 자산 인덱스 (uint32)
   * @param {boolean} params.isBuy - 매수 여부
   * @param {bigint} params.limitPx - 지정가 (raw value)
   * @param {bigint} params.sz - 수량 (raw value)
   * @param {boolean} params.reduceOnly - 리듀스 온리
   * @param {number} params.encodedTif - Time in Force
   * @param {bigint} params.cloid - 클라이언트 주문 ID
   */
  buildLimitOrder(params) {
    const header = this._encodeHeader(ActionId.LIMIT_ORDER);
    const data = this.abiCoder.encode(
      ['uint32', 'bool', 'uint64', 'uint64', 'bool', 'uint8', 'uint128'],
      [params.asset, params.isBuy, params.limitPx, params.sz, params.reduceOnly, params.encodedTif, params.cloid]
    );
    return this._concatBytes(header, data);
  }

  /**
   * Build Vault Transfer action data
   * @param {Object} params
   * @param {string} params.vault - Vault 주소
   * @param {boolean} params.isDeposit - 입금 여부
   * @param {bigint} params.usd - USD 금액 (raw value)
   */
  buildVaultTransfer(params) {
    const header = this._encodeHeader(ActionId.VAULT_TRANSFER);
    const data = this.abiCoder.encode(['address', 'bool', 'uint64'], [params.vault, params.isDeposit, params.usd]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Token Delegate action data
   * @param {Object} params
   * @param {string} params.validator - 검증인 주소
   * @param {bigint} params.wei - 위임할 양
   * @param {boolean} params.isUndelegate - 위임 해제 여부
   */
  buildTokenDelegate(params) {
    const header = this._encodeHeader(ActionId.TOKEN_DELEGATE);
    const data = this.abiCoder.encode(
      ['address', 'uint64', 'bool'],
      [params.validator, params.wei, params.isUndelegate]
    );
    return this._concatBytes(header, data);
  }

  /**
   * Build Staking Deposit action data
   * @param {Object} params
   * @param {bigint} params.wei - 스테이킹할 양
   */
  buildStakingDeposit(params) {
    const header = this._encodeHeader(ActionId.STAKING_DEPOSIT);
    const data = this.abiCoder.encode(['uint64'], [params.wei]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Staking Withdraw action data
   * @param {Object} params
   * @param {bigint} params.wei - 출금할 양
   */
  buildStakingWithdraw(params) {
    const header = this._encodeHeader(ActionId.STAKING_WITHDRAW);
    const data = this.abiCoder.encode(['uint64'], [params.wei]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Spot Send action data
   * ⚠️ 주의: 다른 주소로 토큰 전송 - 자금 손실 위험
   * @param {Object} params
   * @param {string} params.destination - 수신자 주소
   * @param {bigint} params.token - 토큰 인덱스
   * @param {bigint} params.wei - 전송할 양
   */
  buildSpotSend(params) {
    const header = this._encodeHeader(ActionId.SPOT_SEND);
    const data = this.abiCoder.encode(
      ['address', 'uint64', 'uint64'],
      [params.destination, params.token, params.wei]
    );
    return this._concatBytes(header, data);
  }

  /**
   * Build USD Class Transfer action data
   * @param {Object} params
   * @param {bigint} params.ntl - USD 금액 (raw value)
   * @param {boolean} params.toPerp - true: Spot→Perp, false: Perp→Spot
   */
  buildUsdClassTransfer(params) {
    const header = this._encodeHeader(ActionId.USD_CLASS_TRANSFER);
    const data = this.abiCoder.encode(['uint64', 'bool'], [params.ntl, params.toPerp]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Finalize EVM Contract action data
   * @param {Object} params
   * @param {bigint} params.token - 토큰 인덱스
   * @param {number} params.variant - 변형 타입 (1=Create, 2=FirstStorageSlot, 3=CustomStorageSlot)
   * @param {bigint} params.createNonce - 생성 nonce
   */
  buildFinalizeEvmContract(params) {
    const header = this._encodeHeader(ActionId.FINALIZE_EVM_CONTRACT);
    const data = this.abiCoder.encode(
      ['uint64', 'uint8', 'uint64'],
      [params.token, params.variant, params.createNonce]
    );
    return this._concatBytes(header, data);
  }

  /**
   * Build Add API Wallet action data
   * @param {Object} params
   * @param {string} params.wallet - API 지갑 주소
   * @param {string} params.name - 지갑 이름
   */
  buildAddApiWallet(params) {
    const header = this._encodeHeader(ActionId.ADD_API_WALLET);
    const data = this.abiCoder.encode(['address', 'string'], [params.wallet, params.name]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Cancel Order by OID action data
   * @param {Object} params
   * @param {number} params.asset - 자산 인덱스
   * @param {bigint} params.oid - 주문 ID
   */
  buildCancelOrderByOid(params) {
    const header = this._encodeHeader(ActionId.CANCEL_ORDER_BY_OID);
    const data = this.abiCoder.encode(['uint32', 'uint64'], [params.asset, params.oid]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Cancel Order by CLOID action data
   * @param {Object} params
   * @param {number} params.asset - 자산 인덱스
   * @param {bigint} params.cloid - 클라이언트 주문 ID
   */
  buildCancelOrderByCloid(params) {
    const header = this._encodeHeader(ActionId.CANCEL_ORDER_BY_CLOID);
    const data = this.abiCoder.encode(['uint32', 'uint128'], [params.asset, params.cloid]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Approve Builder Fee action data
   * @param {Object} params
   * @param {bigint} params.maxFeeRate - 최대 수수료율
   * @param {string} params.builder - 빌더 주소
   */
  buildApproveBuilderFee(params) {
    const header = this._encodeHeader(ActionId.APPROVE_BUILDER_FEE);
    const data = this.abiCoder.encode(['uint64', 'address'], [params.maxFeeRate, params.builder]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Send Asset action data
   * ⚠️ 주의: 다른 주소로 자산 전송 - 자금 손실 위험
   */
  buildSendAsset(params) {
    const header = this._encodeHeader(ActionId.SEND_ASSET);
    const data = this.abiCoder.encode(
      ['address', 'address', 'uint32', 'uint32', 'uint64', 'uint64'],
      [params.dest, params.subAccount, params.srcDex, params.destDex, params.token, params.wei]
    );
    return this._concatBytes(header, data);
  }

  /**
   * Build Reflect EVM Supply action data
   * @param {Object} params
   * @param {bigint} params.token - 토큰 인덱스
   * @param {bigint} params.wei - 양
   * @param {boolean} params.isMint - 민트 여부
   */
  buildReflectEvmSupply(params) {
    const header = this._encodeHeader(ActionId.REFLECT_EVM_SUPPLY);
    const data = this.abiCoder.encode(['uint64', 'uint64', 'bool'], [params.token, params.wei, params.isMint]);
    return this._concatBytes(header, data);
  }

  /**
   * Build Borrow Lend Op action data (Testnet Only)
   * @param {Object} params
   * @param {number} params.operation - 0=Deposit, 1=Withdraw, 2=Borrow, 3=Repay
   * @param {bigint} params.token - 토큰 인덱스
   * @param {bigint} params.wei - 양
   */
  buildBorrowLendOp(params) {
    const header = this._encodeHeader(ActionId.BORROW_LEND_OP);
    const data = this.abiCoder.encode(['uint8', 'uint64', 'uint64'], [params.operation, params.token, params.wei]);
    return this._concatBytes(header, data);
  }

  // ============================================
  // Transaction Senders
  // ============================================

  /**
   * Raw action 전송
   * @param {ethers.Wallet} signer - 서명자
   * @param {string} actionData - 인코딩된 action 데이터
   */
  async sendRawAction(signer, actionData) {
    const contract = this.coreWriter.connect(signer);
    const tx = await contract.sendRawAction(actionData);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  }

  async sendLimitOrder(signer, params) {
    return this.sendRawAction(signer, this.buildLimitOrder(params));
  }

  async sendVaultTransfer(signer, params) {
    return this.sendRawAction(signer, this.buildVaultTransfer(params));
  }

  async sendTokenDelegate(signer, params) {
    return this.sendRawAction(signer, this.buildTokenDelegate(params));
  }

  async sendStakingDeposit(signer, params) {
    return this.sendRawAction(signer, this.buildStakingDeposit(params));
  }

  async sendStakingWithdraw(signer, params) {
    return this.sendRawAction(signer, this.buildStakingWithdraw(params));
  }

  async sendSpotSend(signer, params) {
    return this.sendRawAction(signer, this.buildSpotSend(params));
  }

  async sendUsdClassTransfer(signer, params) {
    return this.sendRawAction(signer, this.buildUsdClassTransfer(params));
  }

  async sendFinalizeEvmContract(signer, params) {
    return this.sendRawAction(signer, this.buildFinalizeEvmContract(params));
  }

  async sendAddApiWallet(signer, params) {
    return this.sendRawAction(signer, this.buildAddApiWallet(params));
  }

  async sendCancelOrderByOid(signer, params) {
    return this.sendRawAction(signer, this.buildCancelOrderByOid(params));
  }

  async sendCancelOrderByCloid(signer, params) {
    return this.sendRawAction(signer, this.buildCancelOrderByCloid(params));
  }

  async sendApproveBuilderFee(signer, params) {
    return this.sendRawAction(signer, this.buildApproveBuilderFee(params));
  }

  async sendSendAsset(signer, params) {
    return this.sendRawAction(signer, this.buildSendAsset(params));
  }

  async sendReflectEvmSupply(signer, params) {
    return this.sendRawAction(signer, this.buildReflectEvmSupply(params));
  }

  async sendBorrowLendOp(signer, params) {
    return this.sendRawAction(signer, this.buildBorrowLendOp(params));
  }

  // ============================================
  // Utility Functions
  // ============================================

  createWallet(privateKey) {
    return new ethers.Wallet(privateKey, this.provider);
  }

  getProvider() {
    return this.provider;
  }

  /**
   * Decode action data (for debugging)
   */
  decodeAction(data) {
    const bytes = Buffer.from(data.slice(2), 'hex');
    const version = bytes[0];
    const actionId = (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const params = '0x' + bytes.slice(4).toString('hex');
    return { version, actionId, params };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * USD를 raw value로 변환 (6 decimals)
 * @param {number} usd - USD 금액
 * @returns {bigint}
 */
function usdToRaw(usd) {
  return BigInt(Math.floor(usd * 1e6));
}

/**
 * Raw value를 USD로 변환
 * @param {bigint} raw
 * @returns {number}
 */
function rawToUsd(raw) {
  return Number(raw) / 1e6;
}

/**
 * Price를 raw value로 변환 (8 decimals)
 * @param {number} price
 * @returns {bigint}
 */
function priceToRaw(price) {
  return BigInt(Math.floor(price * 1e8));
}

/**
 * Size를 raw value로 변환 (CoreWriter 전용)
 *
 * ⚠️ 중요: CoreWriter Limit Order는 8 decimals 사용 (szDecimals 아님!)
 * - HTTP API는 szDecimals 사용 (BTC=5, ETH=4)
 * - CoreWriter는 모든 자산에 8 decimals 사용
 *
 * @param {number} size - 사람이 읽을 수 있는 수량 (예: 0.01 ETH)
 * @returns {bigint} - Raw value (size × 10^8)
 */
function sizeToRaw(size) {
  // CoreWriter: sz = 10^8 * human readable value
  return BigInt(Math.floor(size * 1e8));
}

// ============================================
// Example
// ============================================

async function main() {
  const coreWriter = new HyperCoreWriter();

  console.log('='.repeat(60));
  console.log('HyperCore CoreWriter 예제 (JavaScript)');
  console.log('='.repeat(60));

  // 1. USD Class Transfer 인코딩 예제
  console.log('\n1. USD Class Transfer 인코딩 예제');
  const usdTransferData = coreWriter.buildUsdClassTransfer({
    ntl: usdToRaw(1.0), // 1 USD
    toPerp: true, // Spot → Perp
  });
  console.log(`   Encoded data: ${usdTransferData}`);
  console.log(`   Decoded: `, coreWriter.decodeAction(usdTransferData));

  // 2. Limit Order 인코딩 예제
  // IMPORTANT: sz는 8 decimals 사용! (szDecimals가 아님)
  // IMPORTANT: encodedTif: 1=ALO, 2=GTC, 3=IOC (0이 아님!)
  console.log('\n2. Limit Order 인코딩 예제');
  const limitOrderData = coreWriter.buildLimitOrder({
    asset: 1, // ETH (cross margin 사용 권장)
    isBuy: true,
    limitPx: priceToRaw(2600), // $2,600
    sz: sizeToRaw(0.01), // 0.01 ETH (8 decimals: 1000000)
    reduceOnly: false,
    encodedTif: 2, // GTC (1=ALO, 2=GTC, 3=IOC)
    cloid: BigInt(Date.now()), // 고유 클라이언트 주문 ID
  });
  console.log(`   Encoded data: ${limitOrderData}`);
  console.log(`   Decoded: `, coreWriter.decodeAction(limitOrderData));

  // 3. Staking Deposit 인코딩 예제
  console.log('\n3. Staking Deposit 인코딩 예제');
  const stakingData = coreWriter.buildStakingDeposit({
    wei: BigInt('1000000000000000000'), // 1 token
  });
  console.log(`   Encoded data: ${stakingData}`);
  console.log(`   Decoded: `, coreWriter.decodeAction(stakingData));

  // 4. Vault Transfer 인코딩 예제
  console.log('\n4. Vault Transfer 인코딩 예제');
  const vaultData = coreWriter.buildVaultTransfer({
    vault: '0x1234567890123456789012345678901234567890',
    isDeposit: true,
    usd: usdToRaw(100), // 100 USD
  });
  console.log(`   Encoded data: ${vaultData}`);

  // 5. Token Delegate 인코딩 예제
  console.log('\n5. Token Delegate 인코딩 예제');
  const delegateData = coreWriter.buildTokenDelegate({
    validator: '0x1234567890123456789012345678901234567890',
    wei: BigInt('1000000000000000000'),
    isUndelegate: false,
  });
  console.log(`   Encoded data: ${delegateData}`);

  console.log('\n' + '='.repeat(60));
  console.log('실제 트랜잭션 전송은 테스트 스크립트를 사용하세요:');
  console.log('  node scripts/test-corewriter.js');
  console.log('='.repeat(60));
}

main().catch(console.error);

// Export
module.exports = {
  HyperCoreWriter,
  ActionId,
  CORE_WRITER_ADDRESS,
  CORE_WRITER_ABI,
  usdToRaw,
  rawToUsd,
  priceToRaw,
  sizeToRaw,
};
