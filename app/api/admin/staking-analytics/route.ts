import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';
import { supabaseService as supabase, appendSupabaseServiceKeyHint } from '@/lib/supabase/serviceClient';
import { estimateStakingReward, estimateTotalPayout } from '@/lib/admin/stakingAnalytics';

const POSITIONS_PAGE = 10_000;

type PositionRow = {
  id: number;
  user_address: string;
  pool_key: string;
  lock_days: number;
  apy_bps: number;
  amount: number;
  status: string;
  start_at: string;
  unlock_at: string;
  reward_amount: number | null;
  total_payout: number | null;
  claimed_at: string | null;
  created_at: string;
};

type LedgerRow = {
  id: number;
  user_address: string;
  position_id: number;
  operation: string;
  amount: number;
  reward_amount: number | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const deny = requireAdminAuth(request);
  if (deny) return deny;

  try {
    const { data: pools, error: poolsErr } = await supabase
      .from('staking_pools')
      .select('pool_key, lock_days, apy_bps, min_stake, max_stake, is_active')
      .order('lock_days', { ascending: true });

    if (poolsErr) throw poolsErr;

    const { data: positions, error: posErr } = await supabase
      .from('staking_positions')
      .select(
        'id, user_address, pool_key, lock_days, apy_bps, amount, status, start_at, unlock_at, reward_amount, total_payout, claimed_at, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(POSITIONS_PAGE);

    if (posErr) throw posErr;

    const posList = (positions || []) as PositionRow[];
    const truncated = posList.length >= POSITIONS_PAGE;

    const byPool: Record<
      string,
      {
        activePositions: number;
        activeWallets: number;
        activePrincipal: number;
        estimatedReward: number;
        estimatedPayout: number;
        claimedPositions: number;
        claimedRewardPaid: number;
        claimedPayoutPaid: number;
        cancelledPositions: number;
      }
    > = {};

    const initPoolKeys = new Set<string>((pools as { pool_key: string }[] | null)?.map((p) => p.pool_key) || []);
    for (const p of posList) initPoolKeys.add(p.pool_key);
    for (const k of initPoolKeys) {
      byPool[k] = {
        activePositions: 0,
        activeWallets: 0,
        activePrincipal: 0,
        estimatedReward: 0,
        estimatedPayout: 0,
        claimedPositions: 0,
        claimedRewardPaid: 0,
        claimedPayoutPaid: 0,
        cancelledPositions: 0,
      };
    }

    let activeCount = 0;
    let claimedCount = 0;
    let cancelledCount = 0;
    const activeWalletsGlobal = new Set<string>();
    let activePrincipalGlobal = 0;
    let estimatedRewardGlobal = 0;
    let estimatedPayoutGlobal = 0;
    let claimedRewardPaidGlobal = 0;
    let claimedPayoutPaidGlobal = 0;

    const maturityActive = {
      unlockWithin7d: { positions: 0, principal: 0, estPayout: 0 },
      unlockWithin30d: { positions: 0, principal: 0, estPayout: 0 },
      unlockLater: { positions: 0, principal: 0, estPayout: 0 },
    };

    const now = Date.now();
    const d7 = now + 7 * 86400_000;
    const d30 = now + 30 * 86400_000;

    for (const row of posList) {
      const amt = Number(row.amount);
      const apy = Number(row.apy_bps);
      const days = Number(row.lock_days);
      const poolKey = row.pool_key;

      if (!byPool[poolKey]) {
        byPool[poolKey] = {
          activePositions: 0,
          activeWallets: 0,
          activePrincipal: 0,
          estimatedReward: 0,
          estimatedPayout: 0,
          claimedPositions: 0,
          claimedRewardPaid: 0,
          claimedPayoutPaid: 0,
          cancelledPositions: 0,
        };
      }
      if (row.status === 'active') {
        activeCount++;
        activeWalletsGlobal.add(row.user_address);
        const er = estimateStakingReward(amt, apy, days);
        const ep = estimateTotalPayout(amt, apy, days);
        activePrincipalGlobal += amt;
        estimatedRewardGlobal += er;
        estimatedPayoutGlobal += ep;

        byPool[poolKey].activePositions += 1;
        byPool[poolKey].activePrincipal += amt;
        byPool[poolKey].estimatedReward += er;
        byPool[poolKey].estimatedPayout += ep;

        const unlockMs = new Date(row.unlock_at).getTime();
        if (unlockMs <= d7) {
          maturityActive.unlockWithin7d.positions += 1;
          maturityActive.unlockWithin7d.principal += amt;
          maturityActive.unlockWithin7d.estPayout += ep;
        } else if (unlockMs <= d30) {
          maturityActive.unlockWithin30d.positions += 1;
          maturityActive.unlockWithin30d.principal += amt;
          maturityActive.unlockWithin30d.estPayout += ep;
        } else {
          maturityActive.unlockLater.positions += 1;
          maturityActive.unlockLater.principal += amt;
          maturityActive.unlockLater.estPayout += ep;
        }
      } else if (row.status === 'claimed') {
        claimedCount++;
        const rPaid = Number(row.reward_amount || 0);
        const pPaid = Number(row.total_payout || 0);
        claimedRewardPaidGlobal += rPaid;
        claimedPayoutPaidGlobal += pPaid;
        byPool[poolKey].claimedPositions += 1;
        byPool[poolKey].claimedRewardPaid += rPaid;
        byPool[poolKey].claimedPayoutPaid += pPaid;
      } else if (row.status === 'cancelled') {
        cancelledCount++;
        byPool[poolKey].cancelledPositions += 1;
      }
    }

    const poolWalletSets = new Map<string, Set<string>>();
    for (const row of posList) {
      if (row.status !== 'active') continue;
      if (!poolWalletSets.has(row.pool_key)) poolWalletSets.set(row.pool_key, new Set());
      poolWalletSets.get(row.pool_key)!.add(row.user_address);
    }
    for (const [k, set] of poolWalletSets) {
      if (byPool[k]) byPool[k].activeWallets = set.size;
    }

    const wrCounts: Record<string, number> = { pending: 0, accepted: 0, rejected: 0 };
    for (const st of ['pending', 'accepted', 'rejected'] as const) {
      const { count, error } = await supabase
        .from('staking_withdrawal_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', st);
      if (error) throw error;
      wrCounts[st] = count ?? 0;
    }

    const { data: ledger, error: ledErr } = await supabase
      .from('staking_ledger')
      .select('id, user_address, position_id, operation, amount, reward_amount, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (ledErr) throw ledErr;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      truncated,
      positionsLoaded: posList.length,
      pools: pools || [],
      summary: {
        positionsInBatch: posList.length,
        active: {
          positions: activeCount,
          distinctWallets: activeWalletsGlobal.size,
          principalBYNOMO: activePrincipalGlobal,
          estimatedRewardBYNOMO: estimatedRewardGlobal,
          estimatedPayoutBYNOMO: estimatedPayoutGlobal,
        },
        claimed: {
          positions: claimedCount,
          rewardPaidBYNOMO: claimedRewardPaidGlobal,
          payoutPaidBYNOMO: claimedPayoutPaidGlobal,
        },
        cancelled: { positions: cancelledCount },
        stakingWithdrawalRequests: wrCounts,
      },
      byPool,
      maturityActive,
      recentPositions: posList.slice(0, 300),
      recentLedger: (ledger || []) as LedgerRow[],
    });
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : 'Failed to load staking analytics';
    const msg = appendSupabaseServiceKeyHint(raw);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
