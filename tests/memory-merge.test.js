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
