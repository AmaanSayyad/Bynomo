/**
 * Platform / protocol fee collector helpers.
 *
 * Business rule:
 * - Charge tiered fee on every deposit and withdrawal (regardless of profit/loss):
 *   free=10%, standard=9%, vip=8%.
 * - Transfer the fee from the chain treasury to a dedicated collector wallet.
 */

export type UserTier = 'free' | 'standard' | 'vip';

export const FEE_PERCENT_BY_TIER: Record<UserTier, number> = {
  free: 0.10,
  standard: 0.09,
  vip: 0.08,
};

const DEFAULT_FEE_PERCENT = FEE_PERCENT_BY_TIER.free;

function normalizeTier(tier?: string | null): UserTier {
  if (tier === 'standard' || tier === 'vip' || tier === 'free') return tier;
  return 'free';
}

export function getFeePercent(tier?: string | null): number {
  return FEE_PERCENT_BY_TIER[normalizeTier(tier)];
}

export function getFeePercentLabel(tier?: string | null): string {
  return `${Math.round(getFeePercent(tier) * 100)}%`;
}

export function calculateFeeAmount(amount: number, tier?: string | null): number {
  // Keep numeric stability (UI inputs are typically <= 4 decimals, but we round to 8).
  const fee = amount * getFeePercent(tier);
  return Math.floor(fee * 1e8) / 1e8;
}

function getEnvOptional(key: string): string | null {
  const val = process.env[key];
  return val && val.trim() ? val.trim() : null;
}

export function getPlatformFeeWalletAddress(normalizedCurrency: string): string | null {
  // PC (Push Chain native token) has its own dedicated treasury wallet.
  // Set NEXT_PUBLIC_PLATFORM_FEE_WALLET_PC to your PC treasury address.
  // Falls back to the generic EVM fee wallet if not configured.
  if (normalizedCurrency === 'PC') {
    return (
      getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_PC') ||
      getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM')
    );
  }

  if (
    normalizedCurrency === 'BNB' ||
    normalizedCurrency === 'PUSH' ||
    normalizedCurrency === 'SOMNIA' ||
    normalizedCurrency === 'STT' ||
    normalizedCurrency === '0G'
  ) {
    return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_EVM');
  }

  // OCT is Sui-compatible — needs a Sui-format address, not an EVM address
  if (normalizedCurrency === 'OCT') {
    return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_OCT');
  }

  if (normalizedCurrency === 'SOL' || normalizedCurrency === 'BYNOMO') {
    return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_SOL');
  }

  if (normalizedCurrency === 'SUI' || normalizedCurrency === 'USDC') {
    return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_SUI');
  }
  if (normalizedCurrency === 'XLM') return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_XLM');
  if (normalizedCurrency === 'XTZ') return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_XTZ');
  if (normalizedCurrency === 'NEAR') return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_NEAR');
  if (normalizedCurrency === 'STRK') return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_STRK');
  if (normalizedCurrency === 'INIT') return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_INIT');
  if (normalizedCurrency === 'APT') return getEnvOptional('NEXT_PUBLIC_PLATFORM_FEE_WALLET_APT');

  return null;
}

const BYNOMO_MINT = 'Faw8wwB6MnyAm9xG3qeXgN1isk9agXBoaRZX9Ma8BAGS';

/**
 * Transfers `feeAmount` from the chain treasury to the platform fee collector.
 * Returns the fee-transfer tx hash/digest when available.
 */
export async function collectPlatformFeeFromTreasury(
  normalizedCurrency: string,
  feeAmount: number,
): Promise<string | null> {
  if (!feeAmount || feeAmount <= 0) return null;

  const feeWallet = getPlatformFeeWalletAddress(normalizedCurrency);
  if (!feeWallet) {
    // Fee wallet not configured — skip transfer but do not block deposit/withdrawal.
    console.warn(`[platformFee] Fee wallet not configured for ${normalizedCurrency}. Skipping fee collection.`);
    return null;
  }

  // Use dynamic imports to avoid bundling unused chain SDKs.
  if (normalizedCurrency === 'BNB') {
    const { transferBNBFromTreasury } = await import('@/lib/bnb/backend-client');
    return transferBNBFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'PUSH') {
    const { transferPUSHFromTreasury } = await import('@/lib/push/backend-client');
    return transferPUSHFromTreasury(feeWallet, feeAmount);
  }

  // PC uses its own treasury transfer so the fee goes to the PC treasury wallet.
  if (normalizedCurrency === 'PC') {
    const { transferPCFromTreasury } = await import('@/lib/push/backend-client');
    return transferPCFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'SOMNIA' || normalizedCurrency === 'STT') {
    const { transferSOMNIAFromTreasury } = await import('@/lib/somnia/backend-client');
    return transferSOMNIAFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'OCT') {
    const { transferOCTFromTreasury } = await import('@/lib/onechain/backend-client');
    return transferOCTFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === '0G') {
    const { transferZGFromTreasury } = await import('@/lib/zg/backend-client');
    return transferZGFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'SOL') {
    const { transferSOLFromTreasury } = await import('@/lib/solana/backend-client');
    return transferSOLFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'BYNOMO') {
    const { transferTokenFromTreasury } = await import('@/lib/solana/backend-client');
    return transferTokenFromTreasury(feeWallet, feeAmount, BYNOMO_MINT);
  }

  if (normalizedCurrency === 'SUI') {
    const { transferSUIFromTreasury } = await import('@/lib/sui/backend-client');
    return transferSUIFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'USDC') {
    const { transferUSDCFromTreasury } = await import('@/lib/sui/backend-client');
    return transferUSDCFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'XLM') {
    const { transferXLMFromTreasury } = await import('@/lib/stellar/backend-client');
    return transferXLMFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'XTZ') {
    const { transferXTZFromTreasury } = await import('@/lib/tezos/backend-client');
    return transferXTZFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'NEAR') {
    const { transferNEARFromTreasury } = await import('@/lib/near/backend-client');
    return transferNEARFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'STRK') {
    const { transferSTRKFromTreasury } = await import('@/lib/starknet/backend-client');
    return transferSTRKFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'INIT') {
    const { transferINITFromTreasury } = await import('@/lib/initia/backend-client');
    return transferINITFromTreasury(feeWallet, feeAmount);
  }

  if (normalizedCurrency === 'APT') {
    const { transferAPTFromTreasury } = await import('@/lib/aptos/backend-client');
    return transferAPTFromTreasury(feeWallet, feeAmount);
  }

  throw new Error(`Unsupported currency for fee transfer: ${normalizedCurrency}`);
}

export { DEFAULT_FEE_PERCENT };

