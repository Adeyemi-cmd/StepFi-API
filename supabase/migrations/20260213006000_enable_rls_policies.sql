-- Migration: enable RLS and define security policies for all tables
-- Description: Must run LAST — depends on every table being created first.
--
-- Execution order dependency:
--   Requires: users, sessions, kyc_verifications, reputation_cache,
--             notifications, user_preferences, loan_index, payment_index,
--             investments_index
--
-- Auth model:
--   Authentication is wallet-based (Stellar). The NestJS API signs JWTs with
--   a top-level `wallet` claim. The helper function current_wallet() reads
--   that claim so RLS policies can resolve the user without a separate lookup.
--
-- Access model:
--   - Profile tables (users, sessions, notifications, kyc, preferences):
--     users can only read/write their own rows.
--   - Index tables (reputation_cache, loan_index, payment_index,
--     investments_index): read-only for any authenticated user.
--     Writes happen exclusively via the service role (indexer jobs).
--   - Service role bypasses RLS automatically — used for all background jobs.
--
-- Idempotent: uses DROP POLICY IF EXISTS before every CREATE POLICY.

BEGIN;

-- =============================================================================
-- HELPER: current_wallet()
-- Reads the Stellar wallet address from the current JWT claims.
-- Returns NULL when there is no authenticated session.
-- =============================================================================
create or replace function public.current_wallet()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'wallet',
    ''
  );
$$;

comment on function public.current_wallet() is
  'Returns the Stellar wallet address embedded in the current JWT. '
  'Returns NULL when called outside an authenticated session. '
  'Used by all user-scoped RLS policies.';

-- =============================================================================
-- USERS TABLE
-- Users can only read and update their own row.
-- =============================================================================
alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_select_own" on public.users
  for select
  using (wallet_address = public.current_wallet());

create policy "users_update_own" on public.users
  for update
  using  (wallet_address = public.current_wallet())
  with check (wallet_address = public.current_wallet());

-- =============================================================================
-- SESSIONS TABLE
-- Users can only read their own sessions (issued by AuthService — API-02).
-- Insert/delete handled by service role only.
-- =============================================================================
alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;

create policy "sessions_select_own" on public.sessions
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- USER_PREFERENCES TABLE
-- Users can read, update and insert their own preferences (API-05).
-- =============================================================================
alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
drop policy if exists "user_preferences_update_own" on public.user_preferences;
drop policy if exists "user_preferences_insert_own" on public.user_preferences;

create policy "user_preferences_select_own" on public.user_preferences
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

create policy "user_preferences_update_own" on public.user_preferences
  for update
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  )
  with check (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

create policy "user_preferences_insert_own" on public.user_preferences
  for insert
  with check (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- NOTIFICATIONS TABLE
-- Users can read and mark-as-read their own notifications (API-23/24).
-- Insert handled by service role (reminder job — API-22).
-- =============================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;

create policy "notifications_select_own" on public.notifications
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

create policy "notifications_update_own" on public.notifications
  for update
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  )
  with check (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- KYC_VERIFICATIONS TABLE
-- Users can only read their own KYC records.
-- Insert/update done by service role (KYC provider webhook).
-- =============================================================================
alter table public.kyc_verifications enable row level security;

drop policy if exists "kyc_verifications_select_own" on public.kyc_verifications;

create policy "kyc_verifications_select_own" on public.kyc_verifications
  for select
  using (
    user_id = (
      select id from public.users
      where wallet_address = public.current_wallet()
      limit 1
    )
  );

-- =============================================================================
-- REPUTATION_CACHE TABLE  (indexed on-chain data — read-only for users)
-- Any authenticated user can read reputation data (public on-chain info).
-- Writes done exclusively by the chain indexer job (service role — API-20).
-- =============================================================================
alter table public.reputation_cache enable row level security;

drop policy if exists "reputation_cache_select_authenticated" on public.reputation_cache;

create policy "reputation_cache_select_authenticated" on public.reputation_cache
  for select
  to authenticated
  using (true);

-- =============================================================================
-- LOAN_INDEX TABLE  (indexed on-chain data — read-only for users)
-- Any authenticated user can read loan index data (public on-chain info).
-- Writes done exclusively by the chain indexer job (service role — API-20).
-- =============================================================================
alter table public.loan_index enable row level security;

drop policy if exists "loan_index_select_authenticated" on public.loan_index;

create policy "loan_index_select_authenticated" on public.loan_index
  for select
  to authenticated
  using (true);

-- =============================================================================
-- PAYMENT_INDEX TABLE  (indexed on-chain data — read-only for users)
-- Any authenticated user can read payment data (public on-chain info).
-- Writes done exclusively by the chain indexer job (service role — API-20).
-- =============================================================================
alter table public.payment_index enable row level security;

drop policy if exists "payment_index_select_authenticated" on public.payment_index;

create policy "payment_index_select_authenticated" on public.payment_index
  for select
  to authenticated
  using (true);

-- =============================================================================
-- INVESTMENTS_INDEX TABLE  (indexed on-chain data — read-only for users)
-- Any authenticated user can read investment data (public on-chain info).
-- Writes done exclusively by the chain indexer job (service role — API-20).
-- =============================================================================
alter table public.investments_index enable row level security;

drop policy if exists "investments_index_select_authenticated" on public.investments_index;

create policy "investments_index_select_authenticated" on public.investments_index
  for select
  to authenticated
  using (true);

COMMIT;
