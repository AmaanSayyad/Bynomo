-- Migration 007: Add missing columns to withdrawal_requests
--
-- The admin wallet-insights, pending, accept, and reject API routes all SELECT
-- `notes` and `account_type` from withdrawal_requests, but those columns were
-- never included in the original schema (001_complete_schema.sql).
-- This migration adds them safely with IF NOT EXISTS guards.

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS account_type TEXT;

COMMENT ON COLUMN public.withdrawal_requests.notes        IS 'Optional admin-facing note attached to the withdrawal request.';
COMMENT ON COLUMN public.withdrawal_requests.account_type IS 'Snapshot of the user account type at time of request (free / standard / vip).';
