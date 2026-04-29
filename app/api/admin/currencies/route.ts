import { NextRequest, NextResponse } from 'next/server';
import { PRICE_FEED_IDS } from '@/lib/utils/priceFeed';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';
import { fetchPythLatestPrices } from '@/lib/server/pythLatest';

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

        const currentPrices = await fetchPythLatestPrices(Object.keys(PRICE_FEED_IDS));

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
