/** Matches DB `claim_staking_position` reward rounding (8 dp). */
export function estimateStakingReward(amount: number, apyBps: number, lockDays: number): number {
  return Math.round(amount * (apyBps / 10000) * (lockDays / 365) * 1e8) / 1e8;
}

export function estimateTotalPayout(amount: number, apyBps: number, lockDays: number): number {
  return amount + estimateStakingReward(amount, apyBps, lockDays);
}
