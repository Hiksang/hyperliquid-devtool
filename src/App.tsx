import { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, ArrowRightLeft, Activity, MessageSquare } from 'lucide-react';
import { useWallet } from './hooks/useWallet';
import { useBalances } from './hooks/useBalances';
import { Header } from './components/Header';
import { BalanceCards } from './components/BalanceCards';
import { PrecompilePanel } from './components/PrecompilePanel';
import { CoreWriterPanel } from './components/CoreWriterPanel';
import { TransactionLog } from './components/TransactionLog';
import { QuickActions } from './components/QuickActions';
import { IndexReference } from './components/IndexReference';
import type { TxLog } from './types';

type Tab = 'precompile' | 'corewriter' | 'logs';

function App() {
  const wallet = useWallet();
  const { balances, loading, fetchBalances } = useBalances(wallet.address);
  const [activeTab, setActiveTab] = useState<Tab>('precompile');
  const [txLogs, setTxLogs] = useState<TxLog[]>([]);

  // Fetch balances on connect
  useEffect(() => {
    if (wallet.isConnected) {
      fetchBalances();
    }
  }, [wallet.isConnected, fetchBalances]);

  // Add or update log
  const handleLog = useCallback(
    (log: Omit<TxLog, 'id' | 'timestamp' | 'type'> & { type?: TxLog['type'] }) => {
      const newLog: TxLog = {
        ...log,
        type: log.type || 'CoreWriter',
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
      };

      setTxLogs((prev) => {
        // If this is an update (same action with hash), update existing
        const existingIndex = prev.findIndex(
          (l) => l.action === log.action && log.hash && l.hash === log.hash
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...log };
          return updated;
        }
        return [newLog, ...prev];
      });
    },
    []
  );

  const clearLogs = useCallback(() => setTxLogs([]), []);

  // Static tabs array - memoized to prevent recreation on each render
  const tabs = useMemo(() => [
    { id: 'precompile' as Tab, icon: Database, label: 'Precompile' },
    { id: 'corewriter' as Tab, icon: ArrowRightLeft, label: 'CoreWriter' },
    { id: 'logs' as Tab, icon: Activity, label: 'Logs' },
  ], []);

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-100">
      <Header
        address={wallet.address}
        chainId={wallet.chainId}
        isCorrectChain={wallet.isCorrectChain}
        onConnect={wallet.connect}
      />

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Balance Cards */}
        {wallet.isConnected && (
          <BalanceCards
            balances={balances}
            loading={loading}
            onRefresh={fetchBalances}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'logs' && txLogs.length > 0 && (
                <span className="bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                  {txLogs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel */}
          <div className="space-y-6">
            {activeTab === 'precompile' && (
              <PrecompilePanel
                address={wallet.address}
                onLog={(log) => handleLog({ ...log, type: 'Precompile' })}
              />
            )}

            {activeTab === 'corewriter' && (
              <CoreWriterPanel
                signer={wallet.signer}
                onLog={handleLog}
              />
            )}

            {activeTab === 'logs' && (
              <TransactionLog logs={txLogs} onClear={clearLogs} />
            )}
          </div>

          {/* Right Panel - Context Sensitive */}
          {activeTab === 'precompile' ? (
            <IndexReference />
          ) : (
            <QuickActions
              signer={wallet.signer}
              onLog={handleLog}
              onBalanceRefresh={fetchBalances}
            />
          )}
        </div>
      </main>

      {/* Feedback Section */}
      <footer className="max-w-7xl mx-auto px-6 py-8 mt-8 border-t border-gray-800">
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-blue-800/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">We'd love your feedback!</h3>
              <p className="text-gray-400 text-sm mb-4">
                Help us improve HyperLiquid DevTools. Let us know about any bugs, missing features,
                or suggestions you have. Your feedback is valuable!
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-4">
                <span className="bg-gray-800 px-2 py-1 rounded">Bug reports</span>
                <span className="bg-gray-800 px-2 py-1 rounded">Feature requests</span>
                <span className="bg-gray-800 px-2 py-1 rounded">UX improvements</span>
                <span className="bg-gray-800 px-2 py-1 rounded">Documentation</span>
              </div>
              <a
                href="mailto:hypurrquant.hik@gmail.com?subject=HyperLiquid DevTools Feedback&body=Hi,%0A%0AI'd like to share some feedback about HyperLiquid DevTools:%0A%0A"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
              >
                <MessageSquare className="w-4 h-4" />
                Send Feedback
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
