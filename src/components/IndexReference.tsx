import { useState, useMemo } from 'react';
import { Search, RefreshCw, TrendingUp, Coins, ArrowLeftRight } from 'lucide-react';
import { useAssetMeta } from '../hooks/useAssetMeta';

type TabType = 'perp' | 'spot-token' | 'spot-pair';

export function IndexReference() {
  const { perps, spotTokens, spotPairs, loading, error, refresh } = useAssetMeta();
  const [activeTab, setActiveTab] = useState<TabType>('perp');
  const [search, setSearch] = useState('');

  // Filter perps by search
  const filteredPerps = useMemo(() => {
    if (!search) return perps;
    const lower = search.toLowerCase();
    return perps.filter((p, idx) =>
      p.name.toLowerCase().includes(lower) || idx.toString().includes(lower)
    );
  }, [perps, search]);

  // Filter spot tokens by search
  const filteredSpotTokens = useMemo(() => {
    if (!search) return spotTokens;
    const lower = search.toLowerCase();
    return spotTokens.filter((t) =>
      t.name.toLowerCase().includes(lower) ||
      t.index.toString().includes(lower) ||
      (t.fullName && t.fullName.toLowerCase().includes(lower))
    );
  }, [spotTokens, search]);

  // Filter spot pairs by search
  const filteredSpotPairs = useMemo(() => {
    if (!search) return spotPairs;
    const lower = search.toLowerCase();
    return spotPairs.filter((p) =>
      p.name.toLowerCase().includes(lower) ||
      p.index.toString().includes(lower) ||
      `@${p.index}`.includes(lower)
    );
  }, [spotPairs, search]);

  const tabs = [
    { id: 'perp' as TabType, icon: TrendingUp, label: 'Perp', count: perps.length },
    { id: 'spot-token' as TabType, icon: Coins, label: 'Tokens', count: spotTokens.length },
    { id: 'spot-pair' as TabType, icon: ArrowLeftRight, label: 'Pairs', count: spotPairs.length },
  ];

  // Get token name by index
  const getTokenName = (index: number) => {
    const token = spotTokens.find((t) => t.index === index);
    return token?.name || `Token#${index}`;
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Index Reference</h2>
          <p className="text-xs text-gray-500 mt-1">
            Asset indices for precompile queries
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or index..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm transition ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500 bg-gray-800/50'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            <span className="text-xs text-gray-500">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {error && (
          <div className="p-4 text-red-400 text-sm">Error: {error}</div>
        )}

        {loading && (
          <div className="p-4 text-gray-500 text-sm text-center">Loading...</div>
        )}

        {!loading && !error && (
          <>
            {/* Perp Assets */}
            {activeTab === 'perp' && (
              <div className="divide-y divide-gray-800">
                {/* Description */}
                <div className="px-4 py-3 bg-blue-950/30 border-b border-blue-900/30">
                  <p className="text-xs text-blue-300">
                    <strong>Perpetual Futures</strong> - Perpetual asset index
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Used in position, markPx, oraclePx precompiles. Encoded as uint16/uint32.
                  </p>
                </div>
                <div className="px-4 py-2 bg-gray-800/30 text-xs text-gray-500 font-medium grid grid-cols-12 gap-2">
                  <div className="col-span-2">Index</div>
                  <div className="col-span-5">Symbol</div>
                  <div className="col-span-3">Max Lev</div>
                  <div className="col-span-2">Decimals</div>
                </div>
                {filteredPerps.map((perp, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2.5 grid grid-cols-12 gap-2 hover:bg-gray-800/30 transition text-sm"
                  >
                    <div className="col-span-2 font-mono text-blue-400">{idx}</div>
                    <div className="col-span-5 font-medium">{perp.name}</div>
                    <div className="col-span-3 text-gray-400">{perp.maxLeverage}x</div>
                    <div className="col-span-2 text-gray-500">{perp.szDecimals}</div>
                  </div>
                ))}
                {filteredPerps.length === 0 && (
                  <div className="p-4 text-gray-500 text-sm text-center">No results</div>
                )}
              </div>
            )}

            {/* Spot Tokens */}
            {activeTab === 'spot-token' && (
              <div className="divide-y divide-gray-800">
                {/* Description */}
                <div className="px-4 py-3 bg-green-950/30 border-b border-green-900/30">
                  <p className="text-xs text-green-300">
                    <strong>Spot Tokens</strong> - Spot token index (non-sequential unique ID)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Used in spotBalance precompile. e.g., <code className="bg-gray-800 px-1 rounded">HYPE=150</code>
                  </p>
                  <p className="text-xs text-yellow-500/80 mt-1">
                    ⚠️ Different from Pair Index! Token 150 ≠ Pair @150
                  </p>
                </div>
                <div className="px-4 py-2 bg-gray-800/30 text-xs text-gray-500 font-medium grid grid-cols-12 gap-2">
                  <div className="col-span-2">Index</div>
                  <div className="col-span-4">Symbol</div>
                  <div className="col-span-4">Full Name</div>
                  <div className="col-span-2">Decimals</div>
                </div>
                {filteredSpotTokens.map((token) => (
                  <div
                    key={token.index}
                    className="px-4 py-2.5 grid grid-cols-12 gap-2 hover:bg-gray-800/30 transition text-sm"
                  >
                    <div className="col-span-2 font-mono text-green-400">{token.index}</div>
                    <div className="col-span-4 font-medium">{token.name}</div>
                    <div className="col-span-4 text-gray-400 truncate">
                      {token.fullName || '-'}
                    </div>
                    <div className="col-span-2 text-gray-500">{token.weiDecimals}</div>
                  </div>
                ))}
                {filteredSpotTokens.length === 0 && (
                  <div className="p-4 text-gray-500 text-sm text-center">No results</div>
                )}
              </div>
            )}

            {/* Spot Pairs */}
            {activeTab === 'spot-pair' && (
              <div className="divide-y divide-gray-800">
                {/* Description */}
                <div className="px-4 py-3 bg-yellow-950/30 border-b border-yellow-900/30">
                  <p className="text-xs text-yellow-300">
                    <strong>Spot Trading Pairs</strong> - Spot trading pairs (@ notation, sequential from 0)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Used in spotPx precompile. <code className="bg-gray-800 px-1 rounded">@1</code> = second trading pair.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Tokens</strong> = Token indices that make up this pair (Base/Quote)
                  </p>
                  <p className="text-xs text-yellow-500/80 mt-1">
                    ⚠️ Different from Token Index! Pair @1 ≠ Token 1
                  </p>
                </div>
                <div className="px-4 py-2 bg-gray-800/30 text-xs text-gray-500 font-medium grid grid-cols-12 gap-2">
                  <div className="col-span-2" title="Pair index number">Index</div>
                  <div className="col-span-3" title="@ notation used in HyperLiquid">@ Name</div>
                  <div className="col-span-4" title="Trading pair name">Pair</div>
                  <div className="col-span-3" title="Base token / Quote token indices">Tokens</div>
                </div>
                {filteredSpotPairs.map((pair) => (
                  <div
                    key={pair.index}
                    className="px-4 py-2.5 grid grid-cols-12 gap-2 hover:bg-gray-800/30 transition text-sm"
                  >
                    <div className="col-span-2 font-mono text-yellow-400">{pair.index}</div>
                    <div className="col-span-3 font-mono text-yellow-400">@{pair.index}</div>
                    <div className="col-span-4 font-medium">{pair.name}</div>
                    <div className="col-span-3 text-gray-500 text-xs">
                      {getTokenName(pair.tokens[0])}/{getTokenName(pair.tokens[1])}
                    </div>
                  </div>
                ))}
                {filteredSpotPairs.length === 0 && (
                  <div className="p-4 text-gray-500 text-sm text-center">No results</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-gray-800 text-xs space-y-2">
        <div className="text-gray-400 font-medium">Precompile Input Guide</div>
        <div className="grid grid-cols-2 gap-2 text-gray-500">
          <div>
            <span className="text-blue-400">Perp Index</span>
            <span className="text-gray-600 ml-1">(uint16/32)</span>
          </div>
          <div>→ position, markPx, oraclePx</div>

          <div>
            <span className="text-green-400">Token Index</span>
            <span className="text-gray-600 ml-1">(uint64)</span>
          </div>
          <div>→ spotBalance</div>

          <div>
            <span className="text-yellow-400">Pair Index</span>
            <span className="text-gray-600 ml-1">(uint32)</span>
          </div>
          <div>→ spotPx</div>
        </div>
        <div className="pt-2 border-t border-gray-800 text-yellow-600/70">
          ⚠️ Token Index ≠ Pair Index (different indexing systems)
        </div>
      </div>
    </div>
  );
}
