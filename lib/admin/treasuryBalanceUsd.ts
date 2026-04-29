/**
 * Approximate USD valuation for treasury EOAs (Pyth Hermes + CoinGecko fallbacks).
 * Not financial advice — for ops visibility only.
 */

import { PRICE_FEED_IDS } from '@/lib/utils/priceFeed';

const HERMES = 'https://hermes.pyth.network';

const PYTH_SYMBOLS = ['BNB', 'SOL', 'SUI', 'XLM', 'XTZ', 'NEAR', 'ETH'] as const;
type PythSym = (typeof PYTH_SYMBOLS)[number];

function normalizeFeedId(id: string | undefined): string {
  if (!id || typeof id !== 'string') return '';
  return id.trim().replace(/^0x/i, '').toLowerCase();
}

export async function fetchPythUsdPartial(): Promise<Partial<Record<PythSym, number>>> {
  const ids = PYTH_SYMBOLS.map((k) => {
    const raw = PRICE_FEED_IDS[k];
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  });
  const qs = ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join('&');
  try {
    const r = await fetch(`${HERMES}/v2/updates/price/latest?${qs}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return {};
    const data = await r.json();
    const out: Partial<Record<PythSym, number>> = {};
    data.parsed?.forEach((feed: { id: string; price: { price: string; expo: number } }) => {
      for (const sym of PYTH_SYMBOLS) {
        if (normalizeFeedId(PRICE_FEED_IDS[sym]) === normalizeFeedId(feed.id)) {
          out[sym] = Number(feed.price.price) * 10 ** feed.price.expo;
          break;
        }
      }
    });
    return out;
  } catch {
    return {};
  }
}

/** CoinGecko `simple/price` ids → usd */
export async function fetchCoingeckoTreasuryUsd(): Promise<Record<string, number>> {
  const ids = ['starknet', 'initia', 'zero-gravity'].join(',');
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) return {};
    const j = (await r.json()) as Record<string, { usd?: number }>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(j)) {
      if (typeof v?.usd === 'number' && Number.isFinite(v.usd)) out[k] = v.usd;
    }
    return out;
  } catch {
    return {};
  }
}

const BYNOMO_SOLANA_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';

/** USD price for SPL BYNOMO (not on Pyth); DexScreener pair price. */
export async function fetchDexscreenerBynomoUsd(): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${BYNOMO_SOLANA_MINT}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as {
      pairs?: { priceUsd?: string; liquidity?: { usd?: number } }[];
    };
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const withPrice = pairs
      .map((p) => {
        const price = p?.priceUsd !== undefined ? parseFloat(p.priceUsd) : NaN;
        const liq = Number(p?.liquidity?.usd ?? 0);
        return { price, liq };
      })
      .filter((p) => Number.isFinite(p.price) && p.price > 0);
    if (withPrice.length === 0) return null;
    // Prefer the most liquid pair to avoid stale/illiquid pool prices.
    withPrice.sort((a, b) => b.liq - a.liq);
    return withPrice[0]!.price;
  } catch {
    return null;
  }
}

/**
 * USD per 1 unit of the on-chain asset (null if unknown).
 * `bynomoUsd` — SPL BYNOMO only (DexScreener).
 */
export function usdPerUnit(
  chain: string,
  asset: string,
  pyth: Partial<Record<PythSym, number>>,
  cg: Record<string, number>,
  bynomoUsd?: number | null,
): number | null {
  if (asset === 'USDC') return 1;

  if (chain === 'BNB' && asset === 'BNB') return pyth.BNB ?? null;
  if (chain === 'SOL' && asset === 'SOL') return pyth.SOL ?? null;
  if (chain === 'SOL' && asset === 'BYNOMO') return bynomoUsd ?? null;
  if (chain === 'SUI' && asset === 'SUI') return pyth.SUI ?? null;
  if (chain === 'SUI' && asset === 'USDC') return 1;
  if (chain === 'XLM' && asset === 'XLM') return pyth.XLM ?? null;
  if (chain === 'XTZ' && asset === 'XTZ') return pyth.XTZ ?? null;
  if (chain === 'NEAR' && asset === 'NEAR') return pyth.NEAR ?? null;

  if (chain === 'STRK' && asset === 'STRK') return cg.starknet ?? null;
  if (chain === 'INIT' && asset === 'INIT') return cg.initia ?? null;
  if (chain === '0G' && asset === '0G') return cg['zero-gravity'] ?? null;

  // EVM L2 / testnet gas tokens without dedicated feeds — rough ETH proxy
  if (chain === 'PUSH' && asset === 'native') return pyth.ETH ?? null;
  if (chain === 'STT') return pyth.ETH ?? null;

  if (chain === 'OCT' && asset === 'OCT') return null;

  return null;
}

export function formatUsd(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n > 0 && n < 0.01) return '<$0.01';
  if (n >= 1e9) return `$${n.toExponential(2)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function balanceTimesUsd(balance: number | null, unitUsd: number | null): number | null {
  if (balance === null || !Number.isFinite(balance) || unitUsd === null || !Number.isFinite(unitUsd)) return null;
  return balance * unitUsd;
}
