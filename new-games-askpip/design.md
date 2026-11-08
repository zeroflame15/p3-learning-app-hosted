# Games daily refresh + Ask Pip from a question + scrollable sidebar

Build date: 2026-11-08. Staging only — nothing here is deployed, and no
real family data was touched. Run the apply script on a copy first,
then `npm test` there.

## How to apply

```
cp -r ~/workspace/hosted-p3-learning-app /tmp/gap-copy
node ~/workspace/hosted-p3-learning-app/new-games-askpip/apply.js /tmp/gap-copy
cd /tmp/gap-copy && npm test
```

`apply.js` refuses cleanly (exit 3) if the build is already applied.
It patches `public/index.html`, `lib/rules.js`, `api/ask-pip.js`,
adds `tests/games-daily-askpip.test.js`, and updates three existing
tests that pin the exact old source text this build deliberately moves
(see "Existing tests updated" below).

## What changed

### `public/index.html` (via `new-code.js`, spliced before the live-gen section)
- **New per-explorer field `e.playSeen`** — `{gameId: {day, keys:[...]}}`,
  recorded on every run, merged across devices (inlined in
  `mergeExplorer`: later day wins whole, same day unions keys, cap
  1000). Added to `newExplorer` defaults and to the `playProgress`
  merge (`keys` by higher idx, `combo` by deck side).
- **`gamePoolFor(gameId, idx, tier)`** — the pick-strings one round may
  draw from (question text for word/sort/number/race, the word for
  scramble, the sentence text for sentence, the combo key for memory;
  `null` for race/crossword/parking).
- **`pickGameKeys(...)`** — unseen-first picker: each round takes the
  first pick in the day's seeded shuffle that is neither seen today
  nor already picked this run; an exhausted round reuses that round's
  first pick not yet shown this run (so a run never repeats a question
  inside itself).
- **`pickRaceSeed(...)`** — Maths Race seed search: first of 24
  candidate seeds whose 6 questions are all unseen today (and distinct
  in-run); least-colliding seed wins when the bank is exhausted.
- **`gameRunKeys(...)`** — the questions one run asks, for a seed
  (used to record a run and to score race seeds).
- **`memoryComboFor` / `memComboFromKey`** — the 12 combos
  (3 pair-counts × 4 themes); the deck is now built from the picked
  combo with a seeded shuffle (no more `Math.random`).
- **`NUM_RANGES`** — Number Pop's (a,b) ranges as a module-level var
  for the picker. `genRound` keeps its own local `RANGES` (its
  standalone harnesses eval it without the new block); a test asserts
  the two stay identical.
- **`genRound` / `sentFor`** gain an optional `pick` param. With a
  pick they serve that exact question (falling back to the seeded
  derivation if the pick is not found); with no pick they behave
  exactly as before. Callers pass `(gState.keys||[])[gState.idx]`
  (inline, so the gameHTML/bindGame harnesses keep working).
- **`startGame`** — fresh/replay runs draw via `pickGameKeys` /
  `pickRaceSeed` and record the run in `playSeen`; a resume keeps its
  saved rounds (and heals an old save by recording what it showed).
  A `hasDaily` guard keeps the old seed selection as a fallback: the
  standalone `startGame` harnesses eval it without the new helpers,
  and they must keep working. On the real page the helpers are always
  defined, so the new path always runs. The memory branch uses the
  picked combo (guarded) and a seeded deck (falls back to `shuffle`
  in a harness).
- **`saveGameProgress`** stores the run's `keys` (generic + sentence)
  and the memory `combo`.
- **`armNumberEscape(secs)`** — the Number Pop escape countdown as a
  named function (sets `gState.escapeDeadline` too), so the Ask Pip
  return path can re-arm it with the banked seconds. `bindGame` arms
  through it.
- **Ask Pip from a question** — `askPipAbout(ctx)`, `pipExplainSend`,
  `returnFromAskPip`, `askThreadTitle`, `askKidText`,
  `newAskQuestionThread`, `pipExplainFallback`, `bankSecsLeft`,
  plus session-only `askReturn` / `askPipPause`. `go()` clears
  `askReturn` on any route except `ask`.
