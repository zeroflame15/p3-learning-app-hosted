-- Supabase schema for the hosted P3 Learning App.
-- Run in Supabase Dashboard -> SQL Editor -> New query, or: supabase db push.
-- One row per FAMILY, keyed by a random 6-letter family sync code that
-- the app generates (e.g. ABC2DE). Every device linked with that code
-- reads/writes the same row, so a child can resume on any device and a
-- parent can open the parent dashboard on their own phone with the code
-- and see the latest progress. The server never needs a child's real
-- name: the code is random, not a name. Progress is one JSON document
-- per family, which keeps the app's existing per-explorer data model
-- intact. No camera or location data is stored. Ever.
--
-- If you ran the earlier schema (device_progress, one row per device
-- UUID), run this file too — it creates the new table. Old per-device
-- rows are NOT auto-migrated: the first device that opens the updated
-- app already has its local progress and uploads it under its family
-- sync code, which becomes the shared family record.

create table if not exists public.family_progress (
  code text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock the table down: only the service-role key (server) may read/write.
alter table public.family_progress enable row level security;
drop policy if exists "service role only" on public.family_progress;
create policy "service role only" on public.family_progress
  for all using (auth.role() = 'service_role');

-- Ask Pip threads are already stored inside the progress document (per
-- explorer), so no separate tables are needed for v1. If you later want
-- server-side thread history, add:
-- create table if not exists public.ask_threads (
--   id uuid primary key default gen_random_uuid(),
--   code text not null,
--   explorer_id text not null,
--   title text not null default 'New chat',
--   created_at timestamptz not null default now()
-- );
-- create table if not exists public.ask_messages (
--   id uuid primary key default gen_random_uuid(),
--   thread_id uuid not null references public.ask_threads(id) on delete cascade,
--   role text not null check (role in ('kid','pip')),
--   text text not null,
--   live boolean not null default false,
--   created_at timestamptz not null default now()
-- );
