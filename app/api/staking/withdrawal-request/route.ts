import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { isWalletGloballyBanned } from '@/lib/bans/walletBan';
import { assertBalanceApiAuthorized } from '@/lib/balance/balanceApiGuard';
import { computeStakingPayout } from '@/lib/staking/payout';
import { isManualStakingPayoutExemptWallet, stakingPrincipalRequiresManualPayout } from '@/lib/staking/manualWithdrawThreshold';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { isValidAddress } from '@/lib/utils/address';

interface Body {
  userAddress?: string;
  positionId?: number;
}

export async function POST(request: NextRequest) {
  const unauthorized = assertBalanceApiAuthorized(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as Body;
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
    return NextResponse.json({ error: 'Position is not eligible for payout request.' }, { status: 400 });
  }
  if (new Date(pos.unlock_at).getTime() > Date.now()) {
    return NextResponse.json({ error: 'Position is still locked.' }, { status: 400 });
  }

  const amount = Number(pos.amount || 0);
  if (isManualStakingPayoutExemptWallet(userAddress)) {
    return NextResponse.json(
      {
        error: 'This wallet is exempt from manual review. Use the standard Claim action instead.',
        code: 'USE_STANDARD_CLAIM',
      },
      { status: 400 },
    );
  }
  if (!stakingPrincipalRequiresManualPayout(amount)) {
    return NextResponse.json(
      {
        error:
          'This position is below the manual-review threshold. Use the standard Claim action instead.',
        code: 'USE_STANDARD_CLAIM',
      },
      { status: 400 },
    );
  }

  const apyBps = Number(pos.apy_bps || 0);
  const lockDays = Number(pos.lock_days || 0);
  const { reward, payout } = computeStakingPayout(amount, apyBps, lockDays);

  const { data: existing } = await supabase
    .from('staking_withdrawal_requests')
    .select('id, status')
    .eq('position_id', positionId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'A pending payout request already exists for this position.', code: 'ALREADY_PENDING' },
      { status: 409 },
    );
  }

  const { data: inserted, error: insErr } = await supabase
    .from('staking_withdrawal_requests')
    .insert({
      user_address: pos.user_address,
      position_id: positionId,
      currency: 'BYNOMO',
      stake_amount: amount,
      reward_amount: reward,
      payout_amount: payout,
      status: 'pending',
    })
    .select('id, position_id, stake_amount, reward_amount, payout_amount, status, requested_at')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json(
        { error: 'A pending payout request already exists for this position.', code: 'ALREADY_PENDING' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: insErr.message || 'Failed to create payout request.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, request: inserted });
}
