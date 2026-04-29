'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WalletConnect } from '@/components/wallet';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useOverflowStore } from '@/lib/store';
import { balanceMutationHeaders, ensureBalanceSession } from '@/lib/balance/balanceClientHeaders';
import {
  MANUAL_STAKING_PAYOUT_THRESHOLD_BYNOMO,
  isManualStakingPayoutExemptWallet,
  stakingPrincipalRequiresManualPayout,
} from '@/lib/staking/manualWithdrawThreshold';

type Pool = {
  pool_key: string;
  lock_days: number;
  apy_bps: number;
  min_stake: number;
  max_stake: number | null;
  is_active: boolean;
};

type Position = {
  id: number;
  pool_key: string;
  lock_days: number;
  apy_bps: number;
  amount: number;
  start_at: string;
  unlock_at: string;
  status: 'active' | 'claimed' | 'cancelled';
  reward_amount: number | null;
  total_payout: number | null;
  claimed_at: string | null;
};

type PayoutRequest = {
  id: number;
  position_id: number;
  status: 'pending' | 'accepted' | 'rejected';
  stake_amount: number;
  payout_amount: number;
  requested_at: string;
};

function fmt(num: number): string {
  return Number(num || 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtDate(input: string | null | undefined): string {
  if (!input) return '-';
  const d = new Date(input);
  return d.toLocaleString();
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n > 0 && n < 0.01) return '<$0.01';
  if (n >= 1e9) return `$${n.toExponential(2)}`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function StakingPage() {
  const BYNOMO_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';
  const STAKING_VAULT = process.env.NEXT_PUBLIC_SOL_STAKING_VAULT_ADDRESS || '';
  const address = useOverflowStore((s) => s.address);
  const isConnected = useOverflowStore((s) => s.isConnected);
  const { sendTransaction: sendSolanaTransaction } = useSolanaWallet();

  const [pools, setPools] = useState<Pool[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [bynomoBalance, setBynomoBalance] = useState(0);
  const [vaultBynomoBalance, setVaultBynomoBalance] = useState(0);
  const [amountByPool, setAmountByPool] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submittingPool, setSubmittingPool] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [requestingPayoutFor, setRequestingPayoutFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calculatorAmount, setCalculatorAmount] = useState<string>('');
  const [calculatorPoolKey, setCalculatorPoolKey] = useState<string>('');
  const [bynomoUsd, setBynomoUsd] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const priceRes = await fetch('/api/staking/bynomo-usd');
      const priceJson = await priceRes.json();
      if (priceRes.ok && typeof priceJson.priceUsd === 'number' && Number.isFinite(priceJson.priceUsd)) {
        setBynomoUsd(priceJson.priceUsd);
      } else {
        setBynomoUsd(null);
      }

      const poolsRes = await fetch('/api/staking/pools');
      const poolsJson = await poolsRes.json();
      if (!poolsRes.ok) throw new Error(poolsJson.error || 'Failed to load staking pools');
      setPools((poolsJson.pools || []) as Pool[]);

      const { getTokenBalance } = await import('@/lib/solana/client');
      const vaultBal = STAKING_VAULT ? await getTokenBalance(STAKING_VAULT, BYNOMO_MINT) : 0;
      setVaultBynomoBalance(Number(vaultBal || 0));

      if (address) {
        const posRes = await fetch(`/api/staking/positions?userAddress=${encodeURIComponent(address)}`);
        const posJson = await posRes.json();

        if (!posRes.ok) throw new Error(posJson.error || 'Failed to load staking positions');

        const walletBal = await getTokenBalance(address, BYNOMO_MINT);
        setBynomoBalance(Number(walletBal || 0));
        setPositions((posJson.positions || []) as Position[]);

        const prRes = await fetch(
          `/api/staking/withdrawal-requests?userAddress=${encodeURIComponent(address)}`,
          { credentials: 'include', headers: { ...balanceMutationHeaders() } },
        );
        const prJson = await prRes.json();
        if (prRes.ok) {
          setPayoutRequests((prJson.requests || []) as PayoutRequest[]);
        } else {
          setPayoutRequests([]);
        }
      } else {
        setBynomoBalance(0);
        setPositions([]);
        setPayoutRequests([]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh staking data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void ensureBalanceSession();
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!calculatorPoolKey && pools.length > 0) {
      setCalculatorPoolKey(pools[0].pool_key);
    }
  }, [calculatorPoolKey, pools]);

  const activePositions = useMemo(() => positions.filter((p) => p.status === 'active'), [positions]);
  const claimablePositions = useMemo(
    () => activePositions.filter((p) => new Date(p.unlock_at).getTime() <= Date.now()),
    [activePositions],
  );
  const isManualPayoutExemptWallet = useMemo(
    () => (address ? isManualStakingPayoutExemptWallet(address) : false),
    [address],
  );

  const latestPayoutRequestByPositionId = useMemo(() => {
    const map = new Map<number, PayoutRequest>();
    for (const r of payoutRequests) {
      const pid = Number(r.position_id);
      if (!map.has(pid)) map.set(pid, r);
    }
    return map;
  }, [payoutRequests]);

  const calculatorPool = useMemo(
    () => pools.find((p) => p.pool_key === calculatorPoolKey) ?? pools[0] ?? null,
    [calculatorPoolKey, pools],
  );
  const calculatorPrincipal = useMemo(() => {
    const n = Number(calculatorAmount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [calculatorAmount]);
  const calculatorApyPct = Number(calculatorPool?.apy_bps || 0) / 100;
  const calculatorDays = Number(calculatorPool?.lock_days || 0);
  const calculatorReward = useMemo(() => {
    if (!calculatorPool || calculatorPrincipal <= 0) return 0;
    return Math.round(calculatorPrincipal * (calculatorApyPct / 100) * (calculatorDays / 365) * 1e8) / 1e8;
  }, [calculatorApyPct, calculatorDays, calculatorPool, calculatorPrincipal]);
  const calculatorPayout = calculatorPrincipal + calculatorReward;
  const calculatorRoiPct = calculatorPrincipal > 0 ? (calculatorReward / calculatorPrincipal) * 100 : 0;
  const calculatorDailyReward = calculatorDays > 0 ? calculatorReward / calculatorDays : 0;
  const calculatorMonthlyReward = calculatorDays > 0 ? calculatorReward * (30 / calculatorDays) : 0;
  const calculatorSimpleAnnualizedPct =
    calculatorPrincipal > 0 && calculatorDays > 0 ? (calculatorReward / calculatorPrincipal) * (365 / calculatorDays) * 100 : 0;
  const calculatorCompoundedAnnualPct =
    calculatorPrincipal > 0 && calculatorDays > 0
      ? (Math.pow(1 + calculatorReward / calculatorPrincipal, 365 / calculatorDays) - 1) * 100
      : 0;
  const usd = (bynomo: number) =>
    bynomoUsd !== null && Number.isFinite(bynomoUsd) && Number.isFinite(bynomo) ? bynomo * bynomoUsd : null;

  const handleStake = useCallback(
    async (pool: Pool) => {
      setSuccess(null);
      setError(null);
      if (!address) {
        setError('Connect your wallet first.');
        return;
      }

      const raw = amountByPool[pool.pool_key] || '';
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError('Enter a valid amount.');
        return;
      }

      setSubmittingPool(pool.pool_key);
      try {
        const vaultAddress = process.env.NEXT_PUBLIC_SOL_STAKING_VAULT_ADDRESS;
        if (!vaultAddress) {
          throw new Error('Staking vault address is not configured.');
        }

        const { getSolanaConnection, buildTokenTransferTransaction, waitForSolanaSignatureConfirmed } = await import('@/lib/solana/client');
        const connection = getSolanaConnection();
        const tx = await buildTokenTransferTransaction(amount, address, vaultAddress, BYNOMO_MINT);
        const txHash = await sendSolanaTransaction(tx, connection);
        await waitForSolanaSignatureConfirmed(connection, txHash);

        const res = await fetch('/api/staking/stake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
          credentials: 'include',
          body: JSON.stringify({
            userAddress: address,
            poolKey: pool.pool_key,
            amount,
            txHash,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create staking position');

        setAmountByPool((prev) => ({ ...prev, [pool.pool_key]: '' }));
        setSuccess(`Staked ${fmt(amount)} BYNOMO in ${pool.lock_days}-day pool.`);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create staking position');
      } finally {
        setSubmittingPool(null);
      }
    },
    [address, amountByPool, refresh, sendSolanaTransaction],
  );

  const handleClaim = useCallback(
    async (positionId: number) => {
      setSuccess(null);
      setError(null);
      if (!address) {
        setError('Connect your wallet first.');
        return;
      }

      setClaimingId(positionId);
      try {
        const res = await fetch('/api/staking/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
          credentials: 'include',
          body: JSON.stringify({
            userAddress: address,
            positionId,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to claim position');

        setSuccess(`Claim successful. Payout: ${fmt(Number(json?.result?.payout_amount || 0))} BYNOMO`);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to claim position');
      } finally {
        setClaimingId(null);
      }
    },
    [address, refresh],
  );

  const handleRequestVaultPayout = useCallback(
    async (positionId: number) => {
      setSuccess(null);
      setError(null);
      if (!address) {
        setError('Connect your wallet first.');
        return;
      }
      setRequestingPayoutFor(positionId);
      try {
        const res = await fetch('/api/staking/withdrawal-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...balanceMutationHeaders() },
          credentials: 'include',
          body: JSON.stringify({ userAddress: address, positionId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to submit payout request');
        setSuccess(
          'Payout request submitted. An administrator will review and send BYNOMO from the staking vault to your wallet.',
        );
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit payout request');
      } finally {
        setRequestingPayoutFor(null);
      }
    },
    [address, refresh],
  );

  return (
    <div className="min-h-full bg-[#02040a] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-6 relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-20%,rgba(168,85,247,0.18),transparent_45%),radial-gradient(circle_at_80%_-10%,rgba(45,212,191,0.12),transparent_40%)]" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">BYNOMO staking</p>
              <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">Fixed-term pools</h1>
              <p className="mt-2 text-sm text-white/60">
                Stake BYNOMO in fixed-term pools (30–365 days), including a 365-day tier at 100% APY. Rewards are fixed at stake time and claimable at maturity.
              </p>
            </div>
            <div className="relative flex items-center gap-2">
              <WalletConnect />
            </div>
          </div>
          <div className="relative mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-200/90">
            <span className="font-black uppercase tracking-wider text-cyan-300">Direct staking vault</span>
            <span className="ml-2 font-mono break-all">{STAKING_VAULT || 'Not configured'}</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Wallet</p>
            <p className="mt-2 text-sm text-white/80 break-all">{address || 'Not connected'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Wallet BYNOMO (on-chain)</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">{fmt(bynomoBalance)}</p>
            <p className="mt-1 text-[11px] text-white/35">≈ {fmtUsd(usd(bynomoBalance))}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Staking vault BYNOMO</p>
            <p className="mt-2 text-2xl font-black text-purple-300">{fmt(vaultBynomoBalance)}</p>
            <p className="mt-1 text-[11px] text-white/35">≈ {fmtUsd(usd(vaultBynomoBalance))}</p>
            <p className="mt-1 text-[10px] font-mono text-white/40 break-all">{STAKING_VAULT || 'Not configured'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Claimable now</p>
            <p className="mt-2 text-2xl font-black text-purple-300">{claimablePositions.length}</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          BYNOMO staking is now live.
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/70 flex flex-wrap items-center justify-between gap-2">
          <span>
            BYNOMO staking uses your <span className="font-bold text-white">wallet BYNOMO balance</span>; stake tx goes{' '}
            <span className="font-bold text-cyan-300">wallet → staking vault</span>.
          </span>
        </div>

        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Staking return calculator</p>
          <div className="relative overflow-hidden rounded-xl border border-cyan-400/20 bg-black/30 p-4 sm:p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.08),transparent_40%),radial-gradient(circle_at_80%_100%,rgba(168,85,247,0.12),transparent_45%)]" />
            <div className="relative space-y-4">
              <p className="text-xs text-white/60">
                Simulate expected payout with current pool parameters. Works as a quick estimate for beginners and a deeper annualized view for advanced users.
              </p>
              <p className="text-[10px] text-white/40">
                Indicative USD uses DexScreener BYNOMO price (same as admin treasury). 1 BYNOMO ≈{' '}
                <span className="font-mono text-cyan-200/90">{bynomoUsd !== null ? `$${bynomoUsd.toFixed(6)}` : '—'}</span>
                {bynomoUsd === null && ' — price unavailable.'}
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Stake amount (BYNOMO)</p>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={calculatorAmount}
                    onChange={(e) => setCalculatorAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30"
                  />
                  {calculatorPrincipal > 0 && (
                    <p className="mt-1 text-[10px] text-white/35">≈ {fmtUsd(usd(calculatorPrincipal))}</p>
                  )}
                </label>

                <label className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Pool term</p>
                  <select
                    value={calculatorPool?.pool_key || ''}
                    onChange={(e) => setCalculatorPoolKey(e.target.value)}
                    className="mt-2 w-full bg-transparent text-sm font-semibold text-white outline-none"
                  >
                    {pools.map((pool) => (
                      <option key={pool.pool_key} value={pool.pool_key} className="bg-[#0b0d13]">
                        {pool.lock_days} Days ({(pool.apy_bps / 100).toFixed(2)}% APY)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Quick fill</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setCalculatorAmount('100000')} className="rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold text-white/70 hover:text-white hover:border-white/40">100k</button>
                    <button type="button" onClick={() => setCalculatorAmount('1000000')} className="rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold text-white/70 hover:text-white hover:border-white/40">1M</button>
                    <button type="button" onClick={() => setCalculatorAmount(String(Math.max(0, Math.floor(bynomoBalance))))} className="rounded-md border border-cyan-400/25 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:border-cyan-300/50">Wallet max</button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-200/70">Estimated reward</p>
                  <p className="mt-1 text-lg font-black text-emerald-300">{fmt(calculatorReward)} BYNOMO</p>
                  <p className="mt-0.5 text-[11px] text-emerald-200/60">≈ {fmtUsd(usd(calculatorReward))}</p>
                </div>
                <div className="rounded-lg border border-purple-400/20 bg-purple-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-purple-200/70">Total payout</p>
                  <p className="mt-1 text-lg font-black text-purple-300">{fmt(calculatorPayout)} BYNOMO</p>
                  <p className="mt-0.5 text-[11px] text-purple-200/60">≈ {fmtUsd(usd(calculatorPayout))}</p>
                </div>
                <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-cyan-200/70">ROI at unlock</p>
                  <p className="mt-1 text-lg font-black text-cyan-300">{calculatorRoiPct.toFixed(4)}%</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/50">Daily equivalent</p>
                  <p className="mt-1 text-lg font-black text-white">{fmt(calculatorDailyReward)} BYNOMO/day</p>
                  <p className="mt-0.5 text-[11px] text-white/40">≈ {fmtUsd(usd(calculatorDailyReward))}/day</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Advanced finance lens</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/75">
                    Monthly run-rate:{' '}
                    <span className="font-semibold text-white">
                      {fmt(calculatorMonthlyReward)} BYNOMO
                      <span className="text-white/45"> ({fmtUsd(usd(calculatorMonthlyReward))})</span>
                    </span>
                  </div>
                  <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/75">
                    Simple annualized yield: <span className="font-semibold text-white">{calculatorSimpleAnnualizedPct.toFixed(4)}%</span>
                  </div>
                  <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white/75">
                    Compounded annualized: <span className="font-semibold text-white">{calculatorCompoundedAnnualPct.toFixed(4)}%</span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-white/45">
                  Formula: Reward = Principal × (APY/100) × (LockDays/365). Values are estimates before market and protocol changes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Stake pools</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pools.map((pool) => (
              <div key={pool.pool_key} className="rounded-xl border border-white/10 bg-black/30 p-4 shadow-[0_10px_40px_-24px_rgba(168,85,247,0.45)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-white">{pool.lock_days} Days</h2>
                  <span className="rounded-full bg-purple-500/20 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-purple-200">
                    {(pool.apy_bps / 100).toFixed(2)}% APY
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/60">
                  Min {fmt(Number(pool.min_stake || 0))} BYNOMO
                  {pool.max_stake ? ` · Max ${fmt(Number(pool.max_stake))} BYNOMO` : ''}
                </p>
                <div className="mt-4 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={amountByPool[pool.pool_key] || ''}
                    onChange={(e) => setAmountByPool((prev) => ({ ...prev, [pool.pool_key]: e.target.value }))}
                    placeholder="Amount"
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-400/60"
                  />
                  <button
                    onClick={() => void handleStake(pool)}
                    disabled={!isConnected || submittingPool === pool.pool_key || loading}
                    className="rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-2 text-xs font-black uppercase tracking-widest text-purple-200 transition-all duration-200 hover:bg-purple-500/25 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submittingPool === pool.pool_key ? 'Staking...' : 'Stake'}
                  </button>
                </div>
                {!isConnected && (
                  <p className="mt-2 text-[11px] text-white/45">
                    Connect wallet to stake.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">My positions</p>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-widest text-white/40">
                  <tr>
                    <th className="px-4 py-3">Pool</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">APY</th>
                    <th className="px-4 py-3">Unlock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payout</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 && (
                    <tr>
                      <td className="px-4 py-5 text-white/45" colSpan={7}>
                        {loading ? 'Loading positions...' : 'No staking positions yet.'}
                        {!loading && (
                          <span className="ml-2">
                            <span className="text-cyan-300">Enter an amount in a pool above and stake from your wallet.</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  )}

                  {positions.map((p) => {
                    const unlocked = p.status === 'active' && new Date(p.unlock_at).getTime() <= Date.now();
                    const estReward = Number((Number(p.amount) * (p.apy_bps / 10000) * (p.lock_days / 365)).toFixed(8));
                    const estPayout = Number(p.total_payout || Number(p.amount) + estReward);
                    const manualPayout =
                      stakingPrincipalRequiresManualPayout(Number(p.amount)) && !isManualPayoutExemptWallet;
                    const latestReq = latestPayoutRequestByPositionId.get(p.id);

                    return (
                      <tr key={p.id} className="border-t border-white/5 text-white/80">
                        <td className="px-4 py-3 font-semibold">{p.lock_days}D</td>
                        <td className="px-4 py-3">
                          <div>{fmt(Number(p.amount))}</div>
                          {usd(Number(p.amount)) !== null && (
                            <p className="mt-0.5 text-[10px] text-white/35">≈ {fmtUsd(usd(Number(p.amount)))}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">{(p.apy_bps / 100).toFixed(2)}%</td>
                        <td className="px-4 py-3">{fmtDate(p.unlock_at)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                              p.status === 'claimed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : unlocked
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {p.status === 'active' && unlocked ? 'claimable' : p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {p.status === 'claimed'
                              ? `${fmt(Number(p.total_payout || 0))} BYNOMO`
                              : `${fmt(estPayout)} BYNOMO (est.)`}
                          </div>
                          {p.status === 'claimed'
                            ? usd(Number(p.total_payout || 0)) !== null && (
                                <p className="mt-0.5 text-[10px] text-white/35">
                                  ≈ {fmtUsd(usd(Number(p.total_payout || 0)))}
                                </p>
                              )
                            : usd(estPayout) !== null && (
                                <p className="mt-0.5 text-[10px] text-white/35">≈ {fmtUsd(usd(estPayout))}</p>
                              )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.status === 'active' && unlocked ? (
                            manualPayout ? (
                              latestReq?.status === 'pending' ? (
                                <span className="text-[11px] font-semibold text-amber-300">Awaiting admin approval</span>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  {latestReq?.status === 'rejected' && (
                                    <span className="max-w-[220px] text-right text-[10px] text-rose-300/90">
                                      Last payout request was rejected. Submit again if you still want the vault transfer.
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleRequestVaultPayout(p.id)}
                                    disabled={requestingPayoutFor === p.id}
                                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                                  >
                                    {requestingPayoutFor === p.id ? 'Submitting...' : 'Request vault payout'}
                                  </button>
                                </div>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleClaim(p.id)}
                                disabled={claimingId === p.id}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                              >
                                {claimingId === p.id ? 'Claiming...' : 'Claim'}
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-white/40">{p.status === 'claimed' ? fmtDate(p.claimed_at) : '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <footer className="py-24 px-10 border-t border-white/5 bg-black relative z-10 w-full overflow-hidden">
        <div className="huge-footer-logo">BYNOMO</div>


        <div className="footer-meta">
          <div className="footer-meta-item">2026 © All rights reserved</div>

          <div className="footer-link-group">
            <Link href="/litepaper" className="footer-meta-item">Litepaper</Link>
            <Link href="/staking" className="footer-meta-item">Staking</Link>
            <a href="https://x.com/bynomofun" target="_blank" rel="noopener noreferrer" className="footer-meta-item">X / Twitter</a>
            <a href="https://linktr.ee/bynomo.fun" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Linktree</a>
            <a href="https://github.com/AmaanSayyad/Bynomo" target="_blank" rel="noopener noreferrer" className="footer-meta-item">GitHub</a>
            <a href="https://t.me/bynomo" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Telegram</a>
            <a href="https://discord.gg/5MAHQpWZ7b" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Discord</a>
            <a href="https://bags.fm/apps/067c4ea3-94c8-47b7-b0c2-d80029f7fed8" target="_blank" rel="noopener noreferrer" className="footer-meta-item">Bags</a>
          </div>

          <div className="footer-link-group">
            <a href="#" className="footer-meta-item">Terms</a>
            <a href="#" className="footer-meta-item">Privacy</a>
            <a href="#" className="footer-meta-item">Cookies</a>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .huge-footer-logo {
          font-size: clamp(5rem, 15vw, 15rem);
          font-weight: 950;
          letter-spacing: -0.06em;
          line-height: 0.8;
          text-align: center;
          width: 100%;
          margin-bottom: 80px;
          background: linear-gradient(180deg, #fff 40%, rgba(255, 255, 255, 0.05) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: var(--font-orbitron);
        }
        .footer-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding-top: 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .footer-meta-item {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: rgba(255, 255, 255, 0.2);
        }
        .footer-link-group {
          display: flex;
          gap: 32px;
        }
        .footer-link-group a {
          color: rgba(255, 255, 255, 0.2);
          transition: color 0.3s ease;
        }
        .footer-link-group a:hover {
          color: #fff;
        }
        @media (max-width: 768px) {
          .footer-meta {
            flex-direction: column;
            gap: 30px;
            text-align: center;
          }
          .footer-link-group {
            flex-wrap: wrap;
            justify-content: center;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}
