import { NextRequest, NextResponse } from 'next/server';
import { PRICE_FEED_IDS } from '@/lib/utils/priceFeed';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';

export async function GET(request: NextRequest) {
    const deny = requireAdminAuth(request);
    if (deny) return deny;
    try {
        const forexTokens = new Set(['EUR', 'GBP', 'JPY', 'AUD', 'CAD']);
        const metalsTokens = new Set(['GOLD', 'SILVER']);
        const commoditiesTokens = new Set(['WTI', 'BRENT', 'SPX', 'NDX', 'DJI']);
        const stocksTokens = new Set([
            'AAPL', 'GOOGL', 'AMZN', 'MSFT', 'NVDA', 'TSLA', 'META', 'NFLX',
            'AMD', 'BABA', 'DIS', 'JPM', 'V', 'MA', 'PYPL', 'COIN', 'MSTR', 'UBER', 'PLTR', 'CRM', 'INTC', 'TSM',
        ]);

        const tokens = Object.entries(PRICE_FEED_IDS).map(([symbol, id]) => {
            let category = 'Crypto';
            if (forexTokens.has(symbol)) category = 'Forex';
            else if (metalsTokens.has(symbol)) category = 'Metals';
            else if (stocksTokens.has(symbol)) category = 'Stocks';
            else if (commoditiesTokens.has(symbol)) category = 'Commodities';

            return { symbol, pythId: id, category };
        });

        // 2. Fetch current prices for all from Pyth Hermes
        const ids = Object.values(PRICE_FEED_IDS).map(id => id.startsWith('0x') ? id : `0x${id}`);
        const queryString = ids.map(id => `ids%5B%5D=${id}`).join('&');
        const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?${queryString}`);

        let currentPrices: Record<string, number> = {};
        if (response.ok) {
            const priceData = await response.json();
            priceData.parsed?.forEach((feed: any) => {
                // Find which symbol this ID belongs to
                const symbol = Object.keys(PRICE_FEED_IDS).find(
                    s => PRICE_FEED_IDS[s as keyof typeof PRICE_FEED_IDS].replace('0x', '') === feed.id
                );
                if (symbol) {
                    const price = Number(feed.price.price) * Math.pow(10, feed.price.expo);
                    currentPrices[symbol] = price;
                }
            });
        }

        return NextResponse.json({
            tokens: tokens.map(t => ({
                ...t,
                price: currentPrices[t.symbol] || 0
            })),
            totalTokens: tokens.length
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
