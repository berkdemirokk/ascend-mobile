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
    v_code := 'ASCEND-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4))
      || '-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
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
