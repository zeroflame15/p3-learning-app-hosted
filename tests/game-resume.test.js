// Game resume: a saved-and-quit round must resume exactly where it
// stopped — same round, same score, already-answered state, and the
// clock kept (seen live 2026-11-07: Number Pop resumed at round 5
// with the timer reset to 0s, and re-answering round 5 counted
// twice — 7/6 with 7 stars for a 6-round game).
//
// startGame + saveGameProgress are eval'd standalone with stubs, the
// same way tests/leaderboard.test.js evals recordPlayBest: each eval
// is a DIRECT eval inside its test callback, so the functions close
// over that callback's vars (gState, ex, GAMES, ...).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
// hashStr is a one-liner, so fnBody (which looks for the next
// function) would overshoot into the next function.
function fnLine(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  return html.slice(start, html.indexOf('\n', start));
}
// saveGameProgress closes with "save(); }" on one line and the next
// plain function is far away (the ASK PIP section starts with var
// declarations), so fnBody would swallow them and the eval would
// choke on a bare "var". Grab to its own terminator instead.
function fnSaveGame() {
  const start = html.indexOf('function saveGameProgress(){');
  assert.ok(start >= 0, 'saveGameProgress found');
  const end = html.indexOf('save(); }', start);
  assert.ok(end >= 0, 'saveGameProgress end found');
  return html.slice(start, end + 'save(); }'.length);
}

test('resuming Number Pop restores the answered round, the pick and the clock', () => {
  var gState = null; // eslint-disable-line no-unused-vars
  var explorer = { // eslint-disable-line no-unused-vars
    id: 'e1', name: 'Jiyuna', stars: 49, playBest: {}, playDoneDay: {}, playFresh: {},
    playProgress: { number: { idx: 4, score: 4, seed: 777, answered: true, picked: 2, elapsed: 65 } },
  };
  var DB = { explorers: [explorer], activeId: 'e1' }; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers.find(function (e) { return e.id === DB.activeId; }) || null; } // eslint-disable-line no-unused-vars
  var GAMES = [{ id: 'number', name: 'Number Pop', rounds: 6 }]; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  function save() {} // eslint-disable-line no-unused-vars
  var route = null; // eslint-disable-line no-unused-vars
  function go(r) { route = r; } // eslint-disable-line no-unused-vars
  const startGame = eval('(' + fnText('function startGame(id){') + ')');
  startGame('number');
  assert.equal(gState.idx, 4, 'resumes at round 5 (idx 4)');
  assert.equal(gState.score, 4, 'score kept');
  assert.equal(gState.answered, true, 'the answered round is restored answered, so it shows feedback + Next instead of fresh buttons');
  assert.equal(gState.picked, 2, 'the pick is restored, so the round cannot be scored again');
  assert.equal(gState.startedAt, null, 'resuming an answered round keeps the clock paused until Next');
  assert.equal(gState.answerSecs, 65, 'the banked seconds resume with the run');
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')');
  const elapsed = playElapsedSecs();
  assert.ok(elapsed >= 64 && elapsed <= 67, 'the clock resumes at ~65s, not 0 (got ' + elapsed + 's)');
  assert.equal(route, 'game', 'goes to the game screen');
  // Saving right after resume keeps the answered state, so a second
  // resume still cannot re-score the round.
  const saveGameProgress = eval('(' + fnSaveGame() + ')');
  saveGameProgress();
  assert.equal(explorer.playProgress.number.answered, true, 'save keeps the round answered');
  assert.equal(explorer.playProgress.number.picked, 2, 'save keeps the pick');
  assert.ok(explorer.playProgress.number.elapsed >= 64, 'save keeps the elapsed time');
});

test('a fresh game starts at round 1 with the clock at zero', () => {
  var gState = null; // eslint-disable-line no-unused-vars
  var explorer = { // eslint-disable-line no-unused-vars
    id: 'e1', name: 'Jiyuna', stars: 49, playBest: {}, playDoneDay: {}, playFresh: {},
    playProgress: {},
  };
  var DB = { explorers: [explorer], activeId: 'e1' }; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers.find(function (e) { return e.id === DB.activeId; }) || null; } // eslint-disable-line no-unused-vars
  var GAMES = [{ id: 'number', name: 'Number Pop', rounds: 6 }]; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  function save() {} // eslint-disable-line no-unused-vars
  function go() {} // eslint-disable-line no-unused-vars
  const hashStr = eval('(' + fnLine('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
  const startGame = eval('(' + fnText('function startGame(id){') + ')');
  startGame('number');
  assert.equal(gState.idx, 0, 'fresh game starts at round 1');
  assert.equal(gState.score, 0, 'fresh score is 0');
  assert.equal(gState.answered, false, 'nothing answered yet');
  assert.equal(gState.picked, null, 'no pick yet');
  assert.equal(gState.answerSecs, 0, 'fresh game banks no seconds yet');
  assert.ok(gState.startedAt, 'fresh game starts the clock running');
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')');
  const elapsed = playElapsedSecs();
  assert.ok(elapsed <= 1, 'fresh clock starts near 0 (got ' + elapsed + 's)');
});

