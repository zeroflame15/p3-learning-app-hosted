-- Supabase schema for the SERVER-BANK PILOT (one topic: math-ntuc).
-- Run AFTER supabase/schema.sql, in Supabase Dashboard -> SQL Editor
-- -> New query. The parent runs this file; no agent runs it.
-- The year's questions live here, not in the app file: the app pulls
-- one day's set at a time (POST /api/daily-set) and reports answers
-- (POST /api/report-answers). The client never talks to Supabase
-- directly and never sends a child's name — only the random 6-letter
-- family code (or a device id for an unlinked device) + explorer id.
--
-- Two tables:
--   sb_questions: the question bank. Seeded from the app's own
--     math-ntuc bank by scripts/seed-server-bank.js (source='bank',
--     sub_topic carries the bank kind: quest / fresh / warm / retry).
--     Only quest-pool kinds (quest, fresh) are served as a quest in
--     the pilot; warm/retry rows are seeded for later use.
--   sb_explorer_questions: per-explorer mastery state. Correct ->
--     mastered (never served again); wrong -> due (recycled in a
--     future set, oldest first); served but unreported stays served
--     and may be served again (a quit mid-quest is safe by design).

create table if not exists public.sb_questions (
  id text primary key,
  topic text not null,
  level int not null,
  sub_topic text,
  stem text not null,
  options jsonb not null,
  answer int not null,
  explanation text not null default '',
  joke text not null default '',
  source text not null default 'bank',
  created_at timestamptz not null default now()
);
create index if not exists sb_questions_topic_level_idx on public.sb_questions (topic, level);

-- Lock the table down: only the service-role key (server) may read/write.
alter table public.sb_questions enable row level security;
drop policy if exists "service role only" on public.sb_questions;
create policy "service role only" on public.sb_questions
  for all using (auth.role() = 'service_role');

create table if not exists public.sb_explorer_questions (
  family_code text not null,
  explorer_id text not null,
  question_id text not null,
  status text not null default 'served' check (status in ('served', 'mastered', 'due')),
  attempts int not null default 0,
  correct int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (family_code, explorer_id, question_id)
);
create index if not exists sb_explorer_questions_state_idx on public.sb_explorer_questions (family_code, explorer_id, status);

alter table public.sb_explorer_questions enable row level security;
drop policy if exists "service role only" on public.sb_explorer_questions;
create policy "service role only" on public.sb_explorer_questions
  for all using (auth.role() = 'service_role');
