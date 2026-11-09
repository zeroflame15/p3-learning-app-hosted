// Phase 2 — "Choice and control" (2026-11-10).
//   (1) Quest board: Home shows THREE quest choices a day (Pip's pick
//       first + two more), spread across subjects; completing ANY one
//       counts for the streak. Out-of-season topics never appear.
//   (2) Difficulty button: "Too easy / Just right / Too hard" on
//       every question. Too hard -> the NEXT question is easier +
//       Pip hints first; Too easy -> the next is harder; Just right
//       -> same level. The choice persists (diffPref) and shapes the
//       next quest. Two consecutive errors auto-drop a level + hint.
//   (3) Critter Friend badge: visitedStages now survives the merge,
//       so the badge fires after all four stages are viewed — and
//       stays fired through a save/merge round-trip.
//   (4) critterView resets when the active explorer changes, so a
//       fresh explorer's Critter Lab shows its own real stage, not
//       the previous explorer's viewed stage.
// The real functions are extracted from public/index.html and run in
// a vm — nothing here re-implements the app.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const TODAY = '2026-11-10'; // Term 4 (Nov)
const TERM1 = '2026-01-15'; // Term 1 (Jan)

// Brace-balanced extraction that skips strings and comments, so a
// function whose body contains braces inside a string still extracts
// cleanly (same approach as fib-kind's fnExact).
function extractFn(marker) {
  const i = html.indexOf(marker);
  assert.ok(i >= 0, marker + ' must exist in public/index.html');
  let j = html.indexOf('{', i);
  assert.ok(j >= 0, marker + ': no opening brace');
  let depth = 0, inStr = false, strCh = '', esc = false, inLine = false, inBlock = false;
  for (; j < html.length; j++) {
    const ch = html[j], nx = html[j + 1];
    if (inLine) { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; j++; } continue; }
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '/' && nx === '/') { inLine = true; continue; }
    if (ch === '/' && nx === '*') { inBlock = true; continue; }
    if (ch === '"' || ch === "'" || ch.charCodeAt(0) === 96) { inStr = true; strCh = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces for ' + marker);
}
function loadInto(ctx, marker) { vm.runInContext(extractFn(marker), ctx); }

/* ================= (1) quest board ================= */

const BOARD_TOPICS = [
  { id: 'math-ntuc', sub: 'math', subName: 'Maths', name: 'NTUC FairPrice', moe: false, term: 1 },
  { id: 'eng-story', sub: 'english', subName: 'English', name: 'Story Time', moe: false, term: 1 },
  { id: 'chi-listen', sub: 'chinese', subName: 'Chinese', name: 'Listening', moe: false, term: 1 },
  { id: 'sci-plants', sub: 'science', subName: 'Science', name: 'Plants', moe: false, term: 1 },
  { id: 'math-fractions', sub: 'math', subName: 'Maths', name: 'Fractions', moe: true, term: 4 },
  { id: 'sci-magnets', sub: 'science', subName: 'Science', name: 'Magnets', moe: true, term: 4 },
];
const ALL_SUBS_PLAN = { rest: false, review: false, subs: ['math', 'english', 'chinese', 'science'] };

function boardContext(day) {
  const ctx = vm.createContext({ console });
  ctx._day = day;
  ctx.todayKey = function () { return ctx._day; };
  ctx.TOPICS = BOARD_TOPICS;
  loadInto(ctx, 'function schoolTermOf(dateKey){');
  loadInto(ctx, 'function moeInSeason(tp, todayStr){');
  loadInto(ctx, 'function boardInSeason(t){');
  loadInto(ctx, 'function planTopics(plan){');
  loadInto(ctx, 'function boardPicks(e, todayPlan){');
  return ctx;
}
function boardExplorer(over) {
  return Object.assign({ id: 'e-board-1', completed: {}, swapIdx: 0 }, over || {});
}

