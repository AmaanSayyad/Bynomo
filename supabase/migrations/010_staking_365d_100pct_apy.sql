-- 365-day BYNOMO pool at 100% APY (apy_bps = 10_000 → principal × 1.0 reward over full year).

INSERT INTO public.staking_pools (pool_key, lock_days, apy_bps, min_stake, is_active)
VALUES ('BYNOMO_365D', 365, 10000, 1, true)
ON CONFLICT (pool_key) DO UPDATE
SET
  lock_days = EXCLUDED.lock_days,
  apy_bps = EXCLUDED.apy_bps,
  min_stake = EXCLUDED.min_stake,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
