# HyperLiquid DevTools Dashboard - 작업 기록

**날짜**: 2025-01-19
**작업자**: Claude Code Assistant

---

## 개요

HyperLiquid DevTools Dashboard의 Precompile 및 CoreWriter 기능을 완성하고, 기술 문서를 작성했습니다.

---

## 1. 누락된 Precompile 4개 추가

### 추가된 Precompile

| Address | Name | Description | Input Types |
|---------|------|-------------|-------------|
| `0x80D` | Token Supply | 토큰 공급량 정보 | `(uint32 tokenIndex)` |
| `0x80F` | Account Margin Summary | 사용자 마진 요약 | `(uint32 dexIndex, address user)` |
| `0x811` | Borrow Lend User State | Portfolio Margin 사용자 상태 | `(address user, uint64 tokenIndex)` |
| `0x812` | Borrow Lend Reserve State | Portfolio Margin 리저브 상태 | `(uint64 tokenIndex)` |

### 수정된 파일
- `src/lib/constants.ts` - Precompile 정의 추가
- `src/components/PrecompilePanel.tsx` - 테스트 로직 추가

---

## 2. Precompile 입력 타입 수정

기존 코드의 잘못된 파라미터 순서 및 타입을 수정했습니다.

### 수정 내역

| Precompile | 이전 (잘못됨) | 수정 (올바름) |
|------------|--------------|---------------|
| position | `(uint32, address)` | `(address, uint16)` |
| spotBalance | `(uint64, address)` | `(address, uint64)` |
| spotPx | `uint64` (token) | `uint32` (pair index) |
| spotInfo | `uint64` (token) | `uint32` (pair index) |
| bbo | `uint64` (spot token) | `uint32` (perp index) |

### 중요 참고사항
- `spotPx`, `spotInfo` → **Spot Pair Index** 사용 (Token Index 아님)
- `bbo` → **Perp Asset Index** 사용 (Spot 아님)

---

## 3. CoreWriter Buffer 에러 수정

### 문제
브라우저 환경에서 `Buffer is not defined` 에러 발생

### 원인
Node.js의 `Buffer` 객체가 브라우저에서 사용 불가

### 해결
`src/lib/corewriter.ts`에서 `Buffer.from()` → 커스텀 `toHex()` 함수로 교체

```typescript
// 이전 (에러 발생)
return '0x' + Buffer.from(header).toString('hex');

// 수정 (브라우저 호환)
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
return '0x' + toHex(header);
```

### 테스트 결과
- Action 7 (USD Class Transfer): ✅ 성공
- Tx: `0x8cc7c5d906bf63225d5e0fce8d2f4e9338539e3bb944826fbba40654b747b0fa`

---

## 4. UI/UX 개선사항

### Precompile Panel
- API에서 자산 메타데이터 자동 로드 (perps, spotTokens, spotPairs)
- 실제 인덱스와 심볼 표시 (예: `#150 HYPE`)
- Calldata 입력/출력 표시 기능
- Test All 버튼으로 전체 테스트

### 입력 필드
- Target Address 입력 (지갑 미연결 시에도 조회 가능)
- Perp Asset 선택 (API에서 로드)
- Spot Token 선택 (실제 인덱스 사용)
- Spot Pair 선택 (Pair Index)
- Vault Address 입력

---

## 5. Portfolio Margin 정보 추가

### 현재 상태: Pre-Alpha

### 지원 자산

| Type | Token | Index |
|------|-------|-------|
| Borrowable | USDC | 0 |
| Borrowable | USDH | 360 |
| Collateral | HYPE | 150 |
| Collateral | UBTC | 197 |

### 주요 파라미터
- LTV (HYPE): 0.5 (50%)
- Liquidation Threshold: 0.95
- Pre-Alpha Caps: borrow_cap(USDC) = 1000, supply_cap(HYPE) = 200

### 참고 문서
- https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-margin

---

## 6. 생성된 문서

### Tech Spec 문서
- 경로: `docs/tech-spec-hyperevm-precompiles.md`
- 내용:
  - 전체 19개 Precompile 주소 및 설명
  - Input/Output 타입 상세
  - Calldata 인코딩 예제 (ethers.js, viem, Solidity)
  - Asset Index 참조표
  - Decimal 참조표
  - Portfolio Margin 상세

