-- Ascend: Monk Mode — Supabase schema
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
$$ language plpgsql;

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
  using (auth.uid() = user_id);

drop policy if exists "user_state: insert own" on public.user_state;
create policy "user_state: insert own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_state: update own" on public.user_state;
create policy "user_state: update own"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_state: delete own" on public.user_state;
create policy "user_state: delete own"
  on public.user_state for delete
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: streak_leaderboard
-- Public, anonymized streak ranking. Users only see their own anon_username and
-- can update only their own row. Everyone (including anon users) can read all
-- rows because anon_username never reveals identity.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.streak_leaderboard (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  anon_username  text not null,
  current_streak int  not null default 0,
  longest_streak int  not null default 0,
  total_xp       int  not null default 0,
  updated_at     timestamptz not null default now()
);

create index if not exists streak_leaderboard_current_streak_idx
  on public.streak_leaderboard (current_streak desc, total_xp desc);

create or replace function public.streak_leaderboard_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists streak_leaderboard_set_updated_at on public.streak_leaderboard;
create trigger streak_leaderboard_set_updated_at
before update on public.streak_leaderboard
for each row execute function public.streak_leaderboard_set_updated_at();

alter table public.streak_leaderboard enable row level security;

-- Public read — the whole point is showing the top users. The anon_username is
-- generated client-side and never tied to PII, so this is safe to leave open.
drop policy if exists "streak_leaderboard: read all" on public.streak_leaderboard;
create policy "streak_leaderboard: read all"
  on public.streak_leaderboard for select
  using (true);

drop policy if exists "streak_leaderboard: insert own" on public.streak_leaderboard;
create policy "streak_leaderboard: insert own"
  on public.streak_leaderboard for insert
  with check (auth.uid() = user_id);

drop policy if exists "streak_leaderboard: update own" on public.streak_leaderboard;
create policy "streak_leaderboard: update own"
  on public.streak_leaderboard for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "streak_leaderboard: delete own" on public.streak_leaderboard;
create policy "streak_leaderboard: delete own"
  on public.streak_leaderboard for delete
  using (auth.uid() = user_id);

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
  with check (auth.uid() = user_id or user_id is null);

-- No select / update / delete policies — events are write-only from the client.
-- The owner reads them via service-role from a dashboard or via Supabase UI.

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: push_tokens
-- Stores each device's Expo push token for server-initiated notifications
-- (friend invite accepted, achievement unlocked, etc.). One row per user;
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
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: referral_redemptions
-- Tracks referral code redemption — referrer (the inviter), referee (the new
-- user), and redemption status. Edge Function 'redeem-referral' creates the
-- row and grants both users a 7-day Premium entitlement via RevenueCat.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.referral_redemptions (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid references auth.users(id) on delete set null,
  referee_id   uuid references auth.users(id) on delete cascade,
  ref_code     text not null,
  status       text not null default 'pending',
  -- pending | granted | failed
  created_at   timestamptz not null default now(),
  granted_at   timestamptz,
  unique (referee_id) -- one redemption per new user, prevents abuse
);

create index if not exists referral_redemptions_referrer_idx
  on public.referral_redemptions (referrer_id, created_at desc);

alter table public.referral_redemptions enable row level security;

drop policy if exists "referrals: read own" on public.referral_redemptions;
create policy "referrals: read own"
  on public.referral_redemptions for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- Inserts only via Edge Function (service role) — no client-direct inserts
-- because we need to verify ref_code maps to a real anon_username.

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: friendships + friend_invites
-- Symmetric friendship: a single row per pair, ordered (user_a < user_b) so
-- we never have duplicates. Status starts 'pending', flips to 'accepted'
-- when the recipient accepts the invite.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  user_a       uuid not null references auth.users(id) on delete cascade,
  user_b       uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',
  -- pending | accepted | blocked
  initiated_by uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_a_idx
  on public.friendships (user_a, status);
create index if not exists friendships_user_b_idx
  on public.friendships (user_b, status);

alter table public.friendships enable row level security;

