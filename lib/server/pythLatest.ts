import { PRICE_FEED_IDS } from '@/lib/utils/priceFeed';
import { fetchPublicMarketPrices } from '@/lib/server/publicMarketPrices';

const HERMES_ENDPOINTS = [
  process.env.PYTH_HERMES_URL?.trim() || 'https://pyth.dourolabs.app/hermes',
  'https://hermes.pyth.network',
];
const PYTH_PRO_REST_ENDPOINT = 'https://pyth-lazer.dourolabs.app/v1/latest_price';
const HERMES_CHUNK_SIZE = 20;
const SNAPSHOT_TTL_MS = 750;
const HERMES_AUTH_COOLDOWN_MS = 60_000;

const PRO_SYMBOL_BY_ASSET: Partial<Record<keyof typeof PRICE_FEED_IDS, string>> = {
  BTC: 'Crypto.BTC/USD',
  ETH: 'Crypto.ETH/USD',
  SOL: 'Crypto.SOL/USD',
  SUI: 'Crypto.SUI/USD',
  BNB: 'Crypto.BNB/USD',
  XLM: 'Crypto.XLM/USD',
  XTZ: 'Crypto.XTZ/USD',
  NEAR: 'Crypto.NEAR/USD',
};

let snapshotCache: { at: number; prices: Partial<Record<string, number>> } = { at: 0, prices: {} };
let hermesAuthBlockedUntil = 0;
let lastHermesWarnAt = 0;

/** Only a Pyth Terminal Hermes key — Lazer/Pro keys are not entitled for crypto spots. */
function hermesApiKey(): string {
  return process.env.PYTH_API_KEY?.trim() || process.env.PYTH_HERMES_API_KEY?.trim() || '';
}

function hermesHeaders(): Record<string, string> {
  const key = hermesApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function normalizeFeedId(id: string | undefined): string {
  if (!id || typeof id !== 'string') return '';
  return id.trim().replace(/^0x/i, '').toLowerCase();
}

function parsePriceFromFeed(feed: any): number | null {
  if (feed && typeof feed.price === 'string' && Number.isFinite(Number(feed.price))) {
    const exponent = Number(feed.exponent);
    if (Number.isFinite(exponent)) return Number(feed.price) * 10 ** exponent;
  }
  if (feed?.price && Number.isFinite(Number(feed.price.price)) && Number.isFinite(Number(feed.price.expo))) {
    return Number(feed.price.price) * 10 ** Number(feed.price.expo);
  }
  return null;
}

function warnHermes(message: string): void {
  const now = Date.now();
  if (now - lastHermesWarnAt < 30_000) return;
  lastHermesWarnAt = now;
  console.warn(`[pyth] ${message}`);
}

async function fetchViaPythPro(assets: string[]): Promise<Partial<Record<string, number>>> {
  const proEnabled = process.env.PYTH_PRO_ENABLE === 'true';
  if (!proEnabled) return {};
  const apiKey = process.env.PYTH_PRO_API_KEY?.trim();
  if (!apiKey) return {};

  const symbols: string[] = [];
  const assetBySymbol = new Map<string, string>();
  for (const asset of assets) {
    const symbol = PRO_SYMBOL_BY_ASSET[asset as keyof typeof PRICE_FEED_IDS];
    if (symbol) {
      symbols.push(symbol);
      assetBySymbol.set(symbol, asset);
    }
  }
  if (symbols.length === 0) return {};

  try {
    const response = await fetch(PYTH_PRO_REST_ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        channel: process.env.PYTH_PRO_CHANNEL || 'fixed_rate@200ms',
        symbols,
        properties: ['price', 'exponent', 'feedUpdateTimestamp'],
        formats: [],
      }),
    });
    if (!response.ok) return {};

    const data = await response.json();
    const feeds: any[] = Array.isArray(data?.parsed?.priceFeeds)
      ? data.parsed.priceFeeds
      : Array.isArray(data?.priceFeeds)
        ? data.priceFeeds
        : [];

    const out: Partial<Record<string, number>> = {};
    feeds.forEach((feed, idx) => {
      const price = parsePriceFromFeed(feed);
      if (price === null || !Number.isFinite(price) || price <= 0) return;

      const assetFromSymbol = typeof feed?.symbol === 'string' ? assetBySymbol.get(feed.symbol) : undefined;
      const asset = assetFromSymbol || assetBySymbol.get(symbols[idx] || '');
      if (asset) out[asset] = price;
    });
    return out;
  } catch {
    return {};
  }
}

