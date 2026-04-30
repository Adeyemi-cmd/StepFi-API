-- Migration: fix reputation_cache score constraint
-- Description: The original constraint allowed scores up to 1000, but the
--              Reputation Soroban contract stores scores as u32 in the 0–100 range.
--              This migration drops the incorrect constraint and adds the correct one.
-- Idempotent: uses IF NOT EXISTS / IF EXISTS checks to allow safe re-runs

-- Drop the incorrect constraint if it exists
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'reputation_cache_score_range_check'
  ) then
    alter table public.reputation_cache
      drop constraint reputation_cache_score_range_check;
  end if;
end;
$$;

-- Add the correct constraint (0–100, matching the on-chain contract range)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reputation_cache_score_range_check'
  ) then
    alter table public.reputation_cache
      add constraint reputation_cache_score_range_check
      check (score >= 0 and score <= 100);
  end if;
end;
$$;

-- Comments
comment on column public.reputation_cache.score is
  'On-chain reputation score in the 0–100 range, as defined by the Reputation Soroban contract.';
comment on column public.reputation_cache.tier is
  'Derived credit tier: bronze (0–59), silver (60–89), gold (90–100).';
