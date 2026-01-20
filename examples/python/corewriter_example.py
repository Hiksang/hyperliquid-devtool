"""
HyperCore CoreWriter 예제 (Python)

HyperEVM에서 HyperCore로 트랜잭션을 보내는 예제

CoreWriter 시스템 컨트랙트: 0x3333333333333333333333333333333333333333
Gas 소비: ~47,000 gas (기본 호출)
지연: 주문 및 vault 전송은 몇 초간 지연됨

Requirements:
    pip install web3 eth-abi python-dotenv
"""

from typing import Dict, Optional
from dataclasses import dataclass
from enum import IntEnum
import struct

from web3 import Web3
from eth_abi import encode

# ============================================
# Constants
# ============================================

RPC_URL = "https://rpc.hyperliquid.xyz/evm"
CORE_WRITER_ADDRESS = "0x3333333333333333333333333333333333333333"

CORE_WRITER_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "user", "type": "address"},
            {"indexed": False, "name": "data", "type": "bytes"},
        ],
        "name": "RawAction",
        "type": "event",
    },
    {
        "inputs": [{"name": "data", "type": "bytes"}],
        "name": "sendRawAction",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

# Action IDs
class ActionId(IntEnum):
    LIMIT_ORDER = 1
    VAULT_TRANSFER = 2
    TOKEN_DELEGATE = 3
    STAKING_DEPOSIT = 4
    STAKING_WITHDRAW = 5
    SPOT_SEND = 6
    USD_CLASS_TRANSFER = 7
    FINALIZE_EVM_CONTRACT = 8
    ADD_API_WALLET = 9
    CANCEL_ORDER_BY_OID = 10
    CANCEL_ORDER_BY_CLOID = 11
    APPROVE_BUILDER_FEE = 12
    SEND_ASSET = 13
    REFLECT_EVM_SUPPLY = 14
    BORROW_LEND_OP = 15


class FinalizeVariant(IntEnum):
    CREATE = 1
    FIRST_STORAGE_SLOT = 2
    CUSTOM_STORAGE_SLOT = 3


class BorrowLendOp(IntEnum):
    DEPOSIT = 0
    WITHDRAW = 1
    BORROW = 2
    REPAY = 3


# Action encoding version
VERSION = 0x01


# ============================================
# Data Classes
# ============================================

@dataclass
class LimitOrderParams:
    asset: int  # uint32
    is_buy: bool
    limit_px: int  # uint64 - raw price value
    sz: int  # uint64 - raw size value
    reduce_only: bool
    encoded_tif: int  # uint8 - Time in Force
    cloid: int  # uint128 - client order ID (0 if none)


@dataclass
class VaultTransferParams:
    vault: str  # address
    is_deposit: bool
    usd: int  # uint64 - raw USD amount (6 decimals)


@dataclass
class TokenDelegateParams:
    validator: str  # address
    wei: int  # uint64
    is_undelegate: bool


@dataclass
class StakingParams:
    wei: int  # uint64


@dataclass
class SpotSendParams:
    destination: str  # address
    token: int  # uint64 - token index
    wei: int  # uint64


@dataclass
class UsdClassTransferParams:
    ntl: int  # uint64 - raw USD amount
    to_perp: bool  # True: Spot→Perp, False: Perp→Spot


@dataclass
class FinalizeEvmContractParams:
    token: int  # uint64 - token index
    variant: int  # uint8
    create_nonce: int  # uint64


@dataclass
class AddApiWalletParams:
    wallet: str  # address
    name: str


@dataclass
class CancelOrderByOidParams:
    asset: int  # uint32
    oid: int  # uint64 - order ID


@dataclass
class CancelOrderByCloidParams:
    asset: int  # uint32
    cloid: int  # uint128 - client order ID


@dataclass
class ApproveBuilderFeeParams:
    max_fee_rate: int  # uint64
    builder: str  # address


@dataclass
class SendAssetParams:
    dest: str  # address
    sub_account: str  # address
    src_dex: int  # uint32
    dest_dex: int  # uint32
    token: int  # uint64
    wei: int  # uint64


@dataclass
class ReflectEvmSupplyParams:
    token: int  # uint64
    wei: int  # uint64
    is_mint: bool


@dataclass
class BorrowLendOpParams:
    operation: int  # uint8 - 0=Deposit, 1=Withdraw, 2=Borrow, 3=Repay
    token: int  # uint64
    wei: int  # uint64


@dataclass
class TxResult:
    hash: str
    receipt: Optional[Dict]


# ============================================
# HyperCoreWriter Class
# ============================================

class HyperCoreWriter:
    """
    HyperCore CoreWriter SDK for Python
    """

    def __init__(self, rpc_url: str = RPC_URL):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.core_writer = self.w3.eth.contract(
            address=Web3.to_checksum_address(CORE_WRITER_ADDRESS),
            abi=CORE_WRITER_ABI
        )

    def _encode_header(self, action_id: int) -> bytes:
        """버전 + action ID 헤더 생성 (4 bytes)"""
        header = bytes([
            VERSION,
            (action_id >> 16) & 0xFF,
            (action_id >> 8) & 0xFF,
            action_id & 0xFF
        ])
        return header

    def _concat_bytes(self, header: bytes, data: bytes) -> bytes:
        """헤더 + ABI 인코딩 데이터 결합"""
        return header + data

    # ============================================
    # Action Builders
    # ============================================

    def build_limit_order(self, params: LimitOrderParams) -> bytes:
        """Build Limit Order action data"""
        header = self._encode_header(ActionId.LIMIT_ORDER)
        data = encode(
            ["uint32", "bool", "uint64", "uint64", "bool", "uint8", "uint128"],
            [params.asset, params.is_buy, params.limit_px, params.sz,
             params.reduce_only, params.encoded_tif, params.cloid]
        )
        return self._concat_bytes(header, data)

    def build_vault_transfer(self, params: VaultTransferParams) -> bytes:
        """Build Vault Transfer action data"""
        header = self._encode_header(ActionId.VAULT_TRANSFER)
        vault_addr = Web3.to_checksum_address(params.vault)
        data = encode(
            ["address", "bool", "uint64"],
            [vault_addr, params.is_deposit, params.usd]
        )
        return self._concat_bytes(header, data)

    def build_token_delegate(self, params: TokenDelegateParams) -> bytes:
        """Build Token Delegate action data"""
        header = self._encode_header(ActionId.TOKEN_DELEGATE)
        validator_addr = Web3.to_checksum_address(params.validator)
        data = encode(
            ["address", "uint64", "bool"],
            [validator_addr, params.wei, params.is_undelegate]
        )
        return self._concat_bytes(header, data)

    def build_staking_deposit(self, params: StakingParams) -> bytes:
        """Build Staking Deposit action data"""
        header = self._encode_header(ActionId.STAKING_DEPOSIT)
        data = encode(["uint64"], [params.wei])
        return self._concat_bytes(header, data)

    def build_staking_withdraw(self, params: StakingParams) -> bytes:
        """Build Staking Withdraw action data"""
        header = self._encode_header(ActionId.STAKING_WITHDRAW)
        data = encode(["uint64"], [params.wei])
        return self._concat_bytes(header, data)

    def build_spot_send(self, params: SpotSendParams) -> bytes:
        """
        Build Spot Send action data
        ⚠️ 주의: 다른 주소로 토큰 전송 - 자금 손실 위험
        """
        header = self._encode_header(ActionId.SPOT_SEND)
        dest_addr = Web3.to_checksum_address(params.destination)
        data = encode(
            ["address", "uint64", "uint64"],
            [dest_addr, params.token, params.wei]
        )
        return self._concat_bytes(header, data)

    def build_usd_class_transfer(self, params: UsdClassTransferParams) -> bytes:
        """Build USD Class Transfer action data"""
        header = self._encode_header(ActionId.USD_CLASS_TRANSFER)
        data = encode(["uint64", "bool"], [params.ntl, params.to_perp])
        return self._concat_bytes(header, data)

    def build_finalize_evm_contract(self, params: FinalizeEvmContractParams) -> bytes:
        """Build Finalize EVM Contract action data"""
        header = self._encode_header(ActionId.FINALIZE_EVM_CONTRACT)
        data = encode(
            ["uint64", "uint8", "uint64"],
            [params.token, params.variant, params.create_nonce]
        )
        return self._concat_bytes(header, data)

    def build_add_api_wallet(self, params: AddApiWalletParams) -> bytes:
        """Build Add API Wallet action data"""
        header = self._encode_header(ActionId.ADD_API_WALLET)
        wallet_addr = Web3.to_checksum_address(params.wallet)
        data = encode(["address", "string"], [wallet_addr, params.name])
        return self._concat_bytes(header, data)

    def build_cancel_order_by_oid(self, params: CancelOrderByOidParams) -> bytes:
        """Build Cancel Order by OID action data"""
        header = self._encode_header(ActionId.CANCEL_ORDER_BY_OID)
        data = encode(["uint32", "uint64"], [params.asset, params.oid])
        return self._concat_bytes(header, data)

    def build_cancel_order_by_cloid(self, params: CancelOrderByCloidParams) -> bytes:
        """Build Cancel Order by CLOID action data"""
        header = self._encode_header(ActionId.CANCEL_ORDER_BY_CLOID)
        data = encode(["uint32", "uint128"], [params.asset, params.cloid])
        return self._concat_bytes(header, data)

    def build_approve_builder_fee(self, params: ApproveBuilderFeeParams) -> bytes:
        """Build Approve Builder Fee action data"""
        header = self._encode_header(ActionId.APPROVE_BUILDER_FEE)
        builder_addr = Web3.to_checksum_address(params.builder)
        data = encode(["uint64", "address"], [params.max_fee_rate, builder_addr])
        return self._concat_bytes(header, data)

    def build_send_asset(self, params: SendAssetParams) -> bytes:
        """
        Build Send Asset action data
        ⚠️ 주의: 다른 주소로 자산 전송 - 자금 손실 위험
        """
        header = self._encode_header(ActionId.SEND_ASSET)
        dest_addr = Web3.to_checksum_address(params.dest)
        sub_addr = Web3.to_checksum_address(params.sub_account)
        data = encode(
            ["address", "address", "uint32", "uint32", "uint64", "uint64"],
            [dest_addr, sub_addr, params.src_dex, params.dest_dex, params.token, params.wei]
        )
        return self._concat_bytes(header, data)

    def build_reflect_evm_supply(self, params: ReflectEvmSupplyParams) -> bytes:
        """Build Reflect EVM Supply action data"""
        header = self._encode_header(ActionId.REFLECT_EVM_SUPPLY)
        data = encode(
            ["uint64", "uint64", "bool"],
            [params.token, params.wei, params.is_mint]
        )
        return self._concat_bytes(header, data)

    def build_borrow_lend_op(self, params: BorrowLendOpParams) -> bytes:
        """Build Borrow Lend Op action data (Testnet Only)"""
        header = self._encode_header(ActionId.BORROW_LEND_OP)
        data = encode(
            ["uint8", "uint64", "uint64"],
            [params.operation, params.token, params.wei]
        )
        return self._concat_bytes(header, data)

    # ============================================
    # Transaction Senders
    # ============================================

    def send_raw_action(self, private_key: str, action_data: bytes) -> TxResult:
        """Raw action 전송"""
        account = self.w3.eth.account.from_key(private_key)

        # Build transaction
        tx = self.core_writer.functions.sendRawAction(action_data).build_transaction({
            "from": account.address,
            "nonce": self.w3.eth.get_transaction_count(account.address),
            "gas": 100000,  # ~47,000 + buffer
            "gasPrice": self.w3.eth.gas_price,
        })

        # Sign and send
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)

        # Wait for receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)

        return TxResult(
            hash=tx_hash.hex(),
            receipt=dict(receipt)
        )

    def send_limit_order(self, private_key: str, params: LimitOrderParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_limit_order(params))

    def send_vault_transfer(self, private_key: str, params: VaultTransferParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_vault_transfer(params))

    def send_token_delegate(self, private_key: str, params: TokenDelegateParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_token_delegate(params))

    def send_staking_deposit(self, private_key: str, params: StakingParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_staking_deposit(params))

    def send_staking_withdraw(self, private_key: str, params: StakingParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_staking_withdraw(params))

    def send_spot_send(self, private_key: str, params: SpotSendParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_spot_send(params))

    def send_usd_class_transfer(self, private_key: str, params: UsdClassTransferParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_usd_class_transfer(params))

    def send_finalize_evm_contract(self, private_key: str, params: FinalizeEvmContractParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_finalize_evm_contract(params))

    def send_add_api_wallet(self, private_key: str, params: AddApiWalletParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_add_api_wallet(params))

    def send_cancel_order_by_oid(self, private_key: str, params: CancelOrderByOidParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_cancel_order_by_oid(params))

    def send_cancel_order_by_cloid(self, private_key: str, params: CancelOrderByCloidParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_cancel_order_by_cloid(params))

    def send_approve_builder_fee(self, private_key: str, params: ApproveBuilderFeeParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_approve_builder_fee(params))

    def send_send_asset(self, private_key: str, params: SendAssetParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_send_asset(params))

    def send_reflect_evm_supply(self, private_key: str, params: ReflectEvmSupplyParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_reflect_evm_supply(params))

    def send_borrow_lend_op(self, private_key: str, params: BorrowLendOpParams) -> TxResult:
        return self.send_raw_action(private_key, self.build_borrow_lend_op(params))

    # ============================================
    # Utility Functions
    # ============================================

    def decode_action(self, data: bytes) -> dict:
        """Decode action data (for debugging)"""
        if isinstance(data, str):
            data = bytes.fromhex(data.replace("0x", ""))

        version = data[0]
        action_id = (data[1] << 16) | (data[2] << 8) | data[3]
        params = data[4:]

        return {
            "version": version,
            "action_id": action_id,
            "params": "0x" + params.hex()
        }


