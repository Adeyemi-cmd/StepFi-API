-- Migration: fix payment_index timestamp columns — add timezone awareness
-- Description: payment_index used plain `timestamp` (no timezone) while every
--              other table in the schema uses `timestamptz`. This inconsistency
--              can produce silent time-offset bugs for users in non-UTC timezones.
--              This migration converts both columns to timestamptz.
-- Idempotent: checks column type before altering

-- Convert paid_at to timestamptz
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'payment_index'
      and column_name  = 'paid_at'
      and data_type    = 'timestamp without time zone'
  ) then
    alter table public.payment_index
      alter column paid_at type timestamptz
      using paid_at at time zone 'UTC';
  end if;
end;
$$;

-- Convert created_at to timestamptz and add NOT NULL + default
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'payment_index'
      and column_name  = 'created_at'
      and data_type    = 'timestamp without time zone'
  ) then
    alter table public.payment_index
      alter column created_at type timestamptz
      using created_at at time zone 'UTC';

    alter table public.payment_index
      alter column created_at set not null;

    alter table public.payment_index
      alter column created_at set default now();
  end if;
end;
$$;

-- Add missing tx_hash unique constraint to prevent duplicate indexing
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_index_tx_hash_key'
  ) then
    alter table public.payment_index
      add constraint payment_index_tx_hash_key unique (tx_hash);
  end if;
end;
$$;

-- Comments
comment on table public.payment_index is
  'Off-chain index of on-chain loan repayment transactions. '
  'Written only by the chain indexer job using the service role.';
comment on column public.payment_index.paid_at is
  'UTC timestamp of the Stellar transaction that recorded this payment.';
comment on column public.payment_index.tx_hash is
  'Stellar transaction hash. Unique — prevents duplicate indexing.';
