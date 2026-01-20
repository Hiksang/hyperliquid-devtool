import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { RPC_URL, API_URL, PRECOMPILES } from '../lib/constants';
import type { Balances } from '../types';

export function useBalances(address: string) {
  const [balances, setBalances] = useState<Balances>({ perp: 0, spot: {} });
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoading(true);

    try {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const abiCoder = new ethers.AbiCoder();

      // Perp withdrawable
      const perpResult = await provider.call({
        to: PRECOMPILES.withdrawable.address,
        data: abiCoder.encode(['address'], [address]),
      });
      const perpBalance = parseInt(perpResult, 16) / 1e6;

      // Spot balances via API
      const spotRes = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'spotClearinghouseState', user: address }),
      });
      const spotData = await spotRes.json();
      const spotBalances: Record<string, number> = {};
      if (spotData.balances) {
        for (const bal of spotData.balances) {
          spotBalances[bal.coin] = parseFloat(bal.total);
        }
      }

      setBalances({ perp: perpBalance, spot: spotBalances });
    } catch (error) {
      console.error('Failed to fetch balances', error);
    }
    setLoading(false);
  }, [address]);

  return { balances, loading, fetchBalances };
}
