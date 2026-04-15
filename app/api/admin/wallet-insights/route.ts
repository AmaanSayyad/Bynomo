import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/serviceClient';
import { isWalletGloballyBanned } from '@/lib/bans/walletBan';
import {
  isDemoWalletAddress,
  walletAddressSearchVariants,
} from '@/lib/admin/walletAddressVariants';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';

const AUDIT_CAP = 15_000;
const BETS_CAP = 25_000;

/** Supabase/PostgREST errors are often plain objects, not `Error` — avoid showing generic "Unknown error". */
function messageFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function addTo(map: Record<string, number>, currency: string, n: number) {
  const c = currency || 'UNKNOWN';
  map[c] = (map[c] ?? 0) + n;
}

export async function GET(request: NextRequest) {
  const deny = requireAdminAuth(request);
  if (deny) return deny;
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('address') || '';
    const address = raw.trim();

    if (!address || address.length < 3) {
      return NextResponse.json({ error: 'Query param address is required (min 3 chars).' }, { status: 400 });
    }
    if (address.length > 256) {
      return NextResponse.json({ error: 'Address too long.' }, { status: 400 });
    }

    const variants = walletAddressSearchVariants(address);
    if (variants.length === 0) {
      return NextResponse.json({ error: 'Invalid address.' }, { status: 400 });
    }

    const bannedChecks = await Promise.all(variants.map(v => isWalletGloballyBanned(v)));
    const bannedGlobally = bannedChecks.some(Boolean);

    const [
      balRes,
      auditRes,
      betsRes,
      wdRes,
      profileRes,
      refRes,
      sessRes,
    ] = await Promise.all([
      // Explicit column selection to avoid exposing sensitive future columns
      supabaseService.from('user_balances').select('user_address, currency, balance, status, user_tier, updated_at, created_at').in('user_address', variants),
      supabaseService
        .from('balance_audit_log')
        .select(
          'id, user_address, currency, operation_type, amount, balance_before, balance_after, transaction_hash, bet_id, created_at',
        )
        .in('user_address', variants)
        .order('created_at', { ascending: false })
        .limit(AUDIT_CAP),
      supabaseService
        .from('bet_history')
        .select(
          'id, wallet_address, asset, direction, amount, multiplier, strike_price, end_price, payout, won, mode, network, resolved_at, created_at',
        )
        .in('wallet_address', variants)
        .order('created_at', { ascending: false })
        .limit(BETS_CAP),
      // Explicit column selection to avoid exposing sensitive future columns
      supabaseService
        .from('withdrawal_requests')
        .select('id, user_address, currency, amount, net_amount, fee_amount, requested_at, status, decided_by, tx_hash, notes, account_type, created_at')
        .in('user_address', variants)
        .order('requested_at', { ascending: false })
        .limit(500),
      supabaseService
        .from('user_profiles')
        .select('user_address, username, access_code, updated_at')
        .in('user_address', variants)
        .limit(1),
      // Explicit column selection to avoid exposing sensitive future columns
      supabaseService.from('user_referrals').select('id, user_address, referral_code, referral_count, referred_by, created_at, updated_at').in('user_address', variants).limit(1),
      supabaseService
        .from('user_sessions')
        .select('id, network, started_at, last_ping_at, ended_at')
        .in('wallet_address', variants)
        .order('started_at', { ascending: false })
        .limit(200),
    ]);

    if (balRes.error) throw balRes.error;
    if (auditRes.error) throw auditRes.error;
    if (betsRes.error) throw betsRes.error;
    if (wdRes.error) throw wdRes.error;
    if (profileRes.error) throw profileRes.error;
    if (refRes.error) throw refRes.error;
    // Sessions table may not exist yet — treat as empty rather than throwing
    const sessionRows = sessRes.error ? [] : (sessRes.data ?? []);

    // Compute dwell-time stats
    const now = Date.now();
    let totalSeconds = 0;
    for (const s of sessionRows) {
      const end = s.ended_at ? new Date(s.ended_at).getTime() : Math.min(new Date(s.last_ping_at).getTime() + 90_000, now);
      const start = new Date(s.started_at).getTime();
      totalSeconds += Math.max(0, Math.floor((end - start) / 1000));
    }
    const lastSeen = sessionRows.length > 0 ? sessionRows[0].last_ping_at : null;
    const firstSeen = sessionRows.length > 0 ? sessionRows[sessionRows.length - 1].started_at : null;
    function fmtDuration(s: number) {
      if (s <= 0) return '0s';
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : '', `${sec}s`].filter(Boolean).join(' ');
    }
    const timeOnPlatform = {
      totalSessions: sessionRows.length,
      totalSeconds,
      formatted: fmtDuration(totalSeconds),
      lastSeen,
      firstSeen,
      recentSessions: sessionRows.slice(0, 20).map(s => ({
        id: s.id,
        network: s.network,
        started_at: s.started_at,
        last_ping_at: s.last_ping_at,
        ended_at: s.ended_at ?? null,
        durationSeconds: Math.max(0, Math.floor(((s.ended_at ? new Date(s.ended_at).getTime() : Math.min(new Date(s.last_ping_at).getTime() + 90_000, now)) - new Date(s.started_at).getTime()) / 1000)),
      })),
    };

    const rawBalances = balRes.data ?? [];
    const mergedBal = new Map<string, (typeof rawBalances)[0]>();
    for (const b of rawBalances) {
      const cur = b.currency;
      const ex = mergedBal.get(cur);
      if (!ex || new Date(b.updated_at) > new Date(ex.updated_at)) mergedBal.set(cur, b);
    }
    const balances = [...mergedBal.values()];
    const auditRows = auditRes.data ?? [];
    const betRows = betsRes.data ?? [];
    const wdRows = wdRes.data ?? [];

    const totalDepositsByCurrency: Record<string, number> = {};
    const totalWithdrawalsByCurrency: Record<string, number> = {};
    let depositCount = 0;
    let withdrawalCount = 0;
    let betPlacedCount = 0;
    let payoutEventCount = 0;

    for (const row of auditRows) {
      const amt = Number(row.amount ?? 0);
      const cur = String(row.currency ?? 'BNB');
      const op = row.operation_type;
      if (op === 'deposit') {
        addTo(totalDepositsByCurrency, cur, amt);
        depositCount += 1;
      } else if (op === 'withdrawal') {
        addTo(totalWithdrawalsByCurrency, cur, amt);
        withdrawalCount += 1;
      } else if (op === 'bet_placed') {
        betPlacedCount += 1;
      } else if (op === 'payout') {
        payoutEventCount += 1;
      }
    }

    function aggregateBets(rows: typeof betRows) {
      let wins = 0;
      let losses = 0;
      let totalWagered = 0;
      let totalPayout = 0;
      const byNetwork: Record<
        string,
        { bets: number; wins: number; losses: number; wagered: number; payout: number; net: number }
      > = {};

      for (const b of rows) {
        const wager = Number(b.amount ?? 0);
        const pay = Number(b.payout ?? 0);
        const net = b.won ? pay - wager : -wager;
        totalWagered += wager;
        totalPayout += pay;
        if (b.won) wins += 1;
        else losses += 1;

        const netw = String(b.network ?? 'UNKNOWN');
        if (!byNetwork[netw]) {
          byNetwork[netw] = { bets: 0, wins: 0, losses: 0, wagered: 0, payout: 0, net: 0 };
        }
        const bn = byNetwork[netw];
        bn.bets += 1;
        if (b.won) bn.wins += 1;
        else bn.losses += 1;
        bn.wagered += wager;
        bn.payout += pay;
        bn.net += net;
      }

      const totalBets = rows.length;
      const netBettingPLUser = totalPayout - totalWagered;
      const winRate = totalBets > 0 ? wins / totalBets : 0;

      return {
        totalBets,
        wins,
        losses,
        totalWagered,
        totalPayoutReceived: totalPayout,
        netBettingPLUser,
        winRate,
        byNetwork,
      };
    }

    const realBets = betRows.filter(b => !isDemoWalletAddress(b.wallet_address));
    const demoBets = betRows.filter(b => isDemoWalletAddress(b.wallet_address));

    const bettingAll = aggregateBets(betRows);
    const bettingReal = aggregateBets(realBets);
    const bettingDemo = aggregateBets(demoBets);

    const pendingWithdrawals = wdRows.filter(w => w.status === 'pending');
    const acceptedWithdrawals = wdRows.filter(w => w.status === 'accepted');
    const rejectedWithdrawals = wdRows.filter(w => w.status === 'rejected');

    /** Current house balance — withdrawable if status active and not globally banned */
    const withdrawableByCurrency: Record<string, number> = {};
    const balanceRowsOut = balances.map(b => {
      const cur = b.currency;
      const bal = Number(b.balance ?? 0);
      const can =
        !bannedGlobally && b.status === 'active' ? bal : 0;
      withdrawableByCurrency[cur] = (withdrawableByCurrency[cur] ?? 0) + can;
      return {
        currency: cur,
        balance: bal,
        status: b.status,
        user_tier: (b as { user_tier?: string }).user_tier ?? 'free',
        updated_at: b.updated_at,
        withdrawableNow: can,
      };
    });

    const profile = Array.isArray(profileRes.data) ? profileRes.data[0] ?? null : profileRes.data;
    const referral = Array.isArray(refRes.data) ? refRes.data[0] ?? null : refRes.data;

    return NextResponse.json({
      query: address,
      variantsUsed: variants,
      bannedGlobally,
      balances: balanceRowsOut,
      aggregates: {
        audit: {
          totalDepositsByCurrency,
          totalWithdrawalsByCurrency,
          depositCount,
          withdrawalCount,
          betPlacedAuditCount: betPlacedCount,
          payoutAuditCount: payoutEventCount,
          rowsReturned: auditRows.length,
          cappedAt: AUDIT_CAP,
          auditTruncated: auditRows.length >= AUDIT_CAP,
        },
        betting: {
          all: bettingAll,
          real: bettingReal,
          demo: bettingDemo,
          betsRowsReturned: betRows.length,
          betsCappedAt: BETS_CAP,
          betsTruncated: betRows.length >= BETS_CAP,
        },
        withdrawals: {
          pending: pendingWithdrawals,
          accepted: acceptedWithdrawals,
          rejected: rejectedWithdrawals,
          pendingTotalByCurrency: pendingWithdrawals.reduce(
            (acc: Record<string, number>, w) => {
              addTo(acc, w.currency, Number(w.amount ?? 0));
              return acc;
            },
            {},
          ),
        },
        withdrawableByCurrency,
        summary: {
          /** User-centric: total payouts minus total staked (all settled bets in result set). */
          netBettingProfitLoss: bettingAll.netBettingPLUser,
          /** House perspective for bets: wagered - paid out */
          houseEdgeFromBets: bettingAll.totalWagered - bettingAll.totalPayoutReceived,
        },
      },
      profile: profile
        ? { username: profile.username, access_code: profile.access_code, updated_at: profile.updated_at }
        : null,
      referral: referral
        ? {
            referral_code: referral.referral_code,
            referral_count: referral.referral_count,
            referred_by: referral.referred_by,
          }
        : null,
      recentAudit: auditRows.slice(0, 80),
      recentBets: betRows.slice(0, 80),
      withdrawalHistory: wdRows,
      timeOnPlatform,
    });
  } catch (e: unknown) {
    const msg = messageFromUnknown(e);
    console.error('[wallet-insights]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