test('board: three distinct in-season topics, spread across subjects', () => {
  const ctx = boardContext(TODAY); // Term 4 — every topic in season
  const picks = ctx.boardPicks(boardExplorer(), ALL_SUBS_PLAN);
  assert.equal(picks.length, 3, 'exactly three choices');
  const ids = picks.map(function (t) { return t.id; });
  assert.equal(new Set(ids).size, 3, 'all three are distinct topics: ' + ids.join(', '));
  const subs = new Set(picks.map(function (t) { return t.sub; }));
  assert.ok(subs.size >= 2, 'the three span more than one subject: ' + Array.from(subs).join(', '));
  picks.forEach(function (t) {
    assert.ok(ctx.boardInSeason(t), t.id + ' is in season');
  });
});

test('board: an out-of-season MOE topic never appears on the board', () => {
  // Term 1 (January): the Term-4 MOE topics (Fractions, Magnets) are
  // not taught yet, so the board must not offer them.
  const ctx = boardContext(TERM1);
  assert.equal(ctx.boardInSeason(BOARD_TOPICS[4]), false, 'Fractions (MOE Term 4) is out of season in Term 1');
  assert.equal(ctx.boardInSeason(BOARD_TOPICS[5]), false, 'Magnets (MOE Term 4) is out of season in Term 1');
  assert.equal(ctx.boardInSeason(BOARD_TOPICS[0]), true, 'a local-bank topic is always in season');
  const picks = ctx.boardPicks(boardExplorer(), ALL_SUBS_PLAN);
  assert.equal(picks.length, 3, 'three choices still offered from in-season topics');
  picks.forEach(function (t) {
    assert.ok(t.id !== 'math-fractions' && t.id !== 'sci-magnets', t.id + ' must not be offered out of season');
  });
});

test('board: the shuffle button offers a different set of quests', () => {
  const ctx = boardContext(TODAY);
  const first = ctx.boardPicks(boardExplorer({ swapIdx: 0 }), ALL_SUBS_PLAN).map(function (t) { return t.id; });
  const second = ctx.boardPicks(boardExplorer({ swapIdx: 1 }), ALL_SUBS_PLAN).map(function (t) { return t.id; });
  assert.notDeepEqual(second, first, 'a different swapIdx rotates the board: ' + first.join(',') + ' -> ' + second.join(','));
  assert.equal(new Set(second).size, 3, 'the rotated board is still three distinct topics');
});

test('board: the board card shows subject, topic and "5 questions · about 15 minutes"', () => {
  const src = extractFn('function boardCardHTML(e, t, isPick, todayPlan){');
  assert.ok(src.includes("esc(t.subName)"), 'the card names the subject');
  assert.ok(src.includes("esc(t.name)"), 'the card names the topic');
  assert.ok(src.includes('5 questions · about 15 minutes'), 'the card states the 5-question, ~15-minute shape');
  assert.ok(src.includes("⭐ Pip’s pick"), 'Pip’s pick is labelled');
  assert.ok(src.includes('↻ Replay this quest'), 'a finished board quest offers Replay');
  assert.ok(src.includes('✔ Done today — streak safe!'), 'a finished board quest shows as done');
});

test('board: completing ANY one of the three counts for the streak', () => {
  // The streak is topic-agnostic (Phase 1): any 1 quest finished on
  // a new day lights it. Prove it for each board pick in turn — the
  // child is free to pick any of the three, and any one counts.
  const bctx = boardContext(TODAY);
  const picks = bctx.boardPicks(boardExplorer(), ALL_SUBS_PLAN);
  assert.equal(picks.length, 3, 'three board choices');
  const sctx = vm.createContext({ console, todayKey: function () { return TODAY; } });
  ['parseDateKey', 'addDaysKey', 'mondayOfKey', 'daysBetweenKeys', 'streakTick', 'recordStreak'].forEach(function (name) {
    loadInto(sctx, 'function ' + name + '(');
  });
  picks.forEach(function (t) {
    const e = { streak: 0, streakLongest: 0, streakLastDate: null, streakFreezes: 1, streakFreezeWeek: null, streakLost: 0, streakRepairUntil: null, streakFreezeUsedDay: null, completed: {}, completedDay: {} };
    sctx.recordStreak(e, TODAY); // finishing the board quest "t"
    assert.equal(e.streak, 1, 'finishing board quest ' + t.id + ' lights the streak to 1');
  });
});

