import { PRICE_FEED_IDS } from '@/lib/utils/priceFeed';

const HERMES_ENDPOINT = 'https://hermes.pyth.network';
const PYTH_PRO_REST_ENDPOINT = 'https://pyth-lazer.dourolabs.app/v1/latest_price';

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

async function fetchViaHermes(assets: string[]): Promise<Partial<Record<string, number>>> {
  const requested = assets
    .map((asset) => [asset, (PRICE_FEED_IDS as Record<string, string>)[asset]] as const)
    .filter(([, id]) => typeof id === 'string');

  if (requested.length === 0) return {};

  const ids = requested.map(([, id]) => (id.startsWith('0x') ? id : `0x${id}`));
  const queryString = ids.map((id) => `ids%5B%5D=${encodeURIComponent(id)}`).join('&');
  try {
    const response = await fetch(`${HERMES_ENDPOINT}/v2/updates/price/latest?${queryString}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return {};
    const data = await response.json();

    const assetByFeedId = new Map<string, string>();
    requested.forEach(([asset, id]) => assetByFeedId.set(normalizeFeedId(id), asset));

    const out: Partial<Record<string, number>> = {};
    const parsed = Array.isArray(data?.parsed) ? data.parsed : [];
    parsed.forEach((feed: any) => {
      const asset = assetByFeedId.get(normalizeFeedId(feed?.id));
      if (!asset) return;
      const price = parsePriceFromFeed(feed);
      if (price !== null && Number.isFinite(price) && price > 0) out[asset] = price;
    });
    return out;
  } catch {
    return {};
  }
}

export async function fetchPythLatestPrices(assets: string[]): Promise<Partial<Record<string, number>>> {
  const uniqueAssets = Array.from(new Set(assets.filter(Boolean)));
  const hermesPrices = await fetchViaHermes(uniqueAssets);
  const missing = uniqueAssets.filter((asset) => !Number.isFinite(hermesPrices[asset] as number));
  if (missing.length === 0) return hermesPrices;

  // Optional Pro fallback (disabled by default until full feed-symbol mapping is verified).
  const proFallback = await fetchViaPythPro(missing);
  return { ...hermesPrices, ...proFallback };
}
