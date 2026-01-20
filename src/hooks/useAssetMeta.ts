import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../lib/constants';

export interface PerpAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

export interface SpotToken {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  isCanonical: boolean;
  evmContract: string | null;
  fullName: string | null;
}

export interface SpotPair {
  name: string; // e.g., "PURR/USDC", "@1"
  index: number;
  tokens: [number, number]; // [base token index, quote token index]
  isCanonical: boolean;
}

export interface AssetMeta {
  perps: PerpAsset[];
  spotTokens: SpotToken[];
  spotPairs: SpotPair[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAssetMeta(): AssetMeta {
  const [perps, setPerps] = useState<PerpAsset[]>([]);
  const [spotTokens, setSpotTokens] = useState<SpotToken[]>([]);
  const [spotPairs, setSpotPairs] = useState<SpotPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch perp meta
      const perpResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
      });
      const perpData = await perpResponse.json();

      if (perpData.universe) {
        setPerps(perpData.universe);
      }

      // Fetch spot meta
      const spotResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'spotMeta' }),
      });
      const spotData = await spotResponse.json();

      if (spotData.tokens) {
        setSpotTokens(spotData.tokens);
      }

      if (spotData.universe) {
        // Map spot universe to SpotPair format
        const pairs: SpotPair[] = spotData.universe.map((pair: any, idx: number) => ({
          name: pair.name,
          index: idx,
          tokens: pair.tokens,
          isCanonical: pair.isCanonical ?? true,
        }));
        setSpotPairs(pairs);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  return {
    perps,
    spotTokens,
    spotPairs,
    loading,
    error,
    refresh: fetchMeta,
  };
}
