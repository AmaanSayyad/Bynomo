'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const PARTNER_LOGOS = [
  { key: 'BNB', src: '/logos/bnb-bnb-logo.png', alt: 'BNB Chain' },
  { key: 'PUSH', src: '/logos/push-logo.png', alt: 'Push Chain' },
  { key: 'SOL', src: '/logos/solana-sol-logo.png', alt: 'Solana' },
  { key: 'YZI', src: '/logos/yzilabs.jpg', alt: 'YZi Labs' },
  { key: 'YC', src: '/logos/Y-Combinator.png', alt: 'Y Combinator' },
  { key: 'NITRO', src: '/logos/nitro.svg', alt: 'Nitro' },
  { key: 'ALLIANCE', src: '/logos/alliance.jpg', alt: 'Alliance' },
];

/**
 * Full-width scrolling marquee for confirmed partnerships.
 * Reuses the logos-marquee-* CSS classes from waitlist.css.
 */
export function PartnershipsRevealSection() {
  // Repeat 8× before doubling so the row fills any viewport width.
  const trackItems = useMemo(
    () => {
      const repeated = Array.from({ length: 8 }, () => PARTNER_LOGOS).flat();
      return [...repeated, ...repeated]; // doubled for seamless loop
    },
    [],
  );

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mb-8 max-w-6xl px-4 sm:px-6 lg:px-8"
      >
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/push-bynomo-partnership-banner.png"
            alt="Bynomo and Push Chain partnership announcement banner"
            className="block w-full h-auto"
          />
        </div>
      </motion.div>

      {/* Sub-heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 px-4 text-center sm:mb-8 sm:px-6 lg:px-8"
      >
        <div className="mb-2 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.28em] text-white/25 sm:text-[10px]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          Strategic alliances · confirmed
        </div>
        <h3
          className="text-xl font-black uppercase tracking-tight text-white sm:text-2xl lg:text-3xl"
          style={{ fontFamily: 'var(--font-orbitron)' }}
        >
          Partnerships
        </h3>
      </motion.div>

      {/* Marquee row — same classes as LogosMarqueeSection */}
      <div
        className="logos-marquee-row"
        aria-label="Partner logos: BNB Chain, Push Chain, Solana"
      >
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#02040a] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#02040a] to-transparent" />

        <div
          className="logos-marquee-track partner-marquee-track"
          style={{ '--logos-marquee-duration': '60s' } as React.CSSProperties}
        >
          {trackItems.map((l, i) => (
            <div key={`${l.key}-${i}`} className="logos-marquee-tile partner-logo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.src} alt={l.alt} className="logos-marquee-img" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
