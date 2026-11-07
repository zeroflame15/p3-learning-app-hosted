// The playProgress merge must keep Memory Match's face-up cards.
// save() runs mergeStoredIntoDB() on every save, and the merge
// rebuilt each game's progress from an explicit field list that had
// no `open` — so Save & quit wiped the flipped cards at the very
// moment of quitting, and Resume always came back face-down (seen
// live 2026-11-07, even for a single flipped card with no flip-back
// timer involved).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

// Brace-matching extractor: several of these functions nest other
// function declarations, so slicing to the next '\nfunction ' would
// cut them short.
function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}

const mergeExplorer = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
].map(grabFn).join('\n') + '\n; mergeExplorer;');

function explorer(overrides) {
  const base = {
    id: 'e1', name: 'Test', stars: 0, critterStage: 0, badges: [], treasures: [],
    discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
    hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, playBest: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [],
    deletedThreadIds: [], flashcards: [], deletedFlashcards: [], planner: [],
    deletedPlanner: [], friends: [], deletedFriends: [], friendCode: 'ABCDEF',
    nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦', lookAt: null,
    critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
  };
  return Object.assign(base, overrides);
}
const DECK = ['🐸', '🦦', '🍓', '⭐', '🚀', '🦋', '🐸', '🦦', '🍓', '⭐', '🚀', '🦋'];

test('merge keeps face-up Memory cards saved just before quitting', function () {
  const server = explorer({ playProgress: { memory: { matched: [], moves: 1, won: false, seed: 777, deck: DECK.slice(), elapsed: 33 } } });
  const local = explorer({ playProgress: { memory: { matched: [], moves: 1, won: false, seed: 777, deck: DECK.slice(), open: [0, 5], elapsed: 33 } } });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.playProgress.memory.open, [0, 5], 'the two flipped cards survive the merge, so Resume shows them face-up');
  assert.deepEqual(merged.playProgress.memory.deck, DECK, 'the deck survives too');
  assert.equal(merged.playProgress.memory.moves, 1, 'move count survives');
});

test('merge drops face-up cards once the flip-back has already happened', function () {
  const server = explorer({ playProgress: { memory: { matched: [], moves: 2, won: false, seed: 777, deck: DECK.slice(), open: [0, 5], elapsed: 33 } } });
  const local = explorer({ playProgress: { memory: { matched: [], moves: 2, won: false, seed: 777, deck: DECK.slice(), open: [], elapsed: 34 } } });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.playProgress.memory.open, [], 'the side that played longer (flip-back done) wins, so a stale pair cannot resurrect');
});

test('merge keeps the other side’s face-up cards when it played longer', function () {
  const server = explorer({ playProgress: { memory: { matched: [], moves: 1, won: false, seed: 777, deck: DECK.slice(), open: [2, 7], elapsed: 40 } } });
  const local = explorer({ playProgress: { memory: { matched: [], moves: 1, won: false, seed: 777, deck: DECK.slice(), elapsed: 10 } } });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.playProgress.memory.open, [2, 7], 'the side with the larger elapsed time wins');
});

