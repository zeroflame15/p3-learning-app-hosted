# P3 Learning App — Hosted version

A direct-link web app for Jiyuna: no Muse menus, live AI Pip, and progress
saved on a server so it syncs across devices and the parent dashboard can be
checked remotely.

**Status: DEPLOYED and live at https://jyn-learning.vercel.app/**
(via Vercel project `jyn-learning`, renamed from `p3-learning-app-hosted`,
and the public GitHub repo https://github.com/zeroflame15/p3-learning-app-hosted;
Vercel Authentication is off, so it loads without a Vercel login. The old
URL https://p3-learning-app-hosted.vercel.app/ still works and serves the
same app.) `/api/health` still reads
`livePip:false, progressSync:false` — Supabase and the Meta Model API key
are NOT set up yet, so Pip is still canned answers and progress is still
on-device only until those are added (see "What Bryan still needs to do").
The family-sync-code change is deployed and live. The under-the-hood
wiring below (skill pack, agents, rules, flag-to-test) and the video
alignment below it are implemented and tested locally but NOT yet
deployed — deploy them with the steps below.

## What is in this folder

| Path | What it is |
|---|---|
| `public/index.html` | The full app (Grand Door, Home + weekly themes, Learn 14 P3 topics, Ask Pip threads, Play arcade, Create Studio, Critter Lab, Treasure Realm, Vibe — Forest Morning only, PIN parent page, school schedule / P4 study timetable). Patched from the static web version so Ask Pip calls the server and progress syncs. |
| `public/assets/` | Terrarium + critter-stage artwork, Pip otter image. |
| `api/ask-pip.js` | Serverless function: live AI Pip via Meta Model API (`muse-spark-1.3`). No key → 503 and the app falls back to its canned answers. |
| `api/progress.js` | Serverless function: GET/POST progress sync via Supabase REST, keyed by family sync code (legacy per-device id still accepted as a fallback key). No Supabase → `{configured:false}` and the app keeps using device storage only. |
| `api/health.js` | GET: reports which services are configured (no secrets) + skill pack version and agent counts. |
| `api/flag.js` | POST: records a flagged Pip answer and returns the auto-generated regression test case; stores it in Supabase `flag_log` when configured, otherwise returns the test case for local storage. |
| `lib/skills.js` | Versioned P3 skill pack (`skills-v1`): 16 skills, one exact method per Learn topic. The single source Pip (server + client) routes to. |
| `lib/rules.js` | Plain, tested scoring rules: stars, badges, treasure unlocks, daily fresh sets, warm-up non-repetition. Models explain; code decides. |
| `lib/agents.js` | Registry of the video's 19 specialist agents (17 on Meta Muse, 2 plain code) + routing, by feature. Live: 11. Ready: Reviewer + Judge. Placeholders: 6. |
| `lib/think.js` | "How one agent thinks": skill by id + instructions + lessons learned + guardrails, hint-first, and the signed/traceable reply. |
| `lib/feedback.js` | The feedback loop: Reviewer second-model check, code proves the fix, Judge ships/holds. |
| `lib/flags.js` | `flagToTest`: turns a flagged answer into a regression test case. |
| `scripts/run-nightly.js` | Nightly runner: re-runs the full suite + every flag-derived regression test, writes `tests/nightly-report.json`. No cron is scheduled by this repo. |
| `tests/` | Automated test suite — run with `npm test` (see "Tests" below). |
| `supabase/schema.sql` | One table (`family_progress`, one row per family sync code). Run in Supabase SQL Editor. No camera or location data is stored — ever. |
| `vercel.json`, `package.json` | Vercel routing / function timeouts. |
| `.env.example` | Every environment variable needed, with where each comes from. |

## Under the hood — aligned to the myKx video (5 Nov 2026, NOT yet deployed)

