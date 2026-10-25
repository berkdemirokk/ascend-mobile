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