test('merge keeps a freshly picked weekly theme (later timestamp wins)', function () {
  const server = explorer({ theme: 'Frog Pond', themeAt: '2026-11-07T08:00:00.000Z' });
  const local = explorer({ theme: 'Starry Night', themeAt: '2026-11-07T18:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.theme, 'Starry Night', 'the newer theme pick survives the merge instead of reverting to the server copy');
  assert.equal(merged.themeAt, '2026-11-07T18:00:00.000Z', 'the newer theme timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.equal(merged2.theme, 'Starry Night', 'the newer pick wins whichever side it arrives on');
});

test('merge keeps the server theme when neither side has a theme timestamp', function () {
  const server = explorer({ theme: 'Frog Pond', themeAt: null });
  const local = explorer({ theme: 'Starry Night', themeAt: null });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.theme, 'Frog Pond', 'legacy explorers without a timestamp keep the server copy');
});

test('new explorers start with a null theme timestamp and the theme tap stamps it', function () {
  assert.ok(html.includes("theme:'Frog Pond', themeAt:null"), 'explorer factory must start themeAt at null');
  const start = html.indexOf('[data-theme]');
  assert.ok(start >= 0, 'theme chip handler not found');
  const handler = html.slice(start, html.indexOf('});', start));
  assert.ok(handler.includes('e.themeAt=new Date().toISOString()'), 'tapping a theme chip must stamp themeAt so the merge can tell it is the newer pick');
});

test('merge keeps a freshly reset picture code (later timestamp wins)', function () {
  const server = explorer({ code: ['🦊', '🐢', '🦉'], codeAt: '2026-11-07T08:00:00.000Z' });
  const local = explorer({ code: ['🦋', '🍓', '🚀'], codeAt: '2026-11-07T18:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.code, ['🦋', '🍓', '🚀'], 'the newer reset code survives the merge instead of reverting to the old code');
  assert.equal(merged.codeAt, '2026-11-07T18:00:00.000Z', 'the newer code timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.deepEqual(merged2.code, ['🦋', '🍓', '🚀'], 'the newer reset wins whichever side it arrives on');
});

test('merge keeps the server picture code when neither side has a code timestamp', function () {
  const server = explorer({ code: ['🦊', '🐢', '🦉'], codeAt: null });
  const local = explorer({ code: ['🦋', '🍓', '🚀'], codeAt: null });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.code, ['🦊', '🐢', '🦉'], 'legacy explorers without a timestamp keep the server copy');
});

test('new explorers start with a null code timestamp and the reset stamps it', function () {
  assert.ok(html.includes('code:code, codeAt:null'), 'explorer factory must start codeAt at null');
  assert.ok(html.includes('target.codeAt=new Date().toISOString()'), 'resetting a picture code must stamp codeAt so the merge can tell it is the newer code');
});

test('merge keeps crossword typed letters from both sides, later time wins a conflict', function () {
  const server = explorer({ playProgress: { crossword: { idx: 1, score: 1, seed: 1, filled: [true, false, false, false, false, false], letters: { '0,1': 'A', '2,1': 'I' }, elapsed: 40 } } });
  const local = explorer({ playProgress: { crossword: { idx: 1, score: 1, seed: 1, filled: [true, false, false, false, false, false], letters: { '0,1': 'A', '0,2': 'R' }, elapsed: 30 } } });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.playProgress.crossword.letters, { '0,1': 'A', '2,1': 'I', '0,2': 'R' }, 'letters typed on either device survive — the merge unions them');
  // Same cell, different letter: the side that played longer wins.
  const s2 = explorer({ playProgress: { crossword: { idx: 0, score: 0, seed: 1, filled: [false, false, false, false, false, false], letters: { '1,0': 'A' }, elapsed: 50 } } });
  const l2 = explorer({ playProgress: { crossword: { idx: 0, score: 0, seed: 1, filled: [false, false, false, false, false, false], letters: { '1,0': 'X' }, elapsed: 20 } } });
  assert.equal(mergeExplorer(s2, l2).playProgress.crossword.letters['1,0'], 'A', 'the later (longer-played) letter wins a conflict');
  assert.equal(mergeExplorer(l2, s2).playProgress.crossword.letters['1,0'], 'A', 'the later letter wins whichever side it arrives on');
});

test('merge keeps a treasure spend — stars do not resurrect (reported 2026-11-07)', function () {
  // The old merge kept Math.max(balance), so a spend (34 -> 19) was
  // undone by the next sync: the server still held 34. The ledger
  // (earned minus spent) must survive the merge instead.
  const server = explorer({ stars: 34 });
  const local = explorer({ stars: 19, starsEarned: 34, starsSpent: 15 });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.stars, 19, 'the spent balance survives the merge');
  assert.equal(merged.starsEarned, 34, 'lifetime earned survives');
  assert.equal(merged.starsSpent, 15, 'lifetime spent survives');
  const merged2 = mergeExplorer(local, server);
  assert.equal(merged2.stars, 19, 'the spend survives whichever side it arrives on');
});

test('merge keeps an earn on one side and a spend on the other', function () {
  const server = explorer({ stars: 39, starsEarned: 39, starsSpent: 0 });
  const local = explorer({ stars: 19, starsEarned: 34, starsSpent: 15 });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.starsEarned, 39, 'the higher earned total wins');
  assert.equal(merged.starsSpent, 15, 'the higher spent total wins');
  assert.equal(merged.stars, 24, 'balance is earned minus spent (39 - 15)');
});

test('legacy explorers migrate: their balance becomes the earned total', function () {
  const server = explorer({ stars: 34 });
  const local = explorer({ stars: 34 });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.stars, 34, 'balance unchanged by the migration');
  assert.equal(merged.starsEarned, 34, 'balance becomes the earned total');
  assert.equal(merged.starsSpent, 0, 'nothing spent yet');
});

test('earnStars and spendStars keep the ledger and the balance in step', function () {
  function fnBody(marker) {
    const start = html.indexOf(marker);
    assert.ok(start >= 0, marker + ' found');
    const next = html.indexOf('\nfunction ', start + marker.length);
    return next >= 0 ? html.slice(start, next) : html.slice(start);
  }
  const fns = eval(fnBody('function ensureStarsLedger(e){') + '\n' + fnBody('function earnStars(e,n){') + '\n' + fnBody('function spendStars(e,n){') + '\n;({ensureStarsLedger:ensureStarsLedger,earnStars:earnStars,spendStars:spendStars});');
  const e = { stars: 34 };
  fns.earnStars(e, 5);
  assert.deepEqual([e.stars, e.starsEarned, e.starsSpent], [39, 39, 0], 'earning 5 migrates the legacy balance first, then adds');
  fns.spendStars(e, 15);
  assert.deepEqual([e.stars, e.starsEarned, e.starsSpent], [24, 39, 15], 'spending 15 deducts from the balance');
  fns.spendStars(e, 100);
  assert.equal(e.stars, 0, 'the balance never goes below zero');
  assert.equal(e.starsSpent, 115, 'the spent counter still records the whole spend');
});

test('stars only ever change through the ledger (no direct += / -= left)', function () {
  assert.ok(!/\.stars\+=/.test(html), 'no direct stars+= in the page');
  assert.ok(!/\.stars-=/.test(html), 'no direct stars-= in the page');
  assert.ok(html.includes("spendStars(e,t.cost)"), 'unlocking a treasure spends through the ledger');
  assert.ok(html.includes('starsEarned:0, starsSpent:0'), 'new explorers start with an empty ledger');
});
