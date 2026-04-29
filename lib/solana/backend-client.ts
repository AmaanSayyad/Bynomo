/**
 * Solana Backend Client
 * Used for administrative operations like withdrawals
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    TransactionExpiredBlockheightExceededError,
    type ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { BYNOMO_SPL_MINT_MAINNET, getSolanaConfig, getSolanaStakingVaultConfig } from './config';
import bs58 from 'bs58';

/**
 * Confirm a signature using only HTTP polling (getSignatureStatus + getBlockHeight).
 * Avoids `signatureSubscribe`, which many public RPCs implement incorrectly and which
 * causes sendAndConfirmTransaction to hang until the blockhash expires (~60–90s).
 */
async function confirmSignatureWithPolling(
    connection: Connection,
    signature: string,
    lastValidBlockHeight: number,
    commitment: 'confirmed' | 'finalized' = 'confirmed',
): Promise<void> {
    const pollMs = 400;
    const maxWallMs = 75_000;
    const start = Date.now();

    const satisfies = (status: string | null | undefined) => {
        if (!status) return false;
        if (commitment === 'finalized') return status === 'finalized';
        return status === 'confirmed' || status === 'finalized';
    };

    while (Date.now() - start < maxWallMs) {
        const [statusRes, blockHeight] = await Promise.all([
            connection.getSignatureStatus(signature),
            connection.getBlockHeight(commitment),
        ]);

        const v = statusRes?.value;
        if (v?.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(v.err)}`);
        }
        if (v && satisfies(v.confirmationStatus ?? null)) {
            return;
        }

        if (blockHeight > lastValidBlockHeight) {
            const again = await connection.getSignatureStatus(signature);
            const v2 = again?.value;
            if (!v2?.err && v2 && satisfies(v2.confirmationStatus ?? null)) {
                return;
            }
            throw new TransactionExpiredBlockheightExceededError(signature);
        }

        await new Promise((r) => setTimeout(r, pollMs));
    }

    const final = await connection.getSignatureStatus(signature);
    const fv = final?.value;
    if (!fv?.err && fv && satisfies(fv.confirmationStatus ?? null)) {
        return;
    }
    throw new Error('SOL transaction confirmation timed out');
}

/** Same RPC preference order as `lib/solana/config.ts` — avoids flaky primary + indexing lag after send. */
function solanaVerificationRpcEndpoints(configRpc: string): string[] {
    const norm = configRpc.replace(/\/+$/, '');
    const publicRpcs = [
        norm,
        'https://solana-rpc.publicnode.com',
        'https://rpc.ankr.com/solana',
        'https://solana-mainnet.rpc.extrnode.com',
        'https://api.mainnet-beta.solana.com',
    ];
    return [...new Set(publicRpcs.filter(Boolean))];
}

function messageAccountKeysBase58(parsed: ParsedTransactionWithMeta): string[] {
    const keys = parsed.transaction.message.accountKeys as unknown[];
    return keys.map((k) => {
        if (typeof k === 'string') return k;
        const obj = k as { pubkey?: PublicKey; toBase58?: () => string };
        if (obj.pubkey) return obj.pubkey.toBase58();
        if (obj.toBase58) return obj.toBase58();
        return '';
    });
}

/**
 * After wallet.sendTransaction, RPC nodes often return null briefly from getParsedTransaction.
 * Poll with backoff across multiple endpoints until the tx is indexed or timeout.
 */
async function fetchParsedDepositTransaction(
    signature: string,
    primaryRpc: string,
): Promise<ParsedTransactionWithMeta | null> {
    const endpoints = solanaVerificationRpcEndpoints(primaryRpc);
    const deadline = Date.now() + 12_000;
    let delayMs = 350;

    while (Date.now() < deadline) {
        for (const rpc of endpoints) {
            try {
                const connection = new Connection(rpc, {
                    commitment: 'confirmed',
                    disableRetryOnRateLimit: true,
                    confirmTransactionInitialTimeout: 15000,
                });
                const parsed = await connection.getParsedTransaction(signature, {
                    maxSupportedTransactionVersion: 0,
                    commitment: 'confirmed',
                });
                if (parsed?.meta && !parsed.meta.err) {
                    return parsed;
                }
            } catch (err) {
                console.warn(`[fetchParsedDepositTransaction] ${rpc}:`, err);
            }
        }
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs + 100, 2000);
    }

    return null;
}

async function sendSignedTransactionAndConfirmPolling(
    connection: Connection,
    transaction: Transaction,
    signers: Keypair[],
): Promise<string> {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signers[0]!.publicKey;
    transaction.sign(...signers);

    const raw = transaction.serialize();
    const signature = await connection.sendRawTransaction(raw, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 5,
    });

    await confirmSignatureWithPolling(connection, signature, lastValidBlockHeight, 'confirmed');
    return signature;
}

/**
 * Verifies a native SOL or SPL deposit to the configured treasury (signature = tx id).
 */
export async function verifySolanaDepositTx(
    signature: string,
    userAddress: string,
    expectedAmount: number,
    tokenMint?: string,
): Promise<boolean> {
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return false;

    try {
        const config = getSolanaConfig();
        if (!config.treasuryAddress) return false;

        const treasuryPub = new PublicKey(config.treasuryAddress);
        const userPub = new PublicKey(userAddress);

        const parsed = await fetchParsedDepositTransaction(signature, config.rpcEndpoint);

        if (!parsed || parsed.meta?.err) return false;
        const meta = parsed.meta;
        if (!meta) return false;

        const accountKeys = messageAccountKeysBase58(parsed);

        // Ensure the user's wallet signed this tx (prevents crediting using unrelated signatures).
        const userSigned = parsed.transaction.message.accountKeys.some((entry: { pubkey: PublicKey; signer: boolean }) =>
            entry.pubkey.equals(userPub) && entry.signer === true,
        );
        if (!userSigned) return false;

        if (!tokenMint) {
            const treasuryIdx = accountKeys.indexOf(treasuryPub.toBase58());
            const userIdx = accountKeys.indexOf(userPub.toBase58());
            if (treasuryIdx === -1 || userIdx === -1) return false;
            const preT = meta.preBalances[treasuryIdx];
            const postT = meta.postBalances[treasuryIdx];
            const gained = postT - preT;
            const minLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL * 0.99);
            return gained >= minLamports;
        }

        const {
            getMint,
            getAssociatedTokenAddressSync,
            TOKEN_PROGRAM_ID,
            TOKEN_2022_PROGRAM_ID,
        } = await import('@solana/spl-token');
        const mintPk = new PublicKey(tokenMint);

        let decimals = 9;
        try {
            const mintInfo = await getMint(
                new Connection(config.rpcEndpoint, 'confirmed'),
                mintPk,
                'confirmed',
                TOKEN_PROGRAM_ID,
            );
            decimals = mintInfo.decimals;
        } catch {
            try {
                const mintInfo = await getMint(
                    new Connection(config.rpcEndpoint, 'confirmed'),
                    mintPk,
                    'confirmed',
                    TOKEN_2022_PROGRAM_ID,
                );
                decimals = mintInfo.decimals;
            } catch {
                return false;
            }
        }

        const minRaw = BigInt(Math.floor(expectedAmount * Math.pow(10, decimals) * 0.99));

        const treasuryStr = treasuryPub.toBase58();
        const treasuryAtaCandidates = new Set<string>();
        for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
            for (const allowOff of [false, true]) {
                try {
                    treasuryAtaCandidates.add(
                        getAssociatedTokenAddressSync(mintPk, treasuryPub, allowOff, programId).toBase58(),
                    );
                } catch {
                    /* skip */
                }
            }
        }

        const preTb = meta.preTokenBalances || [];
        const postTb = meta.postTokenBalances || [];

        const matchesTreasuryDestination = (b: (typeof postTb)[number]) => {
            if (b.mint !== tokenMint) return false;
            const accPk = accountKeys[b.accountIndex];
            const ownerOk = b.owner === treasuryStr;
            const ataOk = accPk ? treasuryAtaCandidates.has(accPk) : false;
            return ownerOk || ataOk;
        };

        const preRow = preTb.find(matchesTreasuryDestination);
        const postRow = postTb.find(matchesTreasuryDestination);
        const preAmt = BigInt(preRow?.uiTokenAmount?.amount ?? '0');
        const postAmt = BigInt(postRow?.uiTokenAmount?.amount ?? '0');
        const gained = postAmt - preAmt;
        return gained >= minRaw;
    } catch (err) {
        console.error('[verifySolanaDepositTx]', err);
        return false;
    }
}

/**
 * Verify a BYNOMO SPL stake transfer from user wallet to staking vault.
 */
export async function verifySolanaStakeToVaultTx(
    signature: string,
    userAddress: string,
    expectedAmount: number,
    vaultAddress: string,
): Promise<boolean> {
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return false;
    try {
        const config = getSolanaConfig();
        const parsed = await fetchParsedDepositTransaction(signature, config.rpcEndpoint);
        if (!parsed || parsed.meta?.err) return false;
        const meta = parsed.meta;
        if (!meta) return false;

        const userPub = new PublicKey(userAddress);
        const vaultPub = new PublicKey(vaultAddress);
        const mintPk = new PublicKey(BYNOMO_SPL_MINT_MAINNET);

        const userSigned = parsed.transaction.message.accountKeys.some((entry: { pubkey: PublicKey; signer: boolean }) =>
            entry.pubkey.equals(userPub) && entry.signer === true,
        );
        if (!userSigned) return false;

        const accountKeys = messageAccountKeysBase58(parsed);
        const {
            getMint,
            getAssociatedTokenAddressSync,
            TOKEN_PROGRAM_ID,
            TOKEN_2022_PROGRAM_ID,
        } = await import('@solana/spl-token');

        let decimals = 9;
        try {
            const mintInfo = await getMint(new Connection(config.rpcEndpoint, 'confirmed'), mintPk, 'confirmed', TOKEN_PROGRAM_ID);
            decimals = mintInfo.decimals;
        } catch {
            try {
                const mintInfo = await getMint(new Connection(config.rpcEndpoint, 'confirmed'), mintPk, 'confirmed', TOKEN_2022_PROGRAM_ID);
                decimals = mintInfo.decimals;
            } catch {
                return false;
            }
        }

        const minRaw = BigInt(Math.floor(expectedAmount * Math.pow(10, decimals) * 0.99));
        const vaultStr = vaultPub.toBase58();
        const vaultAtaCandidates = new Set<string>();
        for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
            for (const allowOff of [false, true]) {
                try {
                    vaultAtaCandidates.add(
                        getAssociatedTokenAddressSync(mintPk, vaultPub, allowOff, programId).toBase58(),
                    );
                } catch {
                    /* skip */
                }
            }
        }

        const preTb = meta.preTokenBalances || [];
        const postTb = meta.postTokenBalances || [];
        const matchesVaultDestination = (b: (typeof postTb)[number]) => {
            if (b.mint !== BYNOMO_SPL_MINT_MAINNET) return false;
            const accPk = accountKeys[b.accountIndex];
            const ownerOk = b.owner === vaultStr;
            const ataOk = accPk ? vaultAtaCandidates.has(accPk) : false;
            return ownerOk || ataOk;
        };

        const preRow = preTb.find(matchesVaultDestination);
        const postRow = postTb.find(matchesVaultDestination);
        const preAmt = BigInt(preRow?.uiTokenAmount?.amount ?? '0');
        const postAmt = BigInt(postRow?.uiTokenAmount?.amount ?? '0');
        const gained = postAmt - preAmt;
        return gained >= minRaw;
    } catch (err) {
        console.error('[verifySolanaStakeToVaultTx]', err);
        return false;
    }
}

/**
 * Get the treasury keypair for backend operations
 */
export function getTreasuryKeypair(): Keypair {
    const secretKeyStr = process.env.SOL_TREASURY_SECRET_KEY;

    if (!secretKeyStr) {
        throw new Error('SOL_TREASURY_SECRET_KEY is not configured');
    }

    try {
        // Try parsing as JSON array first
        if (secretKeyStr.startsWith('[')) {
            return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
        }
        // Fallback to base58
        return Keypair.fromSecretKey(bs58.decode(secretKeyStr));
    } catch (error) {
        throw new Error('Invalid SOL_TREASURY_SECRET_KEY format. Must be JSON array or base58.');
    }
}

function keypairFromSecret(secretKeyStr: string, envName: string): Keypair {
    if (!secretKeyStr) {
        throw new Error(`${envName} is not configured`);
    }
    try {
        if (secretKeyStr.startsWith('[')) {
            return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
        }
        return Keypair.fromSecretKey(bs58.decode(secretKeyStr));
    } catch {
        throw new Error(`Invalid ${envName} format. Must be JSON array or base58.`);
    }
}

export function getStakingVaultKeypair(): Keypair {
    return keypairFromSecret(process.env.SOL_STAKING_VAULT_SECRET_KEY || '', 'SOL_STAKING_VAULT_SECRET_KEY');
}

/**
 * Transfer SOL from treasury to a user
 */
export async function transferSOLFromTreasury(
    toAddress: string,
    amountSOL: number
): Promise<string> {
    try {
        const config = getSolanaConfig();
        const connection = new Connection(config.rpcEndpoint, 'confirmed');
        const treasuryKeypair = getTreasuryKeypair();
        const toPublicKey = new PublicKey(toAddress);

        // Pre-check treasury balance to give a clear error instead of raw 0x1
        const treasuryLamports = await connection.getBalance(treasuryKeypair.publicKey);
        const requiredLamports = Math.floor(amountSOL * LAMPORTS_PER_SOL) + 10_000; // 10k lamports for fee buffer
        if (treasuryLamports < requiredLamports) {
            throw new Error(
                `Treasury has insufficient SOL balance. Available: ${(treasuryLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL, required: ${amountSOL.toFixed(6)} SOL. Withdrawal is temporarily unavailable — please try again later or contact support.`
            );
        }

        const maxAttempts = 3;
        let lastErr: unknown;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: treasuryKeypair.publicKey,
                        toPubkey: toPublicKey,
                        lamports: Math.floor(amountSOL * LAMPORTS_PER_SOL),
                    }),
                );
                const signature = await sendSignedTransactionAndConfirmPolling(
                    connection,
                    transaction,
                    [treasuryKeypair],
                );
                console.log(`SOL Withdrawal transaction confirmed: ${signature}`);
                return signature;
            } catch (err) {
                lastErr = err;
                const retry =
                    err instanceof TransactionExpiredBlockheightExceededError ||
                    (err instanceof Error &&
                        /timed out|block height exceeded|429|Too many|fetch failed|ECONNRESET/i.test(err.message));
                if (!retry || attempt === maxAttempts - 1) break;
                await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            }
        }
        throw lastErr;
    } catch (error) {
        console.error('Failed to transfer SOL from treasury:', error);
        // Surface clean message for known simulation/insufficient-funds errors
        if (error instanceof Error) {
            const msg = error.message;
            if (msg.includes('0x1') || msg.includes('insufficient lamports') || msg.includes('Simulation failed')) {
                throw new Error('SOL withdrawal temporarily unavailable due to insufficient treasury balance. Please contact support.');
            }
        }
        throw error;
    }
}
/**
 * Transfer SPL Token from treasury to a user
 */
export async function transferTokenFromTreasury(
    toAddress: string,
    amount: number,
    mintAddress: string
): Promise<string> {
    try {
        const {
            getOrCreateAssociatedTokenAccount,
            createTransferInstruction,
            getMint
        } = await import('@solana/spl-token');

        const config = getSolanaConfig();
        const connection = new Connection(config.rpcEndpoint, 'confirmed');
        const treasuryKeypair = getTreasuryKeypair();
        const toPublicKey = new PublicKey(toAddress);
        const mintPublicKey = new PublicKey(mintAddress);

        // Get mint info to handle decimals
        const mintInfo = await getMint(connection, mintPublicKey);
        const decimals = mintInfo.decimals;

        // Get or create ATA for treasury (source)
        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryKeypair,
            mintPublicKey,
            treasuryKeypair.publicKey
        );

        // Pre-check treasury token balance
        const tokenBalance = Number(fromTokenAccount.amount);
        const requiredRaw = Math.floor(amount * Math.pow(10, decimals));
        if (tokenBalance < requiredRaw) {
            throw new Error(
                `Treasury has insufficient token balance. Available: ${(tokenBalance / Math.pow(10, decimals)).toFixed(decimals)} tokens, required: ${amount}. Withdrawal is temporarily unavailable — please try again later or contact support.`
            );
        }

        // Get or create ATA for receiver (destination)
        // Note: receiver might need to pay for account creation if it doesn't exist,
        // but typically the sender (treasury) pays for it here.
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            treasuryKeypair,
            mintPublicKey,
            toPublicKey
        );

        const maxAttempts = 3;
        let lastErr: unknown;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const transaction = new Transaction().add(
                    createTransferInstruction(
                        fromTokenAccount.address,
                        toTokenAccount.address,
                        treasuryKeypair.publicKey,
                        Math.floor(amount * Math.pow(10, decimals)),
                    ),
                );
                const signature = await sendSignedTransactionAndConfirmPolling(
                    connection,
                    transaction,
                    [treasuryKeypair],
                );
                console.log(`Token Withdrawal transaction confirmed: ${signature}`);
                return signature;
            } catch (err) {
                lastErr = err;
                const retry =
                    err instanceof TransactionExpiredBlockheightExceededError ||
                    (err instanceof Error &&
                        /timed out|block height exceeded|429|Too many|fetch failed|ECONNRESET/i.test(err.message));
                if (!retry || attempt === maxAttempts - 1) break;
                await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            }
        }
        throw lastErr;
    } catch (error) {
        console.error('Failed to transfer token from treasury:', error);
        if (error instanceof Error) {
            const msg = error.message;
            if (msg.includes('0x1') || msg.includes('insufficient') || msg.includes('Simulation failed')) {
                throw new Error('Token withdrawal temporarily unavailable due to insufficient treasury balance. Please contact support.');
            }
        }
        throw error;
    }
}

/**
 * Transfer BYNOMO SPL from treasury wallet to dedicated staking vault.
 */
export async function transferBynomoTreasuryToStakingVault(amount: number): Promise<string> {
    const vault = getSolanaStakingVaultConfig();
    return transferTokenFromTreasury(vault.address, amount, BYNOMO_SPL_MINT_MAINNET);
}

/**
 * Transfer BYNOMO SPL from staking vault wallet back to treasury wallet.
 */
export async function transferBynomoStakingVaultToTreasury(amount: number): Promise<string> {
    try {
        const {
            getOrCreateAssociatedTokenAccount,
            createTransferInstruction,
            getMint,
        } = await import('@solana/spl-token');

        const config = getSolanaConfig();
        const vault = getSolanaStakingVaultConfig();
        const connection = new Connection(config.rpcEndpoint, 'confirmed');
        const stakingVaultKeypair = getStakingVaultKeypair();
        const treasuryPubkey = new PublicKey(config.treasuryAddress);
        const mintPubkey = new PublicKey(BYNOMO_SPL_MINT_MAINNET);

        if (stakingVaultKeypair.publicKey.toBase58() !== vault.address) {
            throw new Error('SOL_STAKING_VAULT_SECRET_KEY does not match NEXT_PUBLIC_SOL_STAKING_VAULT_ADDRESS.');
        }

        const mintInfo = await getMint(connection, mintPubkey);
        const decimals = mintInfo.decimals;

        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            stakingVaultKeypair,
            mintPubkey,
            stakingVaultKeypair.publicKey,
        );

        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            stakingVaultKeypair,
            mintPubkey,
            treasuryPubkey,
        );

        const tokenBalance = Number(fromTokenAccount.amount);
        const requiredRaw = Math.floor(amount * Math.pow(10, decimals));
        if (tokenBalance < requiredRaw) {
            throw new Error(
                `Staking vault has insufficient BYNOMO balance. Available: ${(tokenBalance / Math.pow(10, decimals)).toFixed(decimals)}, required: ${amount}.`,
            );
        }

        const transaction = new Transaction().add(
            createTransferInstruction(
                fromTokenAccount.address,
                toTokenAccount.address,
                stakingVaultKeypair.publicKey,
                requiredRaw,
            ),
        );

        const signature = await sendSignedTransactionAndConfirmPolling(connection, transaction, [stakingVaultKeypair]);
        return signature;
    } catch (error) {
        console.error('Failed to transfer BYNOMO from staking vault to treasury:', error);
        throw error;
    }
}

/**
 * Transfer BYNOMO SPL from staking vault wallet directly to a user wallet.
 */
export async function transferBynomoFromStakingVault(
    toAddress: string,
    amount: number,
): Promise<string> {
    try {
        const {
            getOrCreateAssociatedTokenAccount,
            createTransferInstruction,
            getMint,
        } = await import('@solana/spl-token');

        const config = getSolanaConfig();
        const vault = getSolanaStakingVaultConfig();
        const connection = new Connection(config.rpcEndpoint, 'confirmed');
        const stakingVaultKeypair = getStakingVaultKeypair();
        const toPublicKey = new PublicKey(toAddress);
        const mintPublicKey = new PublicKey(BYNOMO_SPL_MINT_MAINNET);

        if (stakingVaultKeypair.publicKey.toBase58() !== vault.address) {
            throw new Error('SOL_STAKING_VAULT_SECRET_KEY does not match NEXT_PUBLIC_SOL_STAKING_VAULT_ADDRESS.');
        }

        const mintInfo = await getMint(connection, mintPublicKey);
        const decimals = mintInfo.decimals;

        const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            stakingVaultKeypair,
            mintPublicKey,
            stakingVaultKeypair.publicKey,
        );

        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            stakingVaultKeypair,
            mintPublicKey,
            toPublicKey,
        );

        const tokenBalance = Number(fromTokenAccount.amount);
        const requiredRaw = Math.floor(amount * Math.pow(10, decimals));
        if (tokenBalance < requiredRaw) {
            throw new Error(
                `Staking vault has insufficient BYNOMO balance. Available: ${(tokenBalance / Math.pow(10, decimals)).toFixed(decimals)}, required: ${amount}.`,
            );
        }

        const transaction = new Transaction().add(
            createTransferInstruction(
                fromTokenAccount.address,
                toTokenAccount.address,
                stakingVaultKeypair.publicKey,
                requiredRaw,
            ),
        );

        return sendSignedTransactionAndConfirmPolling(connection, transaction, [stakingVaultKeypair]);
    } catch (error) {
        console.error('Failed to transfer BYNOMO from staking vault to user:', error);
        throw error;
    }
}
