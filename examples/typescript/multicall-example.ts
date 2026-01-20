/**
 * HyperCore Read Precompile Multicall 배치 호출 예제 (TypeScript)
 *
 * ethers.js v6와 Multicall3를 사용한 배치 호출 예제
 */

import { ethers, AbiCoder, Contract, JsonRpcProvider } from 'ethers';

// RPC 설정
const RPC_URL = 'https://rpc.hyperliquid.xyz/evm';
// const RPC_URL = 'http://hiksang01.iptime.org:3001/evm'; // 커스텀 RPC

// Multicall3 주소 (HyperEVM Mainnet)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Precompile 주소
const PRECOMPILES = {
  position: '0x0000000000000000000000000000000000000800',
  spotBalance: '0x0000000000000000000000000000000000000801',
  markPx: '0x0000000000000000000000000000000000000806',
  oraclePx: '0x0000000000000000000000000000000000000807',
  spotPx: '0x0000000000000000000000000000000000000808',
  perpAssetInfo: '0x000000000000000000000000000000000000080a',
  spotInfo: '0x000000000000000000000000000000000000080b',
  tokenInfo: '0x000000000000000000000000000000000000080c',
  tokenSupply: '0x000000000000000000000000000000000000080d',
} as const;

// Multicall3 ABI (aggregate3 함수)
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// 타입 정의
interface Position {
  perpIndex: number;
  szi: bigint;
  entryNtl: bigint;
  isolatedRawUsd: bigint;
  leverage: number;
  isIsolated: boolean;
}

interface SpotBalance {
  tokenIndex: number;
  total: bigint;
  hold: bigint;
  entryNtl: bigint;
}

interface PerpAssetInfo {
  index: number;
  coin: string;
  marginTableId: number;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

interface Call3 {
  target: string;
  allowFailure: boolean;
  callData: string;
}

interface Result {
  success: boolean;
  returnData: string;
}

// Helper: 배열을 청크로 분할
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Multicall3를 사용한 배치 호출 클래스
 */
export class HyperCoreMulticall {
  private provider: JsonRpcProvider;
  private multicall: Contract;
  private abiCoder: AbiCoder;