/* ================= (2) difficulty button ================= */

// A topic with genuinely different P3 and P4 banks (the app only
// splits levels at P4 — P1–P3 share the P3 bank, P4–P6 read p4quest).
// Stems are >= 12 chars and options are 4-long, so sbNormalizeQuestion
// accepts them on the server-cache path.
function diffQ(id, stem, ans) {
  return { id: id, q: stem, o: ['one', 'two', 'three', 'four'], a: ans, c: 'Because — Pip hints, never tells.', j: '' };
}
const DIFF_TOPIC = {
  id: 'math-ntuc', sub: 'math', subName: 'Maths', name: 'NTUC FairPrice',
  quest: [diffQ('p3-q1', 'P3 question number one here?', 0), diffQ('p3-q2', 'P3 question number two here?', 1), diffQ('p3-q3', 'P3 question number three?', 2)],
  p4quest: [diffQ('p4-q1', 'P4 question number one here?', 0), diffQ('p4-q2', 'P4 question number two here?', 1)],
  fresh: [diffQ('p3-f1', 'P3 fresh question number one?', 0)],
  p4fresh: [diffQ('p4-f1', 'P4 fresh question number one?', 0)],
  retry: [diffQ('p3-r1', 'P3 retry question number one?', 0)],
  warm: [],
};

function diffContext() {
  const ctx = vm.createContext({ console });
  ctx._day = TODAY;
  ctx.todayKey = function () { return ctx._day; };
  ctx.SB_COUNT = 5;
  ctx.LIVE_GEN_COUNT = 5;
  ctx.diffBankCache = {};
  ctx.TOPIC = DIFF_TOPIC;
  ctx._explorer = null;
  ctx._cur = null;
  ctx.toasts = [];
  ctx.saved = 0;
  ctx.persisted = 0;
  ctx.ex = function () { return ctx._explorer; };
  ctx.topicById = function (id) { return id === DIFF_TOPIC.id ? DIFF_TOPIC : null; };
  ctx.levelNum = function (e) { return (e && e.level) || 3; };
  ctx.toast = function (m) { ctx.toasts.push(m); };
  ctx.render = function () {};
  ctx.save = function () { ctx.saved++; };
  ctx.persistProgress = function () { ctx.persisted++; };
  ctx.syncKey = function () { return 'ABCDEF'; };
  ctx.fetch = function () { return Promise.resolve({ ok: false, json: async function () { return null; } }); };
  // The difficulty engine + the quest list it swaps inside.
  loadInto(ctx, 'function bankFor(t, kind, level){');
  loadInto(ctx, 'function isFibQuestion(q){');
  loadInto(ctx, 'function fibExpected(q){');
  loadInto(ctx, 'function fibAccepts(q){');
  loadInto(ctx, 'function sbNormalizeQuestion(q){');
  loadInto(ctx, 'function sbShapeOk(questions){');
  loadInto(ctx, 'function diffQuestionId(q){');
  loadInto(ctx, 'function diffIsExcluded(q, excludeIds){');
  loadInto(ctx, 'function diffQuestionFor(t, level, shift, excludeIds){');
  loadInto(ctx, 'function diffSwapAt(c, t, level, idx, shift){');
  loadInto(ctx, 'function diffSwapNext(c, t, level){');
  loadInto(ctx, 'function diffHintText(q){');
  loadInto(ctx, 'function diffButtonsHTML(){');
  loadInto(ctx, 'function applyDifficultyChoice(felt){');
  loadInto(ctx, 'function noteQuestAnswer(ok){');
  loadInto(ctx, 'function questListFor(t, c, level){');
  // questListFor's pool branch needs these; the tests below use the
  // no-pool and boost branches, but load them so the function is whole.
  loadInto(ctx, 'function hashStr(s){');
  loadInto(ctx, 'function seededShuffle(');
  loadInto(ctx, 'function poolQuestions(t,');
  loadInto(ctx, 'function optsShuffled(q, seed){');
  return ctx;
}
// A quest-in-progress ("cur") for the topic, at question idx, with a
// fixed 5-question list (no pool, so the list is the P3 bank slice).
function diffCur(ctx, over) {
  const cur = Object.assign({
    topicId: DIFF_TOPIC.id, phase: 'quest', idx: 0, score: 0, wrong: [],
    picked: null, answered: false, pool: null, fresh: false,
    diffShift: 0, diffSwap: {}, hintForIdx: null, consecWrong: 0,
  }, over || {});
  ctx._cur = cur;
  ctx.cur = cur; // diffButtonsHTML / applyDifficultyChoice read the global `cur`
  return cur;
}
function diffExplorer(over) {
  return Object.assign({ id: 'e-diff-1', level: 3, diffPref: 0, diffPrefAt: null, progress: {}, completed: {} }, over || {});
}

