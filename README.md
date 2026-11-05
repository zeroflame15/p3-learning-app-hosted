# P3 Learning App — Hosted version

A direct-link web app for Jiyuna: no Muse menus, live AI Pip, and progress
saved on a server so it syncs across devices and the parent dashboard can be
checked remotely.

**Status: DEPLOYED and live at https://p3-learning-app-hosted.vercel.app/**
(via Vercel project `p3-learning-app-hosted` and the public GitHub repo
https://github.com/zeroflame15/p3-learning-app-hosted; Vercel Authentication
is off, so it loads without a Vercel login). `/api/health` still reads
`livePip:false, progressSync:false` — Supabase and the Meta Model API key
are NOT set up yet, so Pip is still canned answers and progress is still
on-device only until those are added (see "What Bryan still needs to do").
The family-sync-code change in this folder is implemented and tested
locally but NOT yet deployed — deploy it with the steps below.

## What is in this folder

| Path | What it is |
|---|---|
| `public/index.html` | The full app (Grand Door, Home + weekly themes, Learn 14 P3 topics, Ask Pip threads, Play arcade, Create Studio, Critter Lab, Treasure Realm, Vibe — Forest Morning only, PIN parent page, school schedule / P4 study timetable). Patched from the static web version so Ask Pip calls the server and progress syncs. |
| `public/assets/` | Terrarium + critter-stage artwork, Pip otter image. |
| `api/ask-pip.js` | Serverless function: live AI Pip via Meta Model API (`muse-spark-1.3`). No key → 503 and the app falls back to its canned answers. |
| `api/progress.js` | Serverless function: GET/POST progress sync via Supabase REST, keyed by family sync code (legacy per-device id still accepted as a fallback key). No Supabase → `{configured:false}` and the app keeps using device storage only. |
| `api/health.js` | GET: reports which services are configured (no secrets). |
| `supabase/schema.sql` | One table (`family_progress`, one row per family sync code). Run in Supabase SQL Editor. No camera or location data is stored — ever. |
| `vercel.json`, `package.json` | Vercel routing / function timeouts. |
| `.env.example` | Every environment variable needed, with where each comes from. |

## How it works

- **Ask Pip (live):** the app POSTs `{question, history, name}` to `/api/ask-pip`.
  The function calls `https://api.meta.ai/v1/chat/completions` with
  `MODEL_API_KEY` and model `muse-spark-1.3`, using the same Pip prompt as
  the Muse version (under 90 words, P3 level, Singapore syllabus, Chinese
  answers in Chinese). If the call fails, the app shows its canned answer.
- **Progress sync (family sync code):** every save also POSTs the whole
  progress document to `/api/progress` (debounced), keyed by a random
  6-letter family sync code (e.g. `ABC2DE`, no ambiguous 0/O, 1/I/L) —
  never by a child's name. The code is generated on first use, stored in
  the family record, and shown in the PIN-protected parent page (with a
  Copy button and a "Refresh from server now" button). On any other
  device, tap **"Link this device with a family code"** at the Grand
  Door, type the code, and that device pulls the family record down and
  keeps in sync. A device that already has local progress uploads it
  under its code rather than losing it; linking merges the two records
  (union merge: the richer value of every field wins for an explorer
  in both, local-only explorers are kept).
  The parent page pulls the latest server record when it opens, so a
  parent on their own phone (linked with the code) sees the child's
  newest progress. Same storage key as the static version
  (`jiyuna-learning-web-v1`), so existing on-device progress carries over.
  Devices that never get a code keep syncing under their old per-device
  id as a fallback. Treat the code like a house key: anyone who knows
  it can pull the family progress — share it only with the family's
  own devices.
- **Voice:** read-aloud is the device's own text-to-speech, with the
  natural/neural-voice picker from the Muse version. A cloud TTS voice
  (e.g. ElevenLabs) would need a separate paid key and is NOT included.

## What Bryan still needs to do (in order)

1. **Vercel — DONE.** Connected; project `p3-learning-app-hosted` is
   deployed at https://p3-learning-app-hosted.vercel.app/ from the
   GitHub repo https://github.com/zeroflame15/p3-learning-app-hosted.
2. **Create a Supabase project** — free account at https://supabase.com,
   new project, then run `supabase/schema.sql` in its SQL Editor (this
   creates the `family_progress` table — if you ran the earlier
   `device_progress` schema, run this file too; old per-device rows are
   not auto-migrated, the first device just re-uploads under its code),
   and copy from Project Settings → API keys: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
3. **Create a Model API key** — sign in at https://dev.meta.ai, API keys →
   Create API key. This is `MODEL_API_KEY` (server only).
