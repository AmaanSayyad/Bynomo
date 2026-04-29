/**
 * Solana SDK Integration Module
 */

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSolanaConfig } from './config';
import { logTransactionError, logInfo } from '@/lib/logging/error-logger';

// Singleton Connection instance
let connection: Connection | null = null;
let connectionRpcUrl: string | null = null;

/**
 * Get or create a Solana connection instance
 */
export function getSolanaConnection(): Connection {
    const config = getSolanaConfig();
    if (!connection || connectionRpcUrl !== config.rpcEndpoint) {
        connection = new Connection(config.rpcEndpoint, 'confirmed');
        connectionRpcUrl = config.rpcEndpoint;
    }
    return connection;
}

/**
 * Build a deposit transaction
 * Creates a transaction that transfers SOL to the treasury wallet
 */
export async function buildDepositTransaction(
    amount: number,
    userAddress: string
): Promise<Transaction> {
    const config = getSolanaConfig();
    const connection = getSolanaConnection();

    const userPublicKey = new PublicKey(userAddress);
    const treasuryPublicKey = new PublicKey(config.treasuryAddress);

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: userPublicKey,
            toPubkey: treasuryPublicKey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
    );

    // Retry logic for blockhash fetching
    let blockhash: string = '';
    const publicRpcs = [
        config.rpcEndpoint,
        'https://solana-rpc.publicnode.com',
        'https://api.mainnet-beta.solana.com',
        'https://rpc.ankr.com/solana'
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    for (const rpc of publicRpcs) {
        try {
            const conn = new Connection(rpc, 'confirmed');
            const result = await conn.getLatestBlockhash();
            blockhash = result.blockhash;
            if (blockhash) break;
        } catch (err) {
            console.warn(`Failed to get blockhash from ${rpc}, trying next...`);
        }
    }

    if (!blockhash) {
        throw new Error('All Solana RPC regions failed to provide a blockhash. Please try again in a moment.');
    }

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    return transaction;
}

/**
 * Build a SOL transfer transaction to any recipient address (e.g. fee collector).
 */
export async function buildSolTransferTransaction(
    amount: number,
    fromAddress: string,
    toAddress: string
): Promise<Transaction> {
    const connection = getSolanaConnection();
    const fromPubkey = new PublicKey(fromAddress);
    const toPubkey   = new PublicKey(toAddress);

    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
    );

    const publicRpcs = [
        getSolanaConfig().rpcEndpoint,
        'https://solana-rpc.publicnode.com',
        'https://api.mainnet-beta.solana.com',
    ].filter(Boolean) as string[];

    let blockhash = '';
    for (const rpc of publicRpcs) {
        try {
            const conn = new Connection(rpc, 'confirmed');
            const { blockhash: bh } = await conn.getLatestBlockhash();
            blockhash = bh;
            break;
        } catch {
            console.warn(`[buildSolTransferTransaction] blockhash failed for ${rpc}`);
        }
    }
    if (!blockhash) throw new Error('All Solana RPCs failed to provide a blockhash.');

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;
    return transaction;
}

/**
 * Build a token deposit transaction
 */
export async function buildTokenDepositTransaction(
    amount: number,
    userAddress: string,
    mintAddress: string
): Promise<Transaction> {
    const {
        getAssociatedTokenAddress,
        createTransferInstruction,
        getMint,
        createAssociatedTokenAccountIdempotentInstruction,
    } = await import('@solana/spl-token');

    const config = getSolanaConfig();
    const connection = getSolanaConnection();

    const userPublicKey = new PublicKey(userAddress);
    const treasuryPublicKey = new PublicKey(config.treasuryAddress);
    const mintPublicKey = new PublicKey(mintAddress);

    const mintAccountInfo = await connection.getAccountInfo(mintPublicKey, 'confirmed');
    if (!mintAccountInfo) {
        throw new Error('Token mint not found on-chain');
    }
    const tokenProgramId = mintAccountInfo.owner;

    const mintInfo = await getMint(connection, mintPublicKey, 'confirmed', tokenProgramId);
    const decimals = mintInfo.decimals;

    const userTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        userPublicKey,
        false,
        tokenProgramId,
    );
    const treasuryTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        treasuryPublicKey,
        false,
        tokenProgramId,
    );

    const transaction = new Transaction();

    // Transferring into a missing treasury ATA yields InstructionError InvalidAccountData — create it first (user pays rent).
    const treasuryAtaInfo = await connection.getAccountInfo(treasuryTokenAccount, 'confirmed');
    if (!treasuryAtaInfo) {
        transaction.add(
            createAssociatedTokenAccountIdempotentInstruction(
                userPublicKey,
                treasuryTokenAccount,
                treasuryPublicKey,
                mintPublicKey,
                tokenProgramId,
            ),
        );
    }

    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));

    transaction.add(
        createTransferInstruction(
            userTokenAccount,
            treasuryTokenAccount,
            userPublicKey,
            rawAmount,
            [],
            tokenProgramId,
        ),
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPublicKey;

    return transaction;
}

