-- DRAFT: run only on a dedicated MOVA development database after local verification.
-- No live migration applied. Server-only Data API access for demo; no real athlete data.
begin;
create table public.demo_sessions (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at > created_at)
);
create table public.demo_attempts (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.demo_sessions(id) on delete cascade,
 idempotency_key uuid not null,
 fixture_id text not null check(fixture_id in ('block-base','block-next','rebound-base','rebound-next','feet-cut')),
 result jsonb not null check(jsonb_typeof(result)='object' and result->>'source'='synthetic_pose_replay'),
 created_at timestamptz not null default now(),
 unique(session_id,idempotency_key)
);
create index demo_sessions_expiry_idx on public.demo_sessions(expires_at);
create index demo_attempts_history_idx on public.demo_attempts(session_id,created_at desc);
alter table public.demo_sessions enable row level security;
alter table public.demo_attempts enable row level security;
revoke all on public.demo_sessions,public.demo_attempts from public,anon,authenticated;
grant select,insert,delete on public.demo_sessions,public.demo_attempts to service_role;
-- No anon/authenticated policies: only the server role may access these tables.
-- TTL access enforced by server; schedule cleanup separately before production:
-- delete from public.demo_sessions where expires_at <= now();
commit;
