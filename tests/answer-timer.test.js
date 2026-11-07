// Answer-only game timer + per-game leaderboards.
// Requested 2026-11-07: the clock counts only the time a question is
// on screen waiting for an answer. Tapping an answer freezes it
// (feedback time does not count); tapping Next restarts it for the
// next question. The leaderboard is ranked by that time, with one
// board per game.
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

test('playElapsedSecs counts the banked seconds plus the live window, and 0 with no state', () => {
  var gState = null; // eslint-disable-line no-unused-vars
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')');
  assert.equal(playElapsedSecs(), 0, 'no game running, 0s');
  const realNow = Date.now;
  try {
    let now = 1000000000000;
    Date.now = function () { return now; };
    gState = { answerSecs: 0, startedAt: now };
    assert.equal(playElapsedSecs(), 0, 'just started, 0s');
    now += 12000;
    assert.equal(playElapsedSecs(), 12, '12s of answering counted');
    gState = { answerSecs: 12, startedAt: null };
    assert.equal(playElapsedSecs(), 12, 'paused: the banked 12s stay put');
    now += 30000;
    assert.equal(playElapsedSecs(), 12, '30s of feedback later, still 12s — paused time never counts');
    gState = { answerSecs: 12, startedAt: now };
    now += 8000;
    assert.equal(playElapsedSecs(), 20, 'resumed: 12 banked + 8 answering = 20s');
  } finally { Date.now = realNow; }
});

test('pausePlayTimer banks the window and freezes the clock; resumePlayTimer restarts it', () => {
  var gState = null; // eslint-disable-line no-unused-vars
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')'); // eslint-disable-line no-unused-vars
  const pausePlayTimer = eval('(' + fnText('function pausePlayTimer(){') + ')');
  const resumePlayTimer = eval('(' + fnText('function resumePlayTimer(){') + ')');
  const realNow = Date.now;
  try {
    let now = 1000000000000;
    Date.now = function () { return now; };
    gState = { answerSecs: 5, startedAt: now };
    now += 7000;
    pausePlayTimer();
    assert.equal(gState.answerSecs, 12, 'pausing banks the 7s just spent answering');
    assert.equal(gState.startedAt, null, 'clock frozen while the answer shows');
    now += 60000;
    pausePlayTimer();
    assert.equal(gState.answerSecs, 12, 'pausing again is a no-op — feedback time never leaks in');
    resumePlayTimer();
    assert.ok(gState.startedAt, 'Next restarts the clock for the next question');
    assert.equal(gState.answerSecs, 12, 'resume keeps the bank');
    now += 3000;
    assert.equal(playElapsedSecs(), 15, '3s into the next question');
    resumePlayTimer();
    assert.equal(playElapsedSecs(), 15, 'resuming while already running is a no-op');
  } finally { Date.now = realNow; }
});

test('bindGame pauses on every answer tap and resumes on Next (question games only)', () => {
  const bindSrc = fnText('function bindGame(){');
  const pauses = (bindSrc.match(/pausePlayTimer\(\); saveGameProgress\(\); render\(\);/g) || []).length;
  assert.equal(pauses, 4, 'four answer handlers pause before saving (generic tap + Number Pop escape timeout + scramble auto-check + sentence solve), got ' + pauses);
  const resumes = (bindSrc.match(/if\(gState\.idx<gState\.rounds\)resumePlayTimer\(\);/g) || []).length;
  assert.equal(resumes, 2, 'two one-line Next handlers resume when another round follows (generic + sentence); scramble resumes inside its own block, got ' + resumes);
  // Memory, Parking and Crossword are continuous play: no pause
  // anywhere in their handlers, and the timer chip keeps ticking.
  const pauseCalls = (bindSrc.match(/pausePlayTimer\(\)/g) || []).length;
  assert.equal(pauseCalls, 4, 'exactly four pause sites (generic tap + Number Pop escape + scramble auto-check + sentence solve), got ' + pauseCalls);
  // The third pause site is the scramble check, not a stray one:
  // it sits inside scrCheck, the function that grades a filled board.
  const scrCheckAt = bindSrc.indexOf('function scrCheck(){');
  assert.ok(scrCheckAt >= 0, 'scramble grades through scrCheck');
  assert.ok(bindSrc.slice(scrCheckAt).indexOf('pausePlayTimer(); saveGameProgress(); render();') >= 0,
    'scrCheck pauses the clock before saving, like every other answer');
  // The fourth pause site is the sentence solve: it sits inside
  // senSolve, which both solve paths (strip complete, correct
  // punctuation) call, so the clock freezes exactly once per round.
  const senSolveAt = bindSrc.indexOf('function senSolve(){');
  assert.ok(senSolveAt >= 0, 'sentence grades through senSolve');
  assert.ok(bindSrc.slice(senSolveAt).indexOf('pausePlayTimer(); saveGameProgress(); render();') >= 0,
    'senSolve pauses the clock before saving, like every other answer');
  assert.ok(bindSrc.indexOf('senSolve();') >= 0, 'both sentence solve paths call senSolve');
  const resumeCalls = (bindSrc.match(/resumePlayTimer\(\)/g) || []).length;
  assert.equal(resumeCalls, 3, 'exactly three resume sites (generic Next + sentence Next + scramble Next), got ' + resumeCalls);
  const saveSrc = fnBody('function saveGameProgress(){');
  assert.ok(saveSrc.indexOf('var elapsed=playElapsedSecs();') >= 0, 'saved elapsed is the answer-only time');
});

test('startGame banks the resumed seconds and stays paused on an answered round', () => {
  const startSrc = fnText('function startGame(id){');
  assert.ok(startSrc.indexOf('gState.answerSecs=(p&&!doneP&&p.elapsed)?p.elapsed:0;') >= 0,
    'resume banks the saved elapsed seconds');
  assert.ok(startSrc.indexOf('if(p&&!doneP&&gState.answered)gState.startedAt=null;') >= 0,
    'resuming an answered round keeps the clock paused until Next');
  assert.ok(startSrc.indexOf('gState.startedAt=Date.now()-p.elapsed*1000') < 0,
    'old wall-clock resume (which restarted the feedback window) is gone');
});
