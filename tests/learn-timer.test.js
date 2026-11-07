// Learn quest timing + per-quest leaderboards.
// Requested 2026-11-07: the same answer-only clock as Play (it
// counts only the time a question waits for an answer), and one
// leaderboard per quest, ranked by fastest time, for family and
// friends — like the Play boards.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in ' + PAGE_PATH);
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
// Brace-matching extractor (same as memory-merge.test.js): some of
// these functions nest other function declarations.
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
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

const TOPICS9 = [
  { id: 'eng-story', icon: '📖', name: 'Story Words' },
  { id: 'math-mrt', icon: '🔢', name: 'MRT Numbers' },
  { id: 'sci-frog', icon: '🔬', name: 'Frog Life' },
  { id: 'chi-listen', icon: '🀄', name: 'Listen Up' },
];

test('learnElapsedSecs / pause / resume mirror the Play answer-only clock', () => {
  var cur = null; // eslint-disable-line no-unused-vars
  const learnElapsedSecs = eval('(' + fnText('function learnElapsedSecs(){') + ')');
  const pauseLearnTimer = eval('(' + fnText('function pauseLearnTimer(){') + ')');
  const resumeLearnTimer = eval('(' + fnText('function resumeLearnTimer(){') + ')');
  assert.equal(learnElapsedSecs(), 0, 'no quest running, 0s');
  const realNow = Date.now;
  try {
    let now = 1000000000000;
    Date.now = function () { return now; };
    cur = { answerSecs: 0, startedAt: now };
    now += 9000;
    assert.equal(learnElapsedSecs(), 9, '9s of answering counted');
    pauseLearnTimer();
    assert.equal(cur.answerSecs, 9, 'pausing banks the seconds');
    assert.equal(cur.startedAt, null, 'clock frozen while the answer shows');
    now += 20000;
    assert.equal(learnElapsedSecs(), 9, 'feedback time never counts');
    resumeLearnTimer();
    assert.ok(cur.startedAt, 'Next restarts the clock');
    now += 6000;
    assert.equal(learnElapsedSecs(), 15, '9 banked + 6 answering = 15s');
  } finally { Date.now = realNow; }
});

test('recordLearnBest keeps the fastest quest time; a paused run still counts', () => {
  var cur = { startedAt: Date.now() - 45000 }; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  const learnElapsedSecs = eval('(' + fnText('function learnElapsedSecs(){') + ')'); // eslint-disable-line no-unused-vars
  const recordLearnBest = eval('(' + fnText('function recordLearnBest(e, topicId){') + ')');
  const e = {};
  assert.equal(recordLearnBest(e, 'eng-story'), true, 'first run sets a best');
  assert.ok(e.learnBest['eng-story'].secs >= 43 && e.learnBest['eng-story'].secs <= 47, 'first run ~45s, got ' + e.learnBest['eng-story'].secs);
  assert.equal(e.learnBest['eng-story'].day, '2026-11-07', 'best records the day');
  cur = { answerSecs: 30, startedAt: null };
  assert.equal(recordLearnBest(e, 'eng-story'), true, 'a faster paused run is a new best');
  assert.ok(e.learnBest['eng-story'].secs >= 29 && e.learnBest['eng-story'].secs <= 31, 'paused run ~30s');
  cur = {};
  assert.equal(recordLearnBest(e, 'math-mrt'), false, 'no timing at all records nothing');
  assert.equal(e.learnBest['math-mrt'], undefined);
});

