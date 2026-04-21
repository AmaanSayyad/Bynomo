'use client';

import React from 'react';

const DEXSCREENER_PAIR_URL = 'https://dexscreener.com/solana/7aucpepeiykpwzxe1y9hl3c1qj13d1en3dsxlcps9zum';
const DEXSCREENER_EMBED_URL =
  'https://dexscreener.com/solana/7AucPepeiykPwZXe1y9HL3c1QJ13D1eN3dsxLcPs9zum' +
  '?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15';

export default function DexscreenerEmbedSection() {
  return (
    <section className="dexscreener-section">
      <div className="section-content dexscreener-content">
        <div className="dexscreener-header">
          <div className="dexscreener-kicker">
            <span className="dexscreener-kicker-dot" />
            $BYNOMO live on Dexscreener
          </div>

          <div className="dexscreener-title-row">
            <h2 className="dexscreener-title">
              BYNOMO / SOL <span className="dexscreener-title-muted">· Solana · Meteora</span>
            </h2>

            <a
              className="dexscreener-cta"
              href={DEXSCREENER_PAIR_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              View chart
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>

          <p className="dexscreener-subtitle">
            Real-time chart, liquidity, and trade activity for the $BYNOMO pair.
          </p>
        </div>

        <div className="dexscreener-embed">
          <iframe
            src={DEXSCREENER_EMBED_URL}
            title="Dexscreener chart: BYNOMO/SOL"
            allow="clipboard-write; fullscreen"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </section>
  );
}