- **Sidebar** — `.sidebar` gains `overflow-y:auto` (see below).
- Buttons: `🦦 Ask Pip about this question` (`#wuAskPip` warm-up,
  `#qAskPip` quest, `#gAskPip` generic/sentence/crossword games),
  wired in `bindWarmup` / `bindQuiz` / `bindGame`; `askHTML` gains a
  `← Back to my question` button (`#askReturnBtn`) wired in `bindAsk`.

### `lib/rules.js`
- `pickDailyGameKeys(pool, seen, count, seedStr)` and
  `mergePlaySeen(a, b)` — the same rules as the page, exported and
  tested. (The page's `mergePlaySeen` is inlined in `mergeExplorer`
  for the harness reason above; the lib copy is the canonical rule.)

### `api/ask-pip.js`
- Accepts `mode: 'explain'` + `explain: {topic, answer, clue}` and
  uses the explain system prompt (below). Normal mode is unchanged.

### Tests
- New: `tests/games-daily-askpip.test.js` (19 tests).
- Updated (anchor only, intent unchanged): `revamp-b-scramble`
  (scramble init now passes the pick), `revamp-a` (memory save now
  carries `combo`; escape wiring now lives in `armNumberEscape`),
  `answer-timer` (the escape pause now lives in `armNumberEscape`).

## Daily refresh, per game

| Game | What refreshes | How | Bank / notes |
|---|---|---|---|
| Word Garden | 6 questions per run | Picked unseen-first from the 70-question pool (TOPICS[0..3] quest+fresh — the old "60" was stale; the real pool is 70 unique) | 70; ~11 runs before any repeat is forced |
| Number Pop | 6 (a,b) questions per run | Picked unseen-first from the round's (a,b) rectangle | mid: 32/32/384 per band; low/high differ by tier |
| Speed Sort | 6 sets per run | Picked unseen-first from the tier-filtered sets | 24 sets (6/tier); low 12, mid 18, high 24 |
| Word Scramble | 6 words per run | Picked unseen-first from the round's band | 48 words, 16/band |
| Maths Race | 6 sums per run | Seed searched (24 tries) for all-unseen questions | Sum-space is large; a clean seed is found in a try or two |
| Sentence Builder | 6 sentences per run | Picked unseen-first from the tier's sentences | 45 sentences, 15/tier; a 3rd run in a day takes the last 3 unseen, then reuses |
| Memory Match | pairs + theme per run | The 12 combos picked unseen-first; deck seeded from the combo | 12 combos (4/6/8 pairs × 4 themes) |
| Crossword Quest | grid | Already rotates daily (`xwGridOfDay`, one grid/day family-wide) — no change; a same-day replay replays today's grid | 6 grids |
| Exit Parking | — | 18 fixed levels in order, each played once — no repeats are possible, no change | 18 levels |

A run already played today keeps behaving sensibly: the Play page
still shows completed / Replay (a replay draws a fresh unseen set,
matching the quest Replay rule). Leaderboards (fastest time), the
20-minute daily Play cap and the answer-only timer are untouched.

## Ask Pip from a question — how it works

- **Where:** Learn warm-up, Learn quest (quest / retry / boost), and
  the question-based games (Word Garden, Number Pop, Speed Sort, Word
  Scramble, Maths Race, Sentence Builder, Crossword Quest). NOT on
  Memory Match or Exit Parking (no question to ask about).
- **What the child sees:** a `🦦 Ask Pip about this question` button
  under the question. Tapping it pauses the answer-only timer first
  (and banks the Maths Race 10s countdown and the Number Pop escape
  seconds), saves the banked time, opens a NEW Ask Pip thread, and
  goes to Ask Pip. The thread title is `❓ <Topic/Game>: <question>`
  (truncated to 48 chars + `…`), and the opening message is
  `Pip, can you help me with this question? “<question>”` plus
  `The choices are: …` when there are options. The thread carries
  `qctx: {src, label, q}` so it stays identifiable.
