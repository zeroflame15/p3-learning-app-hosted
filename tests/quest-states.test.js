// Quest / game states: one rule for Learn quests and Play games.
//   not-started     — nothing attempted: "Start quest" / "Play"
//   in-progress     — some answered, not all: "Resume" only here
//   completed-today — all done today: "✔ Completed", card greyed
//                     out, with a ↻ Replay button to play again
//   fresh-today     — finished on an earlier day: "Start" with a
//                     fresh set, which returns tomorrow morning.
// A quest finished today is done for the day; tomorrow it is a
// fresh quest again. Replay is always allowed.
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
const questState = eval('(' + fnText('function questState(e, topicId, dayKey){') + ')');
const gameState = eval('(' + fnText('function gameState(e, gameId, dayKey, doneG){') + ')');
const unionObjLatest = eval('(' + fnText('function unionObjLatest(a,b){') + ')');

const TODAY = '2026-11-05';
const YESTERDAY = '2026-11-04';

function explorer(over) {
  return Object.assign({
    completed: {}, completedDay: {}, progress: {},
    playProgress: {}, playDoneDay: {},
  }, over || {});
}

test('quest: never attempted -> not-started', () => {
  assert.equal(questState(explorer(), 't1', TODAY), 'not-started');
});

test('quest: some answers, not finished -> in-progress', () => {
  assert.equal(questState(explorer({ progress: { t1: { idx: 2, score: 2 } } }), 't1', TODAY), 'in-progress');
});

test('quest: finished today -> completed-today', () => {
  assert.equal(questState(explorer({ completed: { t1: 5 }, completedDay: { t1: TODAY } }), 't1', TODAY), 'completed-today');
});

test('quest: finished yesterday -> fresh-today, a new set', () => {
  assert.equal(questState(explorer({ completed: { t1: 4 }, completedDay: { t1: YESTERDAY } }), 't1', TODAY), 'fresh-today');
});

test('quest: completed-today beats a leftover in-progress record', () => {
  const e = explorer({ completed: { t1: 5 }, completedDay: { t1: TODAY }, progress: { t1: { idx: 3, score: 3 } } });
  assert.equal(questState(e, 't1', TODAY), 'completed-today');
});

test('game: never played -> not-started; in progress -> in-progress', () => {
  assert.equal(gameState(explorer(), 'word', TODAY, false), 'not-started');
  assert.equal(gameState(explorer({ playProgress: { word: { idx: 3, score: 2 } } }), 'word', TODAY, false), 'in-progress');
});

test('game: finished today -> completed-today; finished yesterday -> fresh-today', () => {
  assert.equal(gameState(explorer({ playProgress: { word: { idx: 6, score: 5 } }, playDoneDay: { word: TODAY } }), 'word', TODAY, true), 'completed-today');
  assert.equal(gameState(explorer({ playProgress: { word: { idx: 6, score: 5 } }, playDoneDay: { word: YESTERDAY } }), 'word', TODAY, true), 'fresh-today');
});

test('unionObjLatest keeps the latest completion day per quest', () => {
  assert.deepEqual(
    unionObjLatest({ t1: YESTERDAY, t2: TODAY }, { t1: TODAY, t3: YESTERDAY }),
    { t1: TODAY, t2: TODAY, t3: YESTERDAY }
  );
});

test('Learn card: completed-today renders greyed out with a Replay button', () => {
  const learn = fnBody('function learnHTML(){');
  assert.ok(learn.includes("questState(e,t.id,todayKey())"), 'Learn uses questState');
  assert.ok(learn.includes("' done'"), 'completed card gets the done class');
  assert.ok(learn.includes('↻ Replay'), 'completed button offers Replay');
  assert.ok(learn.includes('✔ Completed — replay any time!'), 'completed pill says replay any time');
  assert.ok(learn.includes('▶ Resume quest'), 'in-progress still shows Resume');
  assert.ok(!learn.includes('disabled'), 'no disabled button on a completed quest');
});

test('Play card: completed-today renders greyed out with a Replay button', () => {
  const play = fnBody('function playHTML(){');
  assert.ok(play.includes('gameState(e,g.id,todayKey(),!!doneG)'), 'Play uses gameState');
  assert.ok(play.includes("' done'"), 'completed game card gets the done class');
  assert.ok(play.includes('↻ Replay'), 'completed game button offers Replay');
});

test('finishRound records the completion day; saveGameProgress records the game day', () => {
  const finish = fnBody('function finishRound(t){');
  assert.ok(finish.includes('e.completedDay[cur.topicId]=todayKey()'), 'quest finish stamps today');
  const saveGame = fnBody('function saveGameProgress(){');
  assert.ok(saveGame.includes('e.playDoneDay[gState.id]=todayKey()'), 'game finish stamps today');
});

test('mergeExplorer unions completion days so a finished-today quest stays finished on every device', () => {
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.includes('unionObjLatest(a.completedDay,b.completedDay)'), 'completedDay merges');
  assert.ok(merge.includes('unionObjLatest(a.playDoneDay,b.playDoneDay)'), 'playDoneDay merges');
});

test('replay: a completed-today quest or game can start again from its Replay button', () => {
  const startQ = fnBody('function startQuestFlow(topicId){');
  assert.ok(!startQ.includes('completed-today'), 'no guard blocks a quest replay');
  const startG = fnBody('function startGame(id){');
  assert.ok(!startG.includes('completed-today'), 'no guard blocks a game replay');
  const home = fnBody('function homeHTML(){');
  assert.ok(home.includes('↻ Replay this quest'), 'Home card offers Replay for today’s finished quest');
});

