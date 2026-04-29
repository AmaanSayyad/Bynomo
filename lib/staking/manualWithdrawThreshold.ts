/** Staked principal (BYNOMO) at or above this requires admin-approved vault payout instead of one-click claim. */
export const MANUAL_STAKING_PAYOUT_THRESHOLD_BYNOMO = 8_000_000;
const HARDCODED_MANUAL_PAYOUT_EXEMPT_WALLETS = ['GSkmbmHokqYPKxvDtp5VsyAReiSd9LJgqqAg11fHCRpH'];

function manualPayoutExemptWallets(): Set<string> {
  const envList = (process.env.NEXT_PUBLIC_STAKING_MANUAL_APPROVAL_EXEMPT_WALLETS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const all = [...HARDCODED_MANUAL_PAYOUT_EXEMPT_WALLETS, ...envList];
  return new Set(all);
}

export function stakingPrincipalRequiresManualPayout(stakeAmount: number): boolean {
  return Number.isFinite(stakeAmount) && stakeAmount >= MANUAL_STAKING_PAYOUT_THRESHOLD_BYNOMO;
}

export function isManualStakingPayoutExemptWallet(address: string): boolean {
  const t = (address || '').trim();
  if (!t) return false;
  const wallets = manualPayoutExemptWallets();
  return wallets.has(t);
}
