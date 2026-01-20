import { ExternalLink } from 'lucide-react';
import { ethers } from 'ethers';
import { sendAction, actions } from '../lib/corewriter';
import { CORE_WRITER } from '../lib/constants';

interface QuickActionsProps {
  signer: ethers.JsonRpcSigner | null;
  onLog: (log: {
    action: string;
    status: 'pending' | 'success' | 'error';
    hash?: string;
    details?: string;
  }) => void;
  onBalanceRefresh: () => void;
}

export function QuickActions({ signer, onLog, onBalanceRefresh }: QuickActionsProps) {
  const handleUsdTransfer = async (toPerp: boolean, amount: number) => {
    if (!signer) {
      alert('Please connect wallet first');
      return;
    }

    const direction = toPerp ? 'Spot → Perp' : 'Perp → Spot';
    onLog({ action: `USD Transfer: ${direction} ($${amount})`, status: 'pending' });

    try {
      const { id, types, values } = actions.usdClassTransfer(
        BigInt(Math.round(amount * 1e6)),
        toPerp
      );
      const tx = await sendAction(signer, id, types, values);
      onLog({
        action: `USD Transfer: ${direction} ($${amount})`,
        status: 'pending',
        hash: tx.hash,
      });

      await tx.wait();
      onLog({
        action: `USD Transfer: ${direction} ($${amount})`,
        status: 'success',
        hash: tx.hash,
      });
      onBalanceRefresh();
    } catch (error: unknown) {
      onLog({
        action: `USD Transfer: ${direction} ($${amount})`,
        status: 'error',
        details: (error as Error).message,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Quick Actions</h2>
        </div>
        <div className="p-4 space-y-4">
          {/* USD Transfer */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h3 className="font-medium mb-3">USD Class Transfer</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUsdTransfer(true, 1)}
                disabled={!signer}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm transition"
              >
                Spot → Perp ($1)
              </button>
              <button
                onClick={() => handleUsdTransfer(false, 1)}
                disabled={!signer}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm transition"
              >
                Perp → Spot ($1)
              </button>
            </div>
          </div>

          {/* Contract Info */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h3 className="font-medium mb-2">Contract Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">CoreWriter</span>
                <span className="font-mono text-xs">{CORE_WRITER.slice(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Chain</span>
                <span>HyperEVM (999)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gas (base)</span>
                <span>~47,000</span>
              </div>
            </div>
          </div>

          {/* Encoding Format */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <h3 className="font-medium mb-2">Action Encoding</h3>
            <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
              <div className="text-green-400">[1 byte: 0x01] version</div>
              <div className="text-blue-400">[3 bytes: action_id] big-endian</div>
              <div className="text-yellow-400">[remaining: params] ABI-encoded</div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation Links */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="font-medium mb-3">Documentation</h3>
        <div className="space-y-2">
          <a
            href="https://hyperliquid.gitbook.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ExternalLink className="w-4 h-4" />
            HyperLiquid Docs
          </a>
          <a
            href="https://explorer.hyperliquid.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <ExternalLink className="w-4 h-4" />
            HyperEVM Explorer
          </a>
        </div>
      </div>
    </div>
  );
}