/* --- Replay follow-up fixes (seen live 2026-11-05) -------------------
   A finished run's progress came back from the server on merge, so
   Replay reopened the finished run at its last question; finishing
   it again re-awarded 5 stars (5 -> 10 for one quest). */

const mergeExplorer = eval(
  fnText('function unionArr(a,b){') + '\n' +
  fnText('function unionObjMax(a,b){') + '\n' +
  fnText('function unionObjLatest(a,b){') + '\n' +
  fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
  fnText('function pickCritterName(a,b){') + '\n' +
  fnText('function mergeCare(a,b){') + '\n' +
  fnText('function mergeLetters(a,b){') + '\n' +
  '(' + fnText('function mergeExplorer(a,b){') + ')'
);

test('merge drops stale original-run progress for a completed topic, keeps a fresh replay in progress', () => {
  const server = explorer({ completedDay: { t1: TODAY, t2: TODAY }, progress: {
    t1: { idx: 4, score: 4, pool: ['a'], fresh: false },
    t2: { idx: 1, score: 1, pool: ['b'], fresh: true },
  }});
  const local = explorer({ completedDay: { t1: TODAY, t2: TODAY }, progress: {} });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.progress.t1, undefined, 'stale original-run progress is dropped');
  assert.ok(merged.progress.t2 && merged.progress.t2.idx === 1, 'fresh replay progress survives');
});

test('merge keeps unfinished original-run progress when the topic was never completed', () => {
  const server = explorer({ completedDay: {}, progress: { t1: { idx: 2, score: 2, pool: ['a'], fresh: false } } });
  const local = explorer({ completedDay: {}, progress: {} });
  const merged = mergeExplorer(server, local);
  assert.ok(merged.progress.t1 && merged.progress.t1.idx === 2, 'unfinished progress is kept');
});

/* --- Resume double-count fix (seen live 2026-11-07) -----------------
   Number Pop saved & quit at round 5, resumed at round 5, and
   re-answering round 5 counted twice: 7/6 with 7 stars. The saved
   progress never recorded that the round was already answered, and
   the timer always restarted. saveGameProgress now stores
   answered/picked/elapsed, startGame restores them, and the merge
   keeps them — so a resumed round shows its feedback and Next, and
   can never be scored twice. */
test('merge keeps a resumed round answered, with its pick and elapsed time', () => {
  const server = explorer({ playProgress: { number: { idx: 4, score: 4, seed: 777, answered: true, picked: 2, elapsed: 60 } } });
  const local = explorer({ playProgress: { number: { idx: 4, score: 3, seed: 777, answered: false, picked: null, elapsed: 55 } } });
  const merged = mergeExplorer(server, local);
  const p = merged.playProgress.number;
  assert.equal(p.idx, 4, 'same round');
  assert.equal(p.score, 4, 'higher score wins');
  assert.equal(p.answered, true, 'the answered round stays answered');
  assert.equal(p.picked, 2, 'the winning pick is kept');
  assert.equal(p.elapsed, 60, 'the longer elapsed time is kept');
});

test('merge takes the answered state from the advanced side, never re-opens a scored round', () => {
  const server = explorer({ playProgress: { number: { idx: 5, score: 5, seed: 777, answered: false, picked: null, elapsed: 90 } } });
  const local = explorer({ playProgress: { number: { idx: 4, score: 4, seed: 777, answered: true, picked: 1, elapsed: 70 } } });
  const merged = mergeExplorer(server, local);
  const p = merged.playProgress.number;
  assert.equal(p.idx, 5, 'advanced round wins');
  assert.equal(p.score, 5, 'score is the max');
  assert.equal(p.answered, false, 'the advanced side has not answered round 5 yet');
  assert.equal(p.picked, null, 'no pick carried over to the new round');
  assert.equal(p.elapsed, 90, 'elapsed is the max');
});

test('startQuestFlow discards stale original-run progress for a completed-today quest', () => {
  const startQ = fnBody('function startQuestFlow(topicId){');
  assert.ok(startQ.includes("!p.fresh&&e.completedDay&&e.completedDay[topicId]"), 'stale progress is detected');
  assert.ok(startQ.includes('delete e.progress[topicId]'), 'stale progress is discarded before starting');
});

test('finishRound awards stars only on the first completion of the day', () => {
  const finish = fnBody('function finishRound(t){');
  assert.ok(finish.includes('var firstToday=e.completedDay[cur.topicId]!==todayKey();'), 'first-today is computed before stamping');
  assert.ok(finish.includes('if(firstToday)earnStars(e,cur.score);'), 'stars are gated on first completion today');
});

test('replay results say honestly that no extra stars were earned', () => {
  const finish = fnBody('function finishRound(t){');
  assert.ok(finish.includes('cur.starsEarned=firstToday?cur.score:0;'), 'the run records how many stars it actually earned');
  const done = fnBody('function quizDoneHTML(t){');
  assert.ok(done.includes('cur.starsEarned'), 'results screen reads the recorded stars');
  assert.ok(done.includes('no extra stars this time'), 'a replay says plainly that no extra stars were earned');
});
