-- Migration: create indexer support tables (reputation_history + indexer_cursor)
-- and add idempotency columns/constraints to existing tables.
-- Idempotent: uses IF NOT EXISTS / DO $$ checks throughout.

-- ============================================================================
-- 1. reputation_history — individual reputation change events from on-chain
-- ============================================================================
create table if not exists public.reputation_history (
  id         uuid primary key default gen_random_uuid(),
  event_id   text unique not null,          -- Soroban event id for idempotency
  user_wallet text not null,
  old_score  integer not null,
  new_score  integer not null,
  change_amount integer not null,
  reason     text not null,
  transaction_hash text,
  ledger_sequence bigint not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_reputation_history_user_wallet
  on public.reputation_history (user_wallet);
create index if not exists idx_reputation_history_changed_at
  on public.reputation_history (changed_at);
create index if not exists idx_reputation_history_ledger
  on public.reputation_history (ledger_sequence);

-- ============================================================================
-- 2. indexer_cursor — tracks last indexed ledger per contract
-- ============================================================================
create table if not exists public.indexer_cursor (
  contract_id  text primary key,
  last_ledger  bigint not null default 0,
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- 3. Add event_id column to loan_index for idempotent inserts
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'loan_index'
      and column_name  = 'event_id'
  ) then
    alter table public.loan_index add column event_id text;
  end if;
end;
$$;

-- Create unique index on event_id (partial — only non-null values)
create unique index if not exists loan_index_event_id_uniq
  on public.loan_index (event_id) where event_id is not null;

-- ============================================================================
-- 4. Unique constraint on payment_index (tx_hash, loan_id) for repayment idempotency
-- ============================================================================
create unique index if not exists payment_index_tx_loan_uniq
  on public.payment_index (tx_hash, loan_id);
