-- Keep secure codes readable while preserving all 96 random bits.
do $$
declare
  v_referral record;
  v_token text;
  v_code text;
begin
  for v_referral in select id from public.referrals loop
    loop
      v_token := upper(encode(gen_random_bytes(12), 'hex'));
      v_code := 'ASCEND-' || substr(v_token, 1, 8) || '-'
        || substr(v_token, 9, 8) || '-' || substr(v_token, 17, 8);
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
    v_token := upper(encode(gen_random_bytes(12), 'hex'));
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

revoke all on function public.ensure_my_referral(uuid) from public, anon;
grant execute on function public.ensure_my_referral(uuid) to authenticated;
