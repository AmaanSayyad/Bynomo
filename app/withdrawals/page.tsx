'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { getPushExplorerTxUrl } from '@/lib/push/config';
import { CheckCircle2, Clock3, ExternalLink, Search, XCircle } from 'lucide-react';

type WithdrawalRow = {
  id: number;
  user_address: string;
  currency: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  requested_at: string;
  decided_at?: string | null;
  tx_hash?: string | null;
  fee_tx_hash?: string | null;
};

function getExplorerUrl(currency: string, hash: string | null | undefined) {
  if (!hash || hash === 'INTERNAL' || hash === 'PENDING') return null;
  const c = currency.toUpperCase();
  if (c === 'BNB') return `https://bscscan.com/tx/${hash}`;
  if (c === 'SOL' || c === 'BYNOMO') return `https://solscan.io/tx/${hash}`;
  if (c === 'SUI') return `https://suiscan.xyz/mainnet/tx/${hash}`;
  if (c === 'XLM') return `https://stellar.expert/explorer/public/tx/${hash}`;
  if (c === 'XTZ') return `https://tzkt.io/${hash}`;
  if (c === 'NEAR') return `https://nearblocks.io/txns/${hash}`;
  if (c === 'STRK') return `https://starkscan.co/tx/${hash}`;
  if (c === 'PUSH' || c === 'PC') return getPushExplorerTxUrl(hash);
  if (c === 'SOMNIA' || c === 'STT') return `https://shannon-explorer.somnia.network/tx/${hash}`;
  return null;
}

