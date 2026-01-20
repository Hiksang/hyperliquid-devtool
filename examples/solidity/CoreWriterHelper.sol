// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CoreWriterHelper
 * @notice HyperEVM에서 HyperCore로 트랜잭션을 보내는 헬퍼 컨트랙트
 * @dev CoreWriter 시스템 컨트랙트 (0x3333...3333)를 사용하여 HyperCore Action 전송
 *
 * Action Encoding Format:
 *   [1 byte: version=0x01] [3 bytes: action_id (big-endian)] [remaining: ABI-encoded params]
 *
 * Gas 소비: ~47,000 gas (기본 호출)
 * 지연: 주문 및 vault 전송은 몇 초간 지연됨
 */

// CoreWriter 시스템 컨트랙트 인터페이스
interface ICoreWriter {
    /// @notice Raw action을 HyperCore로 전송
    /// @param data ABI-encoded action data
    event RawAction(address indexed user, bytes data);
    function sendRawAction(bytes calldata data) external;
}

// Action ID 상수
library CoreWriterActions {
    uint24 constant LIMIT_ORDER = 1;
    uint24 constant VAULT_TRANSFER = 2;
    uint24 constant TOKEN_DELEGATE = 3;
    uint24 constant STAKING_DEPOSIT = 4;
    uint24 constant STAKING_WITHDRAW = 5;
    uint24 constant SPOT_SEND = 6;
    uint24 constant USD_CLASS_TRANSFER = 7;
    uint24 constant FINALIZE_EVM_CONTRACT = 8;
    uint24 constant ADD_API_WALLET = 9;
    uint24 constant CANCEL_ORDER_BY_OID = 10;
    uint24 constant CANCEL_ORDER_BY_CLOID = 11;
    uint24 constant APPROVE_BUILDER_FEE = 12;
    uint24 constant SEND_ASSET = 13;
    uint24 constant REFLECT_EVM_SUPPLY = 14;
    uint24 constant BORROW_LEND_OP = 15;
}

// Finalize EVM Contract variant
library FinalizeVariant {
    uint8 constant CREATE = 1;
    uint8 constant FIRST_STORAGE_SLOT = 2;
    uint8 constant CUSTOM_STORAGE_SLOT = 3;
}

// Borrow Lend 작업 타입
library BorrowLendOperation {
    uint8 constant DEPOSIT = 0;
    uint8 constant WITHDRAW = 1;
    uint8 constant BORROW = 2;
    uint8 constant REPAY = 3;
}

/**
 * @title CoreWriterHelper
 * @notice HyperCore Action 인코딩 및 전송 헬퍼
 */
