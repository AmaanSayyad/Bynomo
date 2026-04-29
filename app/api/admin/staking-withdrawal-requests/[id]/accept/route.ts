import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';
import { isWalletGloballyBanned } from '@/lib/bans/walletBan';
import { computeStakingPayout } from '@/lib/staking/payout';
import { stakingPrincipalRequiresManualPayout } from '@/lib/staking/manualWithdrawThreshold';
import { transferBynomoFromStakingVault } from '@/lib/solana/backend-client';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = requireAdminAuth(request);
  if (deny) return deny;

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    const { data: req, error: reqError } = await supabase
      .from('staking_withdrawal_requests')
      .select(
        'id, user_address, position_id, stake_amount, reward_amount, payout_amount, status, requested_at, tx_hash',
      )
      .eq('id', id)
      .single();

    if (reqError) throw reqError;
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.status === 'accepted') {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        txHash: req.tx_hash || undefined,
      });
    }
    if (req.status !== 'pending') {
      return NextResponse.json({ error: `Cannot accept request in status: ${req.status}` }, { status: 400 });
    }

    const userAddress = String(req.user_address).trim();
    if (await isWalletGloballyBanned(userAddress)) {
      return NextResponse.json(
        { error: 'Wallet is on the global ban list. Reject this payout request.' },
        { status: 403 },
      );
    }

    const positionId = Number(req.position_id);
    const variants = walletAddressSearchVariants(userAddress);

    const { data: pos, error: posError } = await supabase
      .from('staking_positions')
      .select('id, user_address, status, amount, apy_bps, lock_days, unlock_at')
      .eq('id', positionId)
      .in('user_address', variants)
      .maybeSingle();

    if (posError) {
      return NextResponse.json({ error: 'Failed to load staking position.' }, { status: 500 });
    }
    if (!pos) {
      return NextResponse.json({ error: 'Staking position not found for this request.' }, { status: 404 });
    }
    if (pos.status !== 'active') {
      return NextResponse.json({ error: 'Position is no longer active; cannot pay out.' }, { status: 400 });
    }
    if (new Date(pos.unlock_at).getTime() > Date.now()) {
      return NextResponse.json({ error: 'Position is still locked.' }, { status: 400 });
    }

    const amount = Number(pos.amount || 0);
    if (!stakingPrincipalRequiresManualPayout(amount)) {
      return NextResponse.json(
        { error: 'Position principal is below manual threshold; reconcile in DB.' },
        { status: 400 },
      );
    }

    const apyBps = Number(pos.apy_bps || 0);
    const lockDays = Number(pos.lock_days || 0);
    const { reward, payout } = computeStakingPayout(amount, apyBps, lockDays);

    const payoutDiff = Math.abs(payout - Number(req.payout_amount || 0));
    if (payoutDiff > 0.00000001) {
      return NextResponse.json(
        {
          error: `Payout mismatch vs current position (computed ${payout}, request ${req.payout_amount}). Refresh and retry.`,
        },
        { status: 409 },
      );
    }

    let claimVaultTxHash: string;
    try {
      claimVaultTxHash = await transferBynomoFromStakingVault(userAddress, payout);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Failed to send BYNOMO from staking vault.' },
        { status: 500 },
      );
    }

    const { data: updatedPos, error: updatePosErr } = await supabase
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
      .eq('status', 'active')
      .select('id');

    if (updatePosErr) {
      return NextResponse.json({ error: updatePosErr.message || 'Failed to finalize position.' }, { status: 500 });
    }
    if (!updatedPos?.length) {
      return NextResponse.json(
        {
          error:
            'Vault transfer was broadcast but the position row was not active — reconcile on-chain tx and DB manually.',
          txHash: claimVaultTxHash,
        },
        { status: 409 },
      );
    }

    const { error: ledgerErr } = await supabase.from('staking_ledger').insert({
      user_address: pos.user_address,
      position_id: positionId,
      currency: 'BYNOMO',
      operation: 'claim',
      amount: payout,
      reward_amount: reward,
      tx_hash: claimVaultTxHash,
    });

    if (ledgerErr) {
      return NextResponse.json(
        { error: ledgerErr.message || 'On-chain payout succeeded but ledger write failed — reconcile manually.', txHash: claimVaultTxHash },
        { status: 500 },
      );
    }

    const { error: updReqErr } = await supabase
      .from('staking_withdrawal_requests')
      .update({
        status: 'accepted',
        decided_at: new Date().toISOString(),
        decided_by: 'admin',
        tx_hash: claimVaultTxHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (updReqErr) {
      return NextResponse.json({ error: updReqErr.message || 'Payout sent but request row update failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      txHash: claimVaultTxHash,
      payout_amount: payout,
      reward_amount: reward,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to accept staking payout request';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
