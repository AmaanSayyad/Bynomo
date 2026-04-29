import { NextRequest, NextResponse } from 'next/server';
import { isDemoBetHistoryRow, walletAddressSearchVariants } from '@/lib/admin/walletAddressVariants';
import { requireAdminAuth } from '@/lib/admin/requireAdminAuth';
import { supabaseService as supabase } from '@/lib/supabase/serviceClient';
import { canonicalHouseUserAddress } from '@/lib/wallet/canonicalAddress';
import { isWithdrawalFrequencyReviewExemptWallet } from '@/lib/withdrawals/frequencyReviewExempt';

const FREQUENCY_REVIEW_THRESHOLD = 10;

export async function GET(_request: NextRequest) {
    const deny = requireAdminAuth(_request);
    if (deny) return deny;
    try {
        // ── 1. Suspicious win-streak detection ────────────────────────────────
        const { data: allBets, error: betError } = await supabase
            .from('bet_history')
            .select('id, wallet_address, won, created_at')
            .order('created_at', { ascending: false });

        if (betError) throw betError;

        const userBets: Record<string, boolean[]> = {};
        (allBets ?? [])
            .filter((b: any) => !isDemoBetHistoryRow(b))
            .forEach((b: any) => {
                if (!userBets[b.wallet_address]) userBets[b.wallet_address] = [];
                userBets[b.wallet_address].push(b.won);
            });

        const suspiciousUsers: any[] = [];
        for (const [address, results] of Object.entries(userBets)) {
            let currentStreak = 0, maxStreak = 0;
            for (const won of results) {
                if (won) { currentStreak++; }
                else { maxStreak = Math.max(maxStreak, currentStreak); currentStreak = 0; }
            }
            maxStreak = Math.max(maxStreak, currentStreak);

            if (maxStreak >= 10) {
                // Explicit column selection to avoid exposing sensitive future columns
                const { data: userData } = await supabase
                    .from('user_balances')
                    .select('id, user_address, currency, balance, status, tier, updated_at, created_at')
                    .eq('user_address', address);
                if (userData && userData.length > 0) {
                    suspiciousUsers.push({ ...userData[0], maxStreak, latestBets: results.slice(0, 10) });
                }
            }
        }

        // ── 2. High-frequency withdrawal users ────────────────────────────────
        // Count completed withdrawals (balance_audit_log) + pending ones per address.
        const { data: auditWithdrawals } = await supabase
            .from('balance_audit_log')
            .select('user_address, currency, amount')
            .eq('operation_type', 'withdrawal');

        const { data: pendingWithdrawals } = await supabase
            .from('withdrawal_requests')
            .select('user_address, currency, amount, decided_by, requested_at, id')
            .eq('status', 'pending');

        // Aggregate per user_address (cross-chain)
        type WdStats = {
            user_address: string;
            completed_count: number;
            pending_count: number;
            total_count: number;
            total_withdrawn: number;
            pending_amount: number;
            pending_requests: any[];
            currencies: Set<string>;
        };
        const wdMap: Record<string, WdStats> = {};
        const norm = (a: string) => canonicalHouseUserAddress(a || '');

        (auditWithdrawals ?? []).forEach((r: any) => {
            const k = norm(r.user_address);
            if (!wdMap[k]) wdMap[k] = {
                user_address: k,
                completed_count: 0, pending_count: 0, total_count: 0,
                total_withdrawn: 0, pending_amount: 0,
                pending_requests: [], currencies: new Set(),
            };
            wdMap[k].completed_count++;
            wdMap[k].total_withdrawn += Number(r.amount);
            wdMap[k].currencies.add(r.currency);
        });

        (pendingWithdrawals ?? []).forEach((r: any) => {
            const k = norm(r.user_address);
            if (!wdMap[k]) wdMap[k] = {
                user_address: k,
                completed_count: 0, pending_count: 0, total_count: 0,
                total_withdrawn: 0, pending_amount: 0,
                pending_requests: [], currencies: new Set(),
            };
            wdMap[k].pending_count++;
            wdMap[k].pending_amount += Number(r.amount);
            wdMap[k].currencies.add(r.currency);
            wdMap[k].pending_requests.push(r);
        });

        // Filter to users who have hit the threshold
        const frequencyUsers: any[] = [];
        for (const stats of Object.values(wdMap)) {
            stats.total_count = stats.completed_count + stats.pending_count;
            if (stats.total_count < FREQUENCY_REVIEW_THRESHOLD) continue;
            if (isWithdrawalFrequencyReviewExemptWallet(stats.user_address)) continue;

            // Enrich with deposit/balance/P&L data (include legacy EVM casing variants)
            const addrVariants = walletAddressSearchVariants(stats.user_address);
            const { data: auditDeposits } = await supabase
                .from('balance_audit_log')
                .select('amount, currency')
                .eq('operation_type', 'deposit')
                .in('user_address', addrVariants);

            const { data: balances } = await supabase
                .from('user_balances')
                .select('currency, balance')
                .in('user_address', addrVariants);

            const totalDeposited = (auditDeposits ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
            const totalAvailableBalance = (balances ?? []).reduce((s: number, r: any) => s + Number(r.balance), 0);
            const netPnl = (stats.total_withdrawn + totalAvailableBalance) - totalDeposited;

            // Check if any pending request is frequency-flagged
            const hasFrequencyFlag = stats.pending_requests.some((r: any) =>
                typeof r.decided_by === 'string' && r.decided_by.startsWith('FREQUENCY_REVIEW')
            );

            frequencyUsers.push({
                user_address: stats.user_address,
                completed_withdrawals: stats.completed_count,
                pending_withdrawals: stats.pending_count,
                total_withdrawals: stats.total_count,
                total_withdrawn: stats.total_withdrawn,
                pending_amount: stats.pending_amount,
                pending_requests: stats.pending_requests,
                currencies: Array.from(stats.currencies),
                total_deposited: totalDeposited,
                total_available_balance: totalAvailableBalance,
                net_pnl: netPnl,
                has_frequency_flag: hasFrequencyFlag,
            });
        }

        // Sort by total_withdrawals desc
        frequencyUsers.sort((a, b) => b.total_withdrawals - a.total_withdrawals);

        return NextResponse.json({ suspiciousUsers, frequencyUsers });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
