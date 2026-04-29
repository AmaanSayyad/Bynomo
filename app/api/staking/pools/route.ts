import { NextResponse } from 'next/server';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';

export async function GET() {
  const { data, error } = await supabase
    .from('staking_pools')
    .select('pool_key, lock_days, apy_bps, min_stake, max_stake, is_active')
    .eq('is_active', true)
    .order('lock_days', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to load staking pools.' }, { status: 500 });
  }

  return NextResponse.json({ pools: data ?? [] });
}
