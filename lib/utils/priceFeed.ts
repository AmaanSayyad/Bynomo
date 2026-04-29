/**
 * Pyth Network Price Feed Service
 * Fetches real-time crypto price data from Pyth Network
 * Supports: BTC, SUI, SOL, AND CUSTOM TOKENS (BYNOMO)
 */


// Pyth Network Price Feed IDs (Stable/Mainnet)
export const PRICE_FEED_IDS = {
  BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  SOL: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  SUI: '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  TRX: '0x67aed5a24fdad045475e7195c98a98aea119c763f272d4523f5bac93a4f33c2b',
  XRP: '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  DOGE: '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c',
  ADA: '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  BCH: '0x3dd2b63686a450ec7290df3a1e0b583c0481f651351edfa7636f39aed55cf8a3',
  BNB: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
  XLM: '0xb7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850',
  XTZ: '0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03',
  NEAR: '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  APT: '0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5', // Corrected Mainnet ID
  // Metals
  GOLD: '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  SILVER: '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
  // FX
  EUR: '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  GBP: '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
  JPY: '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
  AUD: '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80',
  CAD: '0x3112b03a41c910ed446852aacf67118cb1bec67b2cd0b9a214c58cc0eaa2ecca',
  // Stocks
  AAPL: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  GOOGL: '0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6',
  AMZN: '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a',
  MSFT: '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  NVDA: '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
  TSLA: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  META: '0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
  NFLX: '0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2',
  // Commodities
  WTI: '0x6a60b0d1ea6809b47dbe599f24a71c8bda335aa5c77e503e7260cde5ba2f4694',
  BRENT: '0x27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a',
  // Indices
  SPX: '0x9cecbb4f3744f4201aab46431e5587a931dfb6e02567f7c3d73f93b3c9fdeead',
  NDX: '0x1b79d5b75253c291cc72d40cc874f468d07c1e6c149ee298a00d8075cb10c2c0',
  DJI: '0x57cff3a9a4d4c87b595a2d1bd1bac0240400a84677366d632ab838bbbe56f763',
  // More Crypto
  LINK: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  AVAX: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
  DOT: '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b',
  LTC: '0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54',
  UNI: '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
  PEPE: '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
  SHIB: '0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a',
  ATOM: '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
  RENDER: '0x3d4a2bd9535be6ce8059d75eadeba507b043257321aa544717c56fa19b49e35d',
  TAO: '0x410f41de235f2db824e562ea7ab2d3d3d4ff048316c61d629c0b93f58584e1af',
  INJ: '0x7a5bc1d2b56ad029048cd63964b3ad2776eadf812edc1a43a31406cb54bff592',
  KAS: '0xdfd3cb51a9d39fde35a3ff6177b426def03ed48d45008248f22827d8bf50cab4',
  FET: '0x7da003ada32eabbac855af3d22fcf0fe692cc589f0cfd5ced63cf0bdcc742efe',
  FIL: '0x150ac9b959aee0051e4091f0ef5216d941f590e1c5e7f91cf7635b5c11628c0e',
  AR: '0xf610eae82767039ffc95eef8feaeddb7bbac0673cfe7773b2fde24fd1adb0aee',
  STX: '0x0b7fc35cea4acfa65e49a718292e0b31b453072e3af39afbfd2925da5c3ab65d',
  HBAR: '0x3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd',
  ICP: '0xc9907d786c5821547777780a1e4f89484f3417cb14dd244f2b0a34ea7a554d67',
  VET: '0x1722176f738aa1aafea170f8b27724042c5ac6d8cb9cf8ae02d692b0927e0681',
  OP: '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
  BONK: '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  ARB: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
  SNX: '0x39d020f60982ed892abbcd4a06a276a9f9b7bfbce003204c110b6e488f502da3',
  AAVE: '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445',
  GRT: '0x4d1f8dae0d96236fb98e8f47471a366ec3b1732b47041781934ca3a9bb2f35e7',
  THETA: '0xee70804471fe22d029ac2d2b00ea18bbf4fb062958d425e5830fd25bed430345',
  ALGO: '0xfa17ceaf30d19ba51112fdcc750cc83454776f47fb0112e4af07f15f4bb1ebc0',
  EGLD: '0xee326a761a4b53629a29fc64bf47dda18cb2eea0bef22da7144dbdc130d112fc',
  FLOW: '0x2fb245b9a84554a0f15aa123cbb5f64cd263b59e9a87d80148cbffab50c69f30',
  // More Stocks
  AMD: '0x7178689d88cdd76574b64438fc57f4e57efaf0bf5f9593ee19c10e46a3c5b5cf',
  BABA: '0xffeec5e9688e8ab6c2d436981931a654c1d19ac6e69738d703fac6994acb1efa',
  DIS: '0x703e36203020ae6761e6298975764e266fb869210db9b35dd4e4225fa68217d0',
  JPM: '0x5f451bbe32545c6a157f547182878c4f3e00abd6a785db921761309180606f5a',
  V: '0xc719eb7bab9b2bc060167f1d1680eb34a29c490919072513b545b9785b73ee90',
  MA: '0x639db3fe6951d2465bd722768242e68eb0285f279cb4fa97f677ee8f80f1f1c0',
  PYPL: '0x773c3b11f6be58e8151966a9f5832696d8cd08884ccc43ac8965a7ebea911533',
  COIN: '0x5c3bd92f2eed33779040caea9f82fac705f5121d26251f8f5e17ec35b9559cd4',
  MSTR: '0xd8b856d7e17c467877d2d947f27b832db0d65b362ddb6f728797d46b0a8b54c0',
  UBER: '0xc04665f62a0eabf427a834bb5da5f27773ef7422e462d40c7468ef3e4d39d8f1',
  PLTR: '0x3a4c922ec7e8cd86a6fa4005827e723a134a16f4ffe836eac91e7820c61f75a1',
  CRM: '0xfeff234600320f4d6bb5a01d02570a9725c1e424977f2b823f7231e6857bdae8',
  INTC: '0xc13d72c7cc29fc43ee51ff322803aaffd04611756e4e1a6ea03ed8d97d5602a3',
  TSM: '0x6ad383437975189ea6ff0efad3de790d34ff36091a5a24c965e5f047a5de45de',

} as const;

