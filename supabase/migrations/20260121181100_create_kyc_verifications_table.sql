-- Migration: create kyc_verifications table and supporting enums
-- Idempotent: uses IF NOT EXISTS checks to allow safe re-runs

-- Enum for KYC status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'kyc_status') then
    create type public.kyc_status as enum ('none', 'pending', 'verified', 'rejected');
  end if;
end;
$$;

-- Enum for verification level
do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_level') then
    create type public.verification_level as enum ('L0', 'L1', 'L2');
  end if;
end;
$$;

-- Core kyc_verifications table
create table if not exists public.kyc_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  status public.kyc_status not null default 'none',
  verification_level public.verification_level not null default 'L0',
  verified_at timestamptz,
  risk_flags jsonb,
  created_at timestamptz not null default now()
);

-- Check constraint: verified_at only set when status is 'verified'
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kyc_verifications_verified_at_status_check'
  ) then
    alter table public.kyc_verifications
      add constraint kyc_verifications_verified_at_status_check 
      check (
        (status = 'verified' and verified_at is not null) or 
        (status != 'verified' and verified_at is null)
      );
  end if;
end;
$$;

-- Index on user_id for user KYC queries
create index if not exists idx_kyc_verifications_user_id 
  on public.kyc_verifications (user_id);

-- Index on status for filtering by verification status
create index if not exists idx_kyc_verifications_status 
  on public.kyc_verifications (status);

-- Composite index for common query pattern: get user's verifications by status
create index if not exists idx_kyc_verifications_user_status 
  on public.kyc_verifications (user_id, status);

-- Comment on table for documentation
comment on table public.kyc_verifications is 
  'Stores KYC verification status and metadata. Privacy-first: no biometric or document data stored.';

comment on column public.kyc_verifications.provider is 
  'KYC provider name (e.g., sumsub, onfido)';

comment on column public.kyc_verifications.risk_flags is 
  'Flexible JSONB structure for risk metadata from providers';

comment on column public.kyc_verifications.verified_at is 
  'Timestamp when verification completed. Only set when status is verified.';
