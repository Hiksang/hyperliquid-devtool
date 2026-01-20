import { RefreshCw } from 'lucide-react';
import type { Balances } from '../types';

interface BalanceCardsProps {
  balances: Balances;
  loading: boolean;
  onRefresh: () => void;
}

export function BalanceCards({ balances, loading, onRefresh }: BalanceCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Perp Balance</span>
          <button
            onClick={onRefresh}
            className="text-gray-500 hover:text-white"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-2xl font-bold">${balances.perp.toFixed(2)}</div>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="text-gray-400 text-sm mb-2">Spot USDC</div>
        <div className="text-2xl font-bold">
          ${(balances.spot['USDC'] || 0).toFixed(2)}
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="text-gray-400 text-sm mb-2">Spot HYPE</div>
        <div className="text-2xl font-bold">
          {(balances.spot['HYPE'] || 0).toFixed(4)}
        </div>
      </div>
    </div>
  );
}