4. **Set the environment variables in Vercel** — Project Settings →
   Environment Variables: `MODEL_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
   `KID_SESSION_SECRET` (generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
5. **Redeploy** in Vercel. Check `/api/health` — it should read
   `{"livePip":true,"progressSync":true}`.

## How to deploy an update (family sync code, or any later change)

Push this folder's contents to the GitHub repo
https://github.com/zeroflame15/p3-learning-app-hosted (branch `main`) —
Vercel watches that repo and auto-deploys on every push, usually in
under a minute, at the same URL. No new link, no re-publish step.
After deploying the family-sync change, do this once on the device
that already has her progress: open the app, open the parent page
(PIN), note the 6-letter family sync code, then on any other device
open the app and tap "Link this device with a family code" at the
Grand Door and type that code. If Supabase is not set up yet, linking
will say so — finish step 2 above first.

Do NOT paste any of these keys into chat. They go into Vercel's dashboard
or `.env.local` only.

## Costs (verified from the providers' own pages, Nov 2026)

- **Vercel Hobby: $0/month.** 100 GB fast data transfer, 1M function
  invocations, 4 CPU-hours/month. Personal, non-commercial use only. No
  credit card required; over-limit features pause instead of billing.
- **Supabase Free: $0/month.** 500 MB database, 1 GB file storage,
  5 GB egress, 2 active projects. **Caveat: free projects pause after
  1 week of inactivity** and must be restored in the dashboard before
  they serve requests again — if Jiyuna doesn't play for a week, the
  first visit after that will fail to sync until Bryan restores it.
  Pro is $25/month and removes pausing (8 GB database).
- **Meta Model API: pay-as-you-go.** `muse-spark-1.3`: $1.25 input /
  $4.25 output per 1M tokens (Meta pricing, Oct 2026). A few short Pip
  chats a day is cents a month; there is no free allowance quoted.
  ⚠️ Meta's own docs describe the Model API as public preview for US
  developers — whether Bryan (Singapore) can create a key at dev.meta.ai
  is **not verified**; if sign-up is region-blocked, an OpenAI-compatible
  key from another provider can be used instead by setting
  `MODEL_API_BASE` / `MODEL_ID` (the code is provider-agnostic).

## What was verified here (locally, 5 Nov 2026)

- All 3 API files pass `node --check`; all 4 inline scripts in the
  patched `index.html` pass `node --check`.
- Mocked handler tests: `/api/ask-pip` without a key → 503
  `live_pip_not_configured`; with a stubbed Model API response → 200
  with the reply parsed correctly; empty question → 400;
  `/api/progress` without Supabase → `{configured:false}`;
  `/api/health` reports configuration correctly.
- Served locally like Vercel would (static + `/api/*`): `GET /` → 200,
  `/api/health` → 200, `/api/ask-pip` → 503 without a key,
  `/api/progress` → `{configured:false}`.

### Family sync code — verified locally, 5 Nov 2026 (not yet deployed)

- Mocked `/api/progress` handler tests (in-memory Supabase): GET unknown
  code → `data:null`; invalid / missing code → 400; POST device A under
  code `ABC2DE` → ok; GET device B with the same code → pulls A's data
  (stars 42); POST B (stars 55) → GET A reads stars 55; a different
  code sees nothing (isolation); legacy per-device id POST/GET still
  works; oversize payload → 413; POST with no data → 400.
- Client functions extracted verbatim from `public/index.html` and run
  in Node: `makeSyncCode` always yields 6 chars from the unambiguous
  alphabet; `normalizeSyncCode` strips spaces/hyphens and upper-cases;
  `syncCodeValid` rejects `0`/`O`/short codes; `mergeFamilyDB` is a
  union merge — it keeps local-only explorers, keeps the richer value
  of every field for a duplicate explorer (max stars/stage, union of
  completed quests/badges/treasures), and takes the server's PIN/limit/
  code. Timestamps are deliberately NOT trusted as a winner, because
  an open device's per-minute screen-time save keeps bumping its
  local timestamp; a dedicated race test proves a stale copy with a
  newer timestamp does not overwrite newer server progress (stars 55
  on the server survives a local stars-42 copy timestamped later).
- Simulated two-device flow using the actual client `syncToServer` /
  `syncFromServer` / `linkDevice` functions with a mocked
  `/api/progress`: device A uploads existing progress under its code;
  device B links with the (lowercase, hyphenated) code, pulls stars 42
  and the parent PIN; B earns to 55 stars and uploads; A pulls 55 via
  `syncFromServer` (the parent-page refresh path); an unknown code
  links nothing and leaves the local DB untouched; linking a device
  that has a local-only explorer preserves that explorer.

## What was NOT verified

- No live Supabase round-trip was made (no project exists here) and no
  live call to the Meta Model API was made (no key exists here) — the
  family-sync flow was tested against a mocked `/api/progress` only.
- The patched page was not driven in a real browser (no live tap-through
  of the Grand Door link screen, the parent-page sync card, or linking
  two real devices against the live Vercel deployment).

## Deliberately NOT included

- No camera doze-off detection, no child location tracking — same as the
  Muse version.
- The original myKx repo was NOT deployed as-is; this is Jiyuna's app,
  adapted from the Muse/static versions.
