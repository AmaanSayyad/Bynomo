export function computeStakingPayout(amount: number, apyBps: number, lockDays: number): {
  reward: number;
  payout: number;
} {
  const reward = Math.round(amount * (apyBps / 10000) * (lockDays / 365) * 1e8) / 1e8;
  const payout = amount + reward;
  return { reward, payout };
}
