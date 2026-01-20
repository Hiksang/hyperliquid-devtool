// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MulticallReader
 * @notice HyperCore Read Precompile Multicall 배치 호출 예제
 * @dev Multicall3를 사용하여 여러 precompile 호출을 단일 트랜잭션으로 실행
 */

// Multicall3 인터페이스
interface IMulticall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external view returns (Result[] memory returnData);
}

// L1Read Precompile 주소
library L1ReadAddresses {
    address constant POSITION = 0x0000000000000000000000000000000000000800;
    address constant SPOT_BALANCE = 0x0000000000000000000000000000000000000801;
    address constant MARK_PX = 0x0000000000000000000000000000000000000806;
    address constant ORACLE_PX = 0x0000000000000000000000000000000000000807;
    address constant SPOT_PX = 0x0000000000000000000000000000000000000808;
    address constant PERP_ASSET_INFO = 0x000000000000000000000000000000000000080a;
    address constant SPOT_INFO = 0x000000000000000000000000000000000000080b;
    address constant TOKEN_INFO = 0x000000000000000000000000000000000000080C;
    address constant TOKEN_SUPPLY = 0x000000000000000000000000000000000000080D;
}

// 반환 데이터 구조체
struct Position {
    int64 szi;
    uint64 entryNtl;
    int64 isolatedRawUsd;
    uint32 leverage;
    bool isIsolated;
}

struct SpotBalance {
    uint64 total;
    uint64 hold;
    uint64 entryNtl;
}

struct PerpAssetInfo {
    string coin;
    uint32 marginTableId;
    uint8 szDecimals;
    uint32 maxLeverage;
    bool onlyIsolated;
}

