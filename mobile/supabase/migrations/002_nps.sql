-- 002_nps.sql — In-app NPS feedback prompt
--
-- Stores Net Promoter Score responses captured at two retention sweet spots:
--   - lesson-3   : user has formed an opinion but isn't checked out yet
--   - streak-14  : the "habit formed" moment
--
-- The client writes here only via the authenticated anon key. No client-side
-- SELECT policy — admin reads via service-role key in the Supabase dashboard.
-- The point is to stop flying blind on user retention complaints with no
-- actual feedback data flowing in.

create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_username text,
  score smallint not null check (score between 0 and 10),
  comment text,
  trigger text not null check (trigger in ('lesson-3', 'streak-14')),
  created_at timestamptz default now() not null,
  app_version text,
  locale text
);

create index if not exists nps_responses_created_idx
  on public.nps_responses (created_at desc);
create index if not exists nps_responses_trigger_score_idx
  on public.nps_responses (trigger, score);

alter table public.nps_responses enable row level security;

-- Allow signed-in users to insert their own row, and signed-out / guest mode
-- inserts as well (matches the analytics_events policy — write-only client).
drop policy if exists "users can insert their own NPS" on public.nps_responses;
create policy "users can insert their own NPS" on public.nps_responses
  for insert with check (auth.uid() = user_id or auth.uid() is null);

-- No SELECT / UPDATE / DELETE policies on the user side — admin reads via
-- service-role key in the Supabase dashboard.
