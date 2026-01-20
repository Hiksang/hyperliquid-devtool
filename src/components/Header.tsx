import { Wallet, Activity, Copy, Check, Github } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  address: string;
  chainId: number;
  isCorrectChain: boolean;
  onConnect: () => void;
}

export function Header({ address, chainId, isCorrectChain, onConnect }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="border-b border-gray-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">HyperLiquid DevTools</h1>
            <p className="text-xs text-gray-500">Precompile & CoreWriter Dashboard</p>
          </div>
          <a
            href="https://github.com/Hiksang/hyperliquid-devtool"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-gray-400 hover:text-white transition"
            title="View on GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
        </div>

        {address ? (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">Connected</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <button onClick={copyAddress} className="text-gray-400 hover:text-white">
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-xs ${
                isCorrectChain
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {isCorrectChain ? 'HyperEVM' : `Chain ${chainId}`}
            </div>
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