test('bindQuiz pauses on answer and resumes on Next; finishRound records the quest best', () => {
  const bindSrc = fnText('function bindQuiz(){');
  assert.ok(bindSrc.indexOf('pauseLearnTimer();') >= 0, 'answering pauses the quest clock');
  assert.ok(bindSrc.indexOf('if(cur.idx<list.length)resumeLearnTimer();') >= 0, 'Next resumes it when another question follows');
  assert.ok(bindSrc.indexOf('setInterval(tickQuizTime,1000)') >= 0, 'the quiz chip ticks live');
  const finishSrc = fnText('function finishRound(t){');
  assert.ok(finishSrc.indexOf('cur.newBest=recordLearnBest(e, cur.topicId);') >= 0, 'finishing a quest records its best time');
  const doneSrc = fnText('function quizDoneHTML(t){');
  assert.ok(doneSrc.indexOf('Your time: ') >= 0, 'completion screen shows the time');
  assert.ok(doneSrc.indexOf('🏅 New fastest time!') >= 0, 'completion screen celebrates a new best');
  const quizSrc = fnText('function quizHTML(){');
  assert.ok(quizSrc.indexOf('id="quizTime"') >= 0, 'the quest screen has a live timer chip');
  const beginSrc = fnText('function beginQuest(topicId){');
  assert.ok(beginSrc.indexOf('answerSecs:0, startedAt:Date.now()') >= 0, 'a fresh quest starts the clock at zero');
  const loadSrc = fnText('function loadProgress(topicId){');
  assert.ok(loadSrc.indexOf('answerSecs:(p.elapsed||0)') >= 0, 'a resumed quest banks its saved seconds');
  assert.ok(loadSrc.indexOf('startedAt:(p.answered?null:Date.now())') >= 0, 'a resumed answered round stays paused until Next');
  const persistSrc = fnText('function persistProgress(){');
  assert.ok(persistSrc.indexOf('elapsed:learnElapsedSecs()') >= 0, 'saved progress carries the answer-only elapsed time');
});

test('learnBoardHTML has one board per quest, family and friends together, ranked by fastest time', () => {
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { id: 'e1', name: 'Jiyuna', face: '🦦', stars: 40, friends: ['XYZ789', 'MNP456', 'QQQ111'], deletedFriends: [], friendCode: 'ABC2DE',
        learnBest: { 'eng-story': { secs: 65, day: '2026-11-07' }, 'math-mrt': { secs: 30, day: '2026-11-07' } } },
      { name: 'Sibling', face: '🐸', stars: 55, learnBest: { 'sci-frog': { secs: 120, day: '2026-11-07' } } },
      { name: 'Cousin', face: '🦁', stars: 10, learnBest: { 'eng-story': { secs: 50, day: '2026-11-07' } } },
    ],
    activeId: 'e1',
  };
  var TOPICS = TOPICS9; // eslint-disable-line no-unused-vars
  var friendsCache = [ // eslint-disable-line no-unused-vars
    { code: 'XYZ789', name: 'Kai', stars: 30, bestTimes: { 'learn-eng-story': { secs: 40 }, word: { secs: 25 } } },
    { code: 'MNP456', name: 'Mei', stars: 5, bestTimes: { 'learn-eng-story': { secs: 44 } } },
    { code: 'QQQ111', name: 'Ned', stars: 0, bestTimes: {} },
  ];
  var frErrMsg = ''; // eslint-disable-line no-unused-vars
  var friendsUnconfigured = false; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers[0]; } // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const learnBoardHTML = eval('(' + fnText('function learnBoardHTML(){') + ')');
  const out = learnBoardHTML();
  assert.ok(out.indexOf('Quest leaderboard') >= 0, 'one combined leaderboard heading');
  assert.ok(out.indexOf('Friends quest board') < 0, 'no separate friends board any more');
  assert.ok(out.indexOf('Fastest time wins') >= 0, 'ranked by time, not stars');
  assert.ok(out.indexOf('family and friends together') >= 0, 'the board says it combines everyone');
  for (const name of ['Story Words', 'MRT Numbers', 'Frog Life']) {
    assert.ok(out.indexOf(name) >= 0, 'a board for ' + name);
  }
  assert.ok(out.indexOf('Listen Up') < 0, 'no board for a quest nobody has timed');
  // Story Words: friend Kai (40s) beats Cousin (50s) and Jiyuna (65s); friend Mei (44s) sits between them.
  const iStory = out.indexOf('Story Words'), iMath = out.indexOf('MRT Numbers');
  const storyBoard = out.slice(iStory, iMath);
  assert.ok(storyBoard.indexOf('Kai') < storyBoard.indexOf('Mei'), 'Kai 40s before Mei 44s');
  assert.ok(storyBoard.indexOf('Mei') < storyBoard.indexOf('Cousin'), 'Mei 44s before Cousin 50s');
  assert.ok(storyBoard.indexOf('Cousin') < storyBoard.indexOf('Jiyuna'), 'Cousin 50s before Jiyuna 65s');
  assert.ok(storyBoard.indexOf('Sibling') < 0, 'Sibling has no Story Words time, so not on that board');
  assert.ok(storyBoard.indexOf('⏱ 40s') >= 0, 'fastest quest time shown');
  assert.ok(storyBoard.indexOf('👥 Friend') >= 0, 'friend rows carry the Friend tag');
  assert.ok(storyBoard.indexOf('🦦') >= 0, 'family rows still show the face');
  assert.ok(out.indexOf('Number Pop') < 0, 'Play times never leak onto the quest board');
  // Ned has no timed quest: on the waiting line, not on a board.
  assert.ok(out.indexOf('Ned — no timed quests yet.') >= 0, 'a friend with no times sits on the waiting line');
  assert.ok(out.indexOf('id="frCode"') >= 0 && out.indexOf('id="frSend"') >= 0, 'add-a-friend row stays on the board');
  DB = { explorers: [] };
  const noEx = learnBoardHTML();
  assert.ok(noEx.indexOf('Pick an explorer') >= 0, 'no explorers: the board says to pick one first');
  DB = { explorers: [{ id: 'e1', name: 'Nobody', face: '🦦', stars: 0, friends: [], deletedFriends: [], learnBest: {} }], activeId: 'e1' };
  friendsCache = [];
  const noTimes = learnBoardHTML();
  assert.ok(noTimes.indexOf('No timed quests yet') >= 0, 'nobody timed anything: the board invites the first run');
  assert.ok(noTimes.indexOf('No friends yet') >= 0, 'and it says there are no friends yet');
});

