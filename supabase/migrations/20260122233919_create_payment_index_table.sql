-- Migration: create payment_index table and indexes
-- Idempotent: uses IF NOT EXISTS checks to allow safe re-runs

create table if not exists public.payment_index (
  id uuid primary key default gen_random_uuid(),
  loan_id text not null,
  tx_hash text not null,
  amount numeric(20, 7) not null,
  paid_at timestamp not null,
  created_at timestamp default now()
);

-- Check constraint: payment amount must be positive
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_index_amount_positive_check'
  ) then
    alter table public.payment_index
      add constraint payment_index_amount_positive_check
      check (amount > 0);
  end if;
end;
$$;

-- Indexes for common queries
create index if not exists idx_payment_index_loan_id on public.payment_index (loan_id);
create index if not exists idx_payment_index_tx_hash on public.payment_index (tx_hash);
create index if not exists idx_payment_index_paid_at on public.payment_index (paid_at);