test('difficulty: "Too easy" makes the next question harder (P3 -> P4 bank)', () => {
  const ctx = diffContext();
  const q = ctx.diffQuestionFor(DIFF_TOPIC, 3, +1, []);
  assert.ok(q, 'an adjacent-level question exists for +1 from P3');
  assert.ok(q.id.indexOf('p4-') === 0, 'it comes from the P4 bank: ' + q.id);
  assert.ok(DIFF_TOPIC.p4quest.some(function (x) { return x.id === q.id; }), 'it is a real P4 question');
});

test('difficulty: "Too hard" makes the next question easier (P4 -> P3 bank)', () => {
  const ctx = diffContext();
  const q = ctx.diffQuestionFor(DIFF_TOPIC, 4, -1, []);
  assert.ok(q, 'an adjacent-level question exists for -1 from P4');
  assert.ok(q.id.indexOf('p3-') === 0, 'it comes from the P3 bank: ' + q.id);
});

test('difficulty: no adjacent bank -> keep the current question (null), never crash', () => {
  const ctx = diffContext();
  assert.equal(ctx.diffQuestionFor(DIFF_TOPIC, 3, 0, []), null, 'shift 0 means no swap');
  // P3 -> P2: P1–P3 share the one P3 bank, so there is no genuinely
  // different local bank one level down.
  assert.equal(ctx.diffQuestionFor(DIFF_TOPIC, 3, -1, []), null, 'no local P2 bank distinct from the P3 bank');
  // A question already in the list is excluded, so the swap never
  // repeats a question the child has just seen. Exclude every P4
  // question (quest bank AND fresh bank) — then no swap is possible.
  const exclude = DIFF_TOPIC.p4quest.concat(DIFF_TOPIC.p4fresh).map(function (q) { return q.id; });
  assert.equal(ctx.diffQuestionFor(DIFF_TOPIC, 3, +1, exclude), null, 'an excluded adjacent bank yields no swap');
});

test('difficulty: a cached server set one level down supplies the easier question', () => {
  const ctx = diffContext();
  ctx.diffBankCache['math-ntuc|2'] = { day: TODAY, questions: [diffQ('p2-q1', 'P2 question number one here?', 0)] };
  const q = ctx.diffQuestionFor(DIFF_TOPIC, 3, -1, []);
  assert.ok(q, 'the cached level-2 set answers the -1 shift');
  assert.equal(q.id, 'p2-q1', 'it is the cached P2 question');
  // A stale cache (another day) is ignored.
  ctx.diffBankCache['math-ntuc|2'] = { day: '2026-11-09', questions: [diffQ('p2-q1', 'P2 question number one here?', 0)] };
  assert.equal(ctx.diffQuestionFor(DIFF_TOPIC, 3, -1, []), null, 'a stale-day cache does not supply a question');
});

test('difficulty: questListFor applies a diffSwap without mutating the bank', () => {
  const ctx = diffContext();
  const before = DIFF_TOPIC.quest.map(function (q) { return q.id; });
  const swapQ = diffQ('p4-q9', 'P4 swap question number nine?', 1);
  const list = ctx.questListFor(DIFF_TOPIC, { phase: 'quest', pool: null, fresh: false, diffSwap: { 1: swapQ } }, 3);
  assert.equal(list[1].id, 'p4-q9', 'index 1 is replaced by the swapped question');
  assert.equal(list[0].id, 'p3-q1', 'the other questions are untouched');
  assert.deepEqual(DIFF_TOPIC.quest.map(function (q) { return q.id; }), before, 'the bank itself is never mutated');
  const boosted = ctx.questListFor(DIFF_TOPIC, { phase: 'boost', boostList: [diffQ('b1', 'Boost question number one?', 0)], diffSwap: {} }, 3);
  assert.equal(boosted.length, 1, 'the boost list passes through unchanged');
});

