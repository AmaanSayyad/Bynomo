/**
 * Free live market prices (no Pyth API key required).
 * Primary: Binance spot. Backup: Coinbase FX rates. Equities/futures: Yahoo chart.
 */

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api.binance.us',
];
const COINBASE_RATES_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/** Our asset symbol → Binance USDT pair */
const BINANCE_SYMBOL: Partial<Record<string, string>> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  SUI: 'SUIUSDT',
  TRX: 'TRXUSDT',
  XRP: 'XRPUSDT',
  DOGE: 'DOGEUSDT',
  ADA: 'ADAUSDT',
  BCH: 'BCHUSDT',
  BNB: 'BNBUSDT',
  XLM: 'XLMUSDT',
  XTZ: 'XTZUSDT',
  NEAR: 'NEARUSDT',
  APT: 'APTUSDT',
  LINK: 'LINKUSDT',
  AVAX: 'AVAXUSDT',
  DOT: 'DOTUSDT',
  LTC: 'LTCUSDT',
  UNI: 'UNIUSDT',
  PEPE: 'PEPEUSDT',
  SHIB: 'SHIBUSDT',
  ATOM: 'ATOMUSDT',
  RENDER: 'RENDERUSDT',
  TAO: 'TAOUSDT',
  INJ: 'INJUSDT',
  KAS: 'KASUSDT',
  FET: 'FETUSDT',
  FIL: 'FILUSDT',
  AR: 'ARUSDT',
  STX: 'STXUSDT',
  HBAR: 'HBARUSDT',
  ICP: 'ICPUSDT',
  VET: 'VETUSDT',
  OP: 'OPUSDT',
  BONK: 'BONKUSDT',
  ARB: 'ARBUSDT',
  SNX: 'SNXUSDT',
  AAVE: 'AAVEUSDT',
  GRT: 'GRTUSDT',
  THETA: 'THETAUSDT',
  ALGO: 'ALGOUSDT',
  EGLD: 'EGLDUSDT',
  FLOW: 'FLOWUSDT',
  GOLD: 'PAXGUSDT',
  EUR: 'EURUSDT',
  GBP: 'GBPUSDT',
  AUD: 'AUDUSDT',
};

/** Coinbase currency codes for 1 / USD-rate conversion */
const COINBASE_CODE: Partial<Record<string, string>> = {
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  SUI: 'SUI',
  TRX: 'TRX',
  XRP: 'XRP',
  DOGE: 'DOGE',
  ADA: 'ADA',
  BCH: 'BCH',
  BNB: 'BNB',
  XLM: 'XLM',
  XTZ: 'XTZ',
  NEAR: 'NEAR',
  APT: 'APT',
  LINK: 'LINK',
  AVAX: 'AVAX',
  DOT: 'DOT',
  LTC: 'LTC',
  UNI: 'UNI',
  SHIB: 'SHIB',
  ATOM: 'ATOM',
  FIL: 'FIL',
  ICP: 'ICP',
  VET: 'VET',
  AAVE: 'AAVE',
  ALGO: 'ALGO',
  EUR: 'EUR',
  GBP: 'GBP',
  AUD: 'AUD',
  JPY: 'JPY',
  CAD: 'CAD',
};

const YAHOO_SYMBOL: Partial<Record<string, string>> = {
  SILVER: 'SI=F',
  JPY: 'JPY=X',
  CAD: 'CADUSD=X',
  AAPL: 'AAPL',
  GOOGL: 'GOOGL',
  AMZN: 'AMZN',
  MSFT: 'MSFT',
  NVDA: 'NVDA',
  TSLA: 'TSLA',
  META: 'META',
  NFLX: 'NFLX',
  WTI: 'CL=F',
  BRENT: 'BZ=F',
  SPX: '^GSPC',
  NDX: '^NDX',
  DJI: '^DJI',
  AMD: 'AMD',
  BABA: 'BABA',
  DIS: 'DIS',
  JPM: 'JPM',
  V: 'V',
  MA: 'MA',
  PYPL: 'PYPL',
  COIN: 'COIN',
  MSTR: 'MSTR',
  UBER: 'UBER',
  PLTR: 'PLTR',
  CRM: 'CRM',
  INTC: 'INTC',
  TSM: 'TSM',
};

let binanceCache: { at: number; byPair: Map<string, number> } = { at: 0, byPair: new Map() };
let coinbaseCache: { at: number; usd: Record<string, number> } = { at: 0, usd: {} };
const yahooCache = new Map<string, { at: number; price: number }>();