contract MulticallReader {
    // Multicall3 주소 (HyperEVM Mainnet)
    IMulticall3 constant MULTICALL3 = IMulticall3(0xcA11bde05977b3631167028862bE2a173976CA11);

    /**
     * @notice 여러 perp의 마크 가격을 배치로 조회
     * @param perpIndices 조회할 perp 인덱스 배열
     * @return prices 마크 가격 배열 (raw value)
     */
    function batchGetMarkPrices(uint32[] calldata perpIndices)
        external view returns (uint64[] memory prices)
    {
        IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](perpIndices.length);

        for (uint256 i = 0; i < perpIndices.length; i++) {
            calls[i] = IMulticall3.Call3({
                target: L1ReadAddresses.MARK_PX,
                allowFailure: false,
                callData: abi.encode(perpIndices[i])
            });
        }

        IMulticall3.Result[] memory results = MULTICALL3.aggregate3(calls);
        prices = new uint64[](perpIndices.length);

        for (uint256 i = 0; i < results.length; i++) {
            prices[i] = abi.decode(results[i].returnData, (uint64));
        }
    }

    /**
     * @notice 여러 perp의 오라클 가격을 배치로 조회
     * @param perpIndices 조회할 perp 인덱스 배열
     * @return prices 오라클 가격 배열 (raw value)
     */
    function batchGetOraclePrices(uint32[] calldata perpIndices)
        external view returns (uint64[] memory prices)
    {
        IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](perpIndices.length);

        for (uint256 i = 0; i < perpIndices.length; i++) {
            calls[i] = IMulticall3.Call3({
                target: L1ReadAddresses.ORACLE_PX,
                allowFailure: false,
                callData: abi.encode(perpIndices[i])
            });
        }

        IMulticall3.Result[] memory results = MULTICALL3.aggregate3(calls);
        prices = new uint64[](perpIndices.length);

        for (uint256 i = 0; i < results.length; i++) {
            prices[i] = abi.decode(results[i].returnData, (uint64));
        }
    }

    /**
     * @notice 사용자의 여러 perp 포지션을 배치로 조회
     * @param user 사용자 주소
     * @param perpIndices 조회할 perp 인덱스 배열
     * @return positions 포지션 배열
     */
    function batchGetPositions(address user, uint16[] calldata perpIndices)
        external view returns (Position[] memory positions)
    {
        IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](perpIndices.length);

        for (uint256 i = 0; i < perpIndices.length; i++) {
            calls[i] = IMulticall3.Call3({
                target: L1ReadAddresses.POSITION,
                allowFailure: true,  // 포지션이 없을 수 있음
                callData: abi.encode(user, perpIndices[i])
            });
        }

        IMulticall3.Result[] memory results = MULTICALL3.aggregate3(calls);
        positions = new Position[](perpIndices.length);

        for (uint256 i = 0; i < results.length; i++) {
            if (results[i].success && results[i].returnData.length > 0) {
                (
                    positions[i].szi,
                    positions[i].entryNtl,
                    positions[i].isolatedRawUsd,
                    positions[i].leverage,
                    positions[i].isIsolated
                ) = abi.decode(results[i].returnData, (int64, uint64, int64, uint32, bool));
            }
        }
    }

    /**
     * @notice 사용자의 여러 토큰 잔액을 배치로 조회
     * @param user 사용자 주소
     * @param tokenIndices 조회할 토큰 인덱스 배열
     * @return balances 잔액 배열
     */
    function batchGetSpotBalances(address user, uint64[] calldata tokenIndices)
        external view returns (SpotBalance[] memory balances)
    {
        IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](tokenIndices.length);

        for (uint256 i = 0; i < tokenIndices.length; i++) {
            calls[i] = IMulticall3.Call3({
                target: L1ReadAddresses.SPOT_BALANCE,
                allowFailure: true,
                callData: abi.encode(user, tokenIndices[i])
            });
        }

        IMulticall3.Result[] memory results = MULTICALL3.aggregate3(calls);
        balances = new SpotBalance[](tokenIndices.length);

        for (uint256 i = 0; i < results.length; i++) {
            if (results[i].success && results[i].returnData.length > 0) {
                (
                    balances[i].total,
                    balances[i].hold,
                    balances[i].entryNtl
                ) = abi.decode(results[i].returnData, (uint64, uint64, uint64));
            }
        }
    }

    /**
     * @notice 전체 perp 마크 가격 조회 (최적 배치 크기: 200)
     * @return prices 전체 225개 perp 마크 가격
     */
    function getAllMarkPrices() external view returns (uint64[] memory prices) {
        uint256 totalPerps = 225;
        uint256 batchSize = 200;
        prices = new uint64[](totalPerps);

        for (uint256 start = 0; start < totalPerps; start += batchSize) {
            uint256 end = start + batchSize > totalPerps ? totalPerps : start + batchSize;
            uint256 count = end - start;

            IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](count);

            for (uint256 i = 0; i < count; i++) {
                calls[i] = IMulticall3.Call3({
                    target: L1ReadAddresses.MARK_PX,
                    allowFailure: false,
                    callData: abi.encode(uint32(start + i))
                });
            }

            IMulticall3.Result[] memory results = MULTICALL3.aggregate3(calls);

            for (uint256 i = 0; i < results.length; i++) {
                prices[start + i] = abi.decode(results[i].returnData, (uint64));
            }
        }
    }

    /**
     * @notice 사용자의 전체 포지션 조회 (225개 perp)
     * @param user 사용자 주소
     * @return positions 전체 포지션 (대부분 szi=0)
     */
    function getAllPositions(address user) external view returns (Position[] memory positions) {
        uint256 totalPerps = 225;
        uint256 batchSize = 200;
        positions = new Position[](totalPerps);

        for (uint256 start = 0; start < totalPerps; start += batchSize) {
            uint256 end = start + batchSize > totalPerps ? totalPerps : start + batchSize;
            uint256 count = end - start;

            IMulticall3.Call3[] memory calls = new IMulticall3.Call3[](count);

            for (uint256 i = 0; i < count; i++) {
                calls[i] = IMulticall3.Call3({
                    target: L1ReadAddresses.POSITION,
                    allowFailure: true,
                    callData: abi.encode(user, uint16(start + i))
                });
            }

            IMulticall3.Result[] memory results = MULTICALL3.aggregate3(calls);

            for (uint256 i = 0; i < results.length; i++) {
                if (results[i].success && results[i].returnData.length > 0) {
                    (
                        positions[start + i].szi,
                        positions[start + i].entryNtl,
                        positions[start + i].isolatedRawUsd,
                        positions[start + i].leverage,
                        positions[start + i].isIsolated
                    ) = abi.decode(results[i].returnData, (int64, uint64, int64, uint32, bool));
                }
            }
        }
    }

    /**
     * @notice Non-zero 포지션만 필터링하여 반환
     * @param user 사용자 주소
     * @return perpIndices Non-zero 포지션의 perp 인덱스 배열
     * @return positions Non-zero 포지션 배열
     */
    function getNonZeroPositions(address user)
        external view
        returns (uint16[] memory perpIndices, Position[] memory positions)
    {
        // 먼저 전체 포지션 조회
        Position[] memory allPositions = this.getAllPositions(user);

        // Non-zero 개수 카운트
        uint256 nonZeroCount = 0;
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (allPositions[i].szi != 0) {
                nonZeroCount++;
            }
        }

        // 결과 배열 생성
        perpIndices = new uint16[](nonZeroCount);
        positions = new Position[](nonZeroCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < allPositions.length; i++) {
            if (allPositions[i].szi != 0) {
                perpIndices[idx] = uint16(i);
                positions[idx] = allPositions[i];
                idx++;
            }
        }
    }
}

/**
 * 사용 예제:
 *
 * // 특정 perp 가격 배치 조회
 * uint32[] memory indices = new uint32[](3);
 * indices[0] = 0;  // BTC
 * indices[1] = 1;  // ETH
 * indices[2] = 5;  // SOL
 * uint64[] memory prices = reader.batchGetMarkPrices(indices);
 *
 * // 사용자 포지션 배치 조회
 * uint16[] memory perpIndices = new uint16[](3);
 * perpIndices[0] = 0;   // BTC
 * perpIndices[1] = 1;   // ETH
 * perpIndices[2] = 159; // HYPE
 * Position[] memory positions = reader.batchGetPositions(user, perpIndices);
 *
 * // 전체 가격 조회 (최적화된 배치)
 * uint64[] memory allPrices = reader.getAllMarkPrices();
 *
 * // Non-zero 포지션만 조회
 * (uint16[] memory nonZeroIndices, Position[] memory nonZeroPositions)
 *     = reader.getNonZeroPositions(user);
 */
