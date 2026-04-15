'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, ExternalLink, X } from 'lucide-react';
import { getPushExplorerTxUrl } from '@/lib/push/config';

export interface ReceiptData {
  kind: 'deposit' | 'withdrawal';
  amount: number;
  fee: number;
  net: number;
  chain: string;
  currency: string;
  txHash?: string;
  createdAt: number;
  status?: 'confirmed' | 'pending';
}

function explorerUrl(chain: string, txHash?: string) {
  if (!txHash || txHash === 'PENDING') return null;
  const c = chain.toUpperCase();
  if (c === 'BNB') return `https://bscscan.com/tx/${txHash}`;
  if (c === 'SOL' || c === 'BYNOMO') return `https://solscan.io/tx/${txHash}`;
  if (c === 'SUI') return `https://suiscan.xyz/mainnet/tx/${txHash}`;
  if (c === 'XLM') return `https://stellar.expert/explorer/public/tx/${txHash}`;
  if (c === 'XTZ') return `https://tzkt.io/${txHash}`;
  if (c === 'NEAR') return `https://nearblocks.io/txns/${txHash}`;
  if (c === 'STRK') return `https://starkscan.co/tx/${txHash}`;
  if (c === 'PUSH' || c === 'PC') return getPushExplorerTxUrl(txHash);
  if (c === 'SOMNIA' || c === 'STT') return `https://shannon-explorer.somnia.network/tx/${txHash}`;
  return null;
}

function formatAmount(n: number) {
  if (!Number.isFinite(n)) return '0.0000';
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toFixed(4);
}

function maskHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

export const ReceiptDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
}> = ({ open, onClose, receipt }) => {
  if (!open || !receipt) return null;

  const link = explorerUrl(receipt.chain, receipt.txHash);
  const isPending = receipt.status === 'pending';
  const [copied, setCopied] = useState(false);

  const title = receipt.kind === 'deposit' ? 'Deposit' : 'Withdrawal';
  const StatusIcon = isPending ? Clock3 : CheckCircle2;

  const tx = useMemo(() => {
    if (!receipt.txHash) return null;
    return receipt.txHash.split('|')[0];
  }, [receipt.txHash]);

  return (
    /* Full-screen backdrop */
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4">
      {/* Dim backdrop — click to close */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card — centered, fixed max-width, no overflow issues */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c14] shadow-[0_32px_80px_rgba(0,0,0,0.8)] overflow-hidden">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <div className={[
            'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
            isPending ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300',
          ].join(' ')}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white leading-none">
              {title}
              <span className={[
                'ml-2 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md',
                isPending ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300',
              ].join(' ')}>
                {isPending ? 'Pending' : 'Confirmed'}
              </span>
            </p>
            <p className="mt-0.5 text-[10px] text-white/35 font-mono truncate">
              {receipt.chain} · {new Date(receipt.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Amount ────────────────────────────────────────────── */}
        <div className="px-4 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-white/35">Amount</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white tabular-nums tracking-tight">
              {formatAmount(receipt.amount)}
            </span>
            <span className="text-sm font-bold text-purple-300">{receipt.currency}</span>
          </div>
        </div>

        {/* ── Fee / Net / Chain ──────────────────────────────────── */}
        <div className="px-4 pt-3 grid grid-cols-3 gap-2">
          {[
            { label: 'Fee',   value: formatAmount(receipt.fee),  color: 'text-rose-300'    },
            { label: 'Net',   value: formatAmount(receipt.net),  color: 'text-emerald-300' },
            { label: 'Chain', value: receipt.chain,              color: 'text-white/80'    },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-2.5">
              <p className="text-[9px] uppercase tracking-widest text-white/30">{label}</p>
              <p className={`mt-1 text-xs font-mono font-semibold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Pending note ──────────────────────────────────────── */}
        {isPending && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Manual approval required</p>
            <p className="mt-0.5 text-[11px] text-amber-200/70 leading-relaxed">
              Your withdrawal will be processed once approved by the admin.
            </p>
          </div>
        )}

        {/* ── Transaction ───────────────────────────────────────── */}
        {tx && (
          <div className="mx-4 mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-widest text-white/30">Transaction</p>
                <p className="mt-0.5 text-[11px] font-mono text-white/70">{maskHash(tx)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tx);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    } catch { /* ignore */ }
                  }}
                  className="h-7 px-2.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-white/70 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 px-2.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 text-white/70 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Close CTA ─────────────────────────────────────────── */}
        <div className="px-4 py-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
