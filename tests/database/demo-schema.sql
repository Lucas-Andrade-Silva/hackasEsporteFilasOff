-- Executed only inside the disposable PostgreSQL service in CI.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
\ir ../../supabase/schema-draft.sql
begin;
do $$
begin
 if not (select relrowsecurity from pg_class where oid='public.demo_sessions'::regclass)
 or not (select relrowsecurity from pg_class where oid='public.demo_attempts'::regclass) then raise exception 'RLS disabled'; end if;
 if has_table_privilege('anon','public.demo_sessions','SELECT') or has_table_privilege('authenticated','public.demo_attempts','SELECT')
 or has_table_privilege('anon','public.demo_attempts','INSERT') or has_table_privilege('authenticated','public.demo_sessions','DELETE')
 then raise exception 'Unexpected client grant'; end if;
end $$;
set local role service_role;
insert into public.demo_sessions(id,token_hash,expires_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',repeat('a',64),now()+interval '24 hours'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('b',64),now()+interval '24 hours');
insert into public.demo_attempts(session_id,idempotency_key,fixture_id,result) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','block-base','{"source":"synthetic_pose_replay"}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','block-next','{"source":"synthetic_pose_replay"}');
insert into public.demo_attempts(session_id,idempotency_key,fixture_id,result) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','block-base','{"source":"synthetic_pose_replay"}')
 on conflict(session_id,idempotency_key) do nothing;
do $$
begin
 if (select count(*) from public.demo_attempts)<>2 then raise exception 'Idempotency or namespace failure'; end if;
 begin
 insert into public.demo_attempts(session_id,idempotency_key,fixture_id,result) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),'invalid','{"source":"synthetic_pose_replay"}');
 raise exception 'Invalid fixture accepted'; exception when check_violation then null; end;
 begin
 insert into public.demo_attempts(session_id,idempotency_key,fixture_id,result) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),'block-base','{"source":"real"}');
 raise exception 'Real data accepted'; exception when check_violation then null; end;
 begin
 insert into public.demo_sessions(token_hash,expires_at) values(repeat('c',64),now()-interval '1 hour');
 raise exception 'Invalid expiry accepted'; exception when check_violation then null; end;
end $$;
delete from public.demo_sessions where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin
 if exists(select 1 from public.demo_attempts where session_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
 or (select count(*) from public.demo_attempts where session_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1
 then raise exception 'Reset cascade or isolation failure'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform count(*) from public.demo_sessions;
 raise exception 'Anon could read session'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform count(*) from public.demo_attempts;
 raise exception 'Authenticated client could read attempts'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'PASS: RLS, grants, namespace uniqueness, constraints, reset cascade and client denial'
