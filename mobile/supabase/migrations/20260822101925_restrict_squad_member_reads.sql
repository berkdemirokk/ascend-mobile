-- Limit squad membership visibility to users who belong to the same squad or
-- own it. The helper lives outside exposed schemas and performs its own
-- auth.uid() authorization check before its SECURITY DEFINER query bypasses
-- squad_members RLS, avoiding recursive-policy evaluation.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.can_read_squad_members(target_squad_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.squads
        where squads.id = target_squad_id
          and squads.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.squad_members
        where squad_members.squad_id = target_squad_id
          and squad_members.user_id = (select auth.uid())
      )
    );
$$;

revoke all on function private.can_read_squad_members(uuid) from public;
revoke all on function private.can_read_squad_members(uuid) from anon;
grant execute on function private.can_read_squad_members(uuid) to authenticated;

drop policy if exists "members: read all authenticated" on public.squad_members;
drop policy if exists "members: squad participants can read" on public.squad_members;
create policy "members: squad participants can read"
  on public.squad_members for select
  to authenticated
  using ((select private.can_read_squad_members(squad_id)));
