import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { RPC_URL, CHAIN_ID } from '../lib/constants';

interface WalletState {
  address: string;
  chainId: number;
  signer: ethers.JsonRpcSigner | null;
  isConnected: boolean;
  isCorrectChain: boolean;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: '',
    chainId: 0,
    signer: null,
    isConnected: false,
    isCorrectChain: false,
  });

  const connect = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask not found! Please install MetaMask.');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      const signer = await provider.getSigner();
      const chainId = Number(network.chainId);

      setState({
        address: accounts[0],
        chainId,
        signer,
        isConnected: true,
        isCorrectChain: chainId === CHAIN_ID,
      });

      if (chainId !== CHAIN_ID) {
        await switchToHyperEVM();
      }
    } catch (error) {
      console.error('Failed to connect wallet', error);
    }
  }, []);

  const switchToHyperEVM = useCallback(async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x3E7' }], // 999 in hex
      });
    } catch (switchError: unknown) {
      if ((switchError as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x3E7',
            chainName: 'HyperEVM Mainnet',
            nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ['https://explorer.hyperliquid.xyz'],
          }],
        });
      }
    }
  }, []);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        setState(prev => ({ ...prev, address: '', isConnected: false, signer: null }));
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      const chainId = parseInt(chainIdHex, 16);
      setState(prev => ({ ...prev, chainId, isCorrectChain: chainId === CHAIN_ID }));
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  return { ...state, connect, switchToHyperEVM };
}
