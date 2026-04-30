-- Migration: create sessions table
-- Description: Stores active user sessions for JWT refresh token validation and device tracking

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_token text not null,
  device_info text,
  ip_address text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),

  -- Constraints
  constraint sessions_refresh_token_key unique (refresh_token),
  constraint sessions_expires_at_check check (expires_at > created_at)
);

-- Indexes
create index if not exists idx_sessions_user_id on public.sessions (user_id);
create index if not exists idx_sessions_expires_at on public.sessions (expires_at);

-- Comments
comment on table public.sessions is 'Active user sessions for refresh token validation.';
comment on column public.sessions.refresh_token is 'Opaque JWT refresh token string.';
comment on column public.sessions.device_info is 'User agent or device identifier.';
