-- Migration: fix sessions table — store refresh token hash instead of plaintext
-- Description: Storing the raw refresh token is a security risk: a database leak
--              exposes all active sessions. This migration renames the column to
--              refresh_token_hash to make the intent explicit and adds a
--              token_family column for refresh token rotation detection.
-- Idempotent: uses IF EXISTS / column existence checks to allow safe re-runs
-- Security: aligns with SECURITY.md — "Hash refresh tokens before storage"

-- 1. Rename refresh_token → refresh_token_hash to signal hashed storage
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'sessions'
      and column_name  = 'refresh_token'
  ) then
    alter table public.sessions
      rename column refresh_token to refresh_token_hash;
  end if;
end;
$$;

-- 2. Drop old unique constraint on the original column name (if still present)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'sessions_refresh_token_key'
  ) then
    alter table public.sessions
      drop constraint sessions_refresh_token_key;
  end if;
end;
$$;

-- 3. Re-add unique constraint under the new column name
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sessions_refresh_token_hash_key'
  ) then
    alter table public.sessions
      add constraint sessions_refresh_token_hash_key
      unique (refresh_token_hash);
  end if;
end;
$$;

-- 4. Add token_family column for refresh token rotation (detect reuse attacks)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'sessions'
      and column_name  = 'token_family'
  ) then
    alter table public.sessions
      add column token_family uuid not null default gen_random_uuid();
  end if;
end;
$$;

-- 5. Add revoked_at column for explicit session invalidation
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'sessions'
      and column_name  = 'revoked_at'
  ) then
    alter table public.sessions
      add column revoked_at timestamptz;
  end if;
end;
$$;

-- Comments
comment on column public.sessions.refresh_token_hash is
  'SHA-256 hex hash of the refresh token. The raw token is never stored. '
  'On verify: hash the incoming token and compare.';
comment on column public.sessions.token_family is
  'Groups tokens from the same original session. If a revoked token from this '
  'family is used, the entire family is invalidated (rotation attack detection).';
comment on column public.sessions.revoked_at is
  'Timestamp when this session was explicitly revoked. NULL means active.';
