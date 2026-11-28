\set ON_ERROR_STOP on
\ir ../../supabase/demo-hardening.sql
begin;
set local role service_role;
do $$
declare a uuid; b uuid; k uuid:=gen_random_uuid(); r jsonb; p jsonb:='{"source":"synthetic_pose_replay","fixtureId":"block-base"}';
begin
 a:=(public.mova_demo_create_session(repeat('a',64))->>'id')::uuid;
 b:=(public.mova_demo_create_session(repeat('b',64))->>'id')::uuid;
 if a is null or b is null or a=b then raise exception 'session creation failed'; end if;
 r:=public.mova_demo_save(a,k,'block-base',p);
 if r<>p then raise exception 'save failed %',r; end if;
 if public.mova_demo_save(a,k,'block-base',p)<>p then raise exception 'retry failed'; end if;
 if public.mova_demo_save(a,k,'block-next',p)->>'error'<>'IDEMPOTENCY_CONFLICT' then raise exception 'conflict failed'; end if;
 if public.mova_demo_save(b,k,'block-base',p)<>p then raise exception 'namespace failed'; end if;
 for i in 1..11 loop
  if public.mova_demo_save(a,gen_random_uuid(),'block-base',p)<>p then raise exception 'unexpected limit'; end if;
 end loop;
 if public.mova_demo_save(a,gen_random_uuid(),'block-base',p)->>'error'<>'ATTEMPT_LIMIT' then raise exception 'rate limit failed'; end if;
 if public.mova_demo_save(a,k,'block-base',p)<>p then raise exception 'retry must survive limit'; end if;
 if public.mova_demo_save(gen_random_uuid(),k,'block-base',p)->>'error'<>'SESSION_EXPIRED' then raise exception 'expired check failed'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.mova_demo_save(uuid,uuid,text,jsonb)','execute') or has_function_privilege('authenticated','public.mova_demo_create_session(text)','execute') then raise exception 'public RPC grant'; end if;
end $$;
rollback;
\echo 'PASS: protected RPC, idempotency, session isolation, rate limit, expiration'