test('difficulty: "Too hard" swaps the next question easier AND hints first', () => {
  const ctx = diffContext();
  ctx._explorer = diffExplorer({ level: 4 }); // P4, so a P3 question exists one level down
  const cur = diffCur(ctx, { idx: 0 });
  ctx.applyDifficultyChoice('hard');
  assert.equal(cur.diffShift, -1, 'the quest now runs one level easier');
  assert.equal(cur.hintForIdx, 1, 'Pip hints first on the next question');
  assert.ok(cur.diffSwap[1], 'the next question is swapped');
  assert.ok(cur.diffSwap[1].id.indexOf('p3-') === 0, 'the swapped question is the easier P3 one: ' + cur.diffSwap[1].id);
  assert.equal(ctx._explorer.diffPref, -1, 'the choice is remembered on the explorer');
  assert.ok(ctx._explorer.diffPrefAt, 'the preference carries a timestamp');
  assert.ok(ctx.persisted >= 1, 'the quest progress is persisted');
});

test('difficulty: "Too easy" swaps the next question harder; "Just right" keeps the level', () => {
  const ctx = diffContext();
  ctx._explorer = diffExplorer({ level: 3 });
  const cur = diffCur(ctx, { idx: 0 });
  ctx.applyDifficultyChoice('easy');
  assert.equal(cur.diffShift, 1, 'the quest now runs one level harder');
  assert.equal(cur.hintForIdx, null, 'no hint is forced for a harder question');
  assert.ok(cur.diffSwap[1] && cur.diffSwap[1].id.indexOf('p4-') === 0, 'the next question is the harder P4 one');
  assert.equal(ctx._explorer.diffPref, 1, 'the harder preference is remembered');

  const ctx2 = diffContext();
  ctx2._explorer = diffExplorer({ level: 3, diffPref: 1, diffPrefAt: '2026-11-10T00:00:00.000Z' });
  const cur2 = diffCur(ctx2, { idx: 1 });
  ctx2.applyDifficultyChoice('just');
  assert.equal(cur2.diffShift, 0, 'Just right returns the quest to its own level');
  assert.equal(ctx2._explorer.diffPref, 0, 'the preference is reset to just right');
});

test('difficulty: two consecutive errors auto-drop a level and hint (no fail screen)', () => {
  const ctx = diffContext();
  ctx._explorer = diffExplorer({ level: 4 });
  const cur = diffCur(ctx, { idx: 0 });
  ctx.noteQuestAnswer(false); // first wrong
  assert.equal(cur.diffShift, 0, 'one wrong answer does not change the level yet');
  assert.equal(cur.hintForIdx, null, 'no hint after a single error');
  ctx.noteQuestAnswer(false); // second wrong in a row
  assert.equal(cur.diffShift, -1, 'two wrong in a row drop a level');
  assert.equal(cur.hintForIdx, 1, 'Pip hints first on the next question');
  assert.ok(cur.diffSwap[1] && cur.diffSwap[1].id.indexOf('p3-') === 0, 'the next question is swapped to the easier P3 one');
  assert.equal(ctx._explorer.diffPref, -1, 'the auto-drop is remembered as a preference');
  ctx.noteQuestAnswer(true); // a right answer resets the counter
  assert.equal(cur.consecWrong, 0, 'a correct answer clears the consecutive-error count');
});

