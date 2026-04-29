-- Migration 008: Fixed-term BYNOMO staking (30/60/90 days)

CREATE TABLE IF NOT EXISTS public.staking_pools (
  pool_key      TEXT PRIMARY KEY,
  lock_days     INTEGER NOT NULL CHECK (lock_days > 0),
  apy_bps       INTEGER NOT NULL CHECK (apy_bps > 0),
  min_stake     NUMERIC(30, 8) NOT NULL DEFAULT 1 CHECK (min_stake > 0),
  max_stake     NUMERIC(30, 8),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staking_positions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_address   TEXT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'BYNOMO',
  pool_key       TEXT NOT NULL REFERENCES public.staking_pools(pool_key),
  lock_days      INTEGER NOT NULL CHECK (lock_days > 0),
  apy_bps        INTEGER NOT NULL CHECK (apy_bps > 0),
  amount         NUMERIC(30, 8) NOT NULL CHECK (amount > 0),
  start_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlock_at      TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'cancelled')),
  reward_amount  NUMERIC(30, 8),
  total_payout   NUMERIC(30, 8),
  claimed_at     TIMESTAMPTZ,
  tx_hash        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staking_ledger (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_address  TEXT NOT NULL,
  position_id   BIGINT NOT NULL REFERENCES public.staking_positions(id) ON DELETE CASCADE,
  currency      TEXT NOT NULL DEFAULT 'BYNOMO',
  operation     TEXT NOT NULL CHECK (operation IN ('stake', 'claim')),
  amount        NUMERIC(30, 8) NOT NULL CHECK (amount >= 0),
  reward_amount NUMERIC(30, 8),
  tx_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staking_positions_user ON public.staking_positions(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staking_positions_status_unlock ON public.staking_positions(status, unlock_at);
CREATE INDEX IF NOT EXISTS idx_staking_ledger_user ON public.staking_ledger(user_address, created_at DESC);

INSERT INTO public.staking_pools (pool_key, lock_days, apy_bps, min_stake, is_active)
VALUES
  ('BYNOMO_30D', 30, 800, 1, true),
  ('BYNOMO_60D', 60, 1200, 1, true),
  ('BYNOMO_90D', 90, 1800, 1, true)
ON CONFLICT (pool_key) DO UPDATE
SET
  lock_days = EXCLUDED.lock_days,
  apy_bps = EXCLUDED.apy_bps,
  min_stake = EXCLUDED.min_stake,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

DROP FUNCTION IF EXISTS public.create_staking_position(TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.create_staking_position(
  p_user_address TEXT,
  p_pool_key     TEXT,
  p_amount       NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_pool          public.staking_pools%ROWTYPE;
  v_balance       NUMERIC;
  v_status        TEXT;
  v_new_balance   NUMERIC;
  v_position_id   BIGINT;
  v_unlock_at     TIMESTAMPTZ;
BEGIN
  IF public.is_wallet_globally_banned(p_user_address) THEN
    RETURN json_build_object('success', false, 'error', 'This wallet is banned from the platform.');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Stake amount must be greater than zero.');
  END IF;

  SELECT * INTO v_pool
  FROM public.staking_pools
  WHERE pool_key = p_pool_key AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Staking pool is not available.');
  END IF;

  IF p_amount < v_pool.min_stake THEN
    RETURN json_build_object('success', false, 'error', 'Stake amount is below pool minimum.');
  END IF;

  IF v_pool.max_stake IS NOT NULL AND p_amount > v_pool.max_stake THEN
    RETURN json_build_object('success', false, 'error', 'Stake amount exceeds pool maximum.');
  END IF;

  SELECT balance, status INTO v_balance, v_status
  FROM public.user_balances
  WHERE user_address = p_user_address AND currency = 'BYNOMO'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'BYNOMO balance row not found.');
  END IF;

  IF v_status = 'frozen' THEN
    RETURN json_build_object('success', false, 'error', 'Account is frozen.');
  END IF;
  IF v_status = 'banned' THEN
    RETURN json_build_object('success', false, 'error', 'Account is banned.');
  END IF;
  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient BYNOMO balance.');
  END IF;

  v_new_balance := v_balance - p_amount;
  UPDATE public.user_balances
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_address = p_user_address AND currency = 'BYNOMO';

  v_unlock_at := NOW() + make_interval(days => v_pool.lock_days);

  INSERT INTO public.staking_positions (
    user_address, currency, pool_key, lock_days, apy_bps, amount, start_at, unlock_at, status
  )
  VALUES (
    p_user_address, 'BYNOMO', v_pool.pool_key, v_pool.lock_days, v_pool.apy_bps, p_amount, NOW(), v_unlock_at, 'active'
  )
  RETURNING id INTO v_position_id;

  INSERT INTO public.staking_ledger (user_address, position_id, currency, operation, amount)
  VALUES (p_user_address, v_position_id, 'BYNOMO', 'stake', p_amount);

  RETURN json_build_object(
    'success', true,
    'position_id', v_position_id,
    'new_balance', v_new_balance,
    'unlock_at', v_unlock_at
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

DROP FUNCTION IF EXISTS public.claim_staking_position(TEXT, BIGINT);
CREATE OR REPLACE FUNCTION public.claim_staking_position(
  p_user_address TEXT,
  p_position_id  BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_pos          public.staking_positions%ROWTYPE;
  v_balance      NUMERIC;
  v_status       TEXT;
  v_new_balance  NUMERIC;
  v_reward       NUMERIC(30, 8);
  v_payout       NUMERIC(30, 8);
BEGIN
  IF public.is_wallet_globally_banned(p_user_address) THEN
    RETURN json_build_object('success', false, 'error', 'This wallet is banned from the platform.');
  END IF;

  SELECT * INTO v_pos
  FROM public.staking_positions
  WHERE id = p_position_id
    AND user_address = p_user_address
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Staking position not found.');
  END IF;

  IF v_pos.status <> 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Position is not claimable.');
  END IF;

  IF NOW() < v_pos.unlock_at THEN
    RETURN json_build_object('success', false, 'error', 'Position is still locked.', 'unlock_at', v_pos.unlock_at);
  END IF;

  v_reward := ROUND(v_pos.amount * (v_pos.apy_bps::NUMERIC / 10000.0) * (v_pos.lock_days::NUMERIC / 365.0), 8);
  v_payout := v_pos.amount + v_reward;

  SELECT balance, status INTO v_balance, v_status
  FROM public.user_balances
  WHERE user_address = p_user_address AND currency = 'BYNOMO'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_balances (user_address, currency, balance, status, updated_at)
    VALUES (p_user_address, 'BYNOMO', v_payout, 'active', NOW());
    v_new_balance := v_payout;
  ELSE
    IF v_status = 'frozen' THEN
      RETURN json_build_object('success', false, 'error', 'Account is frozen.');
    END IF;
    IF v_status = 'banned' THEN
      RETURN json_build_object('success', false, 'error', 'Account is banned.');
    END IF;
    v_new_balance := v_balance + v_payout;
    UPDATE public.user_balances
    SET balance = v_new_balance, updated_at = NOW()
    WHERE user_address = p_user_address AND currency = 'BYNOMO';
  END IF;

  UPDATE public.staking_positions
  SET
    status = 'claimed',
    reward_amount = v_reward,
    total_payout = v_payout,
    claimed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_pos.id;

  INSERT INTO public.staking_ledger (user_address, position_id, currency, operation, amount, reward_amount)
  VALUES (p_user_address, v_pos.id, 'BYNOMO', 'claim', v_payout, v_reward);

  RETURN json_build_object(
    'success', true,
    'position_id', v_pos.id,
    'reward_amount', v_reward,
    'payout_amount', v_payout,
    'new_balance', v_new_balance
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
