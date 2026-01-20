import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { COREWRITER_ACTIONS, CORE_WRITER, ACTION_DOCS } from '../lib/constants';
import { buildAction } from '../lib/corewriter';
import { useAssetMeta } from '../hooks/useAssetMeta';

// Generated wallet info
interface GeneratedWallet {
  address: string;
  privateKey: string;
}

interface CoreWriterPanelProps {
  signer?: ethers.JsonRpcSigner | null;
  onLog?: (log: { action: string; status: 'pending' | 'success' | 'error'; hash?: string; details?: string }) => void;
}

// Helper to convert human amount to raw
const toRaw = (amount: string, decimals: number): bigint => {
  if (!amount || isNaN(Number(amount))) return 0n;
  const [integer, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(integer + paddedFraction);
};

// Decoded calldata result
interface DecodedCalldata {
  actionId: number;
  actionName: string;
  params: Array<{ name: string; type: string; value: string }>;
}

export function CoreWriterPanel({ signer, onLog }: CoreWriterPanelProps) {
  const [selectedActionId, setSelectedActionId] = useState(7); // USD Class Transfer default
  const [humanInputs, setHumanInputs] = useState<Record<string, string>>({});
  const [encodedData, setEncodedData] = useState<string>('');
  const [rawValues, setRawValues] = useState<Record<string, string>>({});
  const [isEncoding, setIsEncoding] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState<GeneratedWallet | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'address' | 'privateKey' | null>(null);

  // Calldata decoder
  const [decodeInput, setDecodeInput] = useState('');
  const [decodedResult, setDecodedResult] = useState<DecodedCalldata | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const { perps, spotTokens, loading: metaLoading } = useAssetMeta();

  const selectedAction = useMemo(
    () => COREWRITER_ACTIONS.find((a) => a.id === selectedActionId),
    [selectedActionId]
  );

  const updateHumanInput = useCallback((key: string, value: string) => {
    setHumanInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Generate a new random wallet
  const generateWallet = useCallback(() => {
    const wallet = ethers.Wallet.createRandom();
    const newWallet = {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
    setGeneratedWallet(newWallet);
    setShowPrivateKey(false);
    setCopiedKey(null);
    // Auto-fill the wallet address
    updateHumanInput('wallet', wallet.address);
  }, [updateHumanInput]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string, type: 'address' | 'privateKey') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  // Get selected perp asset info
  const selectedPerpAsset = useMemo(() => {
    const assetIndex = parseInt(humanInputs['asset'] || '0');
    return perps[assetIndex] || null;
  }, [humanInputs, perps]);

  // Get decimal info for a parameter based on action and context
  const getDecimalInfo = useCallback((actionId: number, param: string, _type: string): { decimals: number; unit: string; hint: string } | null => {
    // USD Class Transfer (7): ntl is USD amount
    if (actionId === 7 && param === 'ntl') {
      return { decimals: 6, unit: 'USD', hint: '0.001 USD = 1000 raw' };
    }
    // Vault Transfer (2): usd is USD amount
    if (actionId === 2 && param === 'usd') {
      return { decimals: 6, unit: 'USD', hint: '0.001 USD = 1000 raw' };
    }
    // Spot Send (6): wei depends on token
    if (actionId === 6 && param === 'wei') {
      return { decimals: 8, unit: 'tokens', hint: 'USDC: 1 = 1e8 raw' };
    }
    // Staking Deposit/Withdraw (4, 5): wei is HYPE (8 decimals on HyperCore)
    if ((actionId === 4 || actionId === 5) && param === 'wei') {
      return { decimals: 8, unit: 'HYPE', hint: '1 HYPE = 1e8 raw' };
    }
    // Token Delegate (3): wei is HYPE (8 decimals on HyperCore)
    if (actionId === 3 && param === 'wei') {
      return { decimals: 8, unit: 'HYPE', hint: '1 HYPE = 1e8 raw' };
    }
    // Limit Order: sz uses asset's szDecimals, limitPx uses 6 decimals (standard)
    if (actionId === 1 && param === 'sz') {
      const szDecimals = selectedPerpAsset?.szDecimals ?? 5;
      const assetName = selectedPerpAsset?.name ?? 'BTC';
      return { decimals: szDecimals, unit: assetName, hint: `${assetName} szDecimals=${szDecimals}` };
    }
    if (actionId === 1 && param === 'limitPx') {
      return { decimals: 1, unit: 'USD', hint: 'Price: raw / 10 = USD' };
    }
    // Approve Builder Fee (12): maxFeeRate
    if (actionId === 12 && param === 'maxFeeRate') {
      return { decimals: 4, unit: '%', hint: '10 = 0.001%, 10000 = 1%' };
    }
    return null;
  }, [selectedPerpAsset]);

  const encodeAction = useCallback(() => {
    if (!selectedAction) return;

    setIsEncoding(true);
    try {
      const newRawValues: Record<string, string> = {};

      const values = selectedAction.params.map((param, idx) => {
        const type = selectedAction.types[idx];
        const humanValue = humanInputs[param] || '';
        const decimalInfo = getDecimalInfo(selectedAction.id, param, type);

        if (type === 'bool') {
          return humanValue === 'true' || humanValue === '1';
        } else if (type === 'address') {
          return humanValue || '0x0000000000000000000000000000000000000000';
        } else if (type === 'string') {
          return humanValue || '';
        } else if (type.startsWith('uint')) {
          // If this param has decimal conversion
          if (decimalInfo) {
            const raw = toRaw(humanValue || '0', decimalInfo.decimals);
            newRawValues[param] = raw.toString();
            return raw;
          }
          return BigInt(humanValue || '0');
        }
        return humanValue;
      });

      setRawValues(newRawValues);
      const encoded = buildAction(selectedAction.id, selectedAction.types, values);
      setEncodedData(encoded);
    } catch (error) {
      console.error('Encoding error:', error);
      setEncodedData(`Error: ${(error as Error).message}`);
    }
    setIsEncoding(false);
  }, [selectedAction, humanInputs, getDecimalInfo]);

  const sendTransaction = useCallback(async () => {
    if (!signer || !encodedData || encodedData.startsWith('Error')) {
      alert('Please connect wallet and encode action first');
      return;
    }

    setIsSending(true);
    const actionName = selectedAction?.name || 'Unknown';
    onLog?.({ action: actionName, status: 'pending' });

    try {
      const coreWriterContract = new ethers.Contract(
        CORE_WRITER,
        ['function sendRawAction(bytes) external'],
        signer
      );
      const tx = await coreWriterContract.sendRawAction(encodedData);
      onLog?.({ action: actionName, status: 'pending', hash: tx.hash });
      await tx.wait();
      onLog?.({ action: actionName, status: 'success', hash: tx.hash });
    } catch (error) {
      onLog?.({ action: actionName, status: 'error', details: (error as Error).message });
    }
    setIsSending(false);
  }, [signer, encodedData, selectedAction, onLog]);

  // Decode calldata to identify action and parameters
  const decodeCalldata = useCallback((calldata: string) => {
    setDecodeError(null);
    setDecodedResult(null);

    if (!calldata || calldata.length < 10) {
      setDecodeError('Invalid calldata: too short');
      return;
    }

    try {
      // Remove 0x prefix if present
      const hex = calldata.startsWith('0x') ? calldata.slice(2) : calldata;

      // Parse header (4 bytes = 8 hex chars)
      const headerHex = hex.slice(0, 8);
      const version = parseInt(headerHex.slice(0, 2), 16);
      const actionId = parseInt(headerHex.slice(2, 8), 16);

      if (version !== 1) {
        setDecodeError(`Unknown version: ${version}`);
        return;
      }

      // Find action definition
      const action = COREWRITER_ACTIONS.find((a) => a.id === actionId);
      if (!action) {
        setDecodeError(`Unknown action ID: ${actionId}`);
        return;
      }

      // Decode parameters
      const paramsData = '0x' + hex.slice(8);
      const abiCoder = new ethers.AbiCoder();
      const decoded = abiCoder.decode(action.types, paramsData);

      const params = action.params.map((name, idx) => ({
        name,
        type: action.types[idx],
        value: formatDecodedValue(decoded[idx], action.types[idx]),
      }));

      setDecodedResult({
        actionId,
        actionName: action.name,
        params,
      });
    } catch (error) {
      setDecodeError(`Decode error: ${(error as Error).message}`);
    }
  }, []);

  // Format decoded value for display
  const formatDecodedValue = (value: unknown, type: string): string => {
    if (type === 'bool') {
      return value ? 'true' : 'false';
    }
    if (type === 'address') {
      return String(value);
    }
    if (type.startsWith('uint')) {
      return String(value);
    }
    return String(value);
  };

  const renderParamInput = useCallback((param: string, type: string, actionId: number) => {
    const value = humanInputs[param] || '';
    const decimalInfo = getDecimalInfo(actionId, param, type);

    // Asset selector for perp asset
    if (param === 'asset' && type === 'uint32') {
      return (
        <select
          value={value}
          onChange={(e) => updateHumanInput(param, e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
          disabled={metaLoading}
        >
          <option value="">Select Asset</option>
          {perps.slice(0, 50).map((asset, index) => (
            <option key={index} value={index}>
              {asset.name} ({index})
            </option>
          ))}
        </select>
      );
    }

    // Token selector for spot tokens
    if (param === 'token' && type === 'uint64') {
      return (
        <select
          value={value}
          onChange={(e) => updateHumanInput(param, e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
          disabled={metaLoading}
        >
          <option value="">Select Token</option>
          {spotTokens.slice(0, 50).map((token) => (
            <option key={token.index} value={token.index}>
              {token.name} (#{token.index})
            </option>
          ))}
        </select>
      );
    }

    // Boolean selector
    if (type === 'bool') {
      // Special labels for known booleans
      const labels = {
        isBuy: { true: 'Buy (Long)', false: 'Sell (Short)' },
        isDeposit: { true: 'Deposit', false: 'Withdraw' },
        toPerp: { true: 'Spot → Perp', false: 'Perp → Spot' },
        reduceOnly: { true: 'Reduce Only', false: 'Normal' },
        isUndelegate: { true: 'Undelegate', false: 'Delegate' },
      } as Record<string, { true: string; false: string }>;

      const label = labels[param] || { true: 'true', false: 'false' };

      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateHumanInput(param, 'false')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${
              value !== 'true' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {label.false}
          </button>
          <button
            type="button"
            onClick={() => updateHumanInput(param, 'true')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${
              value === 'true' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {label.true}
          </button>
        </div>
      );
    }

    // Address input
    if (type === 'address') {
      // Special handling for API Wallet (Action 9, wallet param)
      const isApiWallet = actionId === 9 && param === 'wallet';

      return (
        <div className="space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => updateHumanInput(param, e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono"
          />
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => updateHumanInput(param, '0x0000000000000000000000000000000000000000')}
              className="text-blue-400 hover:text-blue-300"
            >
              Zero
            </button>
            {signer && (
              <button
                type="button"
                onClick={async () => {
                  const addr = await signer.getAddress();
                  updateHumanInput(param, addr);
                }}
                className="text-green-400 hover:text-green-300"
              >
                My Wallet
              </button>
            )}
            {isApiWallet && (
              <button
                type="button"
                onClick={generateWallet}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                🔑 Generate New Wallet
              </button>
            )}
          </div>

          {/* Generated Wallet Display */}
          {isApiWallet && generatedWallet && (
            <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg space-y-2">
              <div className="text-xs text-purple-400 font-medium">Generated API Wallet</div>

              {/* Address */}
              <div className="space-y-1">
                <div className="text-xs text-gray-400">Address:</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-800 px-2 py-1 rounded font-mono text-green-400 break-all">
                    {generatedWallet.address}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedWallet.address, 'address')}
                    className="text-xs text-gray-400 hover:text-white px-2"
                  >
                    {copiedKey === 'address' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Private Key */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Private Key:</span>
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="text-xs text-yellow-400 hover:text-yellow-300"
                  >
                    {showPrivateKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showPrivateKey ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-800 px-2 py-1 rounded font-mono text-red-400 break-all">
                      {generatedWallet.privateKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(generatedWallet.privateKey, 'privateKey')}
                      className="text-xs text-gray-400 hover:text-white px-2"
                    >
                      {copiedKey === 'privateKey' ? '✓' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <code className="block text-xs bg-gray-800 px-2 py-1 rounded font-mono text-gray-600">
                    ••••••••••••••••••••••••••••••••
                  </code>
                )}
              </div>

              <div className="text-xs text-yellow-500 mt-2">
                ⚠️ Save the private key! It cannot be recovered after closing this page.
              </div>
            </div>
          )}
        </div>
      );
    }

    // Number input with decimal conversion
    if (decimalInfo) {
      const rawValue = rawValues[param];
      return (
        <div className="space-y-1">
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => updateHumanInput(param, e.target.value)}
              placeholder="0.0"
              className="w-full px-3 py-2 pr-16 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              {decimalInfo.unit}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {decimalInfo.hint}
            {rawValue && (
              <span className="ml-2 text-yellow-400">= {rawValue} raw</span>
            )}
          </div>
        </div>
      );
    }

    // Default input
    return (
      <input
        type={type.startsWith('uint') ? 'number' : 'text'}
        value={value}
        onChange={(e) => updateHumanInput(param, e.target.value)}
        placeholder={type.startsWith('uint') ? '0' : ''}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono"
      />
    );
  }, [humanInputs, rawValues, updateHumanInput, getDecimalInfo, perps, spotTokens, metaLoading, signer, showPrivateKey, generatedWallet, generateWallet, copyToClipboard, copiedKey]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="font-semibold">CoreWriter Actions</h2>
        <p className="text-xs text-gray-500 mt-1">
          Build calldata for HyperCore transactions (human-readable amounts)
        </p>
      </div>

      {/* Action Selector */}
      <div className="p-4 border-b border-gray-800">
        <label className="block text-xs text-gray-400 mb-1">Select Action</label>
        <select
          value={selectedActionId}
          onChange={(e) => {
            setSelectedActionId(Number(e.target.value));
            setHumanInputs({});
            setRawValues({});
            setEncodedData('');
          }}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
        >
          {COREWRITER_ACTIONS.map((action) => (
            <option key={action.id} value={action.id}>
              [{action.id}] {action.name} {action.status === 'tested' ? '✓' : action.status === 'skip' ? '(skip)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Parameters */}
      {selectedAction && (
        <div className="p-4 border-b border-gray-800 space-y-3">
          {/* Action Documentation (replaces Quick Actions) */}
          {ACTION_DOCS[selectedAction.id] && (
            <div className="p-3 bg-gray-800/50 rounded-lg space-y-2 mb-2">
              <div className="text-sm text-gray-300">{ACTION_DOCS[selectedAction.id].description}</div>

              <div>
                <span className="text-xs text-gray-500">Calldata: </span>
                <code className="text-xs font-mono text-green-400">
                  {ACTION_DOCS[selectedAction.id].calldata}
                </code>
              </div>

              <div className="space-y-1">
                {ACTION_DOCS[selectedAction.id].params.map((p, i) => (
                  <div key={i} className="text-xs flex gap-2">
                    <span className="text-blue-400 font-mono min-w-[80px]">{p.name}</span>
                    <span className="text-gray-500 font-mono min-w-[60px]">{p.type}</span>
                    <span className="text-gray-400">{p.desc}</span>
                  </div>
                ))}
              </div>

              {ACTION_DOCS[selectedAction.id].notes && (
                <div className="text-xs text-yellow-500/80 pt-1">
                  {ACTION_DOCS[selectedAction.id].notes!.map((note, i) => (
                    <div key={i}>⚠️ {note}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedAction.params.map((param, idx) => (
            <div key={param}>
              <label className="block text-xs text-gray-400 mb-1">
                {param}
                <span className="text-gray-600 ml-1">({selectedAction.types[idx]})</span>
              </label>
              {renderParamInput(param, selectedAction.types[idx], selectedAction.id)}
            </div>
          ))}
        </div>
      )}

      {/* Encode Button */}
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={encodeAction}
          disabled={isEncoding}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition"
        >
          {isEncoding ? 'Encoding...' : 'Generate Calldata'}
        </button>
      </div>

      {/* Encoded Data Display */}
      {encodedData && !encodedData.startsWith('Error') && (
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">Encoded Calldata</label>
            <button
              onClick={() => navigator.clipboard.writeText(encodedData)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Copy
            </button>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs break-all">
            <span className="text-green-400">{encodedData.slice(0, 10)}</span>
            <span className="text-blue-400">{encodedData.slice(10, 16)}</span>
            <span className="text-gray-400">{encodedData.slice(16)}</span>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            <span className="text-green-400">0x01</span>=version{' '}
            <span className="text-blue-400">{encodedData.slice(10, 16)}</span>=actionID({selectedAction?.id}){' '}
            <span className="text-gray-400">...</span>=params
          </div>
        </div>
      )}

      {encodedData && encodedData.startsWith('Error') && (
        <div className="p-4 border-b border-gray-800">
          <div className="text-xs text-red-400">{encodedData}</div>
        </div>
      )}

      {/* Send Transaction */}
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={sendTransaction}
          disabled={!signer || !encodedData || encodedData.startsWith('Error') || isSending}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition"
        >
          {isSending ? 'Sending...' : signer ? 'Send Transaction' : 'Connect Wallet to Send'}
        </button>
        <div className="text-xs text-gray-500 mt-2 text-center">
          CoreWriter: {CORE_WRITER.slice(0, 10)}...{CORE_WRITER.slice(-8)}
        </div>
      </div>

      {/* Calldata Decoder */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 font-medium">🔍 Decode Calldata</label>
        </div>
        <div className="space-y-3">
          <textarea
            value={decodeInput}
            onChange={(e) => setDecodeInput(e.target.value)}
            placeholder="Paste calldata here (0x01...)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono h-20 resize-none"
          />
          <button
            onClick={() => decodeCalldata(decodeInput)}
            disabled={!decodeInput}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition"
          >
            Decode
          </button>

          {/* Decode Result */}
          {decodedResult && (
            <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Action:</span>
                <span className="text-sm font-medium text-purple-400">
                  [{decodedResult.actionId}] {decodedResult.actionName}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-gray-400">Parameters:</span>
                {decodedResult.params.map((p, i) => (
                  <div key={i} className="text-xs flex gap-2 pl-2">
                    <span className="text-blue-400 font-mono min-w-[80px]">{p.name}</span>
                    <span className="text-gray-500 font-mono min-w-[60px]">{p.type}</span>
                    <span className="text-green-400 font-mono break-all">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decode Error */}
          {decodeError && (
            <div className="text-xs text-red-400 p-2 bg-red-900/20 rounded">
              {decodeError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