- **What Pip gets (live):** `POST /api/ask-pip` with
  `mode: 'explain'` and `explain: {topic, answer, clue}`, plus the
  question (with choices) as the user message and the thread's last 8
  messages as history. The system prompt is:
  > You are Pip, a friendly otter tutor for {name}, a Singapore
  > Primary 3 student (age 8-9). The child is stuck on a question
  > from {topic}. Explain what the question is asking, the idea behind
  > it, and how to work it out, step by step. Give a hint, not the
  > answer first — guide the child to find it themself. The correct
  > answer is {answer} — this is for your reference only, so you never
  > guide them wrong. Do NOT say the answer first. Only say it if the
  > child finds it, or if they ask you directly for it. {clue, if any}
  > Keep it under 90 words, simple language, encouraging. {FACT line
  > when the question is a plain sum, worked out by code} Never use
  > the $ character, LaTeX, maths formatting like \times or \frac, or
  > markdown like **bold** or # headings — write maths in plain text,
  > for example 3 x 4 = 12, and plain words otherwise. Never mention
  > being an AI model.
- **Offline:** if the live call fails, `pipExplainFallback` replies
  instead — it restates the question, gives the clue, adds Pip's
  skill method, and encourages a first step. It never states the
  answer (the choices may list it as one option; the fallback never
  says "The answer is …"). The question is never lost.
- **Returning:** the thread view shows `← Back to my question`
  (only while viewing that question's thread). It resumes the timers
  — only an UNANSWERED round resumes its clock (an answered round's
  clock stays paused until Next, exactly as before), the Race
  countdown is restored from the banked seconds, the Number Pop
  escape is re-armed, and the game clock interval is re-armed — then
  goes back to the exact question. Navigating away via the nav
  abandons the return (timers stay paused; the next Resume restarts
  from the saved elapsed, so no time is lost or gained).
- **Per-surface question text:** warm-up/quest = the question +
  options + answer + clue; race = the sum string; scramble = the
  letters + hint; sentence = the bank-order words + tip; crossword =
  the current clue (number + direction + word length).

## Sidebar fix

`.sidebar` was `position:sticky; top:0; height:100vh` with no
overflow, so on a short viewport (~820px tall) the 11 nav buttons
plus the brand block overflowed the panel and the bottom items
(Critter, Treasure, Vibe, Jokes, Friends) were cut off and
unreachable. The fix adds `overflow-y:auto` to the `.sidebar` rule,
so the nav list scrolls inside the panel while the panel stays put.
The mobile `@media (max-width:820px)` block (`.sidebar{display:none}`,
`.bottomnav{display:flex}`) is untouched.

## Test results

On a fresh copy with the apply script run: **603/603 green**
(584 pre-existing + 19 new in `tests/games-daily-askpip.test.js`).
The 19 new tests cover: real bank sizes; a set changing across days;
no repeats within a day across runs; small-bank exhaustion (reuses
only after the bank is empty, never repeats inside a run); the race
seed search skipping a fully-seen seed; `gameRunKeys` shapes; the 12
memory combos; `playSeen` record/read/rollover/cap; the lib rules;
startGame/save/merge wiring; crossword daily rotation; the sidebar;
thread titles; the kid message; the new-thread shape; the offline
fallback; the banked-seconds math; the button placement (present on
question screens, absent on Memory/Parking); and the server explain
mode (prompt shape + normal mode unchanged).

## Deliberately left out / not verified

- **Live verification not done.** This build was verified by local
  tests only. It needs a live check on the real app (throwaway
  explorer, TEST family only): play each game twice in a day and
  confirm no repeats; ask Pip from a warm-up, a quest and a game and
  confirm the thread, the explanation, and the return to the exact
  question with the timer paused; check the sidebar scrolls on a
  short laptop window. Nothing was deployed, so the live app is
  unchanged.
- **Crossword / Parking:** documented exceptions (see the table) —
  no new refresh code, by design.
- **`playFresh`:** no longer used for the game seed (the seed now
  derives from the picked set); the field stays in defaults/merge
  for backward compatibility with old saves.
- **Server bank:** untouched — the daily refresh here is client-side
  (in-file banks). The server bank still serves math-ntuc only.
- The `hasDaily` fallback in `startGame` keeps the old seed
  selection if the new helpers are ever missing; on the real page
  they are always defined.