export const CUSTOM_TOKENS = {
  BYNOMO: 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS'
} as const;

export type AssetType = keyof typeof PRICE_FEED_IDS | keyof typeof CUSTOM_TOKENS;

// Pyth prices are fetched through our backend route so Pro keys never reach the browser.
const PYTH_INTERNAL_ENDPOINT = '/api/pyth/latest';

// Cache the last successful multi-asset snapshot so the UI can render even if Hermes is slow.
let lastAllPricesCache: Record<string, number> = {};
const PRICE_CACHE_STORAGE_KEY = 'bynomo_last_price_cache_v1';

// Hydrate cache from localStorage (client-side only) to avoid long loader waits.
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(PRICE_CACHE_STORAGE_KEY);
    if (raw) lastAllPricesCache = JSON.parse(raw) as Record<string, number>;
  } catch {
    // Ignore cache errors and fall back to empty cache.
  }
}

export interface PriceData {
  price: number;
  confidence: number;
  timestamp: number;
  expo: number;
}

export class PythPriceFeed {
  private intervalId: NodeJS.Timeout | null = null;
  private lastPrice: number | null = null;
  private isRunning: boolean = false;
  private asset: AssetType;

  constructor(asset: AssetType = 'BTC') {
    this.asset = asset;
  }

  /**
   * Fetch current price from Pyth Network or Custom APIs
   */
  async fetchPrice(): Promise<PriceData> {
    try {
      if (this.asset === 'BYNOMO') {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CUSTOM_TOKENS.BYNOMO}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error('DexScreener API error');
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const priceUsd = parseFloat(data.pairs[0].priceUsd);
          this.lastPrice = priceUsd;
          return {
            price: priceUsd,
            confidence: 0,
            timestamp: Date.now() / 1000,
            expo: -8
          };
        }
        throw new Error('No pairs found for BYNOMO');
      }

