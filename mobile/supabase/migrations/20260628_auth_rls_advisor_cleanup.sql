-- Harden Supabase advisor findings for Ascend production.
-- Safe to rerun: functions are replaced, policies are dropped/recreated,
-- indexes use IF NOT EXISTS, and optional platform helper grants are guarded.

create or replace function public.user_state_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql
set search_path = public, pg_temp;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end $$;

create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id, created_at desc);
create index if not exists squad_member_progress_user_idx
  on public.squad_member_progress (user_id);

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

drop policy if exists "events: insert own" on public.analytics_events;
create policy "events: insert own"
  on public.analytics_events for insert
  with check ((select auth.uid()) = user_id or user_id is null);

drop policy if exists "push: insert/update own" on public.push_tokens;
create policy "push: insert/update own"
  on public.push_tokens for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "squads: any user can create" on public.squads;
create policy "squads: any user can create"
  on public.squads for insert
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "squads: owner can update" on public.squads;
create policy "squads: owner can update"
  on public.squads for update
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "squads: owner can delete" on public.squads;
create policy "squads: owner can delete"
  on public.squads for delete
  using ((select auth.uid()) = owner_user_id);

drop policy if exists "members: read all authenticated" on public.squad_members;
create policy "members: read all authenticated"
  on public.squad_members for select
  to authenticated
  using (true);

drop policy if exists "members: self join" on public.squad_members;
create policy "members: self join"
  on public.squad_members for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "members: self or owner can leave/kick" on public.squad_members;
create policy "members: self or owner can leave/kick"
  on public.squad_members for delete
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) in (
      select squads.owner_user_id
      from public.squads
      where squads.id = squad_members.squad_id
    )
  );

drop policy if exists "progress: members read" on public.squad_member_progress;
create policy "progress: members read"
  on public.squad_member_progress for select
  using (
    (select auth.uid()) in (
      select squad_members.user_id
      from public.squad_members
      where squad_members.squad_id = squad_member_progress.squad_id
    )
  );

drop policy if exists "progress: self insert" on public.squad_member_progress;
create policy "progress: self insert"
  on public.squad_member_progress for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress: self update" on public.squad_member_progress;
create policy "progress: self update"
  on public.squad_member_progress for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "referrals: owner can insert" on public.referrals;
create policy "referrals: owner can insert" on public.referrals
  for insert with check ((select auth.uid()) = owner_user_id);

drop policy if exists "referrals: redeemer can mark redemption" on public.referrals;
drop policy if exists "referrals: owner can mark reward paid" on public.referrals;
drop policy if exists "referrals: update own redemption state" on public.referrals;
create policy "referrals: update own redemption state" on public.referrals
  for update using (
    ((select auth.uid()) <> owner_user_id and redeemed_by is null)
    or ((select auth.uid()) = owner_user_id and redeemed_by is not null)
  ) with check (
    ((select auth.uid()) = redeemed_by and redeemed_at is not null)
    or ((select auth.uid()) = owner_user_id)
  );
