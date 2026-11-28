-- MOVA app v2: perfis, atividades, ligas e grupos de amigos.
-- Isolamento por conta: RLS em todas as tabelas. Dados de outros usuários
-- (nome, foto e moedas) só saem pelas funções de ranking, e só para quem
-- está na mesma liga ou no mesmo grupo. Moedas não são graváveis pelo cliente.
-- Aplicar uma vez, no SQL Editor do projeto MOVA, depois das migrations da demo.

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_path text check (avatar_path is null or avatar_path like id::text || '/%'),
  bio text check (char_length(bio) <= 280),
  sport text not null default 'volleyball' check (sport in ('volleyball', 'basketball', 'both')),
  position text check (char_length(position) <= 40),
  years_playing text check (years_playing in ('lt1', '1to3', 'gt3')),
  weekly_sessions text check (weekly_sessions in ('0to1', '2to3', '4plus')),
  goal text check (goal in ('jump', 'agility', 'skills', 'friends', 'visibility')),
  recording_space text check (recording_space in ('small', 'large')),
  height_cm smallint check (height_cm between 100 and 250),
  weight_kg smallint check (weight_kg between 30 and 250),
  adult_confirmed boolean not null default false,
  coins integer not null default 0 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- coins, adult_confirmed e id ficam de fora: só o servidor altera.
grant update (display_name, avatar_path, bio, sport, position, years_playing,
  weekly_sessions, goal, recording_space, height_cm, weight_kg)
  on public.profiles to authenticated;

create or replace function public.mova_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger mova_profiles_touch before update on public.profiles
  for each row execute function public.mova_touch_updated_at();

-- Cria o perfil a partir das respostas do onboarding enviadas no cadastro.
-- Recusa o cadastro sem a confirmação de 18+ (regra do produto e do hackathon).
create or replace function public.mova_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(m ->> 'adult_confirmed', '') <> 'true' then
    raise exception 'ADULT_CONFIRMATION_REQUIRED';
  end if;
  insert into public.profiles (id, display_name, sport, position, years_playing,
    weekly_sessions, goal, recording_space, adult_confirmed)
  values (
    new.id,
    left(coalesce(m ->> 'display_name', ''), 60),
    case when m ->> 'sport' in ('volleyball', 'basketball', 'both') then m ->> 'sport' else 'volleyball' end,
    left(m ->> 'position', 40),
    case when m ->> 'years_playing' in ('lt1', '1to3', 'gt3') then m ->> 'years_playing' end,
    case when m ->> 'weekly_sessions' in ('0to1', '2to3', '4plus') then m ->> 'weekly_sessions' end,
    case when m ->> 'goal' in ('jump', 'agility', 'skills', 'friends', 'visibility') then m ->> 'goal' end,
    case when m ->> 'recording_space' in ('small', 'large') then m ->> 'recording_space' end,
    true
  );
  return new;
end $$;

create trigger mova_on_auth_user_created after insert on auth.users
  for each row execute function public.mova_handle_new_user();

-- ---------------------------------------------------------------- atividades
-- Uma linha por tentativa de exercício. A gravação entra junto com o sistema
-- de vídeo (próxima etapa), por função no servidor que valida o limite de
-- 3 tentativas por dia, a nota mínima e as moedas.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) <= 60),
  score numeric(8, 2) not null check (score >= 0),
  passed boolean not null,
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  created_at timestamptz not null default now()
);
create index activities_user_created_idx on public.activities (user_id, created_at desc);

alter table public.activities enable row level security;
create policy activities_select_own on public.activities
  for select to authenticated using (user_id = auth.uid());
revoke all on public.activities from anon, authenticated;
grant select on public.activities to authenticated;

-- ---------------------------------------------------------------- ligas (ranking global opcional)
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  tier smallint not null check (tier between 0 and 5),
  created_at timestamptz not null default now()
);

create table public.league_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index league_members_league_idx on public.league_members (league_id);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
revoke all on public.leagues, public.league_members from anon, authenticated;

-- Divisões por moedas acumuladas: 0, 100, 300, 600, 1000, 1500.
create or replace function public.mova_league_tier(p_coins integer) returns smallint
language sql immutable set search_path = '' as $$
  select (case
    when p_coins >= 1500 then 5
    when p_coins >= 1000 then 4
    when p_coins >= 600 then 3
    when p_coins >= 300 then 2
    when p_coins >= 100 then 1
    else 0 end)::smallint
$$;

