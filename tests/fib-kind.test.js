// Fill-in-the-blank (FIB) question kind — tests.
// Covers: the FIB row encoding (lib/server-bank.js), the client
// renderer choice + answer tolerance (public/index.html), daily-set
// serving a mixed set with the format included, pickSet mixing,
// report-answers working for FIB ids, and MCQ behaviour unchanged.
// No live keys, no network: Supabase is mocked via global.fetch.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sb = require('../lib/server-bank');
const PAGE_PATH = path.join(__dirname, '..', 'public', 'index.html');
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
function fnExact(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in ' + PAGE_PATH);
  let i = html.indexOf('{', start);
  assert.ok(i >= 0, marker + ': no opening brace');
  let depth = 0, inStr = false, strCh = '', esc = false, inLine = false, inBlock = false;
  for (; i < html.length; i++) {
    const ch = html[i], nx = html[i + 1];
    if (inLine) { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; i++; } continue; }
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '/' && nx === '/') { inLine = true; continue; }
    if (ch === '/' && nx === '*') { inBlock = true; continue; }
    if (ch === '"' || ch === "'" || ch.charCodeAt(0) === 96) { inStr = true; strCh = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  throw new Error('no end ' + marker);
}

// Raw Supabase rows, as sb_questions returns them.
function mcqRow(id, stem, options, answer) {
  return { id: id, topic: 'math-ntuc', level: 3, sub_topic: 'quest', stem: stem, options: options, answer: answer, explanation: 'Because.', joke: '', source: 'bank' };
}
function fibRow(id, stem, answer, accept) {
  return { id: id, topic: 'math-ntuc', level: 3, sub_topic: 'quest', stem: stem, options: { kind: 'fib', answer: answer, accept: accept || [] }, answer: 0, explanation: 'Because.', joke: '', source: 'bank' };
}
// Client-shaped questions, as daily-set returns them.
const FIB_Q = { id: 'math-ntuc-p3-f001', q: 'There are 6 bags with 7 apples in each bag. How many apples are there altogether?', o: [], a: 0, c: '6 x 7 = 42.', j: '', k: 'fib', ans: '42', accept: ['forty-two'] };
const FIB_CM_Q = { id: 'math-ntuc-p3-f002', q: 'A ribbon is 42 centimetres long. How long is the ribbon in centimetres?', o: [], a: 0, c: 'It is 42 cm.', j: '', k: 'fib', ans: '42', accept: [] };
const MCQ_Q = { id: 'math-ntuc-p3-0001', q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.', j: '', k: 'mcq' };
const GOOD_SB = [
  { id: 'math-ntuc-p3-0001', q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.', j: '' },
  { id: 'math-ntuc-p3-0002', q: 'One carton of milk is $2. Three cartons cost how much money?', o: ['$5', '$6', '$7', '$23'], a: 1, c: '2 x 3.', j: '' },
  { id: 'math-ntuc-p3-0003', q: 'A basket has 36 eggs shared equally into 4 trays. Each tray has…', o: ['8 eggs', '9 eggs', '10 eggs', '12 eggs'], a: 1, c: '36 / 4 = 9.', j: '' },
  { id: 'math-ntuc-p3-0004', q: 'Bread $1.80 + jam $3.20 = how much money altogether?', o: ['$4.80', '$5.00', '$5.20', '$4.00'], a: 1, c: '80 + 20 cents = $1.', j: '' },
  { id: 'math-ntuc-p3-0005', q: 'There are 7 shelves with 8 cans each. Total cans altogether?', o: ['48', '54', '56', '64'], a: 2, c: '7 x 8 = 56.', j: '' },
];
const MIXED_SB = [GOOD_SB[0], GOOD_SB[1], FIB_Q, GOOD_SB[2], FIB_CM_Q];

function clientEngine() {
  const SB_COUNT = 5;
  const LIVE_GEN_TOPIC = 'math-ntuc';
  const LIVE_GEN_COUNT = 5;
  var localStorage = {
    store: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
    setItem(k, v) { this.store[k] = String(v); },
  };
  const _fuStart = html.indexOf('var FIB_UNITS=');
  assert.ok(_fuStart >= 0, 'FIB_UNITS not found in page');
  const _fuEnd = html.indexOf('};', _fuStart) + 2;
  const FIB_UNITS = eval(html.slice(_fuStart, _fuEnd) + ';FIB_UNITS;'); // eslint-disable-line no-unused-vars
  const hashStr = eval('(' + fnText('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
  const seededShuffle = eval('(' + fnText('function seededShuffle(') + ')'); // eslint-disable-line no-unused-vars
  const bankFor = eval('(' + fnText('function bankFor(t, kind, level){') + ')'); // eslint-disable-line no-unused-vars
  const poolQuestions = eval('(' + fnText('function poolQuestions(t,') + ')'); // eslint-disable-line no-unused-vars
  const optsShuffled = eval('(' + fnText('function optsShuffled(q, seed){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSGet = eval('(' + fnText('function liveGenLSGet(k){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSSet = eval('(' + fnText('function liveGenLSSet(k,v){') + ')'); // eslint-disable-line no-unused-vars
  const isFibQuestion = eval('(' + fnText('function isFibQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibExpected = eval('(' + fnText('function fibExpected(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibAccepts = eval('(' + fnText('function fibAccepts(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibNormText = eval('(' + fnExact('function fibNormText(s){') + ')'); // eslint-disable-line no-unused-vars
  const fibUnitStated = eval('(' + fnText('function fibUnitStated(unit, stem){') + ')'); // eslint-disable-line no-unused-vars
  const fibCanonUnit = eval('(' + fnText('function fibCanonUnit(token){') + ')'); // eslint-disable-line no-unused-vars
  const fibParseNumber = eval('(' + fnText('function fibParseNumber(s, stem){') + ')'); // eslint-disable-line no-unused-vars
  const checkFibAnswer = eval('(' + fnText('function checkFibAnswer(q, typed){') + ')'); // eslint-disable-line no-unused-vars
  const questAnswerText = eval('(' + fnText('function questAnswerText(q){') + ')'); // eslint-disable-line no-unused-vars
  const sbNormalizeQuestion = eval('(' + fnText('function sbNormalizeQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const sbCacheKey = eval('(' + fnText('function sbCacheKey(eid, topicId){') + ')'); // eslint-disable-line no-unused-vars
  const loadSbCache = eval('(' + fnText('function loadSbCache(eid, topicId){') + ')'); // eslint-disable-line no-unused-vars
  const sbShapeOk = eval('(' + fnText('function sbShapeOk(questions){') + ')'); // eslint-disable-line no-unused-vars
  const saveSbCache = eval('(' + fnText('function saveSbCache(eid, topicId, day, questions){') + ')'); // eslint-disable-line no-unused-vars
  const sbPick = eval('(' + fnText('function sbPick(cached, today){') + ')'); // eslint-disable-line no-unused-vars
  const sbPickResume = eval('(' + fnText('function sbPickResume(cached){') + ')'); // eslint-disable-line no-unused-vars
  const sbUsable = eval('(' + fnText('function sbUsable(eid, topicId, level, today, allowStale){') + ')'); // eslint-disable-line no-unused-vars
  const reportServerBankAnswers = eval('(' + fnText('function reportServerBankAnswers(topicId, list, wrongIdx){') + ')'); // eslint-disable-line no-unused-vars
  const questListFor = eval('(' + fnExact('function questListFor(t, c, level){') + ')'); // eslint-disable-line no-unused-vars
  const NTUC = { id: 'math-ntuc',
    quest: [
      { q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.' },
      { q: 'One carton of milk is $2. Three cartons cost how much?', o: ['$5', '$6', '$7', '$23'], a: 1, c: '2 x 3.' },
    ], fresh: [], warm: [], retry: [] };
  function todayKey() { return '2026-11-08'; }
  function topicById(id) { return id === 'math-ntuc' ? NTUC : null; }
  function ex() { return { id: 'e-test-1' }; }
  function syncKey() { return 'ABC2DE'; }
  return {
    isFibQuestion, fibExpected, fibAccepts, fibNormText, fibUnitStated,
    fibParseNumber, checkFibAnswer, questAnswerText, sbNormalizeQuestion,
    sbCacheKey, loadSbCache, sbShapeOk, saveSbCache, sbPick, sbPickResume,
    sbUsable, fetchServerBankQuestions: null, reportServerBankAnswers,
    questListFor, localStorage, NTUC,
  };
}

/* ---------- lib: the FIB row encoding ---------- */

test('fib-kind lib: sbKindOf recognises FIB vs MCQ vs malformed', () => {
  assert.equal(sb.sbKindOf(fibRow('f1', 'How many apples are there altogether?', '42', ['forty-two'])), 'fib');
  assert.equal(sb.sbKindOf(mcqRow('m1', 'How many apples are there altogether?', ['18', '20', '24', '30'], 2)), 'mcq');
  // Malformed rows are never served (null): FIB without an answer,
  // FIB with a blank answer, a FIB-shaped object with another kind,
  // too few options, an out-of-range index, a non-array non-object.
  assert.equal(sb.sbKindOf({ options: { kind: 'fib' }, answer: 0 }), null, 'FIB with no answer text');
  assert.equal(sb.sbKindOf({ options: { kind: 'fib', answer: '   ' }, answer: 0 }), null, 'FIB with a blank answer');
  assert.equal(sb.sbKindOf({ options: { kind: 'other', answer: '42' }, answer: 0 }), null, 'unknown kind');
  assert.equal(sb.sbKindOf({ options: ['a', 'b', 'c'], answer: 0 }), null, 'only 3 options');
  assert.equal(sb.sbKindOf({ options: ['a', 'b', 'c', 'd'], answer: 4 }), null, 'answer index out of range');
  assert.equal(sb.sbKindOf({ options: '42', answer: 0 }), null, 'options must be an array or a fib object');
  assert.equal(sb.sbKindOf(null), null);
  assert.equal(sb.sbKindOf(undefined), null);
  // The FIB sentinel: answer must be 0 is NOT required — any int is
  // ignored for FIB rows; the kind comes from the options object.
  assert.equal(sb.sbKindOf(fibRow('f1', 'How many apples are there altogether?', '7')), 'fib');
});

test('fib-kind lib: sbFibAnswer returns the trimmed text, null for MCQ', () => {
  assert.equal(sb.sbFibAnswer(fibRow('f1', 'How many apples are there altogether?', '  42  ')), '42');
  assert.equal(sb.sbFibAnswer(mcqRow('m1', 'How many apples are there altogether?', ['18', '20', '24', '30'], 2)), null);
  assert.equal(sb.sbFibAnswer({ options: { kind: 'fib' }, answer: 0 }), null, 'malformed FIB has no answer');
});

test('fib-kind lib: sbClientQuestion maps FIB and MCQ rows for daily-set', () => {
  const f = sb.sbClientQuestion(fibRow('f1', 'There are 6 bags with 7 apples in each bag. How many apples are there altogether?', '42', ['forty-two']));
  assert.deepEqual(f, { id: 'f1', q: 'There are 6 bags with 7 apples in each bag. How many apples are there altogether?', c: 'Because.', j: '', k: 'fib', o: [], a: 0, ans: '42', accept: ['forty-two'] });
  const m = mcqRow('m1', 'How many apples are there altogether?', ['18', '20', '24', '30'], 2);
  const mq = sb.sbClientQuestion(m);
  assert.deepEqual(mq, { id: 'm1', q: 'How many apples are there altogether?', c: 'Because.', j: '', k: 'mcq', o: ['18', '20', '24', '30'], a: 2 });
  assert.notEqual(mq.o, m.options, 'the options array is copied, not shared');
  assert.equal(sb.sbClientQuestion({ options: { kind: 'fib' }, answer: 0 }), null, 'malformed rows map to null (filtered by daily-set)');
  assert.equal(sb.sbClientQuestion({ options: ['a', 'b'], answer: 0 }), null);
});

test('fib-kind lib: sbInterleaveKinds alternates, preserves within-kind order', () => {
  const m = (id) => ({ id: id, k: 'mcq' });
  const f = (id) => ({ id: id, k: 'fib' });
  assert.deepEqual(sb.sbInterleaveKinds([m('m1'), m('m2'), m('m3'), f('f1'), f('f2')]).map((x) => x.id), ['m1', 'f1', 'm2', 'f2', 'm3'], 'longer kind first, then strict alternation');
  assert.deepEqual(sb.sbInterleaveKinds([m('m1'), f('f1'), f('f2'), f('f3')]).map((x) => x.id), ['f1', 'm1', 'f2', 'f3'], 'the longer kind leads and its tail stays at the end');
  assert.deepEqual(sb.sbInterleaveKinds([m('m1'), m('m2')]).map((x) => x.id), ['m1', 'm2'], 'one kind only: order unchanged');
  assert.deepEqual(sb.sbInterleaveKinds([]), []);
  // Raw Supabase rows (no .k) interleave by their options shape.
  const raw = [mcqRow('m1', 'How many apples are there altogether?', ['1', '2', '3', '4'], 0), fibRow('f1', 'How many apples are there altogether?', '42'), mcqRow('m2', 'How many apples are there altogether?', ['1', '2', '3', '4'], 0)];
  assert.deepEqual(sb.sbInterleaveKinds(raw).map((x) => x.id), ['m1', 'f1', 'm2']);
});

test('fib-kind lib: pickSet interleaves FIB/MCQ in the fresh draw, due still first', () => {
  const m = (id) => ({ id: id, k: 'mcq', q: 'MCQ question ' + id + ' here?', o: ['1', '2', '3', '4'], a: 0, c: '' });
  const f = (id) => ({ id: id, k: 'fib', q: 'FIB question ' + id + ' here?', o: [], a: 0, c: '', ans: '42' });
  const fresh = [m('m1'), m('m2'), m('m3'), f('f1'), f('f2'), f('f3')];
  const r = sb.pickSet({ due: [], fresh: fresh, count: 5, seed: 7 });
  assert.equal(r.questions.length, 5);
  assert.deepEqual(r.questions.map((x) => x.k), ['fib', 'mcq', 'fib', 'mcq', 'fib'], 'mixed set, not all-MCQ-then-all-FIB');
  assert.equal(r.freshCount, 5);
  assert.equal(r.dueCount, 0);
  // Deterministic: the same seed draws the same mixed set.
  const r2 = sb.pickSet({ due: [], fresh: fresh, count: 5, seed: 7 });
  assert.deepEqual(r2.questions.map((x) => x.id), r.questions.map((x) => x.id));
  // Due first still holds, in the order given, whatever the format.
  const r3 = sb.pickSet({ due: [f('fd1'), m('md1')], fresh: fresh, count: 5, seed: 7 });
  assert.deepEqual(r3.questions.slice(0, 2).map((x) => x.id), ['fd1', 'md1'], 'due first, oldest first, in the order given');
  assert.equal(r3.dueCount, 2);
  // Inputs are not mutated.
  assert.deepEqual(fresh.map((x) => x.id), ['m1', 'm2', 'm3', 'f1', 'f2', 'f3']);
  // All-MCQ behaviour is unchanged: same order as before the change.
  const allMcq = sb.pickSet({ due: [m('d1'), m('d2')], fresh: [m('f1'), m('f2'), m('f3'), m('f4'), m('f5'), m('f6')], count: 5, seed: 7 });
  assert.deepEqual(allMcq.questions.slice(0, 2).map((x) => x.id), ['d1', 'd2']);
  assert.equal(allMcq.dueCount, 2);
  assert.equal(allMcq.freshCount, 3);
});

/* ---------- client: format detection + tolerance ---------- */

test('fib-kind client: isFibQuestion / fibExpected / fibAccepts distinguish formats', () => {
  const c = clientEngine();
  assert.equal(c.isFibQuestion(FIB_Q), true);
  assert.equal(c.fibExpected(FIB_Q), '42');
  assert.deepEqual(c.fibAccepts(FIB_Q), ['forty-two']);
  assert.equal(c.isFibQuestion(MCQ_Q), false);
  assert.equal(c.fibExpected(MCQ_Q), null);
  assert.deepEqual(c.fibAccepts(MCQ_Q), []);
  // A legacy MCQ question (no k, options array) is MCQ by default.
  const legacy = { id: 'x', q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '' };
  assert.equal(c.isFibQuestion(legacy), false);
  // A raw {kind:'fib'} options object is FIB even without k/ans.
  const raw = { id: 'y', q: 'There are 6 bags with 7 apples in each bag. How many?', o: { kind: 'fib', answer: '7', accept: ['seven'] }, a: 0, c: '' };
  assert.equal(c.isFibQuestion(raw), true);
  assert.equal(c.fibExpected(raw), '7');
  assert.deepEqual(c.fibAccepts(raw), ['seven']);
  // The answer text shown to the child / handed to Ask Pip.
  assert.equal(c.questAnswerText(FIB_Q), '42');
  assert.equal(c.questAnswerText(MCQ_Q), '24');
  assert.equal(c.questAnswerText(legacy), '24');
});

test('fib-kind client: checkFibAnswer tolerance — case, whitespace, numeric', () => {
  const c = clientEngine();
  // Numeric: 42, 42.0 and 42.00 are all correct; so are a stray
  // full stop, surrounding spaces and a leading $.
  for (const typed of ['42', ' 42 ', '42.0', '42.00', '42.', '$42']) {
    assert.equal(c.checkFibAnswer(FIB_Q, typed), true, JSON.stringify(typed) + ' should be correct for 42');
  }
  // Alternates: the accept list is matched with text tolerance.
  for (const typed of ['forty-two', 'Forty-Two', ' FORTY-TWO ', 'forty-two.']) {
    assert.equal(c.checkFibAnswer(FIB_Q, typed), true, JSON.stringify(typed) + ' should match the alternate');
  }
  // Genuinely wrong answers are rejected, including near misses,
  // blanks, and a number with a unit the question never states.
  for (const typed of ['43', '41', '24', '', '   ', 'forty two', '42 cm', '42 boxes', 'seven']) {
    assert.equal(c.checkFibAnswer(FIB_Q, typed), false, JSON.stringify(typed) + ' should be wrong for 42');
  }
  // Thousands separators and fractions parse numerically.
  const big = { id: 'b', q: 'There are 1000 stickers in a box. How many stickers are there?', o: [], a: 0, c: '', k: 'fib', ans: '1000', accept: [] };
  assert.equal(c.checkFibAnswer(big, '1,000'), true);
  assert.equal(c.checkFibAnswer(big, '1000.0'), true);
  assert.equal(c.checkFibAnswer(big, '999'), false);
  const half = { id: 'h', q: 'What is half of 1? Give your answer as a decimal number.', o: [], a: 0, c: '', k: 'fib', ans: '0.5', accept: [] };
  assert.equal(c.checkFibAnswer(half, '1/2'), true);
  assert.equal(c.checkFibAnswer(half, '0.50'), true);
  assert.equal(c.checkFibAnswer(half, '0.6'), false);
  // A trailing unit counts ONLY when the question states that unit.
  assert.equal(c.checkFibAnswer(FIB_CM_Q, '42 cm'), true, 'stem says centimetres');
  assert.equal(c.checkFibAnswer(FIB_CM_Q, '42 centimetres'), true);
  assert.equal(c.checkFibAnswer(FIB_CM_Q, '42'), true, 'the bare number still counts');
  assert.equal(c.checkFibAnswer(FIB_CM_Q, '42 m'), false, 'metres are not stated');
  assert.equal(c.checkFibAnswer(FIB_CM_Q, '43 cm'), false, 'wrong number even with the right unit');
  // Text answers: case-insensitive, trimmed, trailing full stop ignored.
  const word = { id: 'w', q: 'What is the capital city of France? Type the name.', o: [], a: 0, c: '', k: 'fib', ans: 'Paris', accept: [] };
  for (const typed of ['Paris', 'paris', ' PARIS ', 'Paris.']) {
    assert.equal(c.checkFibAnswer(word, typed), true, JSON.stringify(typed) + ' should be correct for Paris');
  }
  assert.equal(c.checkFibAnswer(word, 'London'), false);
  assert.equal(c.checkFibAnswer(word, ''), false);
  assert.equal(c.checkFibAnswer(MCQ_Q, '24'), false, 'checkFibAnswer is only for FIB questions (no ans)');
});

test('fib-kind client: sbShapeOk accepts a mixed set, rejects a bad FIB', () => {
  const c = clientEngine();
  assert.equal(c.sbShapeOk(MIXED_SB), true, '3 MCQ + 2 FIB is a valid 5-question set');
  assert.equal(c.sbShapeOk(GOOD_SB), true, 'an all-MCQ set is still valid');
  assert.equal(c.sbShapeOk(MIXED_SB.slice(0, 4)), false, 'a set must have 5');
  const noAns = MIXED_SB.map((q, i) => (i === 2 ? { id: q.id, q: q.q, o: [], a: 0, c: q.c, j: '', k: 'fib', ans: '', accept: [] } : q));
  assert.equal(c.sbShapeOk(noAns), false, 'a FIB question with an empty answer is not servable');
  const noAnsField = MIXED_SB.map((q, i) => (i === 2 ? { id: q.id, q: q.q, o: [], a: 0, c: q.c, j: '', k: 'fib' } : q));
  assert.equal(c.sbShapeOk(noAnsField), false, 'a FIB question with no answer at all is not servable');
  const badMcq = MIXED_SB.map((q, i) => (i === 0 ? { id: q.id, q: q.q, o: ['1', '2', '3'], a: 0, c: q.c, j: '', k: 'mcq' } : q));
  assert.equal(c.sbShapeOk(badMcq), false, 'an MCQ question still needs 4 options');
});

test('fib-kind client: saveSbCache keeps FIB verbatim, shuffles MCQ, mixed set usable', () => {
  const c = clientEngine();
  const rec = c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', MIXED_SB);
  assert.equal(rec.questions.length, 5);
  const fibs = rec.questions.filter((q) => q.k === 'fib');
  assert.equal(fibs.length, 2);
  assert.deepEqual(fibs.map((q) => q.ans), ['42', '42'], 'FIB answers survive the cache');
  assert.ok(fibs.every((q) => Array.isArray(q.o) && q.o.length === 0 && q.a === 0), 'FIB questions carry no options to shuffle');
  assert.deepEqual(fibs.map((q) => q.id), ['math-ntuc-p3-f001', 'math-ntuc-p3-f002'], 'FIB ids survive');
  const mcqs = rec.questions.filter((q) => q.k === 'mcq');
  assert.deepEqual(mcqs.map((q) => q.o[q.a]), ['24', '$6', '9 eggs'], 'shuffled MCQ options still point at the right answers');
  const rec2 = c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', MIXED_SB);
  assert.deepEqual(rec2.questions, rec.questions, 'same explorer+topic+day caches identically');
  assert.equal(c.sbPick(c.loadSbCache('e-test-1', 'math-ntuc'), '2026-11-08').source, 'server');
  assert.equal(c.sbUsable('e-test-1', 'math-ntuc', 3, '2026-11-08', false).source, 'server');
  assert.equal(c.sbUsable('e-test-1', 'math-ntuc', 3, '2026-11-09', false).source, 'bank', 'a new day refuses the stale set');
  // A raw {kind:'fib'} options object from the server normalises too.
  const raw = { id: 'r1', q: 'There are 6 bags with 7 apples in each bag. How many apples?', o: { kind: 'fib', answer: '42', accept: [] }, a: 0, c: '6 x 7.', j: '' };
  const recRaw = c.saveSbCache('e-test-1', 'math-mrt', '2026-11-08', [GOOD_SB[0], GOOD_SB[1], GOOD_SB[2], GOOD_SB[3], raw]);
  const savedRaw = recRaw.questions.find((q) => q.id === 'r1');
  assert.equal(savedRaw.k, 'fib');
  assert.equal(savedRaw.ans, '42');
});

test('fib-kind client: questListFor plays a mixed server set verbatim, bank otherwise', () => {
  const c = clientEngine();
  const t = { id: 'math-ntuc', quest: [{ q: 'bank1' }, { q: 'bank2' }, { q: 'bank3' }, { q: 'bank4' }, { q: 'bank5' }], fresh: [] };
  const mixed = [MCQ_Q, FIB_Q, GOOD_SB[1], FIB_CM_Q, GOOD_SB[2]];
  assert.deepEqual(c.questListFor(t, { phase: 'quest', liveGen: mixed }, 3), mixed, 'server set returned as-is, in order, both formats');
  assert.deepEqual(c.questListFor(t, { phase: 'quest', pool: [0, 1, 2, 3, 4] }, 3).map((q) => q.q), ['bank1', 'bank2', 'bank3', 'bank4', 'bank5'], 'no server set: the bank plays as before');
});

test('fib-kind client: MCQ behaviour unchanged (legacy shape, no k)', () => {
  const c = clientEngine();
  assert.equal(c.sbShapeOk(GOOD_SB), true, 'legacy MCQ questions without k are still valid');
  const rec = c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', GOOD_SB);
  assert.deepEqual(rec.questions.map((q) => q.id), GOOD_SB.map((q) => q.id), 'ids survive');
  assert.deepEqual(rec.questions.map((q) => q.o[q.a]), GOOD_SB.map((q) => q.o[q.a]), 'shuffled options still point at the right answers');
  assert.ok(rec.questions.every((q) => q.k === 'mcq'), 'legacy questions normalise to mcq');
  assert.equal(c.isFibQuestion(GOOD_SB[0]), false);
});

test('fib-kind client: page wiring — FIB input + Check, shared verdict, FIB progress saved', () => {
  assert.ok(html.includes('id="qFibInput"'), 'the quest renders a FIB text input');
  assert.ok(html.includes('id="qFibCheck"'), 'the FIB input has a Check button');
  assert.ok(html.includes('Check my answer'), 'the Check button label');
  assert.ok(html.includes('checkFibAnswer(q, typed)'), 'the Check handler grades the typed answer');
  assert.ok(html.includes('cur.fibCorrect'), 'the FIB verdict is kept on the run');
  assert.ok(html.includes('fibTyped'), 'the typed FIB answer is kept (and persisted) for resume');
  assert.ok(html.includes('var _fib=isFibQuestion(q);'), 'the renderer switches per question');
  assert.ok(html.includes('questAnswerText(q)'), 'feedback / Ask Pip use the shared answer text');
  assert.ok(html.includes("k:'fib'"), 'daily-set/FIB client shape carries the fib kind');
  assert.ok(html.includes('Enter'), 'Enter submits a FIB answer too');
  assert.ok(html.includes('data-qopt'), 'the MCQ option buttons are still there');
  assert.ok(html.includes('data-wopt'), 'warm-up (bank MCQ) is untouched');
});

/* ---------- api: daily-set + report-answers ---------- */

function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function mockReq(method, body) { return { method, body }; }
function loadHandler(name) {
  delete require.cache[require.resolve('../api/' + name)];
  return require('../api/' + name);
}
function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
}
function clearEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
}
function supabaseMock(routes) {
  return async (url, init) => {
    const method = (init && init.method) || 'GET';
    if (url.indexOf('sb_questions?topic=') >= 0) {
      return { ok: true, json: async () => routes.questions || [] };
    }
    if (url.indexOf('sb_questions?id=in.') >= 0) {
      return { ok: true, json: async () => routes.known || [] };
    }
    if (url.indexOf('sb_explorer_questions?') >= 0 && method !== 'POST') {
      return { ok: true, json: async () => routes.states || [] };
    }
    if (url.indexOf('sb_explorer_questions?on_conflict=') >= 0 && method === 'POST') {
      routes.captured = JSON.parse(init.body);
      return { ok: true, json: async () => routes.captured };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
}
function mixedPoolRows() {
  const rows = [];
  for (let i = 1; i <= 8; i++) {
    rows.push(mcqRow('m-p3-' + String(i).padStart(4, '0'), 'MCQ question number ' + i + ' with numbers 2 and 3 in it?', ['4', '5', '6', '7'], 2));
  }
  for (let i = 1; i <= 8; i++) {
    rows.push(fibRow('f-p3-' + String(i).padStart(4, '0'), 'FIB question number ' + i + ' with numbers 6 and 7 in it?', '42', ['forty-two']));
  }
  // Malformed rows that must never be served.
  rows.push({ id: 'bad-fib', topic: 'math-ntuc', level: 3, sub_topic: 'quest', stem: 'A FIB row with no answer text at all here?', options: { kind: 'fib' }, answer: 0, explanation: '', joke: '', source: 'bank' });
  rows.push({ id: 'bad-mcq', topic: 'math-ntuc', level: 3, sub_topic: 'quest', stem: 'An MCQ row with only two options here?', options: ['1', '2'], answer: 0, explanation: '', joke: '', source: 'bank' });
  return rows;
}

test('fib-kind api: daily-set serves a mixed set with the format on each question', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  const routes = {
    questions: mixedPoolRows(),
    states: [
      { question_id: 'f-p3-0002', status: 'due', updated_at: '2026-11-01T00:00:00Z' },
      { question_id: 'm-p3-0001', status: 'mastered', updated_at: '2026-11-07T00:00:00Z' },
    ],
    captured: null,
  };
  global.fetch = supabaseMock(routes);
  try {
    const body = { code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc', level: 3, day: '2026-11-08' };
    const res = mockRes();
    await handler(mockReq('POST', body), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.source, 'server');
    assert.equal(res.body.questions.length, 5);
    assert.equal(res.body.questions[0].id, 'f-p3-0002', 'the due FIB question comes first');
    const kinds = res.body.questions.map((q) => q.k);
    assert.ok(kinds.includes('fib') && kinds.includes('mcq'), 'the set mixes formats: ' + kinds.join(','));
    // The fresh draw (after the due question) interleaves formats.
    const freshKinds = kinds.slice(1);
    for (let i = 1; i < freshKinds.length; i++) {
      assert.notEqual(freshKinds[i], freshKinds[i - 1], 'fresh draw alternates formats: ' + freshKinds.join(','));
    }
    // Every question carries its format; FIB questions carry ans.
    for (const q of res.body.questions) {
      assert.ok(q.k === 'fib' || q.k === 'mcq', 'k is fib or mcq');
      assert.equal(typeof q.q, 'string');
      assert.equal(typeof q.c, 'string');
      if (q.k === 'fib') {
        assert.equal(typeof q.ans, 'string', 'a FIB question carries its expected answer');
        assert.ok(q.ans.length > 0);
        assert.ok(Array.isArray(q.accept), 'a FIB question carries its alternates');
        assert.deepEqual(q.o, [], 'a FIB question carries no options');
        assert.equal(q.a, 0, 'a FIB answer index is the unused sentinel');
      } else {
        assert.equal(q.o.length, 4, 'an MCQ question still carries 4 options');
        assert.ok(q.a >= 0 && q.a <= 3);
      }
    }
    const ids = res.body.questions.map((q) => q.id);
    assert.ok(!ids.includes('m-p3-0001'), 'a mastered question is never served');
    assert.ok(!ids.includes('bad-fib') && !ids.includes('bad-mcq'), 'malformed rows are filtered out of the pool');
    assert.equal(res.body.served + res.body.due + res.body.fresh, 5);
    // Deterministic: the same inputs serve the same mixed set again.
    routes.captured = null;
    const res2 = mockRes();
    await handler(mockReq('POST', body), res2);
    assert.deepEqual(res2.body.questions.map((q) => q.id), ids, 'a lost client cache re-serves the same set for the day');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('fib-kind api: report-answers still works for FIB question ids (no format change)', async () => {
  setEnv();
  const handler = loadHandler('report-answers');
  const origFetch = global.fetch;
  const routes = {
    known: [{ id: 'f-p3-0001' }, { id: 'f-p3-0002' }, { id: 'm-p3-0001' }],
    states: [
      { question_id: 'f-p3-0001', status: 'served', attempts: 0, correct: 0 },
      { question_id: 'f-p3-0002', status: 'due', attempts: 1, correct: 0 },
    ],
    captured: null,
  };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await handler(mockReq('POST', {
      code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc',
      results: [
        { questionId: 'f-p3-0001', correct: true },
        { questionId: 'f-p3-0002', correct: false },
        { questionId: 'm-p3-0001', correct: true },
      ],
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 2, due: 1 });
    const rows = routes.captured;
    assert.equal(rows.length, 3, 'FIB ids report exactly like MCQ ids');
    const rf1 = rows.find((r) => r.question_id === 'f-p3-0001');
    const rf2 = rows.find((r) => r.question_id === 'f-p3-0002');
    assert.equal(rf1.status, 'mastered', 'a correct FIB answer masters');
    assert.equal(rf1.attempts, 1);
    assert.equal(rf1.correct, 1);
    assert.equal(rf2.status, 'due', 'a wrong FIB answer goes due');
    assert.equal(rf2.attempts, 2);
    assert.equal(rf2.correct, 0);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('fib-kind api: report-answers — a FIB id the bank does not know is skipped, rest still land', async () => {
  setEnv();
  const handler = loadHandler('report-answers');
  const origFetch = global.fetch;
  const routes = { known: [{ id: 'f-p3-0001' }], states: [], captured: null };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await handler(mockReq('POST', {
      code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc',
      results: [
        { questionId: 'f-p3-0001', correct: true },
        { questionId: 'f-p3-9999', correct: false },
      ],
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 1, due: 0 });
    assert.equal(routes.captured.length, 1);
  } finally { global.fetch = origFetch; clearEnv(); }
});
