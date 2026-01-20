import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { PRECOMPILES, RPC_URL } from '../lib/constants';
import { useAssetMeta } from '../hooks/useAssetMeta';

interface PrecompilePanelProps {
  address?: string;
  onLog: (log: { action: string; status: 'pending' | 'success' | 'error'; details?: string }) => void;
}

interface PrecompileResult {
  key: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  result?: string;
  error?: string;
  query?: string;      // What was queried (e.g., "BTC", "HYPE")
  calldata?: string;   // The actual calldata sent (input)
  outputData?: string; // The raw output data from the call
}

const DEFAULT_ADDRESS = '0x4eb7A94dfd3e27B30dA3BB3a2498675aaF7F6fe4';

// Helper to calculate price divisor from szDecimals
// Formula: divisor = 10^(6 - szDecimals)
const getPriceDivisor = (szDecimals: number) => {
  return Math.pow(10, 6 - szDecimals);
};

// Helper to calculate balance divisor from weiDecimals
const getBalanceDivisor = (weiDecimals: number) => {
  return Math.pow(10, weiDecimals);
};

// Helper to calculate spot price divisor from szDecimals
// Formula: divisor = 10^(8 - szDecimals)
const getSpotPriceDivisor = (szDecimals: number) => {
  return Math.pow(10, 8 - szDecimals);
};

