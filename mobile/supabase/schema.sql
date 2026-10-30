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

-- Referral data is private. All writes and lookups happen through checked RPCs.
drop policy if exists "referrals: read all" on public.referrals;
drop policy if exists "referrals: read own rows" on public.referrals;
drop policy if exists "referrals: owner can insert" on public.referrals;
drop policy if exists "referrals: redeemer can mark redemption" on public.referrals;
drop policy if exists "referrals: owner can mark reward paid" on public.referrals;
drop policy if exists "referrals: update own redemption state" on public.referrals;
revoke all on public.referrals from anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────────

-- Store ownership and referral transitions stay on the server. Client roles
-- cannot enumerate or mutate referral rows directly.
alter table public.referrals enable row level security;

drop policy if exists "referrals: read all" on public.referrals;
drop policy if exists "referrals: read own rows" on public.referrals;
drop policy if exists "referrals: owner can insert" on public.referrals;
drop policy if exists "referrals: redeemer can mark redemption" on public.referrals;
drop policy if exists "referrals: owner can mark reward paid" on public.referrals;
drop policy if exists "referrals: update own redemption state" on public.referrals;

revoke all on public.referrals from anon, authenticated;

create or replace function public.ensure_my_referral(p_expected_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempt integer := 0;
begin
  if v_user_id is null or p_expected_user_id is distinct from v_user_id then
    raise exception 'unauthorized';
  end if;
  perform pg_advisory_xact_lock(hashtext('referral-owner:' || v_user_id::text)::bigint);
  select code into v_code from public.referrals
    where owner_user_id = v_user_id order by created_at, id limit 1;
  if v_code is not null then return v_code; end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'ASCEND-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4))
      || '-' || upper(substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4));
    begin
      insert into public.referrals (code, owner_user_id) values (v_code, v_user_id);
      return v_code;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.redeem_referral_code(p_code text, p_expected_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_referral public.referrals%rowtype;
begin
  if v_user_id is null or p_expected_user_id is distinct from v_user_id then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  perform pg_advisory_xact_lock(hashtext('referral-redeemer:' || v_user_id::text)::bigint);

  select * into v_referral from public.referrals
    where code = upper(btrim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_referral.owner_user_id = v_user_id then
    return jsonb_build_object('ok', false, 'reason', 'own_code');
  end if;
  if v_referral.redeemed_by = v_user_id then
    return jsonb_build_object('ok', true, 'rewardId', v_referral.id, 'replayed', true);
  end if;
  if v_referral.redeemed_by is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;
  if exists (select 1 from public.referrals where redeemed_by = v_user_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_used_a_code');
  end if;

  update public.referrals set redeemed_by = v_user_id, redeemed_at = now()
    where id = v_referral.id;
  return jsonb_build_object('ok', true, 'rewardId', v_referral.id, 'replayed', false);
end;
$$;

create or replace function public.get_referral_owner_reward_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.referrals
  where owner_user_id = auth.uid()
    and redeemed_by is not null
    and owner_rewarded_at is null
  order by redeemed_at, id
$$;

create or replace function public.get_my_referral_redemption_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer from public.referrals
  where owner_user_id = auth.uid() and redeemed_by is not null
$$;

create or replace function public.mark_referral_rewards_paid(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  update public.referrals set owner_rewarded_at = now()
    where id = any(coalesce(p_ids, '{}'::uuid[]))
      and owner_user_id = auth.uid()
      and redeemed_by is not null
      and owner_rewarded_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.ensure_my_referral(uuid) from public, anon;
revoke all on function public.redeem_referral_code(text, uuid) from public, anon;
revoke all on function public.get_referral_owner_reward_ids() from public, anon;
revoke all on function public.get_my_referral_redemption_count() from public, anon;
revoke all on function public.mark_referral_rewards_paid(uuid[]) from public, anon;
grant execute on function public.ensure_my_referral(uuid) to authenticated;
grant execute on function public.redeem_referral_code(text, uuid) to authenticated;
grant execute on function public.get_referral_owner_reward_ids() to authenticated;
grant execute on function public.get_my_referral_redemption_count() to authenticated;
grant execute on function public.mark_referral_rewards_paid(uuid[]) to authenticated;


-- Migration: 20261025_normalized_analytics_and_leaderboard.sql
-- Description: Adds private normalized lesson and reflection history
-- Idempotent: Can be run multiple times safely.

-- 1. Lesson Completions (relational query & server-side analytics)
create table if not exists public.lesson_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  lesson_id text not null,
  xp_earned integer not null default 15,
  quiz_correct integer not null default 0,
  quiz_total integer not null default 0,
  completed_at timestamptz not null default now(),
  constraint lesson_completions_valid_quiz_counts check (quiz_correct <= quiz_total),
  constraint lesson_completions_user_lesson_unique unique (user_id, path_id, lesson_id)
);

create index if not exists idx_lesson_completions_user_path
  on public.lesson_completions (user_id, path_id);
create index if not exists idx_lesson_completions_date
  on public.lesson_completions (completed_at desc);

alter table public.lesson_completions enable row level security;
grant select, insert, update, delete on public.lesson_completions to authenticated;

drop policy if exists "lesson_completions: select own" on public.lesson_completions;
create policy "lesson_completions: select own"
  on public.lesson_completions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "lesson_completions: insert own" on public.lesson_completions;
create policy "lesson_completions: insert own"
  on public.lesson_completions for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "lesson_completions: update own" on public.lesson_completions;
create policy "lesson_completions: update own"
  on public.lesson_completions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "lesson_completions: delete own" on public.lesson_completions;
create policy "lesson_completions: delete own"
  on public.lesson_completions for delete
  using ((select auth.uid()) = user_id);

-- 2. Lesson Reflections (for journaling archive & NLP insights)
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id text not null,
  lesson_id text not null,
  content text not null,
  audio_uri text,
  mood_signal text,
  created_at timestamptz not null default now(),
  constraint reflections_user_lesson_unique unique (user_id, path_id, lesson_id)
);

create index if not exists idx_reflections_user
  on public.reflections (user_id, created_at desc);

alter table public.reflections enable row level security;
grant select, insert, update, delete on public.reflections to authenticated;

drop policy if exists "reflections: select own" on public.reflections;
create policy "reflections: select own"
  on public.reflections for select
  using ((select auth.uid()) = user_id);

drop policy if exists "reflections: insert own" on public.reflections;
create policy "reflections: insert own"
  on public.reflections for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "reflections: update own" on public.reflections;
create policy "reflections: update own"
  on public.reflections for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "reflections: delete own" on public.reflections;
create policy "reflections: delete own"
  on public.reflections for delete
  using ((select auth.uid()) = user_id);

-- No public leaderboard is exposed until users can opt in to profile visibility.
drop view if exists public.public_leaderboard;

-- Hardened 96-bit referral codes and per-user redemption throttling.
-- Existing installs receive code rotation through the ordered migration;
-- this snapshot does not rotate codes when it is rerun.
create table if not exists public.referral_redemption_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.referral_redemption_attempts enable row level security;
revoke all on public.referral_redemption_attempts from anon, authenticated;
create index if not exists referral_redemption_attempts_user_time_idx
  on public.referral_redemption_attempts (user_id, attempted_at desc);

create or replace function public.ensure_my_referral(p_expected_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_token text;
  v_attempt integer := 0;
begin
  if v_user_id is null or p_expected_user_id is distinct from v_user_id then
    raise exception 'unauthorized';
  end if;
  perform pg_advisory_xact_lock(hashtext('referral-owner:' || v_user_id::text)::bigint);
  select code into v_code from public.referrals
    where owner_user_id = v_user_id order by created_at, id limit 1;
  if v_code is not null then return v_code; end if;
  loop
    v_attempt := v_attempt + 1;
    v_token := upper(encode(extensions.gen_random_bytes(12), 'hex'));
    v_code := 'ASCEND-' || substr(v_token, 1, 8) || '-'
      || substr(v_token, 9, 8) || '-' || substr(v_token, 17, 8);
    begin
      insert into public.referrals (code, owner_user_id) values (v_code, v_user_id);
      return v_code;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.redeem_referral_code(p_code text, p_expected_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_referral public.referrals%rowtype;
  v_attempt_count integer;
begin
  if v_user_id is null or p_expected_user_id is distinct from v_user_id then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  perform pg_advisory_xact_lock(hashtext('referral-redeemer:' || v_user_id::text)::bigint);
  delete from public.referral_redemption_attempts
    where user_id = v_user_id and attempted_at < now() - interval '24 hours';
  select count(*) into v_attempt_count from public.referral_redemption_attempts
    where user_id = v_user_id and attempted_at >= now() - interval '1 hour';
  if v_attempt_count >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;
  insert into public.referral_redemption_attempts (user_id) values (v_user_id);

  select * into v_referral from public.referrals
    where code = upper(btrim(p_code)) for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_referral.owner_user_id = v_user_id then
    return jsonb_build_object('ok', false, 'reason', 'own_code');
  end if;
  if v_referral.redeemed_by = v_user_id then
    return jsonb_build_object('ok', true, 'rewardId', v_referral.id, 'replayed', true);
  end if;
  if v_referral.redeemed_by is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;
  if exists (select 1 from public.referrals where redeemed_by = v_user_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_used_a_code');
  end if;
  update public.referrals set redeemed_by = v_user_id, redeemed_at = now()
    where id = v_referral.id;
  return jsonb_build_object('ok', true, 'rewardId', v_referral.id, 'replayed', false);
end;
$$;

revoke all on function public.ensure_my_referral(uuid) from public, anon;
revoke all on function public.redeem_referral_code(text, uuid) from public, anon;
grant execute on function public.ensure_my_referral(uuid) to authenticated;
grant execute on function public.redeem_referral_code(text, uuid) to authenticated;
