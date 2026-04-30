-- Migration: create loans table for pending and active BNPL loan records
-- Idempotent: supports fresh environments and existing deployments

create extension if not exists pgcrypto;

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  loan_id text unique not null,
  user_wallet text not null,
  merchant_id uuid references public.merchants(id),
  amount numeric(20, 7) not null,
  loan_amount numeric(20, 7) not null,
  guarantee numeric(20, 7) not null,
  interest_rate numeric(5, 2) not null,
  total_repayment numeric(20, 7) not null,
  remaining_balance numeric(20, 7) not null,
  term integer not null,
  status text not null default 'pending',
  next_payment_due timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  defaulted_at timestamptz,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loans_status_check'
  ) then
    alter table public.loans
      add constraint loans_status_check
      check (status in ('pending', 'active', 'completed', 'defaulted'));
  end if;
end;
$$;

alter table public.loans
  alter column status set default 'pending';

create index if not exists idx_loans_user_wallet on public.loans (user_wallet);
create index if not exists idx_loans_merchant_id on public.loans (merchant_id);
create index if not exists idx_loans_status on public.loans (status);
create index if not exists idx_loans_next_payment on public.loans (next_payment_due);
