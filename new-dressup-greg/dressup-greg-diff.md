# Dress-up + frog facts (2026-11-08, Bryan)

Two features, one diff. Built on the post-jokes file. Apply with
`node new-dressup-greg/apply.js <project-dir>` then `npm test` in
that dir. Do NOT apply while a deploy is uploading the same file.

## 1. Full-body avatar builder in "Change my name & look"

Today the modal is only a name field + 12 animal emoji faces
(`e.face`) + a glow colour + a badge. Bryan wants more dress-up
options and a FULL BODY, not just a face.

- New data (top-level, just above `openLookModal`):
  `LOOK_COLORS` — 6 body colours + '' (Natural): pink `#ff8fa3`,
  amber `#ffb020`, teal `#2dd4bf`, blue `#7db4ff`, purple `#c084fc`,
  brown `#8b5e3c`.
  `LOOK_HAIRS` — '', spiky, curly, long, bun; labels in
  `LOOK_HAIR_LABELS`; shapes in `LOOK_HAIR_SHAPES` (small inline
  SVG paths, dark brown `#6b4423`).
  `LOOK_ACCS` — '', necklace, hat, glasses, bowtie; emoji in
  `LOOK_ACC_EMOJI` (📿 🎩 👓 🎀), labels in `LOOK_ACC_LABELS`.
- `avatarLookHTML(face, look, glow)` — the full-body preview.
  Emoji head on top, a CSS body shape below it in the chosen
  colour (Natural = the explorer's glow colour), hair SVG overlaid
  on the head, accessory emoji overlaid (hat on top, glasses over
  the face, necklace/bowtie at the neck). Emoji + CSS only, no new
  image files. Tolerates a missing `look` (legacy explorers).
- Modal: a "My full-body look" preview (`#lookPreview`) plus three
  new picker rows (Body colour swatches, Hair, Accessory) after the
  "My animal friend" row.
- Pickers follow the exact face/glow/badge pattern: resolve the
  live explorer fresh on every tap, preserve a typed unsaved name,
  update outlines in place, stamp `lookAt`, `save()`, and refresh
  the preview in place (`refreshLookPreview()`) — never rebuild the
  modal, never `render()` while it is open. The face picker also
  refreshes the preview (the head changes). `live.look` is created
  on first use for legacy explorers.
- Storage: `e.look={color, hair, accessory}`, stamped by the same
  `e.lookAt` as face/glow/badge. New explorers get
  `look:{color:'',hair:'',accessory:''}` (natural body, no hair, no
  accessory).
- Sync merge (the trap): `mergeExplorer` starts from a deep copy of
  `a` and carries look fields only through the later-timestamp
  branches — the look block now also carries `e.look` (deep-copied
  with JSON, so the merged object never aliases the other side's
  object) in all three branches (b-wins, a-wins, tie → b), exactly
  like glow/badge/face. No other place merges explorer fields:
  lib/ and api/ hold no explorer merge, and the leaderboard rows
  only copy face/name/stars for display.
- Sidebar brand disc, Grand Door chips and leaderboard rows keep
  showing the face emoji only (too small for a full body). The
  full-body preview lives in the profile menu only.

## 2. The frog tells fun facts (Critter Lab)

Today a tap on the frog (`frogTap`) shows a random greeting from
`FROG_LINES`. Bryan wants: tap the frog and he tells FUN FACTS
about frogs.

- `FROG_LINES` is deleted; `FROG_FACTS` (12 facts, one short
  sentence each, P3-friendly) takes its place. Every fact is a
  well-established true fact (the two most trivia-like were checked
  against sources 2026-11-08: a group of frogs is called an army,
  and most frogs can jump about 20 times their body length — US
  National Park Service "Fun with Frogs" and others). The rest are
  standard textbook facts: skin absorption, eyes helping swallowing,
  see-through glass frogs, front-attached tongue, tadpole gills to
  lungs, wide eye view, tiniest frog smaller than a coin
  (Paedophryne amauensis, 7.7 mm), colour change, 200+ million
  years of frogs, the tympanum eardrum behind the eye.
- Tap cycles the facts in shuffled order with no repeats until all
  12 have been told, then reshuffles (`nextFrogFact()` +
  `frogFactState`, session-only, never saved or synced — same
  pattern as `jokeState`/`triviaState`). Hop animation and the
  ~2.6 s bubble are unchanged.
- The bubble now shows the frog's actual name dynamically:
  `💬 Greg Washington: <fact>` — it reads `e.critterName`, so it
  says whatever the frog is currently named on that explorer.
- `.frog-bubble` CSS: facts are full sentences, so the bubble now
  wraps (`text-align:center;line-height:1.35`) instead of
  truncating to one line with an ellipsis. The bubble is only ever
  set by `frogTap`, so nothing else changes.
- "Greg Washington": that name does not appear in the code and no
  frog was renamed and no separate critter was added. Per Bryan
  (2026-11-08 14:18) Greg Washington IS the explorer's own frog in
  the Critter Lab ("same frog in critter", previously recorded as
  Teddy) — the feature is built on the main frog tap, so it is him.
- `tests/frog-drag.test.js` updated: the VM harness now loads
  `FROG_FACTS` + `frogFactState` + `nextFrogFact()` instead of
  `FROG_LINES`, the sandbox gets an identity `shuffle` (the real
  one lives in the page), and the bubble comment now says "frog
  fact" instead of "hello line". The tap-without-drag assertion
  (bubble shows, starts with 💬) is unchanged.