      const endpoint =
        typeof window === 'undefined'
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${PYTH_INTERNAL_ENDPOINT}`
          : PYTH_INTERNAL_ENDPOINT;
      const response = await fetch(`${endpoint}?asset=${encodeURIComponent(this.asset)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const payload = await response.json();
      const price = Number(payload?.prices?.[this.asset]);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`No price data received for ${this.asset}`);
      }

      this.lastPrice = price;

      return {
        price,
        confidence: 0,
        timestamp: Date.now() / 1000,
        expo: -8
      };
    } catch (error) {
      console.error(`Error fetching ${this.asset} price:`, error);
      if (this.lastPrice !== null) {
        return {
          price: this.lastPrice,
          confidence: 0,
          timestamp: Date.now() / 1000,
          expo: -8
        };
      }
      // Fallback to last-known multi-asset cache if available.
      const cached = lastAllPricesCache[this.asset as string];
      if (cached && cached > 0) {
        return {
          price: cached,
          confidence: 0,
          timestamp: Date.now() / 1000,
          expo: -8
        };
      }
      throw error;
    }
  }

  setAsset(asset: AssetType): void {
    this.asset = asset;
    this.lastPrice = null;
  }

  getAsset(): AssetType {
    return this.asset;
  }

  async start(callback: (price: number, data: PriceData) => void): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const priceData = await this.fetchPrice();
      callback(priceData.price, priceData);
    } catch (err) { }
    this.intervalId = setInterval(async () => {
      try {
        const priceData = await this.fetchPrice();
        callback(priceData.price, priceData);
      } catch (err) { }
    }, 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  static async fetchAllPrices(): Promise<Record<string, number>> {
    const symbols = Object.keys(PRICE_FEED_IDS) as string[];
    const results: Record<string, number> = {};

    try {
      const endpoint =
        typeof window === 'undefined'
          ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${PYTH_INTERNAL_ENDPOINT}`
          : PYTH_INTERNAL_ENDPOINT;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: symbols }),
        signal: AbortSignal.timeout(6_000),
      });
      if (response.ok) {
        const payload = await response.json();
        const prices = payload?.prices || {};
        for (const sym of symbols) {
          const px = Number(prices[sym]);
          if (Number.isFinite(px) && px > 0) results[sym] = px;
        }
      }

      // 2. BYNOMO (DexScreener)
      try {
        const bynomoRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CUSTOM_TOKENS.BYNOMO}`, {
          signal: AbortSignal.timeout(5000) // 5s timeout
        });
        if (bynomoRes.ok) {
          const data = await bynomoRes.json();
          if (data.pairs && data.pairs.length > 0) {
            results.BYNOMO = parseFloat(data.pairs[0].priceUsd);
          }
        }
      } catch (tokenErr) {
        // Quietly fail for custom tokens to avoid console spam
      }
    } catch (err) {
      console.error('Error in fetchAllPrices:', err);
      // If Hermes fails, return last known prices so the chart can render.
      return lastAllPricesCache;
    }

    // Update cache when we have some data.
    if (Object.keys(results).length > 0) {
      lastAllPricesCache = { ...lastAllPricesCache, ...results };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(PRICE_CACHE_STORAGE_KEY, JSON.stringify(lastAllPricesCache));
        } catch {
          // Ignore storage write failures (private mode, quota, etc.)
        }
      }
    }

    // If Pyth returns nothing, fall back to last known snapshot.
    return Object.keys(results).length > 0 ? results : lastAllPricesCache;
  }

  getLastPrice(): number | null {
    return this.lastPrice;
  }
}

export const startMultiPythPriceFeed = (
  callback: (prices: Record<string, number>) => void
): (() => void) => {
  let isActive = true;
  /** Prevents overlapping Hermes batch calls (stacked requests → timeouts / canceled rows on mobile). */
  let inFlight = false;

  const run = async () => {
    if (!isActive || inFlight) return;
    inFlight = true;
    try {
      const prices = await PythPriceFeed.fetchAllPrices();
      if (isActive) callback(prices);
    } catch {
      // fetchAllPrices already falls back to cache
    } finally {
      inFlight = false;
    }
  };

  void run();
  const intervalId = setInterval(() => {
    void run();
  }, 1000);

  return () => {
    isActive = false;
    clearInterval(intervalId);
  };
};

export const startPythPriceFeed = (
  callback: (price: number, data: PriceData) => void,
  asset: AssetType = 'BTC'
): (() => void) => {
  const feed = new PythPriceFeed(asset);
  feed.start(callback);
  return () => feed.stop();
};

export const fetchPrice = async (asset: AssetType = 'BTC'): Promise<PriceData> => {
  const feed = new PythPriceFeed(asset);
  return await feed.fetchPrice();
};

export const fetchBTCPrice = async (): Promise<PriceData> => fetchPrice('BTC');

export class MockPriceFeed {
  private basePrice: number;
  private volatility: number;
  private trend: number;
  private intervalId: NodeJS.Timeout | null = null;
  private asset: AssetType;

  constructor(asset: AssetType = 'BTC', basePrice?: number, volatility: number = 0.001, trend: number = 0) {
    this.asset = asset;
    const defaults: Record<string, number> = { BTC: 50000, BNB: 600, BYNOMO: 0.1 };
    this.basePrice = basePrice || defaults[asset] || 1;
    this.volatility = volatility;
    this.trend = trend;
  }

  setAsset(asset: AssetType): void {
    this.asset = asset;
    const defaults: Record<string, number> = { BTC: 50000, BNB: 600, BYNOMO: 0.1 };
    this.basePrice = defaults[asset] || 1;
  }

  getAsset(): AssetType { return this.asset; }

  private generateNextPrice(currentPrice: number): number {
    const change = currentPrice * this.volatility * (Math.random() - 0.5) * 2 + this.trend;
    return currentPrice + change;
  }

  start(callback: (price: number) => void): void {
    let currentPrice = this.basePrice;
    callback(currentPrice);
    this.intervalId = setInterval(() => {
      currentPrice = this.generateNextPrice(currentPrice);
      callback(currentPrice);
    }, 1000);
  }

  stop(): void { if (this.intervalId) clearInterval(this.intervalId); }
}

export const startMockPriceFeed = (
  callback: (price: number) => void,
  options?: { asset?: AssetType; basePrice?: number; volatility?: number; trend?: number }
): (() => void) => {
  const feed = new MockPriceFeed(options?.asset || 'BTC', options?.basePrice, options?.volatility, options?.trend);
  feed.start(callback);
  return () => feed.stop();
};
