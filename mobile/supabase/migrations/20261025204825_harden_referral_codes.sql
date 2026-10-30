-- Referral codes have enough entropy to resist online guessing. Redemption
-- attempts are recorded server-side and limited per authenticated user.
create table if not exists public.referral_redemption_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.referral_redemption_attempts enable row level security;
revoke all on public.referral_redemption_attempts from anon, authenticated;
create index if not exists referral_redemption_attempts_user_time_idx
  on public.referral_redemption_attempts (user_id, attempted_at desc);

-- Rotate existing, short codes as well. Referral relationships are keyed by
-- row id, so already redeemed referrals and rewards remain intact.
do $$
declare
  v_referral record;
  v_code text;
begin
  for v_referral in select id from public.referrals loop
    loop
      v_code := 'ASCEND-' || upper(encode(gen_random_bytes(12), 'hex'));
      begin
        update public.referrals set code = v_code where id = v_referral.id;
        exit;
      exception when unique_violation then
        null;
      end;
    end loop;
  end loop;
end;
$$;

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
    v_code := 'ASCEND-' || upper(encode(gen_random_bytes(12), 'hex'));
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
