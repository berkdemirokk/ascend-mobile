-- Ascend: Daily Discipline — Supabase schema
-- Run this SQL in your Supabase project (SQL editor → New query → Paste → Run).
-- It creates a single-row-per-user table that stores the full progress snapshot,
-- and sets up RLS so each user can only read/write their own row.

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: user_state
-- One row per auth user; `payload` holds the JSON snapshot from AppContext.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Ensure updated_at moves forward on every upsert.
create or replace function public.user_state_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql
set search_path = public, pg_temp;

drop trigger if exists user_state_set_updated_at on public.user_state;
create trigger user_state_set_updated_at
before update on public.user_state
for each row execute function public.user_state_set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.user_state enable row level security;

drop policy if exists "user_state: select own" on public.user_state;
create policy "user_state: select own"
  on public.user_state for select
  using ((select auth.uid()) = user_id);

drop policy if exists "user_state: insert own" on public.user_state;
create policy "user_state: insert own"
  on public.user_state for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_state: update own" on public.user_state;
create policy "user_state: update own"
  on public.user_state for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_state: delete own" on public.user_state;
create policy "user_state: delete own"
  on public.user_state for delete
  using ((select auth.uid()) = user_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: analytics_events
-- Lightweight in-app event log (taps, feature usage, JS errors). Insert-only;
-- nobody reads it from the client. PII is the user's responsibility — never
-- log real name / email / IDs that re-identify the user.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  anon_user_id text,
  event        text not null,
  props        jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists analytics_events_event_idx
  on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "events: insert own" on public.analytics_events;
create policy "events: insert own"
  on public.analytics_events for insert
  with check ((select auth.uid()) = user_id or user_id is null);

-- No select / update / delete policies — events are write-only from the client.
-- The owner reads them via service-role from a dashboard or via Supabase UI.

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: push_tokens
-- Stores each device's Expo push token for server-initiated notifications
-- (streak reminders, achievement nudges, etc.). One row per user;
-- last device wins because we want a single canonical token per user.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  expo_token text not null,
  platform   text not null default 'ios',
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "push: insert/update own" on public.push_tokens;
create policy "push: insert/update own"
  on public.push_tokens for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- referrals — viral / word-of-mouth growth loop
-- Each user has exactly one stable referral code derived from their auth UID
-- (computed client-side, stored here on first share). When a NEW user enters
-- the code during onboarding we write a row recording who-referred-whom; both
-- sides get a reward (streak freezes, granted client-side after the row
-- insert succeeds). The unique constraint on (code) prevents collision and
-- on (redeemed_by) prevents a user from claiming multiple codes.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  -- When the owner-side reward (10 streak freezes for the inviter) was
  -- marked as paid out. Null until the inviter opens the app after the
  -- redemption and AppContext.checkReferralRewards marks it done. The
  -- column was originally missing — half the viral loop was silently
  -- broken. We add it with a migration-safe ALTER below.
  owner_rewarded_at timestamptz,
  created_at timestamptz default now(),
  -- one user can only redeem ONE code in their lifetime
  constraint referrals_one_redeem_per_user unique (redeemed_by)
);

-- Migration-safe column add (works on existing prod tables without
-- recreating). Idempotent: rerunning is a no-op.
alter table public.referrals
  add column if not exists owner_rewarded_at timestamptz;
create index if not exists idx_referrals_owner on public.referrals(owner_user_id);
create index if not exists idx_referrals_code on public.referrals(code);

alter table public.referrals enable row level security;

-- Anyone can read by code (so non-authed onboarding can validate a code
-- before sign-in). Insert/update is auth-only and constrained to the
-- caller's own row.
drop policy if exists "referrals: read all" on public.referrals;
create policy "referrals: read all" on public.referrals
  for select using (true);
drop policy if exists "referrals: owner can insert" on public.referrals;
create policy "referrals: owner can insert" on public.referrals
  for insert with check ((select auth.uid()) = owner_user_id);
drop policy if exists "referrals: redeemer can mark redemption" on public.referrals;
drop policy if exists "referrals: owner can mark reward paid" on public.referrals;
drop policy if exists "referrals: update own redemption state" on public.referrals;
create policy "referrals: update own redemption state" on public.referrals
  for update using (
    -- Redeemers may claim an unredeemed code; owners may mark their own
    -- reward as paid after a redemption exists. One policy avoids multiple
    -- permissive UPDATE policies for the same role/action.
    ((select auth.uid()) <> owner_user_id and redeemed_by is null)
    or ((select auth.uid()) = owner_user_id and redeemed_by is not null)
  ) with check (
    ((select auth.uid()) = redeemed_by and redeemed_at is not null)
    or ((select auth.uid()) = owner_user_id)
  );

grant select, insert, update on public.referrals to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
