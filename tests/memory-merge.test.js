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
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeExplorer',
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
