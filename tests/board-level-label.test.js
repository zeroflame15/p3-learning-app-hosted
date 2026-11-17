// Board + Learn topic labels name the EXPLORER's level (2026-11-17):
// band-based topics (Chinese Foundation P1–P4, English bands) appear
// under EVERY level key in MOE_SUBJECTS_BY_LEVEL, so moeQuestTopic's
// first-match loop always picked P1 and a P3 explorer's board read
// "Singapore MOE syllabus · Primary 1 Chinese" (seen live on
// Juhin's P3 board: "阅读 Reading", P1 Chinese). The pool itself was
// right — chi-reading IS a P3 Chinese topic — and the questions
// already adapt to level; only the displayed label was wrong.
// Fix: moeQuestTopic(id, level) takes the explorer's level and the
// blurb names that level; without one the first match stands.
// Also pinned here: Magnets (sci-magnets, P3 Science Term 4) IS in
// the November pool — it only missed the 3 shown by rotation.
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

const TUE_PLAN = { rest: false, review: false, subs: ['sci', 'chi'] };
const ALL_PLAN = { rest: false, review: false, subs: ['eng', 'math', 'sci', 'chi'] };

function boardContext() {
  const ctx = vm.createContext({ console });
  ctx._day = TODAY;
  ctx.todayKey = function () { return ctx._day; };
  ctx.TOPICS = BOARD_TOPICS;
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
  return Object.assign({ id: 'e-lbl', level: level, completed: {}, completedDay: {}, swapIdx: 0 }, over || {});
}

test('moeQuestTopic: a band topic names the passed level, not the first key that holds it', () => {
  const ctx = boardContext();
  // chi-reading lives under every level key (Foundation band P1–P4
  // plus the upper bands), so the old first-match loop always said P1.
  assert.equal(ctx.moeQuestTopic('chi-reading', 3).blurb, 'Singapore MOE syllabus · Primary 3 Chinese.');
  assert.equal(ctx.moeQuestTopic('chi-reading', 6).blurb, 'Singapore MOE syllabus · Primary 6 Chinese.');
  assert.equal(ctx.moeQuestTopic('chi-reading', 1).blurb, 'Singapore MOE syllabus · Primary 1 Chinese.');
  // No level passed: the old first-match fallback stands (P1).
  assert.equal(ctx.moeQuestTopic('chi-reading').blurb, 'Singapore MOE syllabus · Primary 1 Chinese.');
  // A per-year topic is unaffected by the override either way.
  assert.equal(ctx.moeQuestTopic('sci-magnets', 3).blurb, 'Singapore MOE syllabus · Primary 3 Science.');
});

test('board: a P3 explorer never sees a Primary 1 label on her board', () => {
  const ctx = boardContext();
  for (let swap = 0; swap < 6; swap++) {
    const picks = ctx.boardPicks(explorer('P3', { swapIdx: swap }), TUE_PLAN);
    const moe = picks.filter(function (t) { return t.moe; });
    assert.ok(moe.length > 0, 'swap ' + swap + ': the P3 board offers MOE topics');
    moe.forEach(function (t) {
      assert.ok(t.blurb.indexOf('Primary 3') >= 0, 'swap ' + swap + ': ' + t.id + ' names Primary 3, got "' + t.blurb + '"');
      assert.ok(t.blurb.indexOf('Primary 1') < 0, 'swap ' + swap + ': ' + t.id + ' must not say Primary 1, got "' + t.blurb + '"');
    });
  }
});

test('board: a P6 explorer never sees a Primary 1 label either', () => {
  const ctx = boardContext();
  for (let swap = 0; swap < 6; swap++) {
    const picks = ctx.boardPicks(explorer('P6', { swapIdx: swap }), ALL_PLAN);
    const moe = picks.filter(function (t) { return t.moe; });
    assert.ok(moe.length > 0, 'swap ' + swap + ': the P6 board offers MOE topics');
    moe.forEach(function (t) {
      assert.ok(t.blurb.indexOf('Primary 6') >= 0, 'swap ' + swap + ': ' + t.id + ' names Primary 6, got "' + t.blurb + '"');
      assert.ok(t.blurb.indexOf('Primary 1') < 0, 'swap ' + swap + ': ' + t.id + ' must not say Primary 1, got "' + t.blurb + '"');
    });
  }
});

test('board: a P1 explorer correctly sees Primary 1 labels (control)', () => {
  const ctx = boardContext();
  const picks = ctx.boardPicks(explorer('P1'), ALL_PLAN);
  const moe = picks.filter(function (t) { return t.moe; });
  assert.ok(moe.length > 0, 'the P1 board offers MOE topics');
  moe.forEach(function (t) {
    assert.ok(t.blurb.indexOf('Primary 1') >= 0, t.id + ' names Primary 1 for a P1 explorer, got "' + t.blurb + '"');
  });
});

test('board pool: Magnets (sci-magnets, P3 Science Term 4) IS in-season in November', () => {
  const ctx = boardContext();
  const pool = ctx.moeBoardPool(explorer('P3'), TUE_PLAN);
  const ids = pool.map(function (t) { return t.id; });
  assert.ok(ids.indexOf('sci-magnets') >= 0, 'Magnets must be in the P3 November pool, got: ' + ids.join(', '));
  assert.ok(ids.indexOf('sci-diversity-living') >= 0, 'earlier-term Science topics stay in season too');
});

test('labels live in the page: the board pool and the Learn quest card pass the level', () => {
  const poolSrc = extractFn('function moeBoardPool(e, todayPlan){');
  assert.ok(poolSrc.indexOf('moeQuestTopic(tp.id, levelNum(e))') >= 0, 'moeBoardPool passes the explorer\'s level to moeQuestTopic');
  assert.ok(html.indexOf('var t=topicById(qid, lvl);') >= 0, 'Learn quest cards resolve topics at the page level');
  assert.ok(html.indexOf('var firstT=firstQ?topicById(firstQ, lvl):null;') >= 0, 'Learn session suggestion resolves at the page level too');
  const topicSrc = extractFn('function topicById(id, level){');
  assert.ok(topicSrc.indexOf('moeQuestTopic(id, level)') >= 0, 'topicById passes the level through');
});
