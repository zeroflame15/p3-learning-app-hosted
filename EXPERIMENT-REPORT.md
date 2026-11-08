# Live-generated questions — EXPERIMENT REPORT (one topic: math-ntuc)

Date: 2026-11-07. Status: diff package built and validated on a /tmp copy.
**Not deployed. No live Gemini call has been made yet — see "What was NOT tested".**

## 1. Topic pick

**math-ntuc (NTUC Totals)**, P3 first (P4 via `bankFor` when the explorer is P4+).

Why this topic and not the others:
- Every answer is verifiable by code. A times-table / money / division
  answer either recomputes from the numbers in the question or it does
  not — so the comparison between bank and live is honest instead of
  a matter of taste.
- The bank is small and well understood (44 stems across P3+P4
  quest/fresh/warm/retry), so duplicate detection can be tested
  against the real bank.
- English/Science/Chinese answers cannot be recomputed; validating
  them would need a second model as judge, which is exactly the
  "model grades its own work" trap this experiment avoids.
- math-mrt was the runner-up, but its P4 bank is place value and
  rounding — rounding is verifiable but fiddlier, and its P3 bank
  mixes money/change with counting. NTUC is the cleanest exact-answer
  topic.

## 2. What was built (diff package only — real `public/index.html` untouched)

- `live-gen-diff.md` — 10 exact old→new pairs, every anchor verified
  to occur exactly once in the current file (post-Batch-B, post-weak-boost).
- `new-api-live-gen/lib-live-gen.js` → `lib/live-gen.js` — shared
  validator + prompt builder (server, authoritative).
- `new-api-live-gen/api-generate-questions.js` → `api/generate-questions.js`
  — new POST endpoint; same env as `/api/ask-pip` (key never leaves the server).
- `new-api-live-gen/client-snippet.js` — the client block inserted by Pair 1.
- `new-tests-live-gen/live-gen.test.js`, `live-gen-client.test.js`
  — 19 new tests (see §5).

How it works:
- Starting an NTUC Totals quest kicks off a fetch during warm-up.
  The quest uses the live set only if it arrived, validated, and is
  cached for today; otherwise it silently uses the bank and counts a
  fallback. The child never sees an error.
- Cache is localStorage per explorer + topic (`jyn-livegen-v1:<id>:math-ntuc`),
  NOT an explorer field — so there is no mergeExplorer change and no
  sync change. A fresh quest reuses today's set; an unfinished quest
  resumes from the cache whatever the day; a new day may generate anew.
- A live quest carries an "✨ Fresh from Pip" tag; the Learn card notes
  the experiment; the PIN parent page gets an experiment card
  (generated vs fallback counts, last generation time, last reason —
  device-local, labelled as such).
- Timer, stars, feedback, warm-up, Second Chance and the other 13
  topics are untouched and stay bank-only.

## 3. Validation design (where each check lives)

| Check | Server (`lib/live-gen.js` + endpoint) | Client mirror (page) |
|---|---|---|
| Exactly 5 questions | yes | yes |
| 4 options, all distinct (text + numeric value) | yes | yes |
| Answer index 0–3 | yes | yes |
| Explanation present, shows working (digit/operation) | yes | yes |
| Options all numeric (money allowed) | yes | yes |
| Distractors not all within a whisker (see below) | yes | yes |
| Answer not already a number in the stem | yes | yes |
| Answer recomputes from stem numbers | yes | yes |
| Answer uses EVERY number in the stem | yes | yes |
| Stem duplicates a bank stem (44 real stems) | yes (stems sent by client) | yes |
| Stem duplicated within the set | yes | yes |
| Estimation / multiples / factors / rounding | yes (rejected as non-computable) | yes |

