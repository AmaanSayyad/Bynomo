import { canonicalHouseUserAddress } from '@/lib/wallet/canonicalAddress';

const HARDCODED_FREQUENCY_REVIEW_EXEMPT_WALLETS = ['GSkmbmHokqYPKxvDtp5VsyAReiSd9LJgqqAg11fHCRpH'];

function frequencyReviewExemptWalletSet(): Set<string> {
  const envList = (process.env.WITHDRAWAL_FREQUENCY_REVIEW_EXEMPT_WALLETS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const normalized = [...HARDCODED_FREQUENCY_REVIEW_EXEMPT_WALLETS, ...envList].map((addr) =>
    canonicalHouseUserAddress(addr),
  );
  return new Set(normalized);
}

export function isWithdrawalFrequencyReviewExemptWallet(address: string): boolean {
  const normalized = canonicalHouseUserAddress((address || '').trim());
  if (!normalized) return false;
  return frequencyReviewExemptWalletSet().has(normalized);
}

