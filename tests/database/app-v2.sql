-- Executado só em PostgreSQL descartável (CI ou Docker local).
-- Simula o mínimo de auth e storage do Supabase e prova o isolamento entre contas.
\set ON_ERROR_STOP on
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema auth, storage to anon, authenticated;

\ir ../../supabase/migrations/20261128120000_mova_app_v2.sql

-- Cadastro sem 18+ é recusado.
do $$
begin
  begin
    insert into auth.users values ('00000000-0000-4000-8000-000000000000', '{"display_name":"Sem idade"}');
    raise exception 'cadastro sem 18+ deveria falhar';
  exception when others then
    if sqlerrm <> 'ADULT_CONFIRMATION_REQUIRED' then raise; end if;
  end;
end $$;

-- Três contas adultas.
insert into auth.users values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"display_name":"Ana","adult_confirmed":"true","sport":"volleyball","goal":"jump","recording_space":"small"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{"display_name":"Bia","adult_confirmed":"true","sport":"basketball","goal":"invalido"}'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '{"display_name":"Caio","adult_confirmed":"true"}');

do $$
begin
  if (select goal from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is not null then
    raise exception 'valor inválido do onboarding deveria virar null';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_table_privilege('authenticated', 'public.activities', 'INSERT')
     or has_column_privilege('authenticated', 'public.profiles', 'coins', 'UPDATE')
     or has_function_privilege('anon', 'public.join_league()', 'EXECUTE') then
    raise exception 'permissão inesperada para o cliente';
  end if;
end $$;

-- Como Ana: vê só o próprio perfil, não altera moedas nem o perfil de outra pessoa.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
declare n int;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Ana vê perfis de outras pessoas'; end if;
  update public.profiles set display_name = 'Hack' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Ana alterou o perfil da Bia'; end if;
  update public.profiles set height_cm = 175 where id = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ana não conseguiu editar o próprio perfil'; end if;
  begin
    update public.profiles set coins = 9999 where id = auth.uid();
    raise exception 'Ana alterou as próprias moedas';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set avatar_path = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/x.png' where id = auth.uid();
    raise exception 'Ana apontou a foto para a pasta da Bia';
  exception when check_violation then null;
  end;
end $$;
create temp table code_holder as select code from public.create_friend_group('Atlética');
grant select on code_holder to authenticated;
select public.join_league();
commit;

-- Bia entra no grupo pelo código e na liga.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select public.join_friend_group((select code from code_holder));
select public.join_league();
do $$
declare gid uuid := (select id from public.my_friend_groups() limit 1);
begin
  if (select count(*) from public.friend_group_ranking(gid)) <> 2 then raise exception 'ranking do grupo errado'; end if;
  if (select count(*) from public.league_ranking()) <> 2 then raise exception 'Ana e Bia deveriam dividir a liga'; end if;
  if (select count(*) from public.league_ranking() where is_me) <> 1 then raise exception 'is_me errado'; end if;
end $$;
commit;

-- Caio não é do grupo: não vê o ranking dele, nem o código, e não está em liga nenhuma.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
declare gid uuid;
begin
  select id into gid from public.friend_groups;
  raise exception 'Caio leu a tabela de grupos diretamente';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  if (select count(*) from public.my_friend_groups()) <> 0 then raise exception 'Caio vê grupos alheios'; end if;
  if (select count(*) from public.league_ranking()) <> 0 then raise exception 'Caio vê liga sem entrar'; end if;
end $$;
commit;

-- Liga tem no máximo 20 pessoas: a 21ª da divisão abre uma nova.
insert into auth.users
  select gen_random_uuid(), jsonb_build_object('display_name', 'Extra ' || g, 'adult_confirmed', 'true')
  from generate_series(1, 19) g;
do $$
declare u record;
begin
  for u in select id from public.profiles where display_name like 'Extra %' loop
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    perform public.join_league();
  end loop;
  if (select count(*) from public.leagues) <> 2 then raise exception 'deveria haver 2 ligas'; end if;
  if (select max(c) from (select count(*) c from public.league_members group by league_id) s) > 20 then
    raise exception 'liga passou de 20 pessoas';
  end if;
end $$;

-- Mudança de divisão realoca a pessoa.
update public.profiles set coins = 150 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.join_league();
do $$
begin
  if (select tier from public.league_ranking() limit 1) <> 1 then raise exception 'Ana deveria estar na divisão 1'; end if;
  if (select count(*) from public.league_ranking()) <> 1 then raise exception 'Ana deveria estar sozinha na divisão 1'; end if;
end $$;
commit;

\echo 'app-v2: todos os testes de isolamento passaram'
