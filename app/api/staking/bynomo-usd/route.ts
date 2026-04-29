import { NextResponse } from 'next/server';
import { fetchDexscreenerBynomoUsd } from '@/lib/admin/treasuryBalanceUsd';

/**
 * Public indicative BYNOMO → USD (DexScreener). Same source as admin treasury USD.
 */
export async function GET() {
  try {
    const priceUsd = await fetchDexscreenerBynomoUsd();
    return NextResponse.json(
      { priceUsd, source: 'dexscreener' },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ priceUsd: null, source: 'dexscreener' }, { status: 200 });
  }
}
