import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { assertBalanceApiAuthorized } from '@/lib/balance/balanceApiGuard';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { isValidAddress } from '@/lib/utils/address';

export async function GET(request: NextRequest) {
  const unauthorized = assertBalanceApiAuthorized(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const userAddress = (searchParams.get('userAddress') || '').trim();
  if (!userAddress) {
    return NextResponse.json({ error: 'userAddress is required' }, { status: 400 });
  }
  if (!(await isValidAddress(userAddress))) {
    return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
  }

  const variants = walletAddressSearchVariants(userAddress);
  const { data, error } = await supabase
    .from('staking_withdrawal_requests')
    .select(
      'id, user_address, position_id, stake_amount, reward_amount, payout_amount, status, requested_at, decided_at, tx_hash',
    )
    .in('user_address', variants)
    .order('requested_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to load payout requests.' }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
