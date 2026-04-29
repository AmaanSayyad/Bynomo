'use client';

import React from 'react';
import { motion } from 'framer-motion';

const DEMO_EMBED_SRC =
  'https://www.youtube.com/embed/_YWvJihlqfE?si=j6r-dwwiH3V49_ws';

export default function DemoVideoSection() {
  return (
    <section
      id="demo"
      className="relative border-t border-white/[0.06] bg-[#02040a] py-16 sm:py-20 lg:py-28 overflow-hidden"
      aria-labelledby="demo-heading"
    >
      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-6 sm:mb-8 lg:mb-10"
        >
          <div className="mb-3 sm:mb-4 flex items-center justify-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.2em] sm:tracking-[0.35em] text-white/25">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
            Product demo
          </div>
          <h2
            id="demo-heading"
            className="mb-3 sm:mb-4 text-2xl min-[400px]:text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white px-1"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            See <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/35">Bynomo</span> in action
          </h2>
          <p className="mx-auto max-w-xl text-[11px] sm:text-sm font-bold uppercase tracking-wide text-white/35 leading-relaxed">
            Walkthrough of the trading flow — from chart to bet — in under a few minutes.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full"
        >
          <div
            className="relative aspect-video w-full overflow-hidden rounded-2xl sm:rounded-3xl lg:rounded-[2rem] bg-black shadow-[0_32px_100px_-28px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
          >
            <iframe
              src={DEMO_EMBED_SRC}
              title="Bynomo demo — YouTube video player"
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/[0.07] blur-[100px]" />
    </section>
  );
}
