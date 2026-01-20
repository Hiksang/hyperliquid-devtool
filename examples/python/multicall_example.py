"""
HyperCore Read Precompile Multicall 배치 호출 예제 (Python)

web3.py와 Multicall3를 사용한 배치 호출 예제

Requirements:
    pip install web3
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from web3 import Web3
from eth_abi import encode, decode

# RPC 설정
RPC_URL = "https://rpc.hyperliquid.xyz/evm"
# RPC_URL = "http://hiksang01.iptime.org:3001/evm"  # 커스텀 RPC

# Multicall3 주소 (HyperEVM Mainnet)
MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11"

# Precompile 주소
PRECOMPILES = {
    "position": "0x0000000000000000000000000000000000000800",
    "spotBalance": "0x0000000000000000000000000000000000000801",
    "markPx": "0x0000000000000000000000000000000000000806",
    "oraclePx": "0x0000000000000000000000000000000000000807",
    "spotPx": "0x0000000000000000000000000000000000000808",
    "perpAssetInfo": "0x000000000000000000000000000000000000080a",
    "spotInfo": "0x000000000000000000000000000000000000080b",
    "tokenInfo": "0x000000000000000000000000000000000000080c",
    "tokenSupply": "0x000000000000000000000000000000000000080d",
}

# Multicall3 ABI (aggregate3 함수)
MULTICALL3_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"name": "target", "type": "address"},
                    {"name": "allowFailure", "type": "bool"},
                    {"name": "callData", "type": "bytes"},
                ],
                "name": "calls",
                "type": "tuple[]",
            }
        ],
        "name": "aggregate3",
        "outputs": [
            {
                "components": [
                    {"name": "success", "type": "bool"},
                    {"name": "returnData", "type": "bytes"},
                ],
                "name": "returnData",
                "type": "tuple[]",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    }
]


@dataclass
class Position:
    """포지션 데이터"""
    perp_index: int
    szi: int  # signed
    entry_ntl: int
    isolated_raw_usd: int
    leverage: int
    is_isolated: bool

    @property
    def is_long(self) -> bool:
        return self.szi > 0

    @property
    def is_short(self) -> bool:
        return self.szi < 0


@dataclass
class SpotBalance:
    """스팟 잔액 데이터"""
    token_index: int
    total: int
    hold: int
    entry_ntl: int


@dataclass
class PerpAssetInfo:
    """Perp 자산 정보"""
    index: int
    coin: str
    margin_table_id: int
    sz_decimals: int
    max_leverage: int
    only_isolated: bool


def chunk_list(lst: List, chunk_size: int) -> List[List]:
    """리스트를 청크로 분할"""
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


class HyperCoreMulticall:
    """
    Multicall3를 사용한 HyperCore Read Precompile 배치 호출 클래스
    """

    def __init__(self, rpc_url: str = RPC_URL):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.multicall = self.w3.eth.contract(
            address=Web3.to_checksum_address(MULTICALL3_ADDRESS),
            abi=MULTICALL3_ABI
        )

    def _encode_call(self, target: str, calldata: bytes) -> Tuple[str, bool, bytes]:
        """Multicall3 호출 데이터 생성"""
        return (Web3.to_checksum_address(target), True, calldata)

    def batch_get_mark_prices(self, perp_indices: List[int]) -> Dict[int, int]:
        """
        여러 perp의 마크 가격을 배치로 조회

        Args:
            perp_indices: perp 인덱스 리스트

        Returns:
            {perp_index: mark_price} 딕셔너리
        """
        calls = [
            self._encode_call(
                PRECOMPILES["markPx"],
                encode(["uint32"], [idx])
            )
            for idx in perp_indices
        ]

        results = self.multicall.functions.aggregate3(calls).call()
        prices = {}

        for i, (success, return_data) in enumerate(results):
            if success and len(return_data) > 0:
                price = decode(["uint64"], return_data)[0]
                prices[perp_indices[i]] = price

        return prices

    def get_all_mark_prices(self) -> Dict[int, int]:
        """
        전체 perp 마크 가격 조회 (최적 배치 크기: 200)

        Returns:
            {perp_index: mark_price} 딕셔너리
        """
        total_perps = 225
        batch_size = 200
        all_indices = list(range(total_perps))
        chunks = chunk_list(all_indices, batch_size)

        all_prices = {}
        for chunk in chunks:
            prices = self.batch_get_mark_prices(chunk)
            all_prices.update(prices)

        return all_prices

    def batch_get_positions(self, user: str, perp_indices: List[int]) -> List[Position]:
        """
        사용자의 여러 perp 포지션을 배치로 조회

        Args:
            user: 사용자 주소
            perp_indices: perp 인덱스 리스트

        Returns:
            Position 리스트
        """
        user_addr = Web3.to_checksum_address(user)
        calls = [
            self._encode_call(
                PRECOMPILES["position"],
                encode(["address", "uint16"], [user_addr, idx])
            )
            for idx in perp_indices
        ]

        results = self.multicall.functions.aggregate3(calls).call()
        positions = []

        for i, (success, return_data) in enumerate(results):
            if success and len(return_data) >= 32:
                try:
                    szi, entry_ntl, isolated_raw_usd, leverage, is_isolated = decode(
                        ["int64", "uint64", "int64", "uint32", "bool"],
                        return_data
                    )
                    positions.append(Position(
                        perp_index=perp_indices[i],
                        szi=szi,
                        entry_ntl=entry_ntl,
                        isolated_raw_usd=isolated_raw_usd,
                        leverage=leverage,
                        is_isolated=is_isolated
                    ))
                except Exception:
                    pass

        return positions

    def get_all_positions(self, user: str) -> List[Position]:
        """
        사용자의 전체 포지션 조회 (225개 perp)

        Args:
            user: 사용자 주소

        Returns:
            Position 리스트
        """
        total_perps = 225
        batch_size = 200
        all_indices = list(range(total_perps))
        chunks = chunk_list(all_indices, batch_size)

        all_positions = []
        for chunk in chunks:
            positions = self.batch_get_positions(user, chunk)
            all_positions.extend(positions)

        return all_positions

    def get_non_zero_positions(self, user: str) -> List[Position]:
        """
        Non-zero 포지션만 필터링하여 반환

        Args:
            user: 사용자 주소

        Returns:
            Non-zero Position 리스트
        """
        all_positions = self.get_all_positions(user)
        return [p for p in all_positions if p.szi != 0]

    def batch_get_spot_balances(self, user: str, token_indices: List[int]) -> List[SpotBalance]:
        """
        사용자의 여러 토큰 잔액을 배치로 조회

        Args:
            user: 사용자 주소
            token_indices: 토큰 인덱스 리스트

        Returns:
            SpotBalance 리스트
        """
        user_addr = Web3.to_checksum_address(user)
        calls = [
            self._encode_call(
                PRECOMPILES["spotBalance"],
                encode(["address", "uint64"], [user_addr, idx])
            )
            for idx in token_indices
        ]

        results = self.multicall.functions.aggregate3(calls).call()
        balances = []

        for i, (success, return_data) in enumerate(results):
            if success and len(return_data) >= 24:
                try:
                    total, hold, entry_ntl = decode(
                        ["uint64", "uint64", "uint64"],
                        return_data
                    )
                    balances.append(SpotBalance(
                        token_index=token_indices[i],
                        total=total,
                        hold=hold,
                        entry_ntl=entry_ntl
                    ))
                except Exception:
                    pass

        return balances

    def get_all_spot_balances(self, user: str) -> List[SpotBalance]:
        """
        사용자의 전체 토큰 잔액 조회 (425개 토큰)

        Args:
            user: 사용자 주소

        Returns:
            SpotBalance 리스트
        """
        total_tokens = 425
        batch_size = 300
        all_indices = list(range(total_tokens))
        chunks = chunk_list(all_indices, batch_size)

        all_balances = []
        for chunk in chunks:
            balances = self.batch_get_spot_balances(user, chunk)
            all_balances.extend(balances)

        return all_balances

    def get_non_zero_balances(self, user: str) -> List[SpotBalance]:
        """
        Non-zero 잔액만 필터링하여 반환

        Args:
            user: 사용자 주소

        Returns:
            Non-zero SpotBalance 리스트
        """
        all_balances = self.get_all_spot_balances(user)
        return [b for b in all_balances if b.total != 0]

    def batch_get_perp_asset_info(self, perp_indices: List[int]) -> List[PerpAssetInfo]:
        """
        perpAssetInfo 배치 조회

        Args:
            perp_indices: perp 인덱스 리스트

        Returns:
            PerpAssetInfo 리스트
        """
        calls = [
            self._encode_call(
                PRECOMPILES["perpAssetInfo"],
                encode(["uint32"], [idx])
            )
            for idx in perp_indices
        ]

        results = self.multicall.functions.aggregate3(calls).call()
        infos = []

        for i, (success, return_data) in enumerate(results):
            if success and len(return_data) > 0:
                info = self._parse_perp_asset_info(return_data.hex(), perp_indices[i])
                if info:
                    infos.append(info)

        return infos

    def _parse_perp_asset_info(self, hex_data: str, index: int) -> Optional[PerpAssetInfo]:
        """perpAssetInfo raw 데이터 파싱"""
        try:
            if not hex_data.startswith("0x"):
                hex_data = "0x" + hex_data

            def read_uint(word_index: int) -> int:
                start = 2 + word_index * 64
                slice_data = hex_data[start:start + 64]
                return int(slice_data, 16)

            tuple_offset = read_uint(0) // 32
            string_offset = read_uint(tuple_offset)
            margin_table_id = read_uint(tuple_offset + 1)
            sz_decimals = read_uint(tuple_offset + 2)
            max_leverage = read_uint(tuple_offset + 3)
            only_isolated = read_uint(tuple_offset + 4) != 0

            # 문자열 파싱
            string_start = tuple_offset + string_offset // 32
            string_length = read_uint(string_start)
            string_data_start = 2 + (string_start + 1) * 64
            string_hex = hex_data[string_data_start:string_data_start + string_length * 2]

            coin = ""
            for j in range(0, len(string_hex), 2):
                char_code = int(string_hex[j:j + 2], 16)
                if char_code > 0:
                    coin += chr(char_code)

            return PerpAssetInfo(
                index=index,
                coin=coin,
                margin_table_id=margin_table_id,
                sz_decimals=sz_decimals,
                max_leverage=max_leverage,
                only_isolated=only_isolated
            )
        except Exception:
            return None


def main():
    """사용 예제"""
    import time

    multicall = HyperCoreMulticall()
    test_user = "0x33578377Dd2D850Db9a4FEf38f5a9190bb94E823"

    print("=" * 60)
    print("HyperCore Multicall 배치 호출 예제 (Python)")
    print("=" * 60)

    # 1. 특정 perp 가격 배치 조회
    print("\n1. 특정 perp 마크 가격 조회 (BTC, ETH, SOL)")
    selected_prices = multicall.batch_get_mark_prices([0, 1, 5])
    for idx, price in selected_prices.items():
        print(f"   Index {idx}: {price}")

    # 2. 전체 가격 조회
    print("\n2. 전체 perp 마크 가격 조회 (225개)")
    start_time = time.time()
    all_prices = multicall.get_all_mark_prices()
    elapsed = (time.time() - start_time) * 1000
    print(f"   조회 완료: {len(all_prices)}개, {elapsed:.0f}ms")

    # 3. 사용자 포지션 조회
    print(f"\n3. 사용자 Non-zero 포지션 조회")
    positions = multicall.get_non_zero_positions(test_user)
    print(f"   Non-zero 포지션: {len(positions)}개")
    for p in positions:
        direction = "Long" if p.is_long else "Short"
        print(f"   - Perp {p.perp_index}: szi={p.szi} ({direction}), leverage={p.leverage}x")

    # 4. 사용자 잔액 조회
    print(f"\n4. 사용자 Non-zero 잔액 조회")
    balances = multicall.get_non_zero_balances(test_user)
    print(f"   Non-zero 잔액: {len(balances)}개")
    for b in balances:
        print(f"   - Token {b.token_index}: total={b.total}")

    # 5. perpAssetInfo 배치 조회
    print("\n5. perpAssetInfo 배치 조회 (0-9)")
    perp_infos = multicall.batch_get_perp_asset_info(list(range(10)))
    for info in perp_infos:
        print(f"   {info.index}: {info.coin} (szDec={info.sz_decimals}, maxLev={info.max_leverage}x)")


if __name__ == "__main__":
    main()