async function fetchHermesChunk(
  endpoint: string,
  chunk: ReadonlyArray<readonly [string, string]>,
): Promise<Partial<Record<string, number>>> {
  const ids = chunk.map(([, id]) => (id.startsWith('0x') ? id : `0x${id}`));
  const queryString = ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join('&');
  const response = await fetch(`${endpoint}/v2/updates/price/latest?${queryString}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
    headers: hermesHeaders(),
  });

  if (response.status === 401 || response.status === 403) {
    hermesAuthBlockedUntil = Date.now() + HERMES_AUTH_COOLDOWN_MS;
    const body = await response.text().catch(() => '');
    warnHermes(
      `Hermes ${response.status} on ${endpoint}. ` +
        (response.status === 401
          ? 'Set PYTH_API_KEY from Pyth Terminal (Hermes requires auth after Aug 26 2026).'
          : `Key is not entitled for these feeds. ${body.slice(0, 160)}`),
    );
    return {};
  }
  if (!response.ok) return {};

  const data = await response.json();
  const assetByFeedId = new Map<string, string>();
  chunk.forEach(([asset, id]) => assetByFeedId.set(normalizeFeedId(id), asset));

  const out: Partial<Record<string, number>> = {};
  const parsed = Array.isArray(data?.parsed) ? data.parsed : [];
  parsed.forEach((feed: any) => {
    const asset = assetByFeedId.get(normalizeFeedId(feed?.id));
    if (!asset) return;
    const price = parsePriceFromFeed(feed);
    if (price !== null && Number.isFinite(price) && price > 0) out[asset] = price;
  });
  return out;
}

async function fetchViaHermes(assets: string[]): Promise<Partial<Record<string, number>>> {
  if (Date.now() < hermesAuthBlockedUntil) return {};

  const requested = assets
    .map((asset) => [asset, (PRICE_FEED_IDS as Record<string, string>)[asset]] as const)
    .filter(([, id]) => typeof id === 'string');

  if (requested.length === 0) return {};

  const out: Partial<Record<string, number>> = {};
  for (const endpoint of HERMES_ENDPOINTS) {
    if (Date.now() < hermesAuthBlockedUntil) break;
    for (let i = 0; i < requested.length; i += HERMES_CHUNK_SIZE) {
      if (Date.now() < hermesAuthBlockedUntil) break;
      const chunk = requested.slice(i, i + HERMES_CHUNK_SIZE);
      try {
        const part = await fetchHermesChunk(endpoint, chunk);
        Object.assign(out, part);
      } catch {
        // try next chunk / endpoint
      }
    }
    if (Object.keys(out).length > 0) return out;
  }
  return out;
}

export async function fetchPythLatestPrices(assets: string[]): Promise<Partial<Record<string, number>>> {
  const uniqueAssets = Array.from(new Set(assets.filter(Boolean)));
  if (uniqueAssets.length === 0) return {};

  const now = Date.now();
  const cachedHit = uniqueAssets.every((asset) => Number.isFinite(snapshotCache.prices[asset] as number));
  if (cachedHit && now - snapshotCache.at < SNAPSHOT_TTL_MS) {
    const slice: Partial<Record<string, number>> = {};
    for (const asset of uniqueAssets) slice[asset] = snapshotCache.prices[asset];
    return slice;
  }

  // Free Pyth plans have no API access after the Aug 2026 upgrade.
  // Default to public venues unless a dedicated Hermes key is configured.
  let merged: Partial<Record<string, number>> = {};
  if (hermesApiKey()) {
    merged = await fetchViaHermes(uniqueAssets);
  }

  let missing = uniqueAssets.filter((asset) => !Number.isFinite(merged[asset] as number));
  if (missing.length > 0) {
    const publicPrices = await fetchPublicMarketPrices(missing);
    merged = { ...merged, ...publicPrices };
    missing = uniqueAssets.filter((asset) => !Number.isFinite(merged[asset] as number));
  }

  if (missing.length > 0) {
    const proFallback = await fetchViaPythPro(missing);
    merged = { ...merged, ...proFallback };
  }

  if (Object.keys(merged).length > 0) {
    snapshotCache = { at: Date.now(), prices: { ...snapshotCache.prices, ...merged } };
  }

  return merged;
}
