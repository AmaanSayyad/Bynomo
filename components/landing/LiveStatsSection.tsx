'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  BarChart3,
  TrendingUp,
  Wallet,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PublicStats {
  totalBets: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalWagered: number;
  totalPaidOut: number;
  uniqueWallets: number;
  chainsActive: number;
  totalDeposits: number;
  topCurrencies: { currency: string; wagered: number; paid: number; count: number }[];
}

// ─── Animated Counter ───────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1800, started = false) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!started || target === 0) return;
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration, started]);

  return value;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  accent: string;
  accentSoft: string;
  phase: string;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  description: string;
  icon: LucideIcon;
  index: number;
  started: boolean;
  children?: React.ReactNode;
}

function StatCard({
  accent, accentSoft, phase, label, value, prefix = '', suffix = '', decimals = 0,
  description, icon: Icon, index, started, children,
}: StatCardProps) {
  const count = useCountUp(value, 1600, started);
  const display = decimals > 0
    ? (count / Math.pow(10, decimals)).toFixed(decimals)
    : fmt(count);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      <article
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0b12]/90 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-[transform,border-color,box-shadow] duration-300 lg:rounded-3xl lg:p-7 lg:hover:-translate-y-1 lg:hover:border-white/[0.13] lg:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_32px_70px_-36px_rgba(0,0,0,0.95)]"
      >
        {/* Corner glow */}
        <div
          className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
          style={{ background: accent }}
          aria-hidden
        />
        {/* Subtle inner light */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent"
          aria-hidden
        />
        {/* Left accent bar */}
        <div
          className="absolute bottom-6 left-0 top-6 w-[3px] rounded-full"
          style={{
            background: `linear-gradient(180deg, ${accent}, ${accent}55)`,
            boxShadow: `0 0 18px ${accentSoft}`,
          }}
          aria-hidden
        />

        <div className="relative z-[1] flex flex-1 flex-col gap-5 pl-5">
          {/* Top row: icon + phase label */}
          <div className="flex items-center justify-between gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] transition-transform duration-300 group-hover:scale-[1.06]"
              style={{
                backgroundColor: accentSoft,
                boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.09), 0 8px 24px -8px ${accent}`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.7} aria-hidden />
            </div>

            <span
              className="inline-flex rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] ring-1 ring-inset ring-white/[0.07]"
              style={{ backgroundColor: accentSoft, color: accent }}
            >
              {phase}
            </span>
          </div>

          {/* Big number */}
          <div>
            <div
              className="font-black leading-none tabular-nums text-white"
              style={{
                fontFamily: 'var(--font-orbitron), monospace',
                fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                textShadow: `0 0 40px ${accent}50`,
              }}
            >
              {prefix && (
                <span className="text-[0.6em] font-extrabold" style={{ color: accent }}>
                  {prefix}
                </span>
              )}
              {display}
              {suffix && (
                <span className="ml-1 text-[0.55em] font-extrabold" style={{ color: accent }}>
                  {suffix}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[13px] font-semibold tracking-tight text-white/40">
              {label}
            </p>
          </div>

          {/* Custom children (e.g. bar) */}
          {children}

          {/* Description */}
          <p className="mt-auto text-[12px] leading-[1.65] text-white/40 sm:text-[13px]">
            {description}
          </p>
        </div>

        {/* Bottom edge shine on hover */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        />
      </article>
    </motion.div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

const CARDS = [
  {
    key: 'trades',
    phase: 'TRADE VOLUME',
    label: 'Total Rounds Played',
    prefix: '',
    suffix: '',
    accent: '#3b82f6',
    accentSoft: 'rgba(59,130,246,0.13)',
    icon: BarChart3,
    description: 'Every prediction round resolved on-chain across all supported assets and chains.',
  },
  {
    key: 'chains',
    phase: 'MULTI-CHAIN',
    label: 'Chains Supported',
    prefix: '',
    suffix: '+',
    accent: '#a855f7',
    accentSoft: 'rgba(168,85,247,0.13)',
    icon: Zap,
    description: 'Trade across BNB Chain, Solana, Sui, Starknet, Push Chain, and more — one platform, every chain.',
  },
  {
    key: 'payouts',
    phase: 'WINNING ROUNDS',
    label: 'Rounds Won',
    prefix: '',
    suffix: '',
    accent: '#10b981',
    accentSoft: 'rgba(16,185,129,0.13)',
    icon: TrendingUp,
    description: 'Number of rounds where the trader predicted correctly and received a payout.',
  },
  {
    key: 'deposits',
    phase: 'TREASURY FLOW',
    label: 'Deposits Processed',
    prefix: '',
    suffix: '',
    accent: '#f59e0b',
    accentSoft: 'rgba(245,158,11,0.13)',
    icon: Wallet,
    description: 'On-chain deposit transactions confirmed and credited to house balances.',
  },
  {
    key: 'wallets',
    phase: 'COMMUNITY',
    label: 'Unique Traders',
    prefix: '',
    suffix: '',
    accent: '#06b6d4',
    accentSoft: 'rgba(6,182,212,0.13)',
    icon: Users,
    description: `Distinct wallets that have deposited or placed a real-money round on the platform.`,
  },
] as const;

export default function LiveStatsSection() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.15 });

  useEffect(() => {
    fetch('/api/stats/public')
      .then(r => r.json())
      .then(setStats)
      .catch(() => null);
  }, []);

  const s = stats ?? {
    totalBets: 0, totalWins: 0, totalLosses: 0, winRate: 0,
      totalWagered: 0, totalPaidOut: 0, uniqueWallets: 0,
      chainsActive: 12, totalDeposits: 0, totalWithdrawals: 0,
      topCurrencies: [],
    };

  const cardValues: Record<string, number> = {
    trades:   s.totalBets,
    chains:   s.chainsActive,
    payouts:  s.totalWins,
    deposits: s.totalDeposits,
    wallets:  s.uniqueWallets,
  };

  const started = inView && stats !== null;

  return (
    <section
      ref={sectionRef}
      className="relative border-t border-white/[0.05] bg-[#02040a]"
      aria-labelledby="stats-heading"
    >
      {/* Background ambiance */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-600/[0.04] blur-[140px]" />
        <div className="absolute -bottom-40 left-0 h-[400px] w-[500px] rounded-full bg-purple-600/[0.04] blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[400px] w-[500px] rounded-full bg-emerald-600/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-28 sm:px-10 lg:py-36">

        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 sm:mb-16 lg:mb-20"
        >
          <p className="mb-4 font-mono text-[10px] font-black uppercase tracking-[0.35em] text-white/25">
            ● Protocol Analytics
          </p>
          <h2
            id="stats-heading"
            className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
            style={{ fontFamily: 'var(--font-orbitron), system-ui, sans-serif' }}
          >
            Platform{' '}
            <span
              className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Intelligence
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/45">
            Real-time metrics sourced directly from the BYNOMO protocol. Every number is backed by on-chain data.
          </p>
        </motion.div>

        {/* 5 stat cards — top row 3, bottom row 2 */}
        <div className="space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
            {CARDS.slice(0, 3).map((card, i) => (
              <StatCard
                key={card.key}
                index={i}
                accent={card.accent}
                accentSoft={card.accentSoft}
                phase={card.phase}
                label={card.label}
                prefix={card.prefix}
                suffix={card.suffix}
                icon={card.icon}
                description={card.description}
                started={started}
                value={cardValues[card.key]}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:gap-7">
            {CARDS.slice(3).map((card, i) => (
              <StatCard
                key={card.key}
                index={i + 3}
                accent={card.accent}
                accentSoft={card.accentSoft}
                phase={card.phase}
                label={card.label}
                prefix={card.prefix}
                suffix={card.suffix}
                icon={card.icon}
                description={card.description}
                started={started}
                value={cardValues[card.key]}
              />
            ))}
          </div>
        </div>

        {/* Footnote */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 text-center text-[11px] font-medium tracking-wide text-white/20"
        >
          Updated every 5 minutes from on-chain protocol data · Demo bets excluded
        </motion.p>
      </div>
    </section>
  );
}