const BINANCE_TTL_MS = 500;
const COINBASE_TTL_MS = 1_000;
const YAHOO_TTL_MS = 4_000;

async function loadBinanceTickers(): Promise<Map<string, number>> {
  const now = Date.now();
  if (now - binanceCache.at < BINANCE_TTL_MS && binanceCache.byPair.size > 0) {
    return binanceCache.byPair;
  }

  for (const host of BINANCE_HOSTS) {
    try {
      const response = await fetch(`${host}/api/v3/ticker/bookTicker`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) continue;
      const rows = (await response.json()) as { symbol?: string; bidPrice?: string; askPrice?: string }[];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const byPair = new Map<string, number>();
      for (const row of rows) {
        const symbol = row.symbol;
        const bid = Number(row.bidPrice);
        const ask = Number(row.askPrice);
        const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask;
        if (symbol && Number.isFinite(mid) && mid > 0) byPair.set(symbol, mid);
      }
      if (byPair.size > 0) {
        binanceCache = { at: now, byPair };
        return byPair;
      }
    } catch {
      // try next host
    }
  }
  return binanceCache.byPair;
}

async function loadCoinbaseUsd(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - coinbaseCache.at < COINBASE_TTL_MS && Object.keys(coinbaseCache.usd).length > 0) {
    return coinbaseCache.usd;
  }
  try {
    const response = await fetch(COINBASE_RATES_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return coinbaseCache.usd;
    const data = await response.json();
    const rates = data?.data?.rates as Record<string, string> | undefined;
    if (!rates) return coinbaseCache.usd;
    const usd: Record<string, number> = {};
    for (const [code, raw] of Object.entries(rates)) {
      const perUsd = Number(raw);
      if (!Number.isFinite(perUsd) || perUsd <= 0) continue;
      const price = 1 / perUsd;
      if (Number.isFinite(price) && price > 0) usd[code] = price;
    }
    if (Object.keys(usd).length > 0) coinbaseCache = { at: now, usd };
    return Object.keys(usd).length > 0 ? usd : coinbaseCache.usd;
  } catch {
    return coinbaseCache.usd;
  }
}

async function fetchYahooPrice(yahooSymbol: string): Promise<number | null> {
  const cached = yahooCache.get(yahooSymbol);
  const now = Date.now();
  if (cached && now - cached.at < YAHOO_TTL_MS) return cached.price;

  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`;
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(6_000),
    headers: { 'User-Agent': 'Mozilla/5.0 BynomoPriceFallback/1.0' },
  });
  if (!response.ok) return cached?.price ?? null;
  const data = await response.json();
  const meta = data?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice ?? meta?.fulldayPrice);
  if (!Number.isFinite(price) || price <= 0) return cached?.price ?? null;
  yahooCache.set(yahooSymbol, { at: now, price });
  return price;
}

export async function fetchPublicMarketPrices(
  assets: string[],
): Promise<Partial<Record<string, number>>> {
  const wanted = Array.from(new Set(assets.filter(Boolean)));
  if (wanted.length === 0) return {};

  const out: Partial<Record<string, number>> = {};
  const needYahoo: string[] = [];

  const [tickers, coinbaseUsd] = await Promise.all([
    loadBinanceTickers().catch(() => new Map<string, number>()),
    loadCoinbaseUsd().catch(() => ({} as Record<string, number>)),
  ]);

  for (const asset of wanted) {
    const pair = BINANCE_SYMBOL[asset];
    if (pair) {
      const price = tickers.get(pair);
      if (price && price > 0) {
        out[asset] = price;
        continue;
      }
    }
    const cbCode = COINBASE_CODE[asset];
    if (cbCode && coinbaseUsd[cbCode] > 0) {
      out[asset] = coinbaseUsd[cbCode];
      continue;
    }
    if (YAHOO_SYMBOL[asset]) needYahoo.push(asset);
  }

  const uniqueYahoo = Array.from(new Set(needYahoo));
  const concurrency = 4;
  for (let i = 0; i < uniqueYahoo.length; i += concurrency) {
    const slice = uniqueYahoo.slice(i, i + concurrency);
    const prices = await Promise.all(
      slice.map(async (asset) => {
        const yahooSymbol = YAHOO_SYMBOL[asset];
        if (!yahooSymbol) return [asset, null] as const;
        const price = await fetchYahooPrice(yahooSymbol);
        return [asset, price] as const;
      }),
    );
    for (const [asset, price] of prices) {
      if (price !== null) out[asset] = price;
    }
  }

  return out;
}