/**
 * Build a generic SPL token transfer transaction to any recipient wallet.
 * Creates recipient ATA idempotently when missing.
 */
export async function buildTokenTransferTransaction(
    amount: number,
    fromAddress: string,
    toAddress: string,
    mintAddress: string
): Promise<Transaction> {
    const {
        getAssociatedTokenAddress,
        createTransferInstruction,
        getMint,
        createAssociatedTokenAccountIdempotentInstruction,
    } = await import('@solana/spl-token');

    const connection = getSolanaConnection();
    const fromPublicKey = new PublicKey(fromAddress);
    const toPublicKey = new PublicKey(toAddress);
    const mintPublicKey = new PublicKey(mintAddress);

    const mintAccountInfo = await connection.getAccountInfo(mintPublicKey, 'confirmed');
    if (!mintAccountInfo) {
        throw new Error('Token mint not found on-chain');
    }
    const tokenProgramId = mintAccountInfo.owner;

    const mintInfo = await getMint(connection, mintPublicKey, 'confirmed', tokenProgramId);
    const decimals = mintInfo.decimals;

    const fromTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        fromPublicKey,
        false,
        tokenProgramId,
    );
    const toTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        toPublicKey,
        false,
        tokenProgramId,
    );

    const transaction = new Transaction();
    const toAtaInfo = await connection.getAccountInfo(toTokenAccount, 'confirmed');
    if (!toAtaInfo) {
        transaction.add(
            createAssociatedTokenAccountIdempotentInstruction(
                fromPublicKey,
                toTokenAccount,
                toPublicKey,
                mintPublicKey,
                tokenProgramId,
            ),
        );
    }

    const rawAmount = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    transaction.add(
        createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPublicKey,
            rawAmount,
            [],
            tokenProgramId,
        ),
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPublicKey;
    return transaction;
}

/**
 * Get SOL balance for a given address with robust RPC fallback
 */
export async function getSOLBalance(address: string): Promise<number> {
    if (!address) return 0;

    // Trim address to avoid whitespace issues
    const cleanAddress = address.trim();
    const envRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT?.trim();

    // Comprehensive list of reliable public providers
    const publicRpcs = [
        envRpc || 'https://solana-rpc.publicnode.com',
        'https://solana-rpc.publicnode.com',
        'https://rpc.ankr.com/solana',
        'https://solana-mainnet.rpc.extrnode.com',
        'https://solana.api.onfinality.io/public',
        'https://api.mainnet-beta.solana.com',
    ].filter((value, index, self) => value && self.indexOf(value) === index);

    for (const rpc of publicRpcs) {
        try {
            // Validation
            const publicKey = new PublicKey(cleanAddress);
            if (!PublicKey.isOnCurve(publicKey.toBytes())) {
                console.error(`Invalid SOL address: ${cleanAddress}`);
                return 0;
            }

            const conn = new Connection(rpc, {
                commitment: 'confirmed',
                disableRetryOnRateLimit: true,
                // Increase internal timeout
                confirmTransactionInitialTimeout: 10000
            });

            const balance = await conn.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error: any) {
            const errorMsg = error?.message || 'Connection Error';
            console.warn(`Solana RPC Fail: ${rpc} | Error: ${errorMsg}`);

            if (rpc === publicRpcs[publicRpcs.length - 1]) {
                // Final fetch-based attempt with correct parameters
                try {
                    console.log('Attempting final direct fetch bakiye sorgusu...');
                    const response = await fetch(publicRpcs[0], {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getBalance',
                            params: [cleanAddress, { commitment: 'confirmed' }]
                        })
                    });
                    const data = await response.json();

                    if (data?.result?.value !== undefined) {
                        return data.result.value / LAMPORTS_PER_SOL;
                    } else if (data?.error) {
                        console.error('RPC Error Response:', data.error);
                    }
                } catch (fetchErr) {
                    console.error('All SOL balance retrieval methods failed completely.');
                }
                return 0;
            }
            continue;
        }
    }
    return 0;
}