Distractor rule: a set fails if every distractor is within max(1, 5% of
the answer) — 50 cents for money. Bank-style distractors (a wrong-table
answer such as 48 for 7×8=56) pass; a lazy "answer ±1" set fails.
The prompt demands the same ("at least one distractor must be a real
miss, not just 1 more or 1 less").

Two validator findings from building this (both fixed, both tested):
1. **Change problems need a third grouping.** `c − (a op b)` — "pay
   $10 for $4.25 + $1.75" — was not covered by the first two
   groupings, so real bank-shaped change questions would have been
   rejected. Added and tested.
2. **An intermediate step can pass a plain recompute.** In "4 notebooks
   at $6, pay with $50", the answer 24 (= 4×6) is computable yet wrong
   — it ignores the $50. The validator now requires a match that uses
   EVERY number in the stem, and reports this separately as
   `answer-ignores-numbers`. The prompt gained the matching rule:
   every number in the question must be used in the working.

## 4. Comparison: bank vs live-generated

### What was ACTUALLY tested
The real endpoint handler + real validator, run against three stubbed
"Gemini" generations (mocked `fetch`, dummy key). **No live model call
was made** — there is no Gemini key in this environment
(`MODEL_API_KEY` unset; only `.env.example` exists). Timings below
are mocked-fetch timings and mean nothing for live latency.

| Generation | Result | Detail |
|---|---|---|
| A — good set (5 fresh NTUC questions, incl. a two-step money problem) | **200, accepted** | All 5 validate; returned with `validated:true` |
| B — flawed set (one distinct failure per question) | **502, rejected** | `q1:answer-does-not-recompute`, `q2:non-computable-type` + `q2:duplicate-of-bank`, `q3:duplicate-of-bank`, `q4:weak-distractors`, `q5:answer-in-stem` + `q5:answer-ignores-numbers` |
| C — all correct, but every distractor ±1/±2 | **502, rejected** | `weak-distractors` on all 5 |
| Transient 503 then good | **200 after 1 retry** | 2 fetch calls, set accepted |
| No key configured | **503 `live_pip_not_configured`** | Client falls back to bank |

Mock fallback rate: 2 of 3 generations rejected (67%). **That is NOT
an estimate of the live rate** — B and C were deliberately built to
fail. It only proves the validator rejects what it is supposed to
reject, and accepts a good set.

### Bank vs live, dimension by dimension

| Dimension | Bank (as built) | Live-generated (what the experiment can show) |
|---|---|---|
| Generation time | 0 (pre-written) | Unknown live. Mocked runs are ~0–60 ms of handler overhead only. Live Gemini via the same path as Ask Pip is expected to take seconds; measure post-deploy (the parent card records it). |
| Correctness of answers | Verified by hand when written; 349→405 tests guard the banks | Enforced by recompute: a wrong answer cannot reach the child unless it is computable from the stem AND uses all its numbers. The intermediate-value hole above is the one known residual: an answer that is a *different valid computation* using all numbers (e.g. adding instead of multiplying) would still pass. The prompt + distractor rules narrow this, but only live sampling can measure how often it happens. |
| Syllabus fit | Exact (written to MOE P3/P4) | Prompt-constrained to the same scope (P3: tables 2–9, ×/÷ within 100, money to $10; P4: 2-digit×1-digit, two-step money to $100). No live sample yet to judge drift. |
| Difficulty vs bank | Fixed per bank | Should match the bank's range (same operations, same number sizes). The prompt includes two real bank questions as style anchors. No live sample yet. |
| Distractor quality | Hand-written, table-neighbour style | Validator enforces at least one real miss; the mock C run proves lazy sets are rejected rather than served. Live distractor quality still to be judged by eye. |
| Variety across 3+ generations | Fixed pool: 15 quest questions per topic, repeats after 3 days | Cannot be measured from mocks — the three mock payloads were hand-written, not generated. Live check: run the same prompt 3 times on 3 days, count distinct stems and overlap with the bank. The daily cache guarantees at most one generation per explorer per day, so variety is bounded by the model's own sampling. |
| Failure / fallback rate | 0 (bank always serves) | Unknown live. Every failure is silent for the child (bank fallback) and counted on the parent card, so the rate will be visible after a few days of real use. |

### Honest verdict so far
The machinery works: generation, validation, caching, silent fallback,
tagging and parent reporting are all built and tested. Whether live
generation is actually *better* than the bank is **unproven** — it
depends entirely on the live acceptance rate and on whether the model
writes interesting questions or just safe ones. The experiment is set
up so that question can be answered from real usage in a few days
instead of from an opinion now.

## 5. Validation on a /tmp copy

Fresh copy of the current project (post-Batch-B **and** post-weak-boost,
whose diff landed while this was being built), apply script run,
full suite:

- Baseline in the copy before this diff: 405 tests (384 post-Batch-B + 21 weak-boost).
- After applying: **424/424 green** (19 new live-gen tests), `npm run check` clean.
- New tests cover: validator accept/reject matrix on both copies
  (same fixtures, same verdicts), recompute incl. two-step/change/
  two-product and the intermediate-value case, prompt contents, reply
  parsing, endpoint 200/400/405/502/503 paths + retry, client cache
  (same day = same set, new day refuses, resume keeps any day),
  stats counting, questListFor live branch + non-experiment topics
  untouched, fetch success/failure/timeout fallback, and a
  no-`MODEL_API_KEY`-in-client-code assertion.

## 6. Overlap risk

- **Weak-topic boost: APPLIED while this was built (22:09, 24 pairs).**
  It touches the same quest-flow/parent-page area. All 10 anchors in
  this diff were re-verified against the post-boost file and applied
  cleanly on the fresh copy (424/424). No anchor collided.
- **Revamp Batches A/B: applied. Batch C: still running.** All three
  touch games code only (`genRound`/`startGame`/`gameHTML`/`bindGame`);
  this diff does not touch games code. No overlap.
- If the boost diff or Batch C changes `beginQuest`, `loadProgress`,
  `questListFor`, `quizHTML`, `learnHTML` or `parentHTML` again before
  this is applied, re-run the apply script — it aborts unless every
  anchor occurs exactly once.

## 7. What still needs a live check (after deploy)

1. Set `MODEL_API_KEY`/`MODEL_ID`/`MODEL_API_BASE` in Vercel (Gemini
   free tier, as for Ask Pip) and confirm `/api/health` shows livePip.
2. Start an NTUC Totals quest on a real device: the "✨ Fresh from Pip"
   tag should appear; the parent card should show generated=1.
3. Run the same quest on 3 different days; record for each day:
   generation time (parent card), accepted or fallback, and whether
   any stem repeats the bank or a previous day.
4. Read 3 accepted live sets by eye: syllabus fit, difficulty vs the
   bank, distractor quality, and whether any answer is a *different
   valid computation* (the residual hole in §4).
5. Resume a live quest mid-way (quit, reopen) — same questions.
   Skip warm-up instantly — expect a bank fallback with reason
   `still-loading` on the parent card the first time.
6. Open the same explorer on a second device — it generates its own
   set (cache is per-device by design); confirm no error.
7. Decide from the acceptance rate + quality: keep the experiment,
   expand it, or switch the topic back to bank-only (delete the
   `LIVE_GEN_TOPIC` gate — one constant).

## 8. Update 2026-11-08 — live results and the retry fix

Deployed 2026-11-07 23:23 (repo 169 commits) and verified live the
same night (throwaway explorers only): **0 live questions served in
2 browser attempts** — both quests fell back to the bank, and the
parent card said "timeout-or-fetch-failed". Direct endpoint tests
the same night showed the real story: the endpoint is FAST (2–7s,
not timing out) but only **1 of 4 generated sets passed validation**
— rejections were `q4:answer-ignores-numbers`,
`q3:answer-in-stem`, `q5:duplicate-option-values`. The parent card's
"timeout-or-fetch-failed" label was misleading: the client recorded
ALL failures under that one reason, including validation rejections.
The silent fallback worked exactly as designed — the child never
saw an error.

Fix (built 2026-11-08, in this deploy; Bryan chose "fix it and keep
the experiment"): the server now retries up to **3 generation
attempts** instead of one, feeding each failed set's exact rejection
reasons back into the next prompt, with new attempts stopping after
15s so the answer lands before the client's 20s abort (per-model-call
timeout cut 20s→12s). The client now records `validation-failed`
honestly on the parent card instead of lumping it under
"timeout-or-fetch-failed". Expected acceptance: ~1-in-4 per set →
roughly 1-in-2 or better per quest. Tests 460/460 green, including
two new retry tests (bad set then good set serves live on attempt 2;
three bad sets still fall back cleanly) and one new client test for
the honest reason.

## 9. Update 2026-11-08 — server-bank pilot, parking rework, validator fix

Three changes, one deploy (Bryan approved "deploy it all now"):

**Server-bank pilot (one topic: math-ntuc).** The year's questions
move to the server: `sb_questions` (44 real bank questions seeded)
and `sb_explorer_questions` (per-explorer mastery) in Supabase,
served by two new endpoints — `POST /api/daily-set` (due-first,
then day-seeded fresh; mastered excluded) and
`POST /api/report-answers` (correct → mastered, wrong → due).
The app shows server sets with a "📚 Pip's shelf" chip; precedence
on math-ntuc is server set → live-gen set → bank, and a server set
is never counted as a live-gen fallback. Warm-up stays bank; the
other 13 topics are untouched. Live-gen's role shifts to FILLING
the bank in bulk (generate → validate → keep the good ones).

**Parking rework.** Bryan: "the parking doesn't really swipe and
too easy." Cars now follow the pointer and snap to the furthest
free cell (one drag = one move; tap keeps the one-cell behaviour;
blocked drag shakes and snaps back). Six harder levels, 13–18
(6×6, solutions of 9–17 slides where the old ones were 2–4).
Level stars now bank immediately on the win, once per level per
day — the old end-of-game award never reached the balance.

**Validator fix.** The live-gen recompute checker only tried number
pairs in stem order, so a valid change question ("watermelon $7,
pay with $10", answer $3 = 10−7) was rejected. It now tries the
reverse for `-` and `/` too. Seed pin updated: 33 of 44 bank stems
recompute, 11 known failures (7 word-numbers, 5 estimation /
multiples / factors by design). Tests 490/490 green.

## 10. Update 2026-11-08 — Maths boost (live questions modelled on the miss)

When a Maths topic flags (two quest runs in a row under 3/5), the
boost drill now asks for live-generated questions MODELLED ON THE
EXACT MISSED QUESTION — same skill, easier first — instead of only
the 5 bank cousins a day. `/api/generate-questions` takes an
optional `modelOn` (boost mode allows all four Maths topics; the
quest flow stays math-ntuc-only). Every generated set must pass
the recompute validator, and any failure falls back silently to
the bank cousins, so the child never sees an error. The drill can
be retaken the same day until she scores 4/5 and clears the flag;
stars still only count on the first drill per topic per day.
English, Science and Chinese boosts stay bank-only. The parent
card shows whether the last boost used Pip-made or bank
questions. Tests 525/525 green (490 existing + 35 new).

## 11. Update 2026-11-08 — retake repeats fixed

Live verification of the Maths boost found the retake repeating
3 of the 5 drill questions verbatim. Cause: the boost fetch only
excluded bank stems, never the previous drill's questions, so the
validator had nothing to reject a repeat against — and the
tightly-modelled prompt makes the generator reproduce them.
Fix: starting a boost now passes the drill it replaces (a
finished boost for the same topic) as exclusions to the live
fetch, so the retake set cannot repeat it; the bank fallback is
unaffected. Tests 529/529 green (525 + 4 new).
