-- Large staking maturities (principal >= 8M BYNOMO): queue vault payout for admin approval.

CREATE TABLE IF NOT EXISTS public.staking_withdrawal_requests (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_address   TEXT NOT NULL,
  position_id    BIGINT NOT NULL REFERENCES public.staking_positions(id),
  currency       TEXT NOT NULL DEFAULT 'BYNOMO',
  stake_amount   NUMERIC(30, 8) NOT NULL CHECK (stake_amount > 0),
  reward_amount  NUMERIC(30, 8) NOT NULL CHECK (reward_amount >= 0),
  payout_amount  NUMERIC(30, 8) NOT NULL CHECK (payout_amount > 0),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at     TIMESTAMPTZ,
  decided_by     TEXT,
  tx_hash        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staking_wr_one_pending_per_position
  ON public.staking_withdrawal_requests (position_id)
  WHERE (status = 'pending');

CREATE INDEX IF NOT EXISTS idx_staking_wr_status_requested
  ON public.staking_withdrawal_requests (status, requested_at DESC);

ALTER TABLE public.staking_withdrawal_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staking_withdrawal_requests FROM anon, authenticated;
