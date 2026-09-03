import { NextRequest, NextResponse } from 'next/server';
import { PRICE_FEED_IDS } from '@/lib/utils/priceFeed';
import { fetchPythLatestPrices } from '@/lib/server/pythLatest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonPrices(prices: Partial<Record<string, number>>) {
  return NextResponse.json(
    { prices },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const asset = request.nextUrl.searchParams.get('asset');
  const requestedAssets = asset ? [asset] : Object.keys(PRICE_FEED_IDS);
  const prices = await fetchPythLatestPrices(requestedAssets);
  return jsonPrices(prices);
}

export async function POST(request: NextRequest) {
  let requestedAssets: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.assets)) {
      requestedAssets = body.assets.filter((v: unknown) => typeof v === 'string');
    }
  } catch {
    // ignore invalid JSON and fall back below
  }

  if (requestedAssets.length === 0) requestedAssets = Object.keys(PRICE_FEED_IDS);
  const prices = await fetchPythLatestPrices(requestedAssets);
  return jsonPrices(prices);
}