contract CoreWriterHelper {
    // CoreWriter 시스템 컨트랙트 주소
    ICoreWriter public constant CORE_WRITER = ICoreWriter(0x3333333333333333333333333333333333333333);

    // Action encoding version
    uint8 private constant VERSION = 0x01;

    // ============================================
    // Internal: Action 인코딩 헬퍼
    // ============================================

    /// @dev 버전 + action ID 헤더 생성 (4 bytes)
    function _encodeHeader(uint24 actionId) internal pure returns (bytes memory) {
        return abi.encodePacked(VERSION, actionId);
    }

    // ============================================
    // Action 1: Limit Order
    // ============================================

    /// @notice Limit Order action 인코딩
    /// @param asset 자산 인덱스
    /// @param isBuy 매수 여부
    /// @param limitPx 지정가 (raw value)
    /// @param sz 수량 (raw value)
    /// @param reduceOnly 리듀스 온리 여부
    /// @param encodedTif Time-in-Force 인코딩 값
    /// @param cloid 클라이언트 주문 ID (0이면 없음)
    function encodeLimitOrder(
        uint32 asset,
        bool isBuy,
        uint64 limitPx,
        uint64 sz,
        bool reduceOnly,
        uint8 encodedTif,
        uint128 cloid
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.LIMIT_ORDER),
            abi.encode(asset, isBuy, limitPx, sz, reduceOnly, encodedTif, cloid)
        );
    }

    /// @notice Limit Order 전송
    function sendLimitOrder(
        uint32 asset,
        bool isBuy,
        uint64 limitPx,
        uint64 sz,
        bool reduceOnly,
        uint8 encodedTif,
        uint128 cloid
    ) external {
        CORE_WRITER.sendRawAction(encodeLimitOrder(asset, isBuy, limitPx, sz, reduceOnly, encodedTif, cloid));
    }

    // ============================================
    // Action 2: Vault Transfer
    // ============================================

    /// @notice Vault Transfer action 인코딩
    /// @param vault Vault 주소
    /// @param isDeposit 입금 여부 (false면 출금)
    /// @param usd USD 금액 (raw value, 6 decimals)
    function encodeVaultTransfer(
        address vault,
        bool isDeposit,
        uint64 usd
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.VAULT_TRANSFER),
            abi.encode(vault, isDeposit, usd)
        );
    }

    /// @notice Vault Transfer 전송
    function sendVaultTransfer(address vault, bool isDeposit, uint64 usd) external {
        CORE_WRITER.sendRawAction(encodeVaultTransfer(vault, isDeposit, usd));
    }

    // ============================================
    // Action 3: Token Delegate
    // ============================================

    /// @notice Token Delegate action 인코딩
    /// @param validator 검증인 주소
    /// @param wei_ 위임할 양 (wei)
    /// @param isUndelegate 위임 해제 여부
    function encodeTokenDelegate(
        address validator,
        uint64 wei_,
        bool isUndelegate
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.TOKEN_DELEGATE),
            abi.encode(validator, wei_, isUndelegate)
        );
    }

    /// @notice Token Delegate 전송
    function sendTokenDelegate(address validator, uint64 wei_, bool isUndelegate) external {
        CORE_WRITER.sendRawAction(encodeTokenDelegate(validator, wei_, isUndelegate));
    }

    // ============================================
    // Action 4: Staking Deposit
    // ============================================

    /// @notice Staking Deposit action 인코딩
    /// @param wei_ 스테이킹할 양 (wei)
    function encodeStakingDeposit(uint64 wei_) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.STAKING_DEPOSIT),
            abi.encode(wei_)
        );
    }

    /// @notice Staking Deposit 전송
    function sendStakingDeposit(uint64 wei_) external {
        CORE_WRITER.sendRawAction(encodeStakingDeposit(wei_));
    }

    // ============================================
    // Action 5: Staking Withdraw
    // ============================================

    /// @notice Staking Withdraw action 인코딩
    /// @param wei_ 출금할 양 (wei)
    function encodeStakingWithdraw(uint64 wei_) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.STAKING_WITHDRAW),
            abi.encode(wei_)
        );
    }

    /// @notice Staking Withdraw 전송
    function sendStakingWithdraw(uint64 wei_) external {
        CORE_WRITER.sendRawAction(encodeStakingWithdraw(wei_));
    }

    // ============================================
    // Action 6: Spot Send
    // ============================================

    /// @notice Spot Send action 인코딩
    /// @param destination 수신자 주소
    /// @param token 토큰 인덱스
    /// @param wei_ 전송할 양
    function encodeSpotSend(
        address destination,
        uint64 token,
        uint64 wei_
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.SPOT_SEND),
            abi.encode(destination, token, wei_)
        );
    }

    /// @notice Spot Send 전송
    function sendSpotSend(address destination, uint64 token, uint64 wei_) external {
        CORE_WRITER.sendRawAction(encodeSpotSend(destination, token, wei_));
    }

    // ============================================
    // Action 7: USD Class Transfer
    // ============================================

    /// @notice USD Class Transfer action 인코딩
    /// @param ntl 전송할 USD 금액 (raw value)
    /// @param toPerp true면 Spot→Perp, false면 Perp→Spot
    function encodeUsdClassTransfer(uint64 ntl, bool toPerp) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.USD_CLASS_TRANSFER),
            abi.encode(ntl, toPerp)
        );
    }

    /// @notice USD Class Transfer 전송
    function sendUsdClassTransfer(uint64 ntl, bool toPerp) external {
        CORE_WRITER.sendRawAction(encodeUsdClassTransfer(ntl, toPerp));
    }

    // ============================================
    // Action 8: Finalize EVM Contract
    // ============================================

    /// @notice Finalize EVM Contract action 인코딩
    /// @param token 토큰 인덱스
    /// @param variant 변형 타입 (1=Create, 2=FirstStorageSlot, 3=CustomStorageSlot)
    /// @param createNonce 생성 nonce
    function encodeFinalizeEvmContract(
        uint64 token,
        uint8 variant,
        uint64 createNonce
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.FINALIZE_EVM_CONTRACT),
            abi.encode(token, variant, createNonce)
        );
    }

    /// @notice Finalize EVM Contract 전송
    function sendFinalizeEvmContract(uint64 token, uint8 variant, uint64 createNonce) external {
        CORE_WRITER.sendRawAction(encodeFinalizeEvmContract(token, variant, createNonce));
    }

    // ============================================
    // Action 9: Add API Wallet
    // ============================================

    /// @notice Add API Wallet action 인코딩
    /// @param wallet API 지갑 주소
    /// @param name 지갑 이름
    function encodeAddApiWallet(address wallet, string calldata name) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.ADD_API_WALLET),
            abi.encode(wallet, name)
        );
    }

    /// @notice Add API Wallet 전송
    function sendAddApiWallet(address wallet, string calldata name) external {
        CORE_WRITER.sendRawAction(encodeAddApiWallet(wallet, name));
    }

    // ============================================
    // Action 10: Cancel Order by OID
    // ============================================

    /// @notice Cancel Order by OID action 인코딩
    /// @param asset 자산 인덱스
    /// @param oid 주문 ID
    function encodeCancelOrderByOid(uint32 asset, uint64 oid) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.CANCEL_ORDER_BY_OID),
            abi.encode(asset, oid)
        );
    }

    /// @notice Cancel Order by OID 전송
    function sendCancelOrderByOid(uint32 asset, uint64 oid) external {
        CORE_WRITER.sendRawAction(encodeCancelOrderByOid(asset, oid));
    }

    // ============================================
    // Action 11: Cancel Order by CLOID
    // ============================================

    /// @notice Cancel Order by CLOID action 인코딩
    /// @param asset 자산 인덱스
    /// @param cloid 클라이언트 주문 ID
    function encodeCancelOrderByCloid(uint32 asset, uint128 cloid) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.CANCEL_ORDER_BY_CLOID),
            abi.encode(asset, cloid)
        );
    }

    /// @notice Cancel Order by CLOID 전송
    function sendCancelOrderByCloid(uint32 asset, uint128 cloid) external {
        CORE_WRITER.sendRawAction(encodeCancelOrderByCloid(asset, cloid));
    }

    // ============================================
    // Action 12: Approve Builder Fee
    // ============================================

    /// @notice Approve Builder Fee action 인코딩
    /// @param maxFeeRate 최대 수수료율
    /// @param builder 빌더 주소
    function encodeApproveBuilderFee(uint64 maxFeeRate, address builder) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.APPROVE_BUILDER_FEE),
            abi.encode(maxFeeRate, builder)
        );
    }

    /// @notice Approve Builder Fee 전송
    function sendApproveBuilderFee(uint64 maxFeeRate, address builder) external {
        CORE_WRITER.sendRawAction(encodeApproveBuilderFee(maxFeeRate, builder));
    }

    // ============================================
    // Action 13: Send Asset
    // ============================================

    /// @notice Send Asset action 인코딩
    /// @param dest 목적지 주소
    /// @param subAccount 서브 계정 주소
    /// @param srcDex 소스 DEX 인덱스
    /// @param destDex 목적지 DEX 인덱스
    /// @param token 토큰 인덱스
    /// @param wei_ 전송할 양
    function encodeSendAsset(
        address dest,
        address subAccount,
        uint32 srcDex,
        uint32 destDex,
        uint64 token,
        uint64 wei_
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.SEND_ASSET),
            abi.encode(dest, subAccount, srcDex, destDex, token, wei_)
        );
    }

    /// @notice Send Asset 전송
    function sendSendAsset(
        address dest,
        address subAccount,
        uint32 srcDex,
        uint32 destDex,
        uint64 token,
        uint64 wei_
    ) external {
        CORE_WRITER.sendRawAction(encodeSendAsset(dest, subAccount, srcDex, destDex, token, wei_));
    }

    // ============================================
    // Action 14: Reflect EVM Supply
    // ============================================

    /// @notice Reflect EVM Supply action 인코딩
    /// @param token 토큰 인덱스
    /// @param wei_ 양
    /// @param isMint 민트 여부 (false면 번)
    function encodeReflectEvmSupply(
        uint64 token,
        uint64 wei_,
        bool isMint
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.REFLECT_EVM_SUPPLY),
            abi.encode(token, wei_, isMint)
        );
    }

    /// @notice Reflect EVM Supply 전송
    function sendReflectEvmSupply(uint64 token, uint64 wei_, bool isMint) external {
        CORE_WRITER.sendRawAction(encodeReflectEvmSupply(token, wei_, isMint));
    }

    // ============================================
    // Action 15: Borrow Lend Op (Testnet Only)
    // ============================================

    /// @notice Borrow Lend Op action 인코딩
    /// @param operation 작업 타입 (0=Deposit, 1=Withdraw, 2=Borrow, 3=Repay)
    /// @param token 토큰 인덱스
    /// @param wei_ 양
    function encodeBorrowLendOp(
        uint8 operation,
        uint64 token,
        uint64 wei_
    ) public pure returns (bytes memory) {
        return bytes.concat(
            _encodeHeader(CoreWriterActions.BORROW_LEND_OP),
            abi.encode(operation, token, wei_)
        );
    }

    /// @notice Borrow Lend Op 전송
    function sendBorrowLendOp(uint8 operation, uint64 token, uint64 wei_) external {
        CORE_WRITER.sendRawAction(encodeBorrowLendOp(operation, token, wei_));
    }

    // ============================================
    // Batch Operations
    // ============================================

    /// @notice 여러 raw action을 배치로 전송
    /// @param actions 인코딩된 action 데이터 배열
    function sendBatchActions(bytes[] calldata actions) external {
        for (uint256 i = 0; i < actions.length; i++) {
            CORE_WRITER.sendRawAction(actions[i]);
        }
    }
}

/**
 * 사용 예제:
 *
 * // 1. USD Class Transfer (가장 안전한 테스트)
 * helper.sendUsdClassTransfer(1000000, true); // 1 USD를 Perp로 이동
 *
 * // 2. Limit Order
 * helper.sendLimitOrder(
 *     0,              // BTC
 *     true,           // 매수
 *     1050000000,     // 지정가 $105,000 (raw)
 *     1000000,        // 수량 0.001 BTC (szDecimals=5)
 *     false,          // reduceOnly
 *     0,              // GTC
 *     0               // cloid 없음
 * );
 *
 * // 3. Staking
 * helper.sendStakingDeposit(1000000000000000000); // 1 토큰
 * helper.sendStakingWithdraw(1000000000000000000);
 *
 * // 4. Token Delegate
 * helper.sendTokenDelegate(validatorAddress, amount, false); // delegate
 * helper.sendTokenDelegate(validatorAddress, amount, true);  // undelegate
 *
 * // 5. Vault Transfer
 * helper.sendVaultTransfer(vaultAddress, true, 1000000); // 1 USD 입금
 */