  constructor(rpcUrl: string = RPC_URL) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.multicall = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, this.provider);
    this.abiCoder = new AbiCoder();
  }

  /**
   * 여러 perp의 마크 가격을 배치로 조회
   * @param perpIndices perp 인덱스 배열
   * @returns 마크 가격 배열 (raw value, szDecimals 적용 필요)
   */
  async batchGetMarkPrices(perpIndices: number[]): Promise<Map<number, bigint>> {
    const calls: Call3[] = perpIndices.map((index) => ({
      target: PRECOMPILES.markPx,
      allowFailure: true,
      callData: this.abiCoder.encode(['uint32'], [index]),
    }));

    const results: Result[] = await this.multicall.aggregate3.staticCall(calls);
    const prices = new Map<number, bigint>();

    results.forEach((result, i) => {
      if (result.success && result.returnData !== '0x') {
        const price = this.abiCoder.decode(['uint64'], result.returnData)[0];
        prices.set(perpIndices[i], price);
      }
    });

    return prices;
  }

  /**
   * 전체 perp 마크 가격 조회 (최적 배치 크기: 200)
   */
  async getAllMarkPrices(): Promise<Map<number, bigint>> {
    const totalPerps = 225;
    const batchSize = 200;
    const allIndices = Array.from({ length: totalPerps }, (_, i) => i);
    const chunks = chunkArray(allIndices, batchSize);

    const allPrices = new Map<number, bigint>();

    for (const chunk of chunks) {
      const prices = await this.batchGetMarkPrices(chunk);
      prices.forEach((value, key) => allPrices.set(key, value));
    }

    return allPrices;
  }

  /**
   * 사용자의 여러 perp 포지션을 배치로 조회
   * @param user 사용자 주소
   * @param perpIndices perp 인덱스 배열
   */
  async batchGetPositions(user: string, perpIndices: number[]): Promise<Position[]> {
    const calls: Call3[] = perpIndices.map((index) => ({
      target: PRECOMPILES.position,
      allowFailure: true,
      callData: this.abiCoder.encode(['address', 'uint16'], [user, index]),
    }));

    const results: Result[] = await this.multicall.aggregate3.staticCall(calls);
    const positions: Position[] = [];

    results.forEach((result, i) => {
      if (result.success && result.returnData !== '0x' && result.returnData.length > 2) {
        const [szi, entryNtl, isolatedRawUsd, leverage, isIsolated] = this.abiCoder.decode(
          ['int64', 'uint64', 'int64', 'uint32', 'bool'],
          result.returnData
        );

        positions.push({
          perpIndex: perpIndices[i],
          szi,
          entryNtl,
          isolatedRawUsd,
          leverage: Number(leverage),
          isIsolated,
        });
      }
    });

    return positions;
  }

  /**
   * 사용자의 전체 포지션 조회 (225개 perp)
   * @param user 사용자 주소
   */
  async getAllPositions(user: string): Promise<Position[]> {
    const totalPerps = 225;
    const batchSize = 200;
    const allIndices = Array.from({ length: totalPerps }, (_, i) => i);
    const chunks = chunkArray(allIndices, batchSize);

    const allPositions: Position[] = [];

    for (const chunk of chunks) {
      const positions = await this.batchGetPositions(user, chunk);
      allPositions.push(...positions);
    }

    return allPositions;
  }

  /**
   * Non-zero 포지션만 필터링하여 반환
   * @param user 사용자 주소
   */
  async getNonZeroPositions(user: string): Promise<Position[]> {
    const allPositions = await this.getAllPositions(user);
    return allPositions.filter((p) => p.szi !== 0n);
  }

  /**
   * 사용자의 여러 토큰 잔액을 배치로 조회
   * @param user 사용자 주소
   * @param tokenIndices 토큰 인덱스 배열
   */
  async batchGetSpotBalances(user: string, tokenIndices: number[]): Promise<SpotBalance[]> {
    const calls: Call3[] = tokenIndices.map((index) => ({
      target: PRECOMPILES.spotBalance,
      allowFailure: true,
      callData: this.abiCoder.encode(['address', 'uint64'], [user, index]),
    }));

    const results: Result[] = await this.multicall.aggregate3.staticCall(calls);
    const balances: SpotBalance[] = [];

    results.forEach((result, i) => {
      if (result.success && result.returnData !== '0x' && result.returnData.length > 2) {
        const [total, hold, entryNtl] = this.abiCoder.decode(
          ['uint64', 'uint64', 'uint64'],
          result.returnData
        );

        balances.push({
          tokenIndex: tokenIndices[i],
          total,
          hold,
          entryNtl,
        });
      }
    });

    return balances;
  }

  /**
   * 사용자의 전체 토큰 잔액 조회 (425개 토큰)
   * @param user 사용자 주소
   */
  async getAllSpotBalances(user: string): Promise<SpotBalance[]> {
    const totalTokens = 425;
    const batchSize = 300;
    const allIndices = Array.from({ length: totalTokens }, (_, i) => i);
    const chunks = chunkArray(allIndices, batchSize);

    const allBalances: SpotBalance[] = [];

    for (const chunk of chunks) {
      const balances = await this.batchGetSpotBalances(user, chunk);
      allBalances.push(...balances);
    }

    return allBalances;
  }

  /**
   * Non-zero 잔액만 필터링하여 반환
   * @param user 사용자 주소
   */
  async getNonZeroBalances(user: string): Promise<SpotBalance[]> {
    const allBalances = await this.getAllSpotBalances(user);
    return allBalances.filter((b) => b.total !== 0n);
  }

  /**
   * perpAssetInfo 배치 조회
   * @param perpIndices perp 인덱스 배열
   */
  async batchGetPerpAssetInfo(perpIndices: number[]): Promise<PerpAssetInfo[]> {
    const calls: Call3[] = perpIndices.map((index) => ({
      target: PRECOMPILES.perpAssetInfo,
      allowFailure: true,
      callData: this.abiCoder.encode(['uint32'], [index]),
    }));

    const results: Result[] = await this.multicall.aggregate3.staticCall(calls);
    const infos: PerpAssetInfo[] = [];

    results.forEach((result, i) => {
      if (result.success && result.returnData !== '0x' && result.returnData.length > 2) {
        // perpAssetInfo는 수동 파싱 필요 (string 포함)
        const info = this.parsePerpAssetInfo(result.returnData, perpIndices[i]);
        if (info) infos.push(info);
      }
    });

    return infos;
  }

  /**
   * perpAssetInfo raw 데이터 파싱
   */
  private parsePerpAssetInfo(hex: string, index: number): PerpAssetInfo | null {
    try {
      const readUint = (wordIndex: number): bigint => {
        const start = 2 + wordIndex * 64;
        const slice = hex.slice(start, start + 64);
        return BigInt('0x' + slice);
      };

      const tupleOffset = Number(readUint(0)) / 32;
      const stringOffset = Number(readUint(tupleOffset));
      const marginTableId = Number(readUint(tupleOffset + 1));
      const szDecimals = Number(readUint(tupleOffset + 2));
      const maxLeverage = Number(readUint(tupleOffset + 3));
      const onlyIsolated = readUint(tupleOffset + 4) !== 0n;

      // 문자열 파싱
      const stringStart = tupleOffset + stringOffset / 32;
      const stringLength = Number(readUint(stringStart));
      const stringDataStart = 2 + (Number(stringStart) + 1) * 64;
      const stringHex = hex.slice(stringDataStart, stringDataStart + stringLength * 2);

      let coin = '';
      for (let j = 0; j < stringHex.length; j += 2) {
        const charCode = parseInt(stringHex.slice(j, j + 2), 16);
        if (charCode > 0) coin += String.fromCharCode(charCode);
      }

      return { index, coin, marginTableId, szDecimals, maxLeverage, onlyIsolated };
    } catch {
      return null;
    }
  }
}

