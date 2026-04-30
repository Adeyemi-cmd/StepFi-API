-- Migration: create users table
-- Description: Foundational identity table. Must execute FIRST — every other
--              table in this schema holds a FK to users(id) or a soft reference
--              to users.wallet_address.
--
-- Downstream hard references (FK → users.id ON DELETE CASCADE):
--   · sessions            — JWT refresh tokens & device tracking    (API-02)
--   · kyc_verifications   — KYC status & verification level         (future)
--   · reputation_cache    — on-chain score mirror (PK = user_id)    (API-09)
--   · notifications       — in-app alerts                           (API-23/24)
--   · user_preferences    — UI / notification settings              (API-05)
--
-- Downstream soft references (text → wallet_address, no FK by design):
--   · loan_index.user_wallet          — indexed from CreditLine contract
--   · investments_index.wallet_address — indexed from LiquidityPool contract
--
-- RLS integration:
--   · All user-scoped policies use current_wallet() which reads the `wallet`
--     claim from the JWT and matches against users.wallet_address.
--     See migration 20260213004000_fix_rls_policies.sql.
--
-- Idempotent: uses IF NOT EXISTS / DO $$ checks to allow safe re-runs

-- =============================================================================
-- 1. ENUM: user_status
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type public.user_status as enum (
      'active',   -- default; full access to all endpoints
      'blocked'   -- access denied; used for ToS violations or fraud
    );
  end if;
end;
$$;

-- =============================================================================
-- 2. CORE TABLE
-- =============================================================================
create table if not exists public.users (
  -- Internal surrogate PK — referenced by all child tables via FK
  id               uuid        primary key default gen_random_uuid(),

  -- Stellar public key — the external identifier used in every JWT.
  -- Also used by loan_index and investments_index as a soft reference.
  wallet_address   text        not null,

  -- Optional user-chosen handle (e.g. @maria). Lowercase, 3-30 chars.
  -- Nullable-unique: two NULL values are not considered duplicates in Postgres.
  username         text,

  -- Human-readable display name shown in the UI (e.g. "Maria Garcia").
  display_name     text,

  -- HTTPS URL to a profile picture. Validated by constraint below.
  avatar_url       text,

  -- Account standing. 'blocked' prevents login and all downstream actions.
  -- Checked by JwtAuthGuard before issuing tokens (API-03).
  status           public.user_status not null default 'active',

  -- Timestamp of the last successful authentication.
  -- Updated by AuthService.verifySignature() (API-02).
  -- Useful for session analytics and inactive-account cleanup jobs.
  last_seen_at     timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- =============================================================================
-- 3. CONSTRAINTS
-- =============================================================================

-- wallet_address: unique (one row per Stellar wallet)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_wallet_address_key'
  ) then
    alter table public.users
      add constraint users_wallet_address_key unique (wallet_address);
  end if;
end;
$$;

-- wallet_address: Stellar Ed25519 public key format — G + 55 base32 chars [A-Z2-7]
-- Matches the same regex used in DTO validation (NonceRequestDto / VerifyRequestDto)
-- so the DB and API layer enforce identical rules.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_wallet_address_format_check'
  ) then
    alter table public.users
      add constraint users_wallet_address_format_check
      check (wallet_address ~ '^G[A-Z2-7]{55}$');
  end if;
end;
$$;

-- username: nullable unique
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_key'
  ) then
    alter table public.users
      add constraint users_username_key unique (username);
  end if;
end;
$$;

-- username: when set, must be 3-30 lowercase alphanumeric chars or underscores.
-- Prevents spaces, special chars, and homoglyph abuse.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_format_check'
  ) then
    alter table public.users
      add constraint users_username_format_check
      check (username is null or username ~ '^[a-z0-9_]{3,30}$');
  end if;
end;
$$;

-- display_name: max 100 chars
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_display_name_length_check'
  ) then
    alter table public.users
      add constraint users_display_name_length_check
      check (display_name is null or char_length(display_name) <= 100);
  end if;
end;
$$;

-- avatar_url: must start with https:// when provided.
-- Enforces secure asset delivery and prevents mixed-content warnings.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_avatar_url_https_check'
  ) then
    alter table public.users
      add constraint users_avatar_url_https_check
      check (avatar_url is null or avatar_url ~ '^https://');
  end if;
end;
$$;

-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- Primary lookup path: every authenticated request resolves wallet → user
create index if not exists idx_users_wallet_address
  on public.users (wallet_address);

-- Status filter: used by AuthService to reject blocked users (API-03)
create index if not exists idx_users_status
  on public.users (status)
  where status = 'blocked';   -- partial index — only indexes the minority case

-- Activity queries: last_seen_at used by cleanup/analytics jobs
create index if not exists idx_users_last_seen_at
  on public.users (last_seen_at);

-- =============================================================================
-- 5. AUTO-UPDATE updated_at TRIGGER
-- =============================================================================
create or replace function public.set_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_users_updated_at'
  ) then
    create trigger trg_users_updated_at
    before update on public.users
    for each row
    execute function public.set_users_updated_at();
  end if;
end;
$$;

-- =============================================================================
-- 6. COMMENTS
-- =============================================================================
comment on table public.users is
  'Core identity table — one row per Stellar wallet. '
  'Root of the FK graph: sessions, kyc_verifications, reputation_cache, '
  'notifications, and user_preferences all cascade-delete from here. '
  'loan_index and investments_index reference wallet_address as a soft key.';

comment on column public.users.id is
  'Internal surrogate PK. Referenced by child tables. '
  'Not exposed in API responses — use wallet_address as the public identifier.';

comment on column public.users.wallet_address is
  'Stellar Ed25519 public key (G + 55 base32 chars). '
  'Primary external identifier. Embedded as the `wallet` claim in every JWT. '
  'Matched by current_wallet() in all RLS policies.';

comment on column public.users.username is
  'Optional unique handle (3-30 lowercase alphanumeric + underscore). '
  'NULL until the user sets it via PATCH /users/me (API-05).';

comment on column public.users.display_name is
  'Human-readable name shown in the UI. Max 100 chars. '
  'NULL until set via PATCH /users/me (API-05).';

comment on column public.users.avatar_url is
  'HTTPS URL to profile picture. NULL until set via PATCH /users/me (API-05).';

comment on column public.users.status is
  'active (default): full platform access. '
  'blocked: login rejected by JwtAuthGuard — no JWT issued, no endpoints accessible.';

comment on column public.users.last_seen_at is
  'Updated on every successful signature verification (API-02). '
  'Used by analytics and future inactive-account cleanup jobs.';
