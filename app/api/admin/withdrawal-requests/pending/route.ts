import { NextRequest, NextResponse } from 'next/server';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';

export async function GET(_request: NextRequest) {
  const deny = requireAdminAuth(_request);
  if (deny) return deny;
  try {
    // Explicit column selection to avoid exposing sensitive future columns
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('id, user_address, currency, amount, net_amount, fee_amount, requested_at, status, decided_by, tx_hash, created_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ requests: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load pending withdrawals' }, { status: 500 });
  }
}