// Helper to shorten address
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export function PrecompilePanel({ address: walletAddress, onLog }: PrecompilePanelProps) {
  const [inputAddress, setInputAddress] = useState(walletAddress || DEFAULT_ADDRESS);
  const [perpAsset, setPerpAsset] = useState(0);
  const [spotToken, setSpotToken] = useState(0);
  const [spotPair, setSpotPair] = useState(0);
  const [vaultAddress, setVaultAddress] = useState('0xdfc24b077bc1425ad1dea75bcb6f8158e10df303');
  const [results, setResults] = useState<Record<string, PrecompileResult>>({});

  // Load asset metadata from API
  const { perps, spotTokens, spotPairs, loading: metaLoading } = useAssetMeta();

  const effectiveAddress = walletAddress || inputAddress;

  // Helper functions using dynamic data
  const getPerpAsset = useCallback((index: number) => {
    return perps[index];
  }, [perps]);

  const getPerpSymbol = useCallback((index: number) => {
    return perps[index]?.name || `Perp#${index}`;
  }, [perps]);

  const getSpotToken = useCallback((tokenIndex: number) => {
    return spotTokens.find(t => t.index === tokenIndex);
  }, [spotTokens]);

  const getSpotTokenSymbol = useCallback((tokenIndex: number) => {
    const token = getSpotToken(tokenIndex);
    return token?.name || `Token#${tokenIndex}`;
  }, [getSpotToken]);

  const getSpotPair = useCallback((pairIndex: number) => {
    return spotPairs.find(p => p.index === pairIndex);
  }, [spotPairs]);

  // Get spot pair display name with token names
  const getSpotPairDisplay = useCallback((pairIndex: number) => {
    const pair = getSpotPair(pairIndex);
    if (!pair) return `@${pairIndex}`;
    const baseToken = getSpotToken(pair.tokens[0]);
    const quoteToken = getSpotToken(pair.tokens[1]);
    const baseName = baseToken?.name || `T${pair.tokens[0]}`;
    const quoteName = quoteToken?.name || `T${pair.tokens[1]}`;
    return `@${pairIndex} (${baseName}/${quoteName})`;
  }, [getSpotPair, getSpotToken]);

  // Get szDecimals for spot pair (from base token)
  const getSpotPairSzDecimals = useCallback((pairIndex: number) => {
    const pair = getSpotPair(pairIndex);
    if (!pair) return 0;
    const baseToken = getSpotToken(pair.tokens[0]);
    return baseToken?.szDecimals ?? 0;
  }, [getSpotPair, getSpotToken]);

  const updateResult = useCallback((key: string, update: Partial<PrecompileResult>) => {
    setResults(prev => ({
      ...prev,
      [key]: { ...prev[key], key, ...update }
    }));
  }, []);

  const testPrecompile = useCallback(async (key: string, precompileAddr: string) => {
    updateResult(key, { status: 'loading', result: undefined, error: undefined, query: undefined, calldata: undefined, outputData: undefined });
    onLog({ action: `Read ${key}`, status: 'pending' });

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const abiCoder = new ethers.AbiCoder();

      let data: string;
      let query: string;
      let decodeInfo: { types: string[], format: (decoded: any) => string };

      switch (key) {
        case 'position':
          data = abiCoder.encode(['address', 'uint16'], [effectiveAddress, perpAsset]);
          query = `${shortenAddress(effectiveAddress)} / ${getPerpSymbol(perpAsset)}`;
          decodeInfo = {
            types: ['int64', 'uint64', 'int64', 'uint32', 'bool'],
            format: (d) => `Size: ${Number(d[0]) / 1e8}, Leverage: ${d[3]}x`
          };
          break;
        case 'spotBalance': {
          const tokenInfo = getSpotToken(spotToken);
          const balanceDivisor = tokenInfo ? getBalanceDivisor(tokenInfo.weiDecimals) : 1e8;
          data = abiCoder.encode(['address', 'uint64'], [effectiveAddress, spotToken]);
          query = `${shortenAddress(effectiveAddress)} / ${getSpotTokenSymbol(spotToken)}`;
          decodeInfo = {
            types: ['uint64', 'uint64', 'uint64'],
            // Balance divisor = 10^weiDecimals
            format: (d) => `Total: ${(Number(d[0]) / balanceDivisor).toFixed(6)}, Hold: ${(Number(d[1]) / balanceDivisor).toFixed(6)}`
          };
          break;
        }
        case 'vaultEquity':
          data = abiCoder.encode(['address', 'address'], [effectiveAddress, vaultAddress]);
          query = `${shortenAddress(effectiveAddress)} / Vault ${shortenAddress(vaultAddress)}`;
          decodeInfo = {
            types: ['uint64', 'uint64'],
            format: (d) => `Equity: $${(Number(d[0]) / 1e6).toFixed(2)}`
          };
          break;
        case 'withdrawable':
          data = abiCoder.encode(['address'], [effectiveAddress]);
          query = shortenAddress(effectiveAddress);
          decodeInfo = {
            types: ['uint64'],
            format: (d) => `$${(Number(d[0]) / 1e6).toFixed(6)}`
          };
          break;
        case 'delegations':
          data = abiCoder.encode(['address'], [effectiveAddress]);
          query = shortenAddress(effectiveAddress);
          decodeInfo = {
            types: ['tuple(address,uint64,uint64)[]'],
            format: (d) => d[0].length > 0 ? `${d[0].length} delegation(s)` : 'No delegations'
          };
          break;
        case 'delegatorSummary':
          data = abiCoder.encode(['address'], [effectiveAddress]);
          query = shortenAddress(effectiveAddress);
          decodeInfo = {
            types: ['uint64', 'uint64', 'uint64', 'uint64'],
            format: (d) => `Delegated: ${(Number(d[0]) / 1e18).toFixed(4)} HYPE`
          };
          break;
        case 'markPx': {
          const perpInfo = getPerpAsset(perpAsset);
          const divisor = perpInfo ? getPriceDivisor(perpInfo.szDecimals) : 10000;
          data = abiCoder.encode(['uint32'], [perpAsset]);
          query = `${getPerpSymbol(perpAsset)} (Perp #${perpAsset})`;
          decodeInfo = {
            types: ['uint64'],
            // Price divisor = 10^(6 - szDecimals)
            format: (d) => `$${(Number(d[0]) / divisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
          };
          break;
        }
        case 'oraclePx': {
          const perpInfo = getPerpAsset(perpAsset);
          const divisor = perpInfo ? getPriceDivisor(perpInfo.szDecimals) : 10000;
          data = abiCoder.encode(['uint32'], [perpAsset]);
          query = `${getPerpSymbol(perpAsset)} (Perp #${perpAsset})`;
          decodeInfo = {
            types: ['uint64'],
            // Price divisor = 10^(6 - szDecimals)
            format: (d) => `$${(Number(d[0]) / divisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
          };
          break;
        }
        case 'spotPx': {
          const szDecimals = getSpotPairSzDecimals(spotPair);
          const spotDivisor = getSpotPriceDivisor(szDecimals);
          data = abiCoder.encode(['uint32'], [spotPair]);
          query = getSpotPairDisplay(spotPair);
          decodeInfo = {
            types: ['uint64'],
            // Spot price divisor = 10^(8 - szDecimals)
            format: (d) => `$${(Number(d[0]) / spotDivisor).toFixed(6)}`
          };
          break;
        }
        case 'l1BlockNumber':
          data = '0x';
          query = 'Current L1 Block';
          decodeInfo = {
            types: ['uint64'],
            format: (d) => `Block #${d[0].toString()}`
          };
          break;
        case 'perpAssetInfo':
          data = abiCoder.encode(['uint32'], [perpAsset]);
          query = `${getPerpSymbol(perpAsset)} (Perp #${perpAsset})`;
          decodeInfo = {
            types: ['string', 'uint8', 'uint8', 'bool', 'uint32', 'bool'],
            format: (d) => `${d[0]} | szDec:${d[1]} | maxLev:${d[2]}x`
          };
          break;
        case 'spotPairInfo':
          data = abiCoder.encode(['uint32'], [spotPair]);
          query = `Pair @${spotPair}`;
          decodeInfo = {
            types: ['string', 'uint64', 'uint64'],
            format: (d) => `${d[0]} | base:${d[1]} quote:${d[2]}`
          };
          break;
        case 'tokenInfo':
          data = abiCoder.encode(['uint64'], [spotToken]);
          query = `${getSpotTokenSymbol(spotToken)} (Token #${spotToken})`;
          decodeInfo = {
            // TokenInfo struct (complex - show raw for now)
            types: ['bytes'],
            format: () => `Token #${spotToken} info (see raw)`
          };
          break;
        case 'coreUserExists':
          data = abiCoder.encode(['address'], [effectiveAddress]);
          query = shortenAddress(effectiveAddress);
          decodeInfo = {
            types: ['bool'],
            format: (d) => d[0] ? '✅ User exists' : '❌ User not found'
          };
          break;
        case 'bbo': {
          const perpInfo = getPerpAsset(perpAsset);
          const divisor = perpInfo ? getPriceDivisor(perpInfo.szDecimals) : 10000;
          data = abiCoder.encode(['uint32'], [perpAsset]);
          query = `${getPerpSymbol(perpAsset)} (Perp #${perpAsset})`;
          decodeInfo = {
            types: ['uint64', 'uint64'],
            // BBO returns (bid, ask) with same divisor as markPx
            format: (d) => {
              const bid = (Number(d[0]) / divisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
              const ask = (Number(d[1]) / divisor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
              return `Bid: $${bid} | Ask: $${ask}`;
            }
          };
          break;
        }
        case 'tokenSupply':
          data = abiCoder.encode(['uint32'], [spotToken]);
          query = `${getSpotTokenSymbol(spotToken)} (Token #${spotToken})`;
          decodeInfo = {
            types: ['uint64', 'uint64', 'uint64', 'uint64', 'tuple(address,uint64)[]'],
            format: (d) => `Total: ${(Number(d[1]) / 1e8).toLocaleString()} | Circ: ${(Number(d[2]) / 1e8).toLocaleString()}`
          };
          break;
        case 'accountMarginSummary':
          data = abiCoder.encode(['uint32', 'address'], [0, effectiveAddress]); // DEX 0
          query = `DEX 0 / ${shortenAddress(effectiveAddress)}`;
          decodeInfo = {
            types: ['int64', 'uint64', 'uint64', 'int64'],
            format: (d) => `Value: $${(Number(d[0]) / 1e6).toFixed(2)} | Margin: $${(Number(d[1]) / 1e6).toFixed(2)}`
          };
          break;
        case 'borrowLendUserState':
          data = abiCoder.encode(['address', 'uint64'], [effectiveAddress, spotToken]);
          query = `${shortenAddress(effectiveAddress)} / ${getSpotTokenSymbol(spotToken)}`;
          decodeInfo = {
            types: ['tuple(uint64,uint64)', 'tuple(uint64,uint64)'],
            format: (d) => {
              try {
                const supplyVal = Number(d[1][1]) / 1e6;
                const borrowVal = Number(d[0][1]) / 1e6;
                return `Supply: $${supplyVal.toFixed(2)} | Borrow: $${borrowVal.toFixed(2)}`;
              } catch {
                return 'No Portfolio Margin position';
              }
            }
          };
          break;
        case 'borrowLendReserveState':
          data = abiCoder.encode(['uint64'], [spotToken]);
          query = `${getSpotTokenSymbol(spotToken)} Reserve`;
          decodeInfo = {
            types: ['uint64', 'uint64', 'uint64', 'uint64', 'uint64', 'uint64', 'uint64', 'uint64'],
            format: (d) => {
              const borrowAPR = (Number(d[0]) / 100).toFixed(2);
              const supplyAPY = (Number(d[1]) / 100).toFixed(2);
              const util = (Number(d[3]) / 100).toFixed(1);
              return `Supply: ${supplyAPY}% | Borrow: ${borrowAPR}% | Util: ${util}%`;
            }
          };
          break;
        default:
          throw new Error(`Unknown precompile: ${key}`);
      }

      const result = await provider.call({ to: precompileAddr, data });

      let decoded: string;
      try {
        const decodedResult = abiCoder.decode(decodeInfo.types, result);
        decoded = decodeInfo.format(decodedResult);
      } catch {
        decoded = result.slice(0, 66) + '...';
      }

      updateResult(key, { status: 'success', result: decoded, query, calldata: data, outputData: result });
      onLog({ action: `Read ${key}`, status: 'success', details: decoded });
    } catch (error: unknown) {
      const errorMsg = (error as Error).message;
      updateResult(key, { status: 'error', error: errorMsg.slice(0, 100) });
      onLog({ action: `Read ${key}`, status: 'error', details: errorMsg.slice(0, 100) });
    }
  }, [effectiveAddress, perpAsset, spotToken, spotPair, vaultAddress, onLog, updateResult, getPerpAsset, getPerpSymbol, getSpotToken, getSpotTokenSymbol, getSpotPairDisplay, getSpotPairSzDecimals]);

  const testAll = useCallback(async () => {
    for (const [key, info] of Object.entries(PRECOMPILES)) {
      await testPrecompile(key, info.address);
    }
  }, [testPrecompile]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="font-semibold">L1Read Precompiles</h2>
        <p className="text-xs text-gray-500 mt-1">
          Read HyperCore state from HyperEVM (no wallet required)
        </p>
      </div>

      {/* Input Section */}
      <div className="p-4 border-b border-gray-800 space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target Address</label>
          <input
            type="text"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          {walletAddress && (
            <button
              onClick={() => setInputAddress(walletAddress)}
              className="mt-1 text-xs text-blue-400 hover:text-blue-300"
            >
              Use connected wallet
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Perp Asset ({perps.length})</label>
            <select
              value={perpAsset}
              onChange={(e) => setPerpAsset(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              disabled={metaLoading}
            >
              {metaLoading ? (
                <option>Loading...</option>
              ) : (
                perps.map((asset, index) => (
                  <option key={index} value={index}>
                    {asset.name} ({index})
                  </option>
                ))
              )}
            </select>
            <div className="text-xs text-blue-400/60 mt-1">markPx, oraclePx, bbo, position</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Spot Token ({spotTokens.length})</label>
            <select
              value={spotToken}
              onChange={(e) => setSpotToken(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              disabled={metaLoading}
            >
              {metaLoading ? (
                <option>Loading...</option>
              ) : (
                spotTokens.map((token) => (
                  <option key={token.index} value={token.index}>
                    {token.name} (#{token.index})
                  </option>
                ))
              )}
            </select>
            <div className="text-xs text-green-400/60 mt-1">spotBalance, tokenInfo</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Spot Pair ({spotPairs.length})</label>
            <select
              value={spotPair}
              onChange={(e) => setSpotPair(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              disabled={metaLoading}
            >
              {metaLoading ? (
                <option>Loading...</option>
              ) : (
                spotPairs.map((pair) => {
                  const baseToken = getSpotToken(pair.tokens[0]);
                  const quoteToken = getSpotToken(pair.tokens[1]);
                  const baseName = baseToken?.name || `T${pair.tokens[0]}`;
                  const quoteName = quoteToken?.name || `T${pair.tokens[1]}`;
                  return (
                    <option key={pair.index} value={pair.index}>
                      @{pair.index} ({baseName}/{quoteName})
                    </option>
                  );
                })
              )}
            </select>
            <div className="text-xs text-yellow-400/60 mt-1">spotPx, spotPairInfo</div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Vault Address (for Vault Equity)</label>
          <input
            type="text"
            value={vaultAddress}
            onChange={(e) => setVaultAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={testAll}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition"
        >
          Test All Precompiles
        </button>
      </div>

      {/* Precompile List */}
      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {Object.entries(PRECOMPILES).map(([key, info]) => {
          const result = results[key];
          return (
            <div
              key={key}
              className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{info.name}</div>
                <div className="text-xs text-gray-500 font-mono truncate">{info.address}</div>
                <div className="text-xs text-gray-600 mt-1">{info.description}</div>
                <div className="text-xs text-gray-600">Input: {info.inputTypes.join(', ') || 'none'}</div>
                {result?.status === 'success' && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-gray-400">
                      Query: <span className="text-blue-400">{result.query}</span>
                    </div>
                    <div className="text-sm text-green-400 font-mono">{result.result}</div>
                    <details className="text-xs text-gray-600">
                      <summary className="cursor-pointer hover:text-gray-400">Show calldata</summary>
                      <div className="mt-1 p-2 bg-gray-900 rounded font-mono space-y-1">
                        <div className="break-all">
                          <span className="text-gray-500">input:</span> {result.calldata}
                        </div>
                        <div className="break-all">
                          <span className="text-gray-500">output:</span> {result.outputData}
                        </div>
                      </div>
                    </details>
                  </div>
                )}
                {result?.status === 'error' && (
                  <div className="text-xs text-red-400 mt-1 break-all">{result.error}</div>
                )}
              </div>
              <button
                onClick={() => testPrecompile(key, info.address)}
                disabled={result?.status === 'loading'}
                className={`px-3 py-1.5 rounded-lg text-sm transition ml-3 flex-shrink-0 ${
                  result?.status === 'loading'
                    ? 'bg-gray-700 text-gray-500'
                    : result?.status === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : result?.status === 'error'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {result?.status === 'loading' ? '...' : 'Test'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
