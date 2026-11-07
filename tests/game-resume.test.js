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
  const elapsed = Math.round((Date.now() - gState.startedAt) / 1000);
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
  const elapsed = Math.round((Date.now() - gState.startedAt) / 1000);
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
  const saveGameProgress = eval('(' + fnSaveGame() + ')');
  saveGameProgress();
  const p = explorer.playProgress.word;
  assert.equal(p.idx, 2, 'round kept');
  assert.equal(p.score, 2, 'score kept');
  assert.equal(p.answered, true, 'answered state stored');
  assert.equal(p.picked, 1, 'pick stored');
  assert.ok(p.elapsed >= 41 && p.elapsed <= 43, 'elapsed stored (~42s, got ' + p.elapsed + 's)');
});
