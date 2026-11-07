-- Friends (leaderboard-only) for the hosted P3 Learning App.
-- Run in Supabase Dashboard -> SQL Editor -> New query, AFTER
-- supabase/schema.sql. The friends API (/api/friends.js) does NOT
-- work until these tables exist.
--
-- Privacy design — read this before changing anything:
-- * friend_snapshots holds ONLY what a friend may see on the
--   leaderboard: an explorer's display name, star count, and
--   fastest game times. No family sync code, no Ask Pip chats,
--   no quest progress, no full explorer record — ever.
-- * A friend code identifies ONE explorer, never a family. It is
--   a random 6-character code from the same unambiguous alphabet
--   as the family sync code (no I/L/O/0/1), but it is a different
--   code: knowing a friend code gives no access to the family's
--   progress row.
-- * A friend only appears on a child's leaderboard after a parent
--   accepts the request in the PIN-protected parent page.
-- * The parent page removes a friend by dropping the code from
--   the explorer's friends list in the family record; the snapshot
--   row itself is only ever overwritten by its own explorer's
--   publish calls.

create table if not exists public.friend_snapshots (
  code text primary key,
  name text not null default 'Explorer',
  stars integer not null default 0,
  best_times jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_code text not null,
  to_code text not null,
  from_name text not null default 'Explorer',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- Lock both tables down: only the service-role key (server) may
-- read/write, same as family_progress and flag_log.
alter table public.friend_snapshots enable row level security;
drop policy if exists "service role only" on public.friend_snapshots;
create policy "service role only" on public.friend_snapshots
  for all using (auth.role() = 'service_role');

alter table public.friend_requests enable row level security;
drop policy if exists "service role only" on public.friend_requests;
create policy "service role only" on public.friend_requests
  for all using (auth.role() = 'service_role');
