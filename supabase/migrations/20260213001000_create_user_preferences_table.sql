-- Migration: create user_preferences table
-- Description: Stores user notification and UI preferences.
--              This table was referenced in RLS policies but was missing a creation migration.
-- Idempotent: uses IF NOT EXISTS checks to allow safe re-runs

-- Core user_preferences table
create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  language text not null default 'en',
  theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Validate theme values
  constraint user_preferences_theme_check
    check (theme in ('light', 'dark', 'system')),

  -- Validate language (ISO 639-1 two-letter codes)
  constraint user_preferences_language_check
    check (language ~ '^[a-z]{2}$')
);

-- Trigger function to maintain updated_at
create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach trigger
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_user_preferences_updated_at'
  ) then
    create trigger trg_user_preferences_updated_at
    before update on public.user_preferences
    for each row
    execute function public.set_user_preferences_updated_at();
  end if;
end;
$$;

-- Comments
comment on table public.user_preferences is
  'User-level preferences for notifications and UI. One row per user, auto-created on first access.';
comment on column public.user_preferences.notifications_enabled is
  'Whether the user wants to receive in-app notifications.';
comment on column public.user_preferences.language is
  'Preferred UI language as an ISO 639-1 code (e.g. en, es).';
comment on column public.user_preferences.theme is
  'Preferred UI theme: light, dark, or system (follows device setting).';
