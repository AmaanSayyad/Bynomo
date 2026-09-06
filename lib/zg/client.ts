/**
 * 0G Mainnet (EVM-like) SDK Integration Module
 */

import { ethers } from 'ethers';
import { getRpcUrl, getZGConfig } from './config';

// Singleton Provider instance
let provider: ethers.JsonRpcProvider | null = null;

export function getZGProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(getRpcUrl());
  }
  return provider;
}

export async function getZGBalance(address: string): Promise<number> {
  const p = getZGProvider();
  try {
    const balance = await p.getBalance(address);
    return parseFloat(ethers.formatEther(balance));
  } catch (error) {
    console.error('Failed to get 0G balance:', error);
    // Reset singleton so a later call can recover from a bad provider state.
    provider = null;
    try {
      const retry = getZGProvider();
      const balance = await retry.getBalance(address);
      return parseFloat(ethers.formatEther(balance));
    } catch (retryError) {
      console.error('Failed to get 0G balance on retry:', retryError);
      return 0;
    }
  }
}

export async function getZGTreasuryBalance(): Promise<number> {
  const { treasuryAddress } = getZGConfig();
  if (!treasuryAddress) return 0;
  return getZGBalance(treasuryAddress as string);
}
