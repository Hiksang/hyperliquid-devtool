/**
 * HyperCore Read Precompile Multicall 배치 호출 예제 (viem)
 *
 * viem과 Multicall3를 사용한 배치 호출 예제
 *
 * Requirements:
 *   npm install viem
 */

import {
  createPublicClient,
  http,
  getContract,
  type Address,
  type Hex,
  encodeAbiParameters,
  decodeAbiParameters,
} from 'viem';

// HyperEVM Chain 정의
const hyperEvmMainnet = {
  id: 998,
  name: 'HyperEVM Mainnet',
  network: 'hyperevm',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: { http: ['https://rpc.hyperliquid.xyz/evm'] },
    public: { http: ['https://rpc.hyperliquid.xyz/evm'] },
  },
} as const;

// Multicall3 주소 (HyperEVM Mainnet)
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as Address;

// Precompile 주소
const PRECOMPILES = {
  position: '0x0000000000000000000000000000000000000800' as Address,
  spotBalance: '0x0000000000000000000000000000000000000801' as Address,
  markPx: '0x0000000000000000000000000000000000000806' as Address,
  oraclePx: '0x0000000000000000000000000000000000000807' as Address,
  spotPx: '0x0000000000000000000000000000000000000808' as Address,
  perpAssetInfo: '0x000000000000000000000000000000000000080a' as Address,
  spotInfo: '0x000000000000000000000000000000000000080b' as Address,
  tokenInfo: '0x000000000000000000000000000000000000080c' as Address,
  tokenSupply: '0x000000000000000000000000000000000000080d' as Address,
} as const;

// Multicall3 ABI
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
] as const;

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

interface Call3 {
  target: Address;
  allowFailure: boolean;
  callData: Hex;
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
 * viem을 사용한 HyperCore Multicall 클래스
 */
export class HyperCoreMulticallViem {
  private client;
  private multicall;

  constructor(rpcUrl: string = 'https://rpc.hyperliquid.xyz/evm') {
    this.client = createPublicClient({
      chain: hyperEvmMainnet,
      transport: http(rpcUrl),
    });

    this.multicall = getContract({
      address: MULTICALL3_ADDRESS,
      abi: MULTICALL3_ABI,
      client: this.client,
    });
  }

  /**
   * 여러 perp의 마크 가격을 배치로 조회
   */
  async batchGetMarkPrices(perpIndices: number[]): Promise<Map<number, bigint>> {
    const calls: Call3[] = perpIndices.map((index) => ({
      target: PRECOMPILES.markPx,
      allowFailure: true,
      callData: encodeAbiParameters([{ type: 'uint32' }], [index]) as Hex,
    }));

    const results = await this.multicall.read.aggregate3([calls]);
    const prices = new Map<number, bigint>();

    (results as Array<{ success: boolean; returnData: Hex }>).forEach((result, i) => {
      if (result.success && result.returnData !== '0x') {
        try {
          const [price] = decodeAbiParameters([{ type: 'uint64' }], result.returnData);
          prices.set(perpIndices[i], price);
        } catch {}
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
   */
  async batchGetPositions(user: Address, perpIndices: number[]): Promise<Position[]> {
    const calls: Call3[] = perpIndices.map((index) => ({
      target: PRECOMPILES.position,
      allowFailure: true,
      callData: encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint16' }],
        [user, index]
      ) as Hex,
    }));

    const results = await this.multicall.read.aggregate3([calls]);
    const positions: Position[] = [];

    (results as Array<{ success: boolean; returnData: Hex }>).forEach((result, i) => {
      if (result.success && result.returnData !== '0x' && result.returnData.length > 2) {
        try {
          const [szi, entryNtl, isolatedRawUsd, leverage, isIsolated] = decodeAbiParameters(
            [
              { type: 'int64' },
              { type: 'uint64' },
              { type: 'int64' },
              { type: 'uint32' },
              { type: 'bool' },
            ],
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
        } catch {}
      }
    });

    return positions;
  }

  /**
   * 사용자의 전체 포지션 조회 (225개 perp)
   */
  async getAllPositions(user: Address): Promise<Position[]> {
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
   */
  async getNonZeroPositions(user: Address): Promise<Position[]> {
    const allPositions = await this.getAllPositions(user);
    return allPositions.filter((p) => p.szi !== 0n);
  }

  /**
   * 사용자의 여러 토큰 잔액을 배치로 조회
   */
  async batchGetSpotBalances(user: Address, tokenIndices: number[]): Promise<SpotBalance[]> {
    const calls: Call3[] = tokenIndices.map((index) => ({
      target: PRECOMPILES.spotBalance,
      allowFailure: true,
      callData: encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint64' }],
        [user, BigInt(index)]
      ) as Hex,
    }));

    const results = await this.multicall.read.aggregate3([calls]);
    const balances: SpotBalance[] = [];

    (results as Array<{ success: boolean; returnData: Hex }>).forEach((result, i) => {
      if (result.success && result.returnData !== '0x' && result.returnData.length > 2) {
        try {
          const [total, hold, entryNtl] = decodeAbiParameters(
            [{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint64' }],
            result.returnData
          );

          balances.push({
            tokenIndex: tokenIndices[i],
            total,
            hold,
            entryNtl,
          });
        } catch {}
      }
    });

    return balances;
  }

  /**
   * 사용자의 전체 토큰 잔액 조회 (425개 토큰)
   */
  async getAllSpotBalances(user: Address): Promise<SpotBalance[]> {
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
   */
  async getNonZeroBalances(user: Address): Promise<SpotBalance[]> {
    const allBalances = await this.getAllSpotBalances(user);
    return allBalances.filter((b) => b.total !== 0n);
  }
}

// 사용 예제
async function main() {
  const multicall = new HyperCoreMulticallViem();
  const testUser = '0x33578377Dd2D850Db9a4FEf38f5a9190bb94E823' as Address;

  console.log('='.repeat(60));
  console.log('HyperCore Multicall 배치 호출 예제 (viem)');
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
    const direction = p.szi > 0n ? 'Long' : 'Short';
    console.log(`   - Perp ${p.perpIndex}: szi=${p.szi} (${direction}), leverage=${p.leverage}x`);
  });

  // 4. 사용자 잔액 조회
  console.log(`\n4. 사용자 Non-zero 잔액 조회`);
  const balances = await multicall.getNonZeroBalances(testUser);
  console.log(`   Non-zero 잔액: ${balances.length}개`);
  balances.forEach((b) => {
    console.log(`   - Token ${b.tokenIndex}: total=${b.total}`);
  });
}

main().catch(console.error);

export { PRECOMPILES, MULTICALL3_ADDRESS, hyperEvmMainnet };