-- Entra na liga (ou confirma a atual). Se as moedas mudaram de divisão,
-- realoca para um grupo de até 20 pessoas da nova divisão.
create or replace function public.join_league() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  my_tier smallint;
  current_league uuid;
  current_tier smallint;
  lid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select public.mova_league_tier(coins) into my_tier from public.profiles where id = uid;
  if my_tier is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  select m.league_id, l.tier into current_league, current_tier
    from public.league_members m join public.leagues l on l.id = m.league_id
    where m.user_id = uid;
  if current_league is not null and current_tier = my_tier then
    return current_league;
  end if;

  perform pg_advisory_xact_lock(hashtext('mova_league_tier_' || my_tier));
  delete from public.league_members where user_id = uid;

  select l.id into lid
    from public.leagues l
    left join public.league_members m on m.league_id = l.id
    where l.tier = my_tier
    group by l.id
    having count(m.user_id) < 20
    order by l.created_at
    limit 1;
  if lid is null then
    insert into public.leagues (tier) values (my_tier) returning id into lid;
  end if;

  insert into public.league_members (user_id, league_id) values (uid, lid);
  return lid;
end $$;

create or replace function public.leave_league() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.league_members where user_id = auth.uid();
end $$;

-- Ranking da liga de quem chama. Vazio se a pessoa não entrou.
create or replace function public.league_ranking()
returns table (rank integer, display_name text, avatar_path text, coins integer, is_me boolean, tier smallint)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select m.league_id, l.tier from public.league_members m
    join public.leagues l on l.id = m.league_id
    where m.user_id = auth.uid()
  )
  select
    (row_number() over (order by p.coins desc, lm.joined_at))::integer,
    p.display_name, p.avatar_path, p.coins, p.id = auth.uid(), mine.tier
  from mine
  join public.league_members lm on lm.league_id = mine.league_id
  join public.profiles p on p.id = lm.user_id
  order by 1
$$;

-- ---------------------------------------------------------------- grupos de amigos
create table public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.friend_group_members (
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index friend_group_members_user_idx on public.friend_group_members (user_id);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
revoke all on public.friend_groups, public.friend_group_members from anon, authenticated;

create or replace function public.create_friend_group(p_name text)
returns table (id uuid, code text)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  gid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if (select count(*) from public.friend_groups g where g.owner_id = uid) >= 10 then
    raise exception 'GROUP_LIMIT';
  end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.friend_groups g where g.code = new_code);
  end loop;
  insert into public.friend_groups (name, code, owner_id)
    values (trim(p_name), new_code, uid) returning friend_groups.id into gid;
  insert into public.friend_group_members (group_id, user_id) values (gid, uid);
  return query select gid, new_code;
end $$;

create or replace function public.join_friend_group(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select g.id into gid from public.friend_groups g where g.code = upper(trim(p_code));
  if gid is null then raise exception 'GROUP_NOT_FOUND'; end if;
  if (select count(*) from public.friend_group_members m where m.group_id = gid) >= 50 then
    raise exception 'GROUP_FULL';
  end if;
  insert into public.friend_group_members (group_id, user_id) values (gid, uid)
    on conflict do nothing;
  return gid;
end $$;

create or replace function public.leave_friend_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.friend_group_members where group_id = p_group and user_id = auth.uid();
  delete from public.friend_groups g where g.id = p_group
    and not exists (select 1 from public.friend_group_members m where m.group_id = p_group);
end $$;

create or replace function public.my_friend_groups()
returns table (id uuid, name text, code text, member_count integer, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.code,
    (select count(*) from public.friend_group_members x where x.group_id = g.id)::integer,
    g.owner_id = auth.uid()
  from public.friend_groups g
  join public.friend_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  order by g.created_at
$$;

-- Ranking de um grupo, só para quem é membro dele.
create or replace function public.friend_group_ranking(p_group uuid)
returns table (rank integer, display_name text, avatar_path text, coins integer, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select
    (row_number() over (order by p.coins desc, m.joined_at))::integer,
    p.display_name, p.avatar_path, p.coins, p.id = auth.uid()
  from public.friend_group_members m
  join public.profiles p on p.id = m.user_id
  where m.group_id = p_group
    and exists (select 1 from public.friend_group_members me
                where me.group_id = p_group and me.user_id = auth.uid())
  order by 1
$$;

-- Funções: só usuários logados executam.
revoke execute on function public.join_league(), public.leave_league(), public.league_ranking(),
  public.create_friend_group(text), public.join_friend_group(text), public.leave_friend_group(uuid),
  public.my_friend_groups(), public.friend_group_ranking(uuid)
  from public, anon;
grant execute on function public.join_league(), public.leave_league(), public.league_ranking(),
  public.create_friend_group(text), public.join_friend_group(text), public.leave_friend_group(uuid),
  public.my_friend_groups(), public.friend_group_ranking(uuid)
  to authenticated;
revoke execute on function public.mova_handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- fotos de perfil
-- Bucket público para leitura (a foto aparece no ranking); cada pessoa só
-- escreve dentro da pasta com o próprio id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy mova_avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy mova_avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy mova_avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy mova_avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
