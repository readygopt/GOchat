-- GO Chat schema. Run this in the Supabase SQL editor for your project.
-- All access happens server side with the service role key, which bypasses RLS. RLS is enabled
-- with default deny as defense in depth so the anon and authenticated roles have no direct access.

create extension if not exists "pgcrypto";

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_token text not null,
  title text not null default 'Nova conversa',
  stage text not null default 'exploring',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_owner_token_idx on public.sessions (owner_token);
create index if not exists sessions_updated_at_idx on public.sessions (updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  client_message_id text,
  created_at timestamptz not null default now()
);

-- Idempotency. A given client message id can exist only once per session.
create unique index if not exists messages_session_client_idx
  on public.messages (session_id, client_message_id)
  where client_message_id is not null;

create index if not exists messages_session_created_idx
  on public.messages (session_id, created_at);

create table if not exists public.discovery_snapshots (
  session_id uuid not null references public.sessions (id) on delete cascade,
  version integer not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, version)
);

-- Enable Row Level Security with no policies, so only the service role reaches these tables.
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.discovery_snapshots enable row level security;
