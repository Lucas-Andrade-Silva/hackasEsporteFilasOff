-- Apply after schema-draft.sql. Service-role-only RPCs; no client privileges.
begin;
create or replace function public.mova_demo_create_session(p_token_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_session public.demo_sessions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(913746101::bigint);
  delete from public.demo_sessions where expires_at <= now();
  select * into v_session from public.demo_sessions where token_hash=p_token_hash and expires_at>now();
  if found then return to_jsonb(v_session)-'token_hash'; end if;
  if (select count(*) from public.demo_sessions where created_at>now()-interval '1 minute') >= 60
     or (select count(*) from public.demo_sessions) >= 2000 then
    return jsonb_build_object('error','SESSION_LIMIT');
  end if;
  insert into public.demo_sessions(token_hash,expires_at) values(p_token_hash,now()+interval '24 hours') returning * into v_session;
  return to_jsonb(v_session)-'token_hash';
end $$;
create or replace function public.mova_demo_save(p_session_id uuid,p_idempotency_key uuid,p_fixture_id text,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_existing public.demo_attempts%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id::text,913746102));
  if not exists(select 1 from public.demo_sessions where id=p_session_id and expires_at>now()) then
    return jsonb_build_object('error','SESSION_EXPIRED');
  end if;
  select * into v_existing from public.demo_attempts where session_id=p_session_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.fixture_id<>p_fixture_id then return jsonb_build_object('error','IDEMPOTENCY_CONFLICT'); end if;
    return v_existing.result;
  end if;
  if (select count(*) from public.demo_attempts where session_id=p_session_id)>=100
     or (select count(*) from public.demo_attempts where session_id=p_session_id and created_at>now()-interval '1 minute')>=12 then
    return jsonb_build_object('error','ATTEMPT_LIMIT');
  end if;
  if p_result->>'fixtureId' is distinct from p_fixture_id then return jsonb_build_object('error','INVALID_FIXTURE_RESULT'); end if;
  insert into public.demo_attempts(session_id,idempotency_key,fixture_id,result) values(p_session_id,p_idempotency_key,p_fixture_id,p_result);
  return p_result;
end $$;
revoke all on function public.mova_demo_create_session(text) from public,anon,authenticated;
revoke all on function public.mova_demo_save(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mova_demo_create_session(text) to service_role;
grant execute on function public.mova_demo_save(uuid,uuid,text,jsonb) to service_role;
commit;