// 사용 예제
async function main() {
  const multicall = new HyperCoreMulticall();
  const testUser = '0x33578377Dd2D850Db9a4FEf38f5a9190bb94E823';

  console.log('='.repeat(60));
  console.log('HyperCore Multicall 배치 호출 예제');
  console.log('='.repeat(60));

  // 1. 특정 perp 가격 배치 조회
  console.log('\n1. 특정 perp 마크 가격 조회 (BTC, ETH, SOL)');
  const selectedPrices = await multicall.batchGetMarkPrices([0, 1, 5]);
  selectedPrices.forEach((price, index) => {
    console.log(`   Index ${index}: ${price}`);
  });

  // 2. 전체 가격 조회
  console.log('\n2. 전체 perp 마크 가격 조회 (225개)');
  const startTime = Date.now();
  const allPrices = await multicall.getAllMarkPrices();
  console.log(`   조회 완료: ${allPrices.size}개, ${Date.now() - startTime}ms`);

  // 3. 사용자 포지션 조회
  console.log(`\n3. 사용자 Non-zero 포지션 조회`);
  const positions = await multicall.getNonZeroPositions(testUser);
  console.log(`   Non-zero 포지션: ${positions.length}개`);
  positions.forEach((p) => {
    console.log(`   - Perp ${p.perpIndex}: szi=${p.szi}, leverage=${p.leverage}x`);
  });

  // 4. 사용자 잔액 조회
  console.log(`\n4. 사용자 Non-zero 잔액 조회`);
  const balances = await multicall.getNonZeroBalances(testUser);
  console.log(`   Non-zero 잔액: ${balances.length}개`);
  balances.forEach((b) => {
    console.log(`   - Token ${b.tokenIndex}: total=${b.total}`);
  });

  // 5. perpAssetInfo 배치 조회
  console.log('\n5. perpAssetInfo 배치 조회 (0-9)');
  const perpInfos = await multicall.batchGetPerpAssetInfo([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  perpInfos.forEach((info) => {
    console.log(`   ${info.index}: ${info.coin} (szDec=${info.szDecimals}, maxLev=${info.maxLeverage}x)`);
  });
}

main().catch(console.error);

// Export for use as module
export { PRECOMPILES, MULTICALL3_ADDRESS };