/**
 * Get SPL token balance for a given address and mint.
 * Uses the Associated Token Account + @solana/spl-token (matches Phantom/wallets better than
 * getParsedTokenAccountsByOwner filters, which vary by RPC and can throw or return empty).
 */
export async function getTokenBalance(address: string, mintAddress: string): Promise<number> {
    if (!address || !mintAddress) return 0;

    const cleanAddress = address.trim();
    const cleanMint = mintAddress.trim();

    const envRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT?.trim();
    const publicRpcs = [
        envRpc && envRpc.length > 0 ? envRpc : null,
        'https://solana-rpc.publicnode.com',
        'https://rpc.ankr.com/solana',
        'https://solana-mainnet.rpc.extrnode.com',
        'https://api.mainnet-beta.solana.com',
    ].filter((value, index, self): value is string => !!value && self.indexOf(value) === index);

    const owner = new PublicKey(cleanAddress);
    const mint = new PublicKey(cleanMint);

    const {
        getMint,
        getAccount,
        getAssociatedTokenAddress,
        TOKEN_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID,
        TokenOwnerOffCurveError,
    } = await import('@solana/spl-token');

    async function ataFor(mintPk: PublicKey, ownerPk: PublicKey, programId: PublicKey) {
        try {
            return await getAssociatedTokenAddress(mintPk, ownerPk, false, programId);
        } catch (e: unknown) {
            if (e instanceof TokenOwnerOffCurveError) {
                return getAssociatedTokenAddress(mintPk, ownerPk, true, programId);
            }
            throw e;
        }
    }

    for (const rpc of publicRpcs) {
        try {
            const connection = new Connection(rpc, {
                commitment: 'confirmed',
                disableRetryOnRateLimit: true,
                confirmTransactionInitialTimeout: 10000,
            });

            for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
                try {
                    const mintInfo = await getMint(connection, mint, 'confirmed', programId);
                    const ata = await ataFor(mint, owner, programId);
                    try {
                        const account = await getAccount(connection, ata, 'confirmed', programId);
                        const decimals = mintInfo.decimals;
                        return Number(account.amount) / Math.pow(10, decimals);
                    } catch {
                        // Mint exists on this program but user has no ATA yet → 0 balance.
                        return 0;
                    }
                } catch {
                    // Wrong token program for this mint, or mint fetch failed — try next program / RPC.
                    continue;
                }
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`getTokenBalance RPC failed (${rpc}):`, msg);
        }
    }

    console.error(`getTokenBalance: could not load SPL balance for mint ${cleanMint}`);
    return 0;
}

/**
 * Wait until RPC reports confirmed/finalized status — call before POST /deposit so
 * getParsedTransaction succeeds on the server (avoids indexing race).
 */
export async function waitForSolanaSignatureConfirmed(
    connection: Connection,
    signature: string,
    maxMs = 90_000,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        const { value } = await connection.getSignatureStatuses([signature], {
            searchTransactionHistory: true,
        });
        const v = value[0];
        if (v?.err) {
            throw new Error(`Solana transaction failed: ${JSON.stringify(v.err)}`);
        }
        const cs = v?.confirmationStatus;
        if (cs === 'confirmed' || cs === 'finalized') {
            return;
        }
        await new Promise((r) => setTimeout(r, 450));
    }
    throw new Error('Timed out waiting for Solana confirmation');
}

/**
 * Get treasury balance
 */
export async function getTreasuryBalance(): Promise<number> {
    const config = getSolanaConfig();
    return getSOLBalance(config.treasuryAddress);
}

/**
 * Handle transaction errors
 */
export function handleTransactionError(error: any): Error {
    const errorMessage = error?.message?.toLowerCase() || '';

    if (
        errorMessage.includes('rejected') ||
        errorMessage.includes('denied') ||
        errorMessage.includes('cancelled') ||
        error?.code === 4001
    ) {
        return new Error('Transaction was cancelled by user.');
    }

    if (errorMessage.includes('insufficient funds') || errorMessage.includes('0x1')) {
        return new Error('Insufficient SOL balance for this transaction.');
    }

    if (error instanceof Error) {
        return new Error(`Transaction failed: ${error.message}`);
    }

    return new Error('Transaction failed. Please try again.');
}