Reference: "Can an AI tutor fix Singapore's birth rate? I built one for
my 3 kids | myKx" — https://www.youtube.com/watch?v=LiW64t2Dxes
(Bryan's idea took reference from this video; align especially the
specialists/agents from 2:15 onwards — chapter 2:08 "Inside myKx:
19 agents on Meta Muse"). The video description confirms the chapters
and the principles; the timed-text caption endpoint returned empty, so
the agent names/models below are taken from the video's own
"A specialist for every feature" slide, which Bryan shared as
screenshots. If the spoken words at 2:15 differ anywhere from the
slide, the slide is what this build follows.

### The 19 specialists — the video's exact list

| Feature | Specialist | Model (video) | Status here |
|---|---|---|---|
| Question player | Kix Tutor | Muse Spark 1.3 | live |
| Ask Kix | Ask Kix | Muse Spark – vision | live* |
| Vibe Zone | Vibe Zone maker | Muse Spark | live |
| Talk to Kix | Talk to Kix | Muse Voice Transcribe | placeholder |
| Sidekick Studio | Sidekick Studio | Muse Image + SAM 3.1 | placeholder |
| Critter Lab | Critter Keeper | Muse Spark | live |
| Kix's Notebook | Memory Keeper | Muse Spark | live |
| Breaks and balance | Screen-time guardian | plain rules | live |
| Tonight | Tonight | Muse Spark | live |
| Location | Guardian Brief | Muse Spark | live† |
| Sentry | Home Reader | Muse Spark – vision | placeholder† |
| Sentry | Who's who | SAM 3.1 | placeholder† |
| Do something together | Outing Scout | Muse Spark – web search | placeholder |
| Do something together | Outing Planner | Muse Spark | live |
| New exam papers | Past-paper scout | plain rules | live |
| New exam papers | Content Curator | Muse Spark – files | placeholder |
| Skill packs | Skill Editor | Muse Spark | live |
| Feedback loop | Reviewer | Muse Spark Open, ready | ready |
| Feedback loop | Judge | Muse Spark Open, ready | ready |

19 specialists, 17 on Meta Muse, 2 plain code. **Live: 11. Ready: 2.
Placeholder: 6.** `*` Ask Kix: the video's model is Muse Spark –
vision; vision input is not wired yet, so today it answers by text
on Muse Spark 1.3. `†` Guardian Brief / Home Reader / Who's who are
present as agents because the video names them, but **no location
tracking and no camera, ever** — Guardian Brief briefs from progress
data only, and Home Reader / Who's who never receive a picture.

### Mismatches found (and fixed) in the previous registry

The previous `lib/agents.js` had the right count (19) but the wrong
agents: it was organised by school subject (Maths Tutor, English
Tutor, Science Tutor, Chinese Tutor, Spelling/Listening Coaches,
Storyteller, Critter Guide, Treasure Guide, Encourager, Flag Checker,
Warm-up/Game Coaches, Planner, Parent Summariser, Voice Coach, Image
Guide, Vision Guide, Open Model). None of those names was the video's
— Kix Tutor, Ask Kix, Vibe Zone maker, Talk to Kix, Sidekick Studio,
Critter Keeper, Memory Keeper, Screen-time guardian, Tonight,
Guardian Brief, Home Reader, Who's who, Outing Scout, Outing
Planner, Past-paper scout, Content Curator, Skill Editor, Reviewer
and Judge were all missing, and the two Muse Spark Open agents
(Reviewer, Judge) were collapsed into one "Open Model" placeholder.
Models were also wrong in places: Ask Kix is Muse Spark – vision
(not plain Muse Spark), Sidekick Studio is Muse Image + SAM 3.1
together (not two separate agents), Outing Scout needs web search,
Content Curator needs files, and Screen-time guardian / Past-paper
scout are plain rules (the previous registry's two plain-code agents
were Treasure Guide and Warm-up Coach, which are not in the video).
All of that is now aligned in `lib/agents.js`; routing is by feature
first (a critter-care question goes to Critter Keeper, a flagged
answer to Reviewer), a learning question with an exact skill goes to
Kix Tutor, and an open question with no skill goes to Ask Kix.

### How one agent thinks (`lib/think.js`)

The video's slide, implemented: a question goes to ONE specialist
(Kix Tutor for a Question-player question) → it opens the skill pack
(P3 Science) and reads the exact method **by id** → it thinks inside:
*My instructions* + *Lessons the loop learned* (from flagged
answers for that skill) + *Guardrails it can't break* (hint, not the
answer; P3 level; under 90 words; no personal data; no location /
camera; code decides) → then **code decides** marks / mastery /
rewards (`lib/rules.js`, never the model) → **a hint, not the
answer** (for a learning question with a skill; open questions get a
short explanation). Every reply is **signed and traceable**:
`pip:<agent>:<skill>:skills-v1:<traceId>` — the signature is
returned by `/api/ask-pip` and shown under the reply in the app.

### A continuous eval and feedback loop (`lib/feedback.js`, `api/flag.js`)

Kix replies (signed, traceable) → a kid flags it (one tap, in their
own words) → **Reviewer checks** (a second model reads the case;
when a model key is configured, `/api/flag` runs the Reviewer prompt
as a second model pass — labelled honestly as a second pass, since
Muse Spark Open has no key yet; without a key the review is queued,
never faked) → **code proves the fix** (`proveFix`: reproduced,
re-tested, no regressions) → **Judge ships or holds** (ships only
when the Reviewer confirmed the mistake AND code proved the fix;
ships as a new version, undoable by reverting it) → **it becomes a
test**: the flag's regression test case lands in
`tests/flag-cases.json` and is re-run by the nightly runner.

**Nightly re-run:** `npm run test:nightly` (`scripts/run-nightly.js`)
re-runs the full suite, including every flag-derived regression test,
and writes `tests/nightly-report.json`. **No nightly cron is
scheduled by this repo** — schedule one (Vercel Cron, GitHub Action,
or a local cron) separately, and do not claim a nightly run happens
until one actually is.

### Tests

