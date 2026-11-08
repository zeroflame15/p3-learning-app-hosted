# Jokes + Friends-to-bottom + critter detail fix (2026-11-08, Bryan)

Three small requests, one diff. Built while the gap-fill deploy is
running — do NOT apply to the real `public/index.html` until the
gap-fill deploy handoff lands (the deploy uploads the pre-change
file). Apply with `node new-jokes-friends-critter/apply.js <project-dir>`
then `npm test` in that dir.

## 1. Classroom Jokes sidebar section (new route `jokes`)
- NAV: new entry `['jokes','😂','Jokes','']` after `vibe`, before
  `friends`. `img:''` on purpose — `ic()` falls back to 😂 (same
  pattern as the 17 gap-fill topics; custom 3D art is a follow-up
  with the topic icons).
- PAGE_TITLES: `jokes:'Classroom Jokes'`.
- Render: `else if(route==='jokes')c.innerHTML=jokesHTML(),bindJokes();`
  after the trivia branch.
- New code after `bindTrivia()` (mirrors the Trivia pattern):
  `CLASS_JOKES` (24 classroom jokes, {q setup, a punchline}),
  `jokeState={order, idx, revealed, seen}`, `jokeOrder()` (shuffle,
  reuses global `shuffle`), `jokesHTML()` (pageHero + one joke card:
  setup shown, punchline behind "Show the punchline 👀", then
  "Tell me another! 😂"), `bindJokes()`. Order reshuffles when all
  24 are told; no repeats until then. Session-only state, nothing
  is saved or synced.
  - Name is `CLASS_JOKES` on purpose: the page already has a
    `var JOKES` (6 jokes, Treasure Realm Joke Pearl + Ask Pip's
    joke answers) — the new bank must not touch it. Two of the
    drafted jokes were near-dupes of that bank (maths book, eaten
    homework) and were replaced (teddy bear, big flower).
- Tests: `tests/jokes-critter.test.js` (NAV order, route, JOKES
  shape, reveal/next wiring). `tests/icons.test.js`: NAV push now
  carries the emoji (`n[1]`) so the fallback branch can assert it;
  wanted 50→51 ('11 nav + 9 games + 31 quests'), fallback 17→18
  (17 topics + Jokes nav); wired stays 33; Jokes added to the
  section-top list with art '' (pageHero falls back to 😂).

## 2. Friends to the bottom of the sidebar
- NAV reorder: `friends` moved from 6th to last. Order now:
  home, learn, ask, play, trivia, create, critter, treasure, vibe,
  jokes, friends. The friend badge stays attached to the friends
  button (keyed on `n[0]==='friends'`, order-independent). The
  mobile bottom nav renders NAV in the same order, so Friends goes
  last there too.

## 3. Critter detail shows where you tapped (no more scrolling up)
- Problem: the selected critter's detail card was rendered once,
  in a fixed spot after "Visiting this week" and before the
  collection — tapping a critter deep in the collection meant
  scrolling all the way up to read it.
- Fix: the detail card is now rendered inline in the collection,
  directly under the grid of the category the selected critter
  belongs to (`collectionHTML` appends `detail` after that
  category's grid), with `id="critterDetail"`. The fixed-position
  render (`+ visitingHTML + detail`) is gone.
- `bindCritter`'s `[data-critter]` tap handler scrolls the card
  into view after `render()`:
  `document.getElementById('critterDetail').scrollIntoView({behavior:'smooth',block:'nearest'})`.
  Visiting-week taps work the same way (the detail appears under
  that critter's own category).
- Tests: `tests/jokes-critter.test.js` asserts the detail id, the
  inline placement, the removal of the fixed-position render, and
  the scrollIntoView call. Behaviour to confirm live: tap a
  critter in the last category and the description appears right
  there, visible without scrolling.
