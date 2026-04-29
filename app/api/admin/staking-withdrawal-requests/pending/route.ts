import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';

export async function GET(request: NextRequest) {
  const deny = requireAdminAuth(request);
  if (deny) return deny;

  try {
    const { data, error } = await supabase
      .from('staking_withdrawal_requests')
      .select(
        'id, user_address, position_id, currency, stake_amount, reward_amount, payout_amount, status, requested_at, created_at',
      )
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ requests: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load staking payout requests';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
