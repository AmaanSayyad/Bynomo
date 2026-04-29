import { NextRequest, NextResponse } from 'next/server';
import { walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { isValidAddress } from '@/lib/utils/address';

export async function GET(request: NextRequest) {
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
    .from('staking_positions')
    .select(
      'id, user_address, pool_key, lock_days, apy_bps, amount, start_at, unlock_at, status, reward_amount, total_payout, claimed_at, created_at',
    )
    .in('user_address', variants)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: 'Failed to load staking positions.' }, { status: 500 });
  }

  const now = Date.now();
  const positions = data ?? [];
  const active = positions.filter((p) => p.status === 'active');
  const summary = {
    activePositions: active.length,
    activeStaked: active.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    claimableNow: active
      .filter((p) => new Date(p.unlock_at).getTime() <= now)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  };

  return NextResponse.json({ positions, summary });
}
