/**
 * Push Chain Backend Client
 * Treasury operations for withdrawals — uses existing EVM treasury key
 */

import { ethers } from 'ethers';
import { getPushConfig } from './config';

/**
 * Get the treasury wallet for Push Chain backend operations
 * Reuses the EVM treasury key (same wallet works on all EVM-compatible chains)
 */
export function getPushTreasuryWallet(): ethers.Wallet {
    const config = getPushConfig();
    // Prefer a dedicated Push treasury key, fall back to shared EVM treasury key
    const secretKey =
    process.env.PUSH_TREASURY_SECRET_KEY;

    if (!secretKey) {
        throw new Error('PUSH_TREASURY_SECRET_KEY is not configured');
    }

    const provider = new ethers.JsonRpcProvider(config.rpcEndpoint, {
        chainId: config.chainId,
        name: 'push-donut'
    });
    return new ethers.Wallet(secretKey, provider);
}

/**
 * Transfer PUSH native token from treasury to a given address (e.g. user withdrawal).
 */
export async function transferPUSHFromTreasury(
    toAddress: string,
    amountPUSH: number
): Promise<string> {
    try {
        const wallet = getPushTreasuryWallet();
        const amountStr = amountPUSH.toFixed(18).replace(/\.?0+$/, '');
        const amountWei = ethers.parseEther(amountStr);

        const tx = await wallet.sendTransaction({
            to: toAddress,
            value: amountWei,
        });

        console.log(`PUSH withdrawal transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`PUSH withdrawal transaction confirmed: ${tx.hash}`);

        return tx.hash;
    } catch (error) {
        console.error('Failed to transfer PUSH from treasury:', error);
        throw error;
    }
}

/**
 * Collect PC (Push Chain native token) platform fees from the treasury and
 * send them to the configured PC treasury wallet address
 * (NEXT_PUBLIC_PLATFORM_FEE_WALLET_PC, falling back to NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM).
 *
 * Keeping this separate from transferPUSHFromTreasury means PC fee routing can
 * be configured independently — point it at your revenue treasury wallet.
 */
export async function transferPCFromTreasury(
    toAddress: string,
    amountPC: number
): Promise<string> {
    try {
        const wallet = getPushTreasuryWallet();
        const amountStr = amountPC.toFixed(18).replace(/\.?0+$/, '');
        const amountWei = ethers.parseEther(amountStr);

        const tx = await wallet.sendTransaction({
            to: toAddress,
            value: amountWei,
        });

        console.log(`[PC fee] Treasury → fee wallet tx sent: ${tx.hash}`);
        await tx.wait();
        console.log(`[PC fee] Treasury → fee wallet tx confirmed: ${tx.hash}`);

        return tx.hash;
    } catch (error) {
        console.error('[PC fee] Failed to transfer PC fee from treasury:', error);
        throw error;
    }
}
