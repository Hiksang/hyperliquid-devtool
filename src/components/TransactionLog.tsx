import { ExternalLink } from 'lucide-react';
import type { TxLog } from '../types';

interface TransactionLogProps {
  logs: TxLog[];
  onClear: () => void;
}

export function TransactionLog({ logs, onClear }: TransactionLogProps) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold">Transaction Logs</h2>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-white"
        >
          Clear
        </button>
      </div>
      <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No transactions yet
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`p-3 rounded-lg border ${
                log.status === 'pending'
                  ? 'border-yellow-500/50 bg-yellow-500/10'
                  : log.status === 'success'
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-red-500/50 bg-red-500/10'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{log.action}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    log.status === 'pending'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : log.status === 'success'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {log.status}
                </span>
              </div>
              {log.hash && (
                <a
                  href={`https://explorer.hyperliquid.xyz/tx/${log.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  {log.hash.slice(0, 10)}...{log.hash.slice(-8)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {log.details && (
                <div className="text-xs text-gray-400 mt-1">{log.details}</div>
              )}
              <div className="text-xs text-gray-600 mt-1">
                {log.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