# ============================================
# Utility Functions
# ============================================

def usd_to_raw(usd: float) -> int:
    """USD를 raw value로 변환 (6 decimals)"""
    return int(usd * 1e6)


def raw_to_usd(raw: int) -> float:
    """Raw value를 USD로 변환"""
    return raw / 1e6


def price_to_raw(price: float) -> int:
    """Price를 raw value로 변환 (8 decimals)"""
    return int(price * 1e8)


def size_to_raw(size: float, sz_decimals: int) -> int:
    """Size를 raw value로 변환"""
    return int(size * (10 ** sz_decimals))


# ============================================
# Example
# ============================================

def main():
    """사용 예제"""
    core_writer = HyperCoreWriter()

    print("=" * 60)
    print("HyperCore CoreWriter 예제 (Python)")
    print("=" * 60)

    # 1. USD Class Transfer 인코딩 예제
    print("\n1. USD Class Transfer 인코딩 예제")
    usd_transfer_data = core_writer.build_usd_class_transfer(
        UsdClassTransferParams(
            ntl=usd_to_raw(1.0),  # 1 USD
            to_perp=True  # Spot → Perp
        )
    )
    print(f"   Encoded data: 0x{usd_transfer_data.hex()}")
    print(f"   Decoded: {core_writer.decode_action(usd_transfer_data)}")

    # 2. Limit Order 인코딩 예제
    print("\n2. Limit Order 인코딩 예제")
    limit_order_data = core_writer.build_limit_order(
        LimitOrderParams(
            asset=0,  # BTC
            is_buy=True,
            limit_px=price_to_raw(105000),  # $105,000
            sz=size_to_raw(0.001, 5),  # 0.001 BTC (szDecimals=5)
            reduce_only=False,
            encoded_tif=0,  # GTC
            cloid=0
        )
    )
    print(f"   Encoded data: 0x{limit_order_data.hex()}")
    print(f"   Decoded: {core_writer.decode_action(limit_order_data)}")

    # 3. Staking Deposit 인코딩 예제
    print("\n3. Staking Deposit 인코딩 예제")
    staking_data = core_writer.build_staking_deposit(
        StakingParams(wei=10**18)  # 1 token
    )
    print(f"   Encoded data: 0x{staking_data.hex()}")
    print(f"   Decoded: {core_writer.decode_action(staking_data)}")

    # 4. Vault Transfer 인코딩 예제
    print("\n4. Vault Transfer 인코딩 예제")
    vault_data = core_writer.build_vault_transfer(
        VaultTransferParams(
            vault="0x1234567890123456789012345678901234567890",
            is_deposit=True,
            usd=usd_to_raw(100)  # 100 USD
        )
    )
    print(f"   Encoded data: 0x{vault_data.hex()}")

    # 5. Token Delegate 인코딩 예제
    print("\n5. Token Delegate 인코딩 예제")
    delegate_data = core_writer.build_token_delegate(
        TokenDelegateParams(
            validator="0x1234567890123456789012345678901234567890",
            wei=10**18,
            is_undelegate=False
        )
    )
    print(f"   Encoded data: 0x{delegate_data.hex()}")

    print("\n" + "=" * 60)
    print("실제 트랜잭션 전송 예제:")
    print("=" * 60)
    print("""
    # .env 파일에서 PK 로드
    from dotenv import load_dotenv
    import os

    load_dotenv()
    private_key = os.getenv("PRIVATE_KEY")

    # USD Class Transfer 전송 (가장 안전한 테스트)
    result = core_writer.send_usd_class_transfer(
        private_key,
        UsdClassTransferParams(ntl=usd_to_raw(1.0), to_perp=True)
    )
    print(f"TX Hash: {result.hash}")
    """)


if __name__ == "__main__":
    main()