---

## 7. 폴더 구조 정리

### 삭제됨
- `hyperliquid/dashboard` - 중복 대시보드 제거

### 유지
- `hyperliquid-devtools` - 메인 대시보드

---

## 8. 테스트 결과 요약

### Precompile 테스트
| Precompile | 상태 |
|------------|------|
| position | ✅ |
| spotBalance | ✅ |
| withdrawable | ✅ |
| markPx | ✅ |
| oraclePx | ✅ |
| spotPx | ✅ |
| l1BlockNumber | ✅ |
| perpAssetInfo | ✅ |
| spotPairInfo | ✅ |
| tokenInfo | ✅ |
| tokenSupply | ✅ |
| bbo | ✅ |
| accountMarginSummary | ✅ |
| coreUserExists | ✅ |
| borrowLendUserState | ✅ (USDC만) |
| borrowLendReserveState | ✅ (USDC만) |

### CoreWriter 테스트
| Action | 상태 |
|--------|------|
| Action 4 (Staking Deposit) | ✅ 트랜잭션 성공 |
| Action 7 (USD Class Transfer) | ✅ 트랜잭션 성공 |

---

## 9. HYPE Decimals 수정

### 문제
Staking Deposit/Withdraw 트랜잭션은 성공하지만 실제로 HYPE가 이동하지 않음

### 원인
HYPE를 18 decimals로 잘못 설정 (EVM 네이티브 토큰 기준)

### 해결
HyperCore의 HYPE는 **8 decimals** 사용 (API spotMeta 확인)

```typescript
// 이전 (잘못됨)
return { decimals: 18, unit: 'HYPE', hint: '1 HYPE = 1e18 raw' };

// 수정 (올바름)
return { decimals: 8, unit: 'HYPE', hint: '1 HYPE = 1e8 raw' };
```

### 영향받는 액션
- Action 3 (Token Delegate)
- Action 4 (Staking Deposit)
- Action 5 (Staking Withdraw)

### 참고
```bash
curl -X POST "https://api.hyperliquid.xyz/info" \
  -H "Content-Type: application/json" \
  -d '{"type": "spotMeta"}' | jq '.tokens[] | select(.name == "HYPE")'

# 결과: "weiDecimals": 8
```

---

## 10. CoreWriter 기능 개선

### API Wallet 생성기 (Action 9)
- **Generate New Wallet** 버튼 추가
- `ethers.Wallet.createRandom()` 사용
- Private Key Show/Hide 토글
- 주소 및 Private Key 복사 버튼
- 경고 메시지 표시

### 액션 문서화
Quick Actions 섹션을 액션별 문서로 교체:
- **Description**: 액션 설명
- **Calldata Structure**: 헤더 + ABI 인코딩 구조
- **Parameters**: 파라미터별 타입, 설명, 인덱스 정보
- **Notes**: 주의사항

### 예시 (Action 7)
```
Description: Transfer USD between spot and perp balance
Calldata: Header(01 00 00 07) + abi.encode(ntl, toPerp)
Parameters:
  ntl      uint64   USD amount × 1e6 (6 decimals)
  toPerp   bool     true=Spot→Perp, false=Perp→Spot
```

---

## 11. 실행 방법

```bash
cd hyperliquid-devtools
npm install
npm run dev
# http://localhost:5173 접속
```

---

## 12. 향후 작업 제안

1. **CoreWriter 추가 테스트**: Staking, Vault Transfer 등
2. **에러 핸들링 개선**: 사용자 친화적 에러 메시지
3. **결과 내보내기**: CSV/JSON 다운로드 기능
4. **다크/라이트 모드**: 테마 전환
5. **즐겨찾기**: 자주 사용하는 주소/자산 저장

---

## 참고 자료

- [HyperLiquid Docs](https://hyperliquid.gitbook.io/hyperliquid-docs)
- [Portfolio Margin](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-margin)
- [API Info Endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- [HyperEVM Explorer](https://explorer.hyperliquid.xyz)