function shortHash(hash: string) {
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ status }: { status: WithdrawalRow['status'] }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-black tracking-widest border';
  if (status === 'pending') {
    return (
      <span className={`${base} bg-amber-500/10 text-amber-300 border-amber-500/20`}>
        <Clock3 className="w-3 h-3" /> pending
      </span>
    );
  }
  if (status === 'accepted') {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-300 border-emerald-500/20`}>
        <CheckCircle2 className="w-3 h-3" /> accepted
      </span>
    );
  }
  return (
    <span className={`${base} bg-rose-500/10 text-rose-300 border-rose-500/20`}>
      <XCircle className="w-3 h-3" /> rejected
    </span>
  );
}

export default function WithdrawalsPage() {
  const address = useStore((s) => s.address);
  const isConnected = useStore((s) => s.isConnected);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | WithdrawalRow['status']>('all');
  const [chainFilter, setChainFilter] = useState<'ALL' | string>('ALL');
  const [query, setQuery] = useState('');

  const fetchRows = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/withdrawals?address=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error('Failed to load withdrawals');
      const data = await res.json();
      setRows(data.withdrawals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    const int = setInterval(fetchRows, 30_000);
    return () => clearInterval(int);
  }, [address]);

  const counts = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending').length;
    const accepted = rows.filter((r) => r.status === 'accepted').length;
    const rejected = rows.filter((r) => r.status === 'rejected').length;
    return { pending, accepted, rejected };
  }, [rows]);

  const chainOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(String(r.currency || '').toUpperCase());
    return ['ALL', ...Array.from(set).filter(Boolean).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => (chainFilter === 'ALL' ? true : String(r.currency || '').toUpperCase() === chainFilter))
      .filter((r) => {
        if (!q) return true;
        const tx = String(r.tx_hash || '').toLowerCase();
        const feeTx = String(r.fee_tx_hash || '').toLowerCase();
        const cur = String(r.currency || '').toLowerCase();
        return tx.includes(q) || feeTx.includes(q) || cur.includes(q);
      })
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
  }, [rows, statusFilter, chainFilter, query]);

  if (!isConnected || !address) {
    return (
      <main className="min-h-screen bg-[#02040a] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-black uppercase tracking-widest">Withdrawals</h1>
          <p className="text-white/40 text-sm">Connect your wallet to track withdrawal requests.</p>
          <Link href="/trade" className="inline-flex px-4 py-2 rounded-lg bg-white text-black font-bold text-xs uppercase tracking-wider">
            Go to trade
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#02040a] text-white px-6 py-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight uppercase">Withdrawal Status</h1>
            <p className="text-white/35 text-sm mt-2">Track pending, accepted, and rejected requests.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRows}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg border border-white/15 bg-white/5 hover:bg-white/10"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link
              href="/trade"
              className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg border border-white/15 bg-white text-black hover:bg-gray-200"
            >
              Back to trade
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              statusFilter === 'pending' ? 'border-amber-500/40 bg-amber-500/15' : 'border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15'
            }`}
          >
            <p className="text-xs uppercase text-amber-200/80">Pending</p>
            <p className="text-2xl font-black">{counts.pending}</p>
          </button>
          <button
            onClick={() => setStatusFilter('accepted')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              statusFilter === 'accepted'
                ? 'border-emerald-500/40 bg-emerald-500/15'
                : 'border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15'
            }`}
          >
            <p className="text-xs uppercase text-emerald-200/80">Accepted</p>
            <p className="text-2xl font-black">{counts.accepted}</p>
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`rounded-xl border p-4 text-left transition-colors ${
              statusFilter === 'rejected'
                ? 'border-rose-500/40 bg-rose-500/15'
                : 'border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/15'
            }`}
          >
            <p className="text-xs uppercase text-rose-200/80">Rejected</p>
            <p className="text-2xl font-black">{counts.rejected}</p>
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/[0.02] flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-1 w-full md:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  statusFilter === 'all' ? 'bg-white text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                All ({rows.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  statusFilter === 'pending' ? 'bg-amber-400 text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  statusFilter === 'accepted' ? 'bg-emerald-400 text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                Accepted
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                  statusFilter === 'rejected' ? 'bg-rose-400 text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                Rejected
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tx hash / fee tx / chain…"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20"
                />
              </div>

              <select
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20"
              >
                {chainOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-4 space-y-3">
            {loading && rows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-white/30 text-sm">Loading withdrawals…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
                <p className="text-white/70 font-bold">No matching withdrawals</p>
                <p className="text-white/35 text-sm mt-1">Try clearing filters or search.</p>
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setChainFilter('ALL');
                    setQuery('');
                  }}
                  className="mt-4 inline-flex px-4 py-2 rounded-lg bg-white text-black text-xs font-black uppercase tracking-widest"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map((r) => {
                const txLink = getExplorerUrl(r.currency, r.tx_hash || null);
                const feeLink = getExplorerUrl(r.currency, r.fee_tx_hash || null);
                return (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/30">Requested</p>
                        <p className="text-sm font-mono text-white/80">{formatWhen(r.requested_at)}</p>
                      </div>
                      <StatusPill status={r.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/25">Amount</p>
                        <p className="text-sm font-mono">{Number(r.amount).toFixed(4)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/25">Fee</p>
                        <p className="text-sm font-mono text-red-300">{Number(r.fee_amount).toFixed(4)}</p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[10px] uppercase tracking-widest text-white/25">Net</p>
                        <p className="text-sm font-mono text-emerald-300">{Number(r.net_amount).toFixed(4)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-white/60">{String(r.currency).toUpperCase()}</p>
                      <div className="flex items-center gap-3">
                        {feeLink && (
                          <a href={feeLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white inline-flex items-center gap-1">
                            fee <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {txLink ? (
                          <a href={txLink} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-blue-200 inline-flex items-center gap-1">
                            tx <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/25">
                            {r.status === 'pending' ? 'Awaiting approval' : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-white/30 border-b border-white/10">
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Fee</th>
                  <th className="px-6 py-4">Net</th>
                  <th className="px-6 py-4">Chain</th>
                  <th className="px-6 py-4 text-right">Tx</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-white/30 text-sm">
                      Loading withdrawals…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <p className="text-white/70 font-bold">No matching withdrawals</p>
                      <p className="text-white/35 text-sm mt-1">Try clearing filters or search.</p>
                      <button
                        onClick={() => {
                          setStatusFilter('all');
                          setChainFilter('ALL');
                          setQuery('');
                        }}
                        className="mt-4 inline-flex px-4 py-2 rounded-lg bg-white text-black text-xs font-black uppercase tracking-widest"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const link = getExplorerUrl(r.currency, r.tx_hash || null);
                    const feeLink = getExplorerUrl(r.currency, r.fee_tx_hash || null);
                    return (
                      <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-xs font-mono">{formatWhen(r.requested_at)}</p>
                            {r.decided_at ? (
                              <p className="text-[10px] text-white/30 font-mono">Decided {formatWhen(r.decided_at)}</p>
                            ) : (
                              <p className="text-[10px] text-white/20 font-mono">—</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={r.status} />
                        </td>
                        <td className="px-6 py-4 text-sm font-mono">{Number(r.amount).toFixed(4)}</td>
                        <td className="px-6 py-4 text-sm font-mono text-red-300">{Number(r.fee_amount).toFixed(4)}</td>
                        <td className="px-6 py-4 text-sm font-mono text-emerald-300">{Number(r.net_amount).toFixed(4)}</td>
                        <td className="px-6 py-4 text-xs uppercase font-bold text-white/80">{String(r.currency).toUpperCase()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3 justify-end">
                            {feeLink && (
                              <a
                                href={feeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/50 hover:text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
                              >
                                Fee <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {link ? (
                              <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 text-xs font-mono inline-flex items-center gap-1">
                                {shortHash(r.tx_hash || '')} <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-white/30 text-xs font-mono">{r.status === 'pending' ? 'PENDING' : '—'}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

