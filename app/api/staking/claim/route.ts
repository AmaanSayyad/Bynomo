import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { isWalletGloballyBanned } from '@/lib/bans/walletBan';
import { assertBalanceApiAuthorized } from '@/lib/balance/balanceApiGuard';
import { computeStakingPayout } from '@/lib/staking/payout';
import {
  MANUAL_STAKING_PAYOUT_THRESHOLD_BYNOMO,
  isManualStakingPayoutExemptWallet,
  stakingPrincipalRequiresManualPayout,
} from '@/lib/staking/manualWithdrawThreshold';
import { transferBynomoFromStakingVault } from '@/lib/solana/backend-client';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { isValidAddress } from '@/lib/utils/address';

interface ClaimBody {
  userAddress?: string;
  positionId?: number;
}

export async function POST(request: NextRequest) {
  const unauthorized = assertBalanceApiAuthorized(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as ClaimBody;
  const userAddress = (body.userAddress || '').trim();
  const positionId = Number(body.positionId);

  if (!userAddress || !Number.isFinite(positionId)) {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
  if (!(await isValidAddress(userAddress))) {
    return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
  }
  if (await isWalletGloballyBanned(userAddress)) {
    return NextResponse.json({ error: 'This wallet is banned from the platform.' }, { status: 403 });
  }

  const variants = walletAddressSearchVariants(userAddress);
  const { data: pos, error: posError } = await supabase
    .from('staking_positions')
    .select('id, user_address, status, amount, apy_bps, lock_days, unlock_at')
    .eq('id', positionId)
    .in('user_address', variants)
    .maybeSingle();

  if (posError) {
    return NextResponse.json({ error: 'Failed to verify staking position.' }, { status: 500 });
  }
  if (!pos) {
    return NextResponse.json({ error: 'Staking position not found.' }, { status: 404 });
  }
  if (pos.status !== 'active') {
    return NextResponse.json({ error: 'Position is not claimable.' }, { status: 400 });
  }
  if (new Date(pos.unlock_at).getTime() > Date.now()) {
    return NextResponse.json({ error: 'Position is still locked.' }, { status: 400 });
  }

  const amount = Number(pos.amount || 0);
  const apyBps = Number(pos.apy_bps || 0);
  const lockDays = Number(pos.lock_days || 0);

  if (stakingPrincipalRequiresManualPayout(amount) && !isManualStakingPayoutExemptWallet(userAddress)) {
    const { payout } = computeStakingPayout(amount, apyBps, lockDays);
    return NextResponse.json(
      {
        error:
          'Stakes of 8,000,000 BYNOMO or more require an admin-approved vault payout. Submit a payout request from the staking page instead.',
        code: 'MANUAL_STAKING_PAYOUT_REQUIRED',
        threshold: MANUAL_STAKING_PAYOUT_THRESHOLD_BYNOMO,
        estimated_payout: payout,
      },
      { status: 403 },
    );
  }

  const { reward, payout } = computeStakingPayout(amount, apyBps, lockDays);

  let claimVaultTxHash: string | null = null;
  try {
    claimVaultTxHash = await transferBynomoFromStakingVault(userAddress, payout);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to pay BYNOMO from staking vault.' },
      { status: 500 },
    );
  }

  const { error: updateErr } = await supabase
    .from('staking_positions')
    .update({
      status: 'claimed',
      reward_amount: reward,
      total_payout: payout,
      claimed_at: new Date().toISOString(),
      tx_hash: claimVaultTxHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', positionId)
    .eq('user_address', pos.user_address)
    .eq('status', 'active');

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message || 'Failed to finalize staking claim.' }, { status: 500 });
  }

  const { error: ledgerErr } = await supabase
    .from('staking_ledger')
    .insert({
      user_address: pos.user_address,
      position_id: positionId,
      currency: 'BYNOMO',
      operation: 'claim',
      amount: payout,
      reward_amount: reward,
      tx_hash: claimVaultTxHash,
    });

  if (ledgerErr) {
    return NextResponse.json({ error: ledgerErr.message || 'Failed to write claim ledger.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    result: {
      success: true,
      position_id: positionId,
      reward_amount: reward,
      payout_amount: payout,
      claimVaultTxHash,
    },
  });
}