test('merge keeps the fastest quest time and the banked quest seconds', () => {
  const mergeExplorer = eval([
    'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
    'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeExplorer',
  ].map(grabFn).join('\n') + '\n; mergeExplorer;');
  function explorer(overrides) {
    const base = {
      id: 'e1', name: 'Test', stars: 0, critterStage: 0, badges: [], treasures: [],
      discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
      hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, playBest: {},
      learnBest: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [],
      deletedThreadIds: [], flashcards: [], deletedFlashcards: [], planner: [],
      deletedPlanner: [], friends: [], deletedFriends: [], friendCode: 'ABCDEF',
      nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦', lookAt: null,
      critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
    };
    return Object.assign(base, overrides);
  }
  const a = explorer({ learnBest: { 'eng-story': { secs: 65, day: '2026-11-06' } }, progress: { 'eng-story': { idx: 2, score: 2, elapsed: 40 } } });
  const b = explorer({ learnBest: { 'eng-story': { secs: 50, day: '2026-11-07' } }, progress: { 'eng-story': { idx: 3, score: 2, elapsed: 55 } } });
  const merged = mergeExplorer(a, b);
  assert.equal(merged.learnBest['eng-story'].secs, 50, 'faster quest time wins the merge');
  assert.equal(merged.learnBest['eng-story'].day, '2026-11-07', 'the day follows the winning side');
  assert.equal(merged.progress['eng-story'].elapsed, 55, 'banked quest seconds keep the larger side');
  assert.equal(merged.progress['eng-story'].idx, 3, 'progress still merges by max round');
});

test('tickQuizTime writes the answer-only time and self-clears when the chip is gone', function () {
  const fmtBody = fnBody('function fmtPlaySecs(');
  const tickBody = fnBody('function tickQuizTime(){');
  const elapsedBody = fnBody('function learnElapsedSecs(){');
  var el = { textContent: '' };
  var document = { getElementById: function () { return el; } };
  var cur = { answerSecs: 20, startedAt: Date.now() - 5000 }; // eslint-disable-line no-unused-vars
  var quizTimer = 9;
  var cleared = [];
  function clearInterval(id) { cleared.push(id); }
  var fmtPlaySecs = eval(fmtBody + '; fmtPlaySecs;');
  var learnElapsedSecs = eval(elapsedBody + '; learnElapsedSecs;'); // eslint-disable-line no-unused-vars
  var tickQuizTime = eval(tickBody + '; tickQuizTime;');
  tickQuizTime();
  assert.equal(el.textContent, '⏱ 25s', '20 banked + 5 answering');
  assert.equal(cleared.length, 0, 'timer keeps running while the chip is on screen');
  cur = { answerSecs: 25, startedAt: null };
  tickQuizTime();
  assert.equal(el.textContent, '⏱ 25s', 'paused: the frozen total stays put');
  assert.equal(cleared.length, 0, 'timer must not clear while paused');
  el = null;
  document = { getElementById: function () { return null; } };
  tickQuizTime();
  assert.deepEqual(cleared, [9], 'timer clears itself once the chip disappears');
});
