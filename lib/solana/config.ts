/**
 * Solana Network Configuration
 *
 * Three different concepts (do not mix them up):
 *
 * - **BYNOMO SPL mint** (`BYNOMO_SPL_MINT_MAINNET`) — on-chain mint account for the token; it is *not* a user wallet and has no private key in your `.env`.
 * - **Operational treasury** (`NEXT_PUBLIC_SOL_TREASURY_ADDRESS`) — house vault for SOL + SPL deposits and withdrawals. Must be the **only** pubkey controlled by `SOL_TREASURY_SECRET_KEY` (server-side).
 * - **Protocol fee collector** (`NEXT_PUBLIC_PLATFORM_FEE_WALLET_BYNOMO` / `NEXT_PUBLIC_PLATFORM_FEE_WALLET_SOL`) — **different** pubkey that receives tiered fees via backend transfers *from* the treasury after deposits/withdrawals.
 */

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

/** Mainnet BYNOMO SPL mint address — token identifier, not a treasury or fee wallet. */
export const BYNOMO_SPL_MINT_MAINNET = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';

export interface SolanaConfig {
    network: WalletAdapterNetwork;
    rpcEndpoint: string;
    treasuryAddress: string;
}

export interface SolanaStakingVaultConfig {
    address: string;
}

/**
 * Get Solana configuration from environment variables
 * 
 * @throws {Error} If required environment variables are missing
 * @returns {SolanaConfig} The Solana configuration object
 */
export function getSolanaConfig(): SolanaConfig {
    const networkStr = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'testnet';
    let network: WalletAdapterNetwork;

    switch (networkStr) {
        case 'mainnet-beta':
            network = WalletAdapterNetwork.Mainnet;
            break;
        case 'devnet':
            network = WalletAdapterNetwork.Devnet;
            break;
        case 'testnet':
        default:
            network = WalletAdapterNetwork.Testnet;
            break;
    }

    const publicRpcs = [
        'https://solana-rpc.publicnode.com',
        'https://rpc.ankr.com/solana',
        'https://solana-mainnet.rpc.extrnode.com',
        'https://api.mainnet-beta.solana.com',
    ];

    const envRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT?.trim();
    const envNorm = envRpc?.replace(/\/+$/, '') ?? '';
    // The public Solana Labs endpoint often returns 403 for browser / anonymous traffic.
    const isFlakyPublicCluster =
      envNorm === 'https://api.mainnet-beta.solana.com' ||
      envNorm === 'http://api.mainnet-beta.solana.com';
    const rpcEndpoint = isFlakyPublicCluster ? publicRpcs[0] : envRpc || publicRpcs[0];
    const treasuryAddress = process.env.NEXT_PUBLIC_SOL_TREASURY_ADDRESS;

    // Validate required environment variables
    if (!treasuryAddress) {
        throw new Error(
            'Missing required Solana environment variable: NEXT_PUBLIC_SOL_TREASURY_ADDRESS. ' +
            'Please check your .env file and ensure it is set.'
        );
    }

    return {
        network,
        rpcEndpoint,
        treasuryAddress,
    };
}

/**
 * Validate that all required environment variables are present
 */
export function validateSolanaConfig(): void {
    getSolanaConfig();
}

/**
 * Optional dedicated staking vault for BYNOMO staking custody.
 * When configured, staking routes move SPL tokens between treasury and this vault.
 */
export function getSolanaStakingVaultConfig(): SolanaStakingVaultConfig {
    const address = process.env.NEXT_PUBLIC_SOL_STAKING_VAULT_ADDRESS?.trim();
    if (!address) {
        throw new Error(
            'Missing NEXT_PUBLIC_SOL_STAKING_VAULT_ADDRESS. Configure a dedicated Solana staking vault.',
        );
    }
    return { address };
}
