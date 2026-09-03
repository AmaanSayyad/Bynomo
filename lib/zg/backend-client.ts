/**
 * 0G Mainnet Backend Client
 * Used for administrative operations like withdrawals.
 */

import { ethers } from 'ethers';
import { getRpcUrl, getZGConfig } from './config';

const treasuryAbi = [
  'function withdrawTo(address payable to, uint256 amount) external',
  'function deposit() external payable',
  'event Withdrawn(address indexed to, uint256 amount, uint256 timestamp)',
];

export function getZGTreasuryWallet(): ethers.Wallet {
  const rawSecretKey =
    process.env.ZG_TREASURY_PRIVATE_KEY;

  if (!rawSecretKey) {
    throw new Error('ZG_TREASURY_PRIVATE_KEY is not configured');
  }

  // Support env keys with or without 0x prefix.
  const secretKey = rawSecretKey.startsWith('0x') ? rawSecretKey : `0x${rawSecretKey}`;

  const provider = new ethers.JsonRpcProvider(getRpcUrl());
  return new ethers.Wallet(secretKey, provider);
}

export async function transferZGFromTreasury(
  toAddress: string,
  amountZG: number,
): Promise<string> {
  try {
    const { treasuryAddress } = getZGConfig();
    if (!treasuryAddress) throw new Error('0G treasuryAddress not configured');

    const wallet = getZGTreasuryWallet();
    const treasury = new ethers.Contract(treasuryAddress as string, treasuryAbi, wallet);

    // Avoid scientific notation (e.g. 1e-7), which parseEther rejects.
    const amountStr = amountZG.toFixed(18).replace(/\.?0+$/, '');
    const amountWei = ethers.parseEther(amountStr);

    const { getZGEip1559Fees } = await import('./fees');
    const zgFees = await getZGEip1559Fees();
    const tx = await treasury.withdrawTo(toAddress, amountWei, zgFees);
    await tx.wait();

    return tx.hash;
  } catch (error) {
    console.error('Failed to transfer 0G from treasury:', error);
    throw error;
  }
}
