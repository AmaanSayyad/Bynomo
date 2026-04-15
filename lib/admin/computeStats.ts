/**
 * Shared stats computation used by both:
 *   - /api/admin/stats  (authenticated, full details)
 *   - /api/stats/public (public, aggregate-only, cached)
 *
 * Single source of truth — numbers on the public dashboard always
 * match the admin dashboard exactly.
 */

import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { normalizeWalletForBanKey } from '@/lib/bans/walletBan';

const PAGE = 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NetworkPnLRow {
  volume: number;
  payout: number;
  platformPnL: number;
}

export interface ModeStats {
  totalBets: number;
  totalVolume: number;
  totalPayout: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  platformPnL: number;
  platformPnLByNetwork: Record<string, NetworkPnLRow>;
  totalUsers: number;
  totalReferrals: number;
  averageSessionSeconds: number;
  sessionSampleCount: number;
}

export interface CurrencyStat {
  totalBalance: number;
  userCount: number;
}

export interface PlatformStats {
  real: ModeStats;
  demo: ModeStats;
  currencyStats: Record<string, CurrencyStat>;
  totalDeposits: number;
  totalWithdrawals: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const isDemoWallet = (w: string | null | undefined) =>
  !!w && w.toLowerCase().startsWith('0xdemo');
const isDemoBetId = (id: string | null | undefined) =>
  !!id && String(id).toLowerCase().startsWith('demo-');
const isDemo = (b: { id?: any; wallet_address?: any }) =>
  isDemoWallet(b.wallet_address) || isDemoBetId(b.id);

async function fetchAllBets() {
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('bet_history')
      .select('id, wallet_address, amount, payout, won, network')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`bet_history: ${error.message}`);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function fetchAllSessions() {
  const rows: { wallet_address: string; started_at: string; last_ping_at: string; ended_at: string | null }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('wallet_address, started_at, last_ping_at, ended_at')
      .order('started_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`user_sessions: ${error.message}`);
    const chunk = data ?? [];
    rows.push(...(chunk as typeof rows));
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function fetchAllAuditLogs() {
  const rows: { operation_type: string }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('balance_audit_log')
      .select('operation_type')
      .in('operation_type', ['deposit', 'withdrawal'])
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`balance_audit_log: ${error.message}`);
    const chunk = data ?? [];
    rows.push(...(chunk as typeof rows));
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function aggregateByNetwork(rows: any[]): Record<string, NetworkPnLRow> {
  const m: Record<string, NetworkPnLRow> = {};
  for (const r of rows) {
    const net = String(r.network ?? 'UNKNOWN').trim() || 'UNKNOWN';
    if (!m[net]) m[net] = { volume: 0, payout: 0, platformPnL: 0 };
    m[net].volume += Number(r.amount ?? 0);
    m[net].payout += Number(r.payout ?? 0);
  }
  for (const k of Object.keys(m)) {
    m[k].platformPnL = m[k].volume - m[k].payout;
  }
  return m;
}

const SESSION_IDLE_TAIL_MS = 90_000;
const SESSION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_MAX_SECONDS = 4 * 60 * 60; // cap per-session dwell at 4h
function sessionDurationSeconds(
  row: { started_at: string; last_ping_at: string; ended_at: string | null },
  nowMs: number,
): number {
  const end = row.ended_at
    ? new Date(row.ended_at).getTime()
    : Math.min(new Date(row.last_ping_at).getTime() + SESSION_IDLE_TAIL_MS, nowMs);
  return Math.max(0, Math.floor((end - new Date(row.started_at).getTime()) / 1000));
}

function buildModeStats(
  bets: any[],
  userKeys: Set<string>,
  totalReferrals: number,
  avgSessionSec: number,
  sessionCount: number,
): ModeStats {
  const totalBets   = bets.length;
  const totalWins   = bets.filter(b => b.won).length;
  const totalLosses = totalBets - totalWins;
  const totalVolume = bets.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const totalPayout = bets.reduce((s, b) => s + Number(b.payout ?? 0), 0);
  return {
    totalBets,
    totalVolume,
    totalPayout,
    totalWins,
    totalLosses,
    winRate: totalBets > 0 ? Math.round((totalWins / totalBets) * 1000) / 10 : 0,
    platformPnL: totalVolume - totalPayout,
    platformPnLByNetwork: aggregateByNetwork(bets),
    totalUsers: userKeys.size,
    totalReferrals,
    averageSessionSeconds: avgSessionSec,
    sessionSampleCount: sessionCount,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function computePlatformStats(): Promise<PlatformStats> {
  const norm = (a: string) => normalizeWalletForBanKey(String(a));

  // Parallel: bets + sessions + balances + referrals + banned + audit
  const [allBets, balanceData, walletAddressRows, referralRows, bannedRows, auditRows] = await Promise.all([
    fetchAllBets(),
    supabase.from('user_balances').select('currency, balance'),
    supabase.from('user_balances').select('user_address'),
    supabase.from('user_referrals').select('user_address, referral_count'),
    supabase.from('banned_wallets').select('wallet_address'),
    fetchAllAuditLogs(),
  ]);

  // ── Split bets ────────────────────────────────────────────────────────────
  const demoBets = allBets.filter(isDemo);
  const realBets = allBets.filter(b => !isDemo(b));

  // ── User sets ─────────────────────────────────────────────────────────────
  // Include: wallets from bet_history + all wallets in user_balances (deposited
  // but not yet bet) + banned wallets — so the count reflects every wallet that
  // has ever interacted with the platform, not just those that placed a bet.
  const demoUserKeys = new Set(
    demoBets.map(b => b.wallet_address).filter(Boolean).map(norm),
  );
  const realUserKeys = new Set(
    realBets.map(b => b.wallet_address).filter(Boolean).map(norm),
  );
  // Add all wallets that exist in user_balances (deposited users)
  for (const row of walletAddressRows.data ?? []) {
    const w = (row as any).user_address;
    if (!w) continue;
    (isDemoWallet(w) ? demoUserKeys : realUserKeys).add(norm(w));
  }
  // Add banned wallets
  for (const row of bannedRows.data ?? []) {
    const w = (row as any).wallet_address;
    if (!w) continue;
    (isDemoWallet(w) ? demoUserKeys : realUserKeys).add(norm(w));
  }

  // ── Referrals ─────────────────────────────────────────────────────────────
  const referrals = referralRows.data ?? [];
  const demoReferrals = referrals
    .filter(r => isDemoWallet((r as any).user_address))
    .reduce((s, r) => s + Number((r as any).referral_count ?? 0), 0);
  const realReferrals = referrals
    .filter(r => !isDemoWallet((r as any).user_address))
    .reduce((s, r) => s + Number((r as any).referral_count ?? 0), 0);

  // ── Sessions ──────────────────────────────────────────────────────────────
  let avgReal = 0, avgDemo = 0, countReal = 0, countDemo = 0;
  try {
    const sessions = await fetchAllSessions();
    const nowMs = Date.now();
    const lookbackCutoffMs = nowMs - SESSION_LOOKBACK_MS;
    let sumReal = 0, sumDemo = 0;
    for (const s of sessions) {
      const startedAtMs = new Date(s.started_at).getTime();
      if (!Number.isFinite(startedAtMs) || startedAtMs < lookbackCutoffMs) continue;

      const secRaw = sessionDurationSeconds(s, nowMs);
      if (secRaw <= 0) continue;
      const sec = Math.min(secRaw, SESSION_MAX_SECONDS);

      if (isDemoWallet(s.wallet_address)) { sumDemo += sec; countDemo++; }
      else { sumReal += sec; countReal++; }
    }
    avgReal = countReal > 0 ? sumReal / countReal : 0;
    avgDemo = countDemo > 0 ? sumDemo / countDemo : 0;
  } catch (e: any) {
    console.warn('[computeStats] user_sessions:', e?.message ?? e);
  }

  // ── Currency balances ─────────────────────────────────────────────────────
  const currencyStats: Record<string, CurrencyStat> = {};
  for (const b of balanceData.data ?? []) {
    if (!currencyStats[b.currency]) currencyStats[b.currency] = { totalBalance: 0, userCount: 0 };
    currencyStats[b.currency].totalBalance += Number(b.balance);
    currencyStats[b.currency].userCount    += 1;
  }

  // ── Deposit / withdrawal counts ────────────────────────────────────────────
  const totalDeposits    = auditRows.filter(r => r.operation_type === 'deposit').length;
  const totalWithdrawals = auditRows.filter(r => r.operation_type === 'withdrawal').length;

  return {
    real: buildModeStats(realBets, realUserKeys, realReferrals, avgReal, countReal),
    demo: buildModeStats(demoBets, demoUserKeys, demoReferrals, avgDemo, countDemo),
    currencyStats,
    totalDeposits,
    totalWithdrawals,
  };
}
