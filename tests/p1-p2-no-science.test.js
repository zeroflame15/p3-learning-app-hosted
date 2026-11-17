// P1/P2 have no Science (2026-11-17, Bryan): Science is removed
// from Learn and from quests for P1/P2 only. The MOE syllabus has
// no Science in P1/P2 — the P1/P2 Science entry in the data is a
// placeholder (topics: [], notTaught: true). The gates:
//   - moeSubjects(level) filters notTaught subjects out for lv<=2,
//     so Learn shows no Science card and no Science subject page.
//   - boardPicks(e, todayPlan) drops sub 'sci' topics for lv<=2,
//     so the Home quest board never offers a Science quest — not on
//     a Science plan day (Tue Science + Chinese, Thu Maths +
//     Science), not on a review day, not via Shuffle.
// P3–P6 are completely unchanged. The quest engine itself
// (startQuestFlow) is untouched: with both surfaces gated, no UI
// path can start a Science quest for P1/P2. Trivia Science
// questions and the study-plan day labels are covered separately
// in p1-p2-no-science-trivia-planner.test.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const TODAY = '2026-11-17'; // Term 4 (Nov)

// Brace-balanced extraction that skips strings and comments (same
// approach as phase2-choice-control's extractFn).
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

// Stub topics with the REAL subject codes ('sci', not the phase2
// stubs' 'science'), two per subject, none MOE-gated.
const BOARD_TOPICS = [
  { id: 'math-ntuc', sub: 'math', subName: 'Maths', name: 'NTUC FairPrice', moe: false, term: 1 },
  { id: 'eng-story', sub: 'eng', subName: 'English', name: 'Story Time', moe: false, term: 1 },
  { id: 'chi-listen', sub: 'chi', subName: 'Chinese', name: 'Listening', moe: false, term: 1 },
  { id: 'sci-frog', sub: 'sci', subName: 'Science', name: 'Frog Life Cycle', moe: false, term: 1 },
  { id: 'sci-plants', sub: 'sci', subName: 'Science', name: 'Garden & Plants', moe: false, term: 1 },
  { id: 'math-frac', sub: 'math', subName: 'Maths', name: 'Fractions', moe: false, term: 1 },
  { id: 'eng-tense', sub: 'eng', subName: 'English', name: 'Tenses Trek', moe: false, term: 1 },
  { id: 'chi-family', sub: 'chi', subName: 'Chinese', name: 'Family Words', moe: false, term: 1 },
];
// The real plan days: Tue Science + Chinese, Thu Maths + Science,
// plus a review day (everything) and an all-subjects day.
const TUE_PLAN = { rest: false, review: false, subs: ['sci', 'chi'] };
const THU_PLAN = { rest: false, review: false, subs: ['math', 'sci'] };
const REVIEW_PLAN = { rest: false, review: true, subs: [] };
const ALL_PLAN = { rest: false, review: false, subs: ['eng', 'math', 'sci', 'chi'] };
const PLANS = { Tue: TUE_PLAN, Thu: THU_PLAN, review: REVIEW_PLAN, all: ALL_PLAN };

function boardContext() {
  const ctx = vm.createContext({ console });
  ctx._day = TODAY;
  ctx.todayKey = function () { return ctx._day; };
  ctx.TOPICS = BOARD_TOPICS;
  // The real MOE data: the board now picks from it, so the gate
  // tests exercise the real pool, not the stub list.
  vm.runInContext(extractFn('var MOE_SUBJECTS_BY_LEVEL='), ctx);
  loadInto(ctx, 'function schoolTermOf(dateKey){');
  loadInto(ctx, 'function moeInSeason(tp, todayStr){');
  loadInto(ctx, 'function boardInSeason(t){');
  loadInto(ctx, 'function planTopics(plan){');
  loadInto(ctx, 'function levelNum(e){');
  loadInto(ctx, 'function moeSubjects(level){');
  loadInto(ctx, 'function moeQuestTopic(id, level){');
  loadInto(ctx, 'function moeBoardPool(e, todayPlan){');
  loadInto(ctx, 'function boardPicks(e, todayPlan){');
  return ctx;
}
function explorer(level, over) {
  return Object.assign({ id: 'e-p12', level: level, completed: {}, completedDay: {}, swapIdx: 0 }, over || {});
}

test('board: a P1/P2 explorer never sees a Science quest, on any plan day', () => {
  const ctx = boardContext();
  for (const lv of ['P1', 'P2']) {
    for (const [day, plan] of Object.entries(PLANS)) {
      // Every Shuffle rotation too — the gate must hold whatever
      // swapIdx the child has reached.
      for (let swap = 0; swap < 6; swap++) {
        const picks = ctx.boardPicks(explorer(lv, { swapIdx: swap }), plan);
        assert.ok(picks.length > 0, lv + ' ' + day + ' swap ' + swap + ': the board still offers quests');
        picks.forEach(function (t) {
          assert.notEqual(t.sub, 'sci', lv + ' ' + day + ' swap ' + swap + ': no Science pick, got ' + t.id);
        });
      }
    }
  }
});

test('board: a P1/P2 explorer still gets three choices on a full day', () => {
  const ctx = boardContext();
  for (const lv of ['P1', 'P2']) {
    const picks = ctx.boardPicks(explorer(lv), ALL_PLAN);
    assert.equal(picks.length, 3, lv + ': three choices on an all-subjects day');
    assert.equal(new Set(picks.map(function (t) { return t.id; })).size, 3, lv + ': the three are distinct');
  }
});

test('board: a P3 explorer CAN still get a Science quest (control)', () => {
  const ctx = boardContext();
  let sawSci = false;
  for (let swap = 0; swap < 4; swap++) {
    const picks = ctx.boardPicks(explorer('P3', { swapIdx: swap }), TUE_PLAN);
    if (picks.some(function (t) { return t.sub === 'sci'; })) sawSci = true;
  }
  assert.ok(sawSci, 'P3 on a Science day is offered a Science quest at some rotation');
  const p3all = ctx.boardPicks(explorer('P3'), ALL_PLAN);
  assert.equal(p3all.length, 3, 'P3 still gets three choices');
});

test('gates live in the page: boardPicks drops sci for lv<=2, moeSubjects drops notTaught', () => {
  const boardSrc = extractFn('function boardPicks(e, todayPlan){');
  assert.ok(boardSrc.indexOf("if(levelNum(e)<=2)pool=pool.filter(function(x){ return x.sub!=='sci'; });") >= 0, 'boardPicks gates Science out for P1/P2');
  assert.ok(boardSrc.indexOf('moeBoardPool(e, todayPlan)') >= 0, 'boardPicks builds its pool from the level MOE topics');
  const poolSrc = extractFn('function moeBoardPool(e, todayPlan){');
  assert.ok(poolSrc.indexOf('moeSubjects(levelNum(e))') >= 0, 'the pool is built at the explorer\'s level');
  assert.ok(poolSrc.indexOf('moeQuestTopic(tp.id, levelNum(e))') >= 0, 'pool topics are quest-flow topics at the explorer\'s level — the card blurb names her level, not P1');
  const moeSrc = extractFn('function moeSubjects(level){');
  assert.ok(moeSrc.indexOf('!s.notTaught') >= 0, 'moeSubjects filters notTaught subjects');
  assert.ok(moeSrc.indexOf('lv<=2') >= 0, 'the filter applies to levels 1–2 only');
});