Run `npm test` (Node's built-in runner, no dependencies). After editing
`lib/skills.js` or `lib/agents.js`, run `node scripts/sync-skills.js`
to regenerate the embedded skill pack in `public/index.html` — the
page and the server must never drift apart. **42 test
cases, 42 passing** (5 Nov 2026) — the previous 24 plus new tests for
the video agent list and routing (including "Why can't Pip hop
yet?" → Kix Tutor + `life-cycle-frog`), the think flow (skill by id,
lessons, guardrails, signed replies), the feedback loop (Reviewer /
Judge / prove-fix), and the flag regression cases. That is **NOT
1,000 tests** — the suite is the scaffolding for the 1,000-test goal:
every new flag adds a regression test case, and the count grows from
there. Do not claim 1,000 until the suite actually has that many
passing tests.

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

1. **Vercel — DONE.** Connected; project `jyn-learning` (renamed from
   `p3-learning-app-hosted`) is deployed at https://jyn-learning.vercel.app/
   from the GitHub repo https://github.com/zeroflame15/p3-learning-app-hosted
   (repo name unchanged; old URL still works).
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

### Under-the-hood wiring — verified locally, 5 Nov 2026 (not yet deployed)

- `npm run check` passes (all API + lib files); all 5 inline scripts
  in `public/index.html` parse.
- `npm test`: **42 test cases, 42 passing** (see "Tests" above for
  what they cover and the honest count — not 1,000). `npm run
  test:nightly`: 42 passing, 0 failing, 2 flag cases re-run.
- Mocked `/api/ask-pip`: a "7 x 8?" question is routed to
  Kix Tutor + `times-tables` skill, the skill method ("Count in
  groups… 7 × 8 = 56") is injected into the model prompt, the prompt
  says to give a HINT first, and the reply is signed
  (`pip:kix-tutor:times-tables:skills-v1:<trace>`). No key → 503.
- Mocked `/api/flag` with a model key: the Reviewer second-model pass
  returns CONFIRMED for a corrected flag, code proves the fix, and
  the Judge ships it; without a key the review is queued and the
  Judge holds — never faked.
- Client skill routing extracted verbatim from `public/index.html`
  and run in Node: 6/6 sample questions route to the right skill,
  and `recordFlag` stores a flag locally and builds its test case.
- Mocked `/api/flag`: unconfigured → 200 with the test case and
  `configured:false`; configured → stores the flag in `flag_log`
  (code, question, pip answer, correction, skill, test case, `open`).
- One real content bug was caught by the new tests and fixed: a
  warm-up question ("Most plants start from a…") repeated quest
  wording, so it was reworded ("A tiny shoot grows from a…").
- NOT verified: no real-browser tap-through of the 🚩 Flag button,
  the skill citation line, or the parent-page flags card; no live
  Supabase round-trip for `flag_log`; no live Model API call.

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

### Live sync — verified locally, 5 Nov 2026 (not yet deployed)

- **Pull-then-upload:** `syncToServer()` no longer POSTs the local DB
  as-is. It debounces 800 ms, then `uploadAfterPull()` GETs
  `/api/progress?code=<family code>`, union-merges the server record
  into the local DB with `mergeFamilyDB()` (never last-write-wins),
  and only then POSTs the merged DB. If the server is unconfigured,
  unreachable, or has no data for the code, it falls back to POSTing
  the local DB as before. Offline / unlinked behaviour is unchanged:
  localStorage only, no error shown.
- **No pull-inside-a-pull:** a shared `syncPulling` guard means a
  pull never starts a second pull, and an upload requested while a
  pull is in flight is queued exactly once. `syncFromServer()` uploads
  its merged result with a direct POST (`postToServer()`), never via
  `syncToServer()`.
- **Auto-pull:** every 30 seconds, only while the tab is visible, an
  explorer is active, and the device is linked with a valid 6-letter
  family code, `autoPull()` calls `syncFromServer()`. It also runs
  when the tab becomes visible again (`visibilitychange`).
- **Safe re-render only:** an auto-pull re-renders only when the
  route is not `quiz` / `warmup` / `game` and no modal is open. When
  it is not safe, the merge still happens silently and the next safe
  render shows it — a child is never interrupted mid-question/game.
- **Screen-time save:** the existing 60-second save still runs, but
  it now goes through pull-then-upload, so a device left open can no
  longer overwrite newer server progress with a stale snapshot.
- **Honest limit:** this is polling every 30 seconds, not instant
  push. Worst-case lag for the other device to show new progress is
  ~30 seconds plus the 800 ms upload debounce (less if the other
  device is reloaded, opened on the parent page, or its tab just
  became visible).
- **Grand Door stays the gate:** Bryan said no to skipping it, so
  opening the app still goes through the Grand Door picture code
  even when an explorer already exists on the device. Only the
  parent page is PIN-guarded, as before.
- Tests: `tests/sync-live.test.js` (7 tests) covers all of the above
  as regression checks over `public/index.html`. Suite is now
  49 tests, 49 passing (was 42).

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