test('difficulty: the buttons render on every question, and the hint text never states the answer', () => {
  const ctx = diffContext();
  ctx._explorer = diffExplorer();
  const cur = diffCur(ctx, { idx: 0, diffShift: -1 });
  const btns = ctx.diffButtonsHTML();
  assert.ok(btns.includes('Too easy'), 'the Too easy button renders');
  assert.ok(btns.includes('Just right'), 'the Just right button renders');
  assert.ok(btns.includes('Too hard'), 'the Too hard button renders');
  assert.ok(btns.includes('data-diff="hard"'), 'the buttons carry their felt value');
  const hint = ctx.diffHintText(DIFF_TOPIC.quest[0]);
  assert.ok(hint.length > 0, 'a hint exists');
  assert.ok(hint.indexOf('Because') >= 0, 'the hint is the question’s own explanation (hint-first, never the bare answer)');
  assert.equal(ctx.diffHintText(null), 'Take it slow — read the question once more, and think about what you already know. You’ve got this! 💛', 'a question with no explanation still gets a gentle generic hint');
});

test('difficulty: the choice persists through a merge and shapes the next quest', () => {
  // (a) merge: the later preference wins, and a merge never invents
  //     a preference on a legacy explorer that has none.
  const mctx = vm.createContext({ console, todayKey: function () { return TODAY; } });
  ['unionArr', 'unionObjMax', 'unionObjLatest', 'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer'].forEach(function (name) {
    loadInto(mctx, 'function ' + name + '(');
  });
  function mexplorer(over) {
    return Object.assign({ name: 'Test', completed: {}, completedDay: {}, progress: {}, playProgress: {}, playDoneDay: {}, badges: [], visitedStages: [] }, over || {});
  }
  const local = mexplorer({ diffPref: 1, diffPrefAt: '2026-11-10T08:00:00.000Z' });
  const server = mexplorer({ diffPref: -1, diffPrefAt: '2026-11-10T09:00:00.000Z' });
  const merged = mctx.mergeExplorer(local, server);
  assert.equal(merged.diffPref, -1, 'the later (server) preference wins the merge');
  assert.equal(merged.diffPrefAt, '2026-11-10T09:00:00.000Z', 'the later timestamp is kept');
  const legacyA = mexplorer({});
  const legacyB = mexplorer({});
  const legacyMerged = mctx.mergeExplorer(legacyA, legacyB);
  assert.equal(legacyMerged.diffPref, undefined, 'a merge of two legacy explorers invents no preference');
  assert.equal(legacyMerged.diffPrefAt, undefined, 'and no preference timestamp either');
  // (b) the next quest starts at the remembered shift: the quest
  //     object is initialised from e.diffPref (source check — the
  //     full beginQuest flow needs the whole page).
  const beginSrc = extractFn('function beginQuest(topicId){');
  assert.ok(beginSrc.includes('diffShift:(e.diffPref||0)'), 'a new quest starts at the explorer’s remembered difficulty shift');
});

/* ================= (3) Critter Friend badge survives the merge ================= */

function mergeContext() {
  const ctx = vm.createContext({ console, todayKey: function () { return TODAY; } });
  ['unionArr', 'unionObjMax', 'unionObjLatest', 'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer'].forEach(function (name) {
    loadInto(ctx, 'function ' + name + '(');
  });
  return ctx;
}
function critterExplorer(over) {
  return Object.assign({
    name: 'Test', critterName: 'Splash', critterStage: 0, critterStageDays: 0,
    visitedStages: [], discoveredCritters: [], badges: [],
    completed: {}, completedDay: {}, progress: {}, playProgress: {}, playDoneDay: {},
  }, over || {});
}

test('badge: visitedStages unions across devices, so the badge can reach 4', () => {
  const ctx = mergeContext();
  // Device A saw stages 0 and 1; device B saw 2 and 3. Neither alone
  // has all four — the union does, so the badge fires.
  const a = critterExplorer({ visitedStages: [0, 1] });
  const b = critterExplorer({ visitedStages: [2, 3] });
  const merged = ctx.mergeExplorer(a, b);
  assert.deepEqual(merged.visitedStages.slice().sort(), [0, 1, 2, 3], 'the merge unions the visited stages from both devices');
  assert.ok(merged.visitedStages.length >= 4, 'all four stages visited — the Critter Friend badge condition is met');
});