drop policy if exists "friendships: read own" on public.friendships;
create policy "friendships: read own"
  on public.friendships for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Inserts/updates only via Edge Function so we can validate the invite code
-- and prevent unauthorized friend additions.

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: tribe_messages (path-based tribes — schema only, runtime deferred)
-- Stub for v1.0.12 path tribes feature. Each path has its own room; users
-- working on the same path can post short text messages. Moderation /
-- reporting / muting infrastructure is NOT in this version — table exists
-- so client code can be written against it but is gated off in the UI.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.tribe_messages (
  id          uuid primary key default gen_random_uuid(),
  path_id     text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  anon_handle text not null,
  body        text not null check (char_length(body) <= 280),
  created_at  timestamptz not null default now()
);

create index if not exists tribe_messages_path_idx
  on public.tribe_messages (path_id, created_at desc);

alter table public.tribe_messages enable row level security;

-- Read: anyone signed in can read any tribe (public-by-design rooms).
drop policy if exists "tribes: read all" on public.tribe_messages;
create policy "tribes: read all"
  on public.tribe_messages for select
  using (auth.uid() is not null);

-- Insert: only as the authenticated user. Rate limiting + abuse handling
-- belongs in the Edge Function once we ship the feature.
drop policy if exists "tribes: insert own" on public.tribe_messages;
create policy "tribes: insert own"
  on public.tribe_messages for insert
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- Table: streak_duels (1v1 duels — schema only, runtime deferred)
-- Stub for v1.0.13 streak duel feature. Two users challenge each other to a
-- 7-day streak race; whoever has the higher current_streak at end_at wins.
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.streak_duels (
  id            uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id   uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending',
  -- pending | active | challenger_won | opponent_won | tied | abandoned
  start_at      timestamptz,
  end_at        timestamptz,
  created_at    timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);

alter table public.streak_duels enable row level security;

drop policy if exists "duels: read involved" on public.streak_duels;
create policy "duels: read involved"
  on public.streak_duels for select
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- View: active_tribe_users
-- Lightweight presence — last 5 minutes of analytics_events filtered to
-- 'lesson_open' or 'lesson_complete' grouped by path_id. Powers the
-- "47 kişi şu an X path'inde" feed without needing a realtime channel.
-- ──────────────────────────────────────────────────────────────────────────────
create or replace view public.active_tribe_counts as
select
  (props->>'pathId')::text as path_id,
  count(distinct coalesce(user_id::text, anon_user_id)) as active_count
from public.analytics_events
where created_at > now() - interval '5 minutes'
  and event in ('lesson_open', 'lesson_complete')
  and props ? 'pathId'
group by props->>'pathId';

grant select on public.active_tribe_counts to anon, authenticated;

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
  created_at timestamptz default now(),
  -- one user can only redeem ONE code in their lifetime
  constraint referrals_one_redeem_per_user unique (redeemed_by)
);
create index if not exists idx_referrals_owner on public.referrals(owner_user_id);
create index if not exists idx_referrals_code on public.referrals(code);

alter table public.referrals enable row level security;

-- Anyone can read by code (so non-authed onboarding can validate a code
-- before sign-in). Insert/update is auth-only and constrained to the
-- caller's own row.
create policy "referrals: read all" on public.referrals
  for select using (true);
create policy "referrals: owner can insert" on public.referrals
  for insert with check (auth.uid() = owner_user_id);
create policy "referrals: redeemer can mark redemption" on public.referrals
  for update using (
    -- Only allow the redeeming user to mark `redeemed_by = self` on an
    -- otherwise-unredeemed row.
    redeemed_by is null and auth.uid() <> owner_user_id
  ) with check (
    auth.uid() = redeemed_by and redeemed_at is not null
  );

grant select, insert, update on public.referrals to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- Auth settings you still need to check in the Supabase dashboard:
--   Authentication → Providers → Email: enable "Confirm email" if you want
--     e-mail verification. The app handles both confirmed and unconfirmed
--     sign-up flows.
--   Authentication → URL Configuration: set Site URL + Redirect URLs if
--     you plan to use password reset deep-links in production.
-- ──────────────────────────────────────────────────────────────────────────────