test('saveGameProgress stores the answered state and elapsed time for every game', () => {
  var gState = { id: 'word', idx: 2, score: 2, seed: 111, startedAt: Date.now() - 42000, answered: true, picked: 1, rounds: 6 }; // eslint-disable-line no-unused-vars
  var explorer = { id: 'e1', playProgress: {} }; // eslint-disable-line no-unused-vars
  var DB = { explorers: [explorer], activeId: 'e1' }; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers.find(function (e) { return e.id === DB.activeId; }) || null; } // eslint-disable-line no-unused-vars
  var GAMES = [{ id: 'word', name: 'Word Garden', rounds: 6 }]; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  function save() {} // eslint-disable-line no-unused-vars
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')'); // eslint-disable-line no-unused-vars
  const saveGameProgress = eval('(' + fnSaveGame() + ')');
  saveGameProgress();
  const p = explorer.playProgress.word;
  assert.equal(p.idx, 2, 'round kept');
  assert.equal(p.score, 2, 'score kept');
  assert.equal(p.answered, true, 'answered state stored');
  assert.equal(p.picked, 1, 'pick stored');
  assert.ok(p.elapsed >= 41 && p.elapsed <= 43, 'elapsed stored (~42s, got ' + p.elapsed + 's)');
  // A paused save (answered, clock frozen) banks the seconds.
  gState = { id: 'word', idx: 2, score: 2, seed: 111, answerSecs: 42, startedAt: null, answered: true, picked: 1, rounds: 6 };
  explorer.playProgress = {};
  saveGameProgress();
  const p2 = explorer.playProgress.word;
  assert.ok(p2.elapsed >= 41 && p2.elapsed <= 43, 'paused save banks ~42s (got ' + p2.elapsed + 's)');
  assert.equal(p2.answered, true, 'paused save keeps the answered state');
});

test('resuming Memory Match restores the face-up cards and flips back a miss', () => {
  var gState = null; // eslint-disable-line no-unused-vars
  var deck = ['🐸', '🦦', '🍓', '⭐', '🚀', '🦋', '🐸', '🦦', '🍓', '⭐', '🚀', '🦋'];
  var explorer = { // eslint-disable-line no-unused-vars
    id: 'e1', name: 'Jiyuna', stars: 49, playBest: {}, playDoneDay: {}, playFresh: {},
    playProgress: { memory: { matched: [], moves: 1, won: false, seed: 777, deck: deck.slice(), open: [0, 5], elapsed: 33 } },
  };
  var DB = { explorers: [explorer], activeId: 'e1' }; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers.find(function (e) { return e.id === DB.activeId; }) || null; } // eslint-disable-line no-unused-vars
  var GAMES = [{ id: 'memory', name: 'Memory Match', rounds: 6 }]; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  function save() {} // eslint-disable-line no-unused-vars
  function go() {} // eslint-disable-line no-unused-vars
  function render() {} // eslint-disable-line no-unused-vars
  function shuffle(a) { return a.slice(); } // eslint-disable-line no-unused-vars
  var timers = [];
  function setTimeout(fn) { timers.push(fn); return timers.length; } // eslint-disable-line no-unused-vars
  const startGame = eval('(' + fnText('function startGame(id){') + ')');
  startGame('memory');
  assert.deepEqual(gState.open, [0, 5], 'the two flipped cards come back face-up');
  assert.deepEqual(gState.deck, deck, 'the same deck is restored');
  assert.equal(gState.moves, 1, 'move count kept');
  assert.equal(gState.answerSecs, 33, 'Memory banks the resumed seconds (continuous play, never paused)');
  assert.ok(gState.startedAt, 'Memory keeps the clock running on resume');
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')');
  const elapsed = playElapsedSecs();
  assert.ok(elapsed >= 32 && elapsed <= 35, 'the clock resumes at ~33s, not 0 (got ' + elapsed + 's)');
  assert.equal(gState.lock, true, 'taps are locked while the resumed miss is showing');
  assert.equal(timers.length, 1, 'the 750ms flip-back is re-armed on resume');
  // The flip-back fires: the miss turns face-down again and play unlocks.
  const saveGameProgress = eval('(' + fnSaveGame() + ')');
  timers[0]();
  assert.deepEqual(gState.open, [], 'the mismatched pair flips back down');
  assert.equal(gState.lock, false, 'play unlocks after the flip-back');
  assert.deepEqual(explorer.playProgress.memory.open, [], 'the save after flip-back stores no open cards');
});

test('resuming Memory Match with one card up restores it with no flip-back timer', () => {
  var gState = null; // eslint-disable-line no-unused-vars
  var deck = ['🐸', '🦦', '🍓', '⭐', '🚀', '🦋', '🐸', '🦦', '🍓', '⭐', '🚀', '🦋'];
  var explorer = { // eslint-disable-line no-unused-vars
    id: 'e1', name: 'Jiyuna', stars: 49, playBest: {}, playDoneDay: {}, playFresh: {},
    playProgress: { memory: { matched: [], moves: 0, won: false, seed: 777, deck: deck.slice(), open: [3], elapsed: 12 } },
  };
  var DB = { explorers: [explorer], activeId: 'e1' }; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers.find(function (e) { return e.id === DB.activeId; }) || null; } // eslint-disable-line no-unused-vars
  var GAMES = [{ id: 'memory', name: 'Memory Match', rounds: 6 }]; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  function save() {} // eslint-disable-line no-unused-vars
  function go() {} // eslint-disable-line no-unused-vars
  function shuffle(a) { return a.slice(); } // eslint-disable-line no-unused-vars
  var timers = [];
  function setTimeout(fn) { timers.push(fn); return timers.length; } // eslint-disable-line no-unused-vars
  const startGame = eval('(' + fnText('function startGame(id){') + ')');
  startGame('memory');
  assert.deepEqual(gState.open, [3], 'the single flipped card comes back face-up');
  assert.equal(gState.lock, false, 'play is not locked with one card up');
  assert.equal(timers.length, 0, 'no flip-back timer with only one card up');
});
