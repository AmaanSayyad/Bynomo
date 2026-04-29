import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { isWalletGloballyBanned } from '@/lib/bans/walletBan';
import { assertBalanceApiAuthorized } from '@/lib/balance/balanceApiGuard';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { isValidAddress } from '@/lib/utils/address';
import { verifySolanaStakeToVaultTx } from '@/lib/solana/backend-client';
import { getSolanaStakingVaultConfig } from '@/lib/solana/config';

interface StakeBody {
  userAddress?: string;
  poolKey?: string;
  amount?: number;
  txHash?: string;
}

export async function POST(request: NextRequest) {
  const unauthorized = assertBalanceApiAuthorized(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as StakeBody;
  const userAddress = (body.userAddress || '').trim();
  const poolKey = (body.poolKey || '').trim();
  const amount = Number(body.amount);
  const txHash = (body.txHash || '').trim();

  if (!userAddress || !poolKey || !txHash || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
  if (!(await isValidAddress(userAddress))) {
    return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
  }
  if (await isWalletGloballyBanned(userAddress)) {
    return NextResponse.json({ error: 'This wallet is banned from the platform.' }, { status: 403 });
  }

  const variants = walletAddressSearchVariants(userAddress);
  const canonicalUserAddress = variants[0] || userAddress;
  const { data: pool, error: poolError } = await supabase
    .from('staking_pools')
    .select('pool_key, lock_days, apy_bps, min_stake, max_stake, is_active')
    .eq('pool_key', poolKey)
    .eq('is_active', true)
    .maybeSingle();

  if (poolError) {
    return NextResponse.json({ error: 'Failed to load staking pool.' }, { status: 500 });
  }
  if (!pool) {
    return NextResponse.json({ error: 'Staking pool is not available.' }, { status: 404 });
  }
  if (amount < Number(pool.min_stake || 0)) {
    return NextResponse.json({ error: 'Stake amount is below pool minimum.' }, { status: 400 });
  }
  if (pool.max_stake !== null && amount > Number(pool.max_stake)) {
    return NextResponse.json({ error: 'Stake amount exceeds pool maximum.' }, { status: 400 });
  }

  const { data: existingStakeTx } = await supabase
    .from('staking_ledger')
    .select('id')
    .eq('operation', 'stake')
    .eq('tx_hash', txHash)
    .limit(1);
  if (existingStakeTx && existingStakeTx.length > 0) {
    return NextResponse.json({ error: 'This staking transaction has already been processed.' }, { status: 409 });
  }

  const vaultAddress = getSolanaStakingVaultConfig().address;
  const verified = await verifySolanaStakeToVaultTx(txHash, userAddress, amount, vaultAddress);
  if (!verified) {
    return NextResponse.json(
      { error: 'Staking transfer could not be verified on-chain for the staking vault.' },
      { status: 400 },
    );
  }

  const unlockAt = new Date(Date.now() + Number(pool.lock_days) * 24 * 60 * 60 * 1000).toISOString();
  const { data: created, error: createError } = await supabase
    .from('staking_positions')
    .insert({
      user_address: canonicalUserAddress,
      currency: 'BYNOMO',
      pool_key: pool.pool_key,
      lock_days: pool.lock_days,
      apy_bps: pool.apy_bps,
      amount,
      unlock_at: unlockAt,
      status: 'active',
      tx_hash: txHash,
    })
    .select('id, unlock_at')
    .single();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message || 'Failed to create staking position.' }, { status: 500 });
  }

  const { error: ledgerError } = await supabase
    .from('staking_ledger')
    .insert({
      user_address: canonicalUserAddress,
      position_id: created.id,
      currency: 'BYNOMO',
      operation: 'stake',
      amount,
      tx_hash: txHash,
    });

  if (ledgerError) {
    return NextResponse.json({ error: ledgerError.message || 'Failed to write staking ledger.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    result: {
      success: true,
      position_id: created.id,
      unlock_at: created.unlock_at,
      stakeVaultTxHash: txHash,
    },
  });
}
