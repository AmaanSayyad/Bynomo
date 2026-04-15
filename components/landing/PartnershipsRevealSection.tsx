'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function PartnershipsRevealSection() {
  return (
    <div className="relative z-10 w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8"
      >
        <a
          href="https://x.com/bynomofun/status/2044394325547872432?s=20"
          target="_blank"
          rel="noopener noreferrer"
          className="advisor-card block"
          style={{ cursor: 'pointer' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/push-bynomo-partnership-banner.png"
            alt="Bynomo × Push Chain — confirmed strategic partnership"
            className="advisor-card-photo"
          />

          {/* Confirmed badge */}
          <div className="advisor-card-badge">
            <span className="advisor-card-badge-dot" />
            Confirmed
          </div>

          {/* View on X hint */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white/60">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            View on X
          </div>
        </a>
      </motion.div>
    </div>
  );
}