test('badge: visitedStages persists through a save/merge round-trip (the live bug)', () => {
  const ctx = mergeContext();
  // The live failure: the child viewed all four stages, but the
  // server still showed visitedStages=[] after the save, because the
  // merge dropped the field. A merge must now carry it across.
  const local = critterExplorer({ visitedStages: [0, 1, 2, 3] });
  const server = critterExplorer({ visitedStages: [] });
  const merged = ctx.mergeExplorer(local, server);
  assert.deepEqual(merged.visitedStages.slice().sort(), [0, 1, 2, 3], 'all four viewed stages survive the merge');
  // And back the other way (the server had them, the local copy did not).
  const merged2 = ctx.mergeExplorer(critterExplorer({ visitedStages: [] }), critterExplorer({ visitedStages: [0, 1, 2, 3] }));
  assert.deepEqual(merged2.visitedStages.slice().sort(), [0, 1, 2, 3], 'the server’s visited stages are not lost either');
  // A legacy explorer with no visitedStages at all does not gain an
  // invented field from the merge (the no-change invariant).
  const trulyLegacyA = { name: 'A', completed: {}, completedDay: {}, progress: {} };
  const trulyLegacyB = { name: 'B', completed: {}, completedDay: {}, progress: {} };
  const trulyMerged = ctx.mergeExplorer(trulyLegacyA, trulyLegacyB);
  assert.equal(trulyMerged.visitedStages, undefined, 'a merge of two legacy explorers invents no visitedStages');
});

/* ================= (4) critterView resets when the explorer changes ================= */

function viewContext() {
  const ctx = vm.createContext({ console });
  ctx.critterView = null;
  ctx.critterViewFor = null;
  ctx.careMsg = null;
  loadInto(ctx, 'function resetCritterViewFor(e){');
  return ctx;
}

test('view: switching explorers resets the viewed stage (and the stale care message)', () => {
  const ctx = viewContext();
  // Explorer A viewed the Adult Frog stage.
  ctx.critterView = 3;
  ctx.critterViewFor = 'explorer-A';
  ctx.careMsg = 'You fed Greg Washington! 🪰';
  // Explorer B (a fresh explorer) opens Critter Lab.
  ctx.resetCritterViewFor({ id: 'explorer-B', critterStage: 0 });
  assert.equal(ctx.critterView, null, 'the viewed stage is reset — B does not inherit A’s Adult Frog view');
  assert.equal(ctx.critterViewFor, 'explorer-B', 'the view is now tracked against B');
  assert.equal(ctx.careMsg, null, 'the stale care message from A is cleared too');
});

test('view: re-rendering for the SAME explorer keeps the viewed stage', () => {
  const ctx = viewContext();
  ctx.critterView = 2;
  ctx.critterViewFor = 'explorer-A';
  ctx.careMsg = 'Nice!';
  ctx.resetCritterViewFor({ id: 'explorer-A', critterStage: 0 });
  assert.equal(ctx.critterView, 2, 'the same explorer keeps its viewed stage across re-renders');
  assert.equal(ctx.careMsg, 'Nice!', 'its care message is kept too');
});

test('view: a fresh explorer’s Critter Lab shows its own real stage', () => {
  // Critter Lab renders the viewed stage if one is set, else the
  // explorer’s real growth stage — and it resets the view for a new
  // explorer before reading it, so a fresh Egg never shows Froglet.
  const src = extractFn('function critterHTML(){');
  assert.ok(src.includes('resetCritterViewFor(e);'), 'Critter Lab resets the view for the active explorer on render');
  assert.ok(src.includes('var view=(critterView==null?e.critterStage:critterView)'), 'with no view set, the pond shows the explorer’s real stage');
  const ctx = viewContext();
  ctx.critterView = 2; // a previous explorer’s Froglet view, still lingering
  ctx.critterViewFor = 'explorer-A';
  ctx.resetCritterViewFor({ id: 'explorer-B', critterStage: 0 });
  const view = (ctx.critterView == null ? 0 : ctx.critterView);
  assert.equal(view, 0, 'the fresh explorer’s pond shows its own Egg (stage 0), not the lingering Froglet');
});
