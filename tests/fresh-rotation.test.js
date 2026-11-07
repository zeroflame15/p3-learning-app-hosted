// Daily rotation (requested 2026-11-07): the page's own fresh-set,
// warm-up and retry engines must change the questions every time —
// a finished quest never repeats yesterday's questions, a warm-up
// never repeats yesterday's, and a retry never repeats the last one.
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

function engine() {
  const hashStr = eval('(' + fnText('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
  const seededShuffle = eval('(' + fnText('function seededShuffle(') + ')'); // eslint-disable-line no-unused-vars
  const poolQuestions = eval('(' + fnText('function poolQuestions(t){') + ')'); // eslint-disable-line no-unused-vars
  const rotateIndices = eval('(' + fnText('function rotateIndices(') + ')'); // eslint-disable-line no-unused-vars
  const dailyPoolIndices = eval('(' + fnText('function dailyPoolIndices(') + ')');
  const dailyWarmIndices = eval('(' + fnText('function dailyWarmIndices(') + ')');
  return { dailyPoolIndices, dailyWarmIndices };
}

test('page dailyPoolIndices: consecutive days are disjoint, same group returns after 3 days', () => {
  const { dailyPoolIndices } = engine();
  const t = { id: 'math-frac', quest: Array.from({ length: 5 }, (_, i) => ({ q: 'q' + i })), fresh: Array.from({ length: 10 }, (_, i) => ({ q: 'f' + i })) };
  let prev = null;
  for (let d = 1; d <= 9; d++) {
    const date = '2026-11-' + String(d).padStart(2, '0');
    const set = dailyPoolIndices(t, date, 'explorer1');
    assert.equal(set.length, 5, date + ': five questions');
    assert.equal(new Set(set).size, 5, date + ': five distinct questions');
    assert.deepEqual(set, dailyPoolIndices(t, date, 'explorer1'), date + ': stable within the day');
    assert.ok(set.every((v) => v >= 0 && v < 15), date + ': indices inside the 15-question pool');
    if (prev) assert.ok(set.every((v) => !prev.includes(v)), date + ': shares nothing with yesterday');
    prev = set;
  }
  const d1 = dailyPoolIndices(t, '2026-11-07', 'explorer1');
  const d4 = dailyPoolIndices(t, '2026-11-10', 'explorer1');
  assert.deepEqual([...d1].sort(), [...d4].sort(), 'the same group returns after 3 days');
});

test('page dailyWarmIndices: a warm-up never repeats yesterday', () => {
  const { dailyWarmIndices } = engine();
  const t = { id: 'eng-story', warm: Array.from({ length: 8 }, (_, i) => ({ q: 'w' + i })) };
  let prev = null;
  for (let d = 1; d <= 7; d++) {
    const date = '2026-11-' + String(d).padStart(2, '0');
    const set = dailyWarmIndices(t, date, 'explorer1');
    assert.equal(set.length, 4, date + ': four warm-up questions');
    assert.equal(new Set(set).size, 4, date + ': four distinct questions');
    if (prev) assert.ok(set.every((v) => !prev.includes(v)), date + ': shares nothing with yesterday');
    prev = set;
  }
});

test('every topic bank is sized for rotation: pool 15, warm 8, retry 6', () => {
  function Q(q, o, a, c, j) { return { q: q, o: o, a: a, c: c, j: j }; }
  function extractVar(src, name) {
    const s = src.indexOf('var ' + name + '=');
    let i = src.indexOf('=', s) + 1, depth = 0, inStr = false, strCh = '', esc = false;
    const start = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
      if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
      if (ch === '[' || ch === '{') depth++;
      if (ch === ']' || ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    throw new Error('no end ' + name);
  }
  const TOPICS = eval('(' + extractVar(html, 'TOPICS') + ')');
  const FRESH = eval('(' + extractVar(html, 'FRESH_BANK') + ')');
  assert.equal(TOPICS.length, 14, '14 topics');
  TOPICS.forEach((t) => {
    assert.equal(t.quest.length, 5, t.id + ': 5 quest questions');
    assert.equal((t.warm || []).length, 8, t.id + ': 8 warm-up questions (two days of 4)');
    assert.equal((t.retry || []).length, 6, t.id + ': 6 retry questions (a fresh 3 every retry)');
    assert.equal((FRESH[t.id] || []).length, 10, t.id + ': 10 fresh-bank questions');
    assert.equal(t.quest.length + (FRESH[t.id] || []).length, 15, t.id + ': pool of 15 (three days of 5)');
    // No question text repeats inside a topic's own banks.
    const all = [...t.quest, ...t.warm, ...t.retry, ...(FRESH[t.id] || [])].map((q) => q.q);
    assert.equal(new Set(all).size, all.length, t.id + ': no duplicated question text across its banks');
  });
});

test('page questListFor: a retry draws from its stored pool, never the whole bank', () => {
  const questListFor = eval(fnText('function questListFor(t, c){') + '\n;questListFor');
  const t = { retry: [{ q: 'r0' }, { q: 'r1' }, { q: 'r2' }, { q: 'r3' }, { q: 'r4' }, { q: 'r5' }] };
  assert.deepEqual(questListFor(t, { phase: 'retry', retryPool: [5, 0, 2] }).map((q) => q.q), ['r5', 'r0', 'r2'], 'retry uses the drawn pool, in order');
  assert.deepEqual(questListFor(t, { phase: 'retry' }).map((q) => q.q), ['r0', 'r1', 'r2'], 'an old retry run without a pool falls back to the first three');
  const bindSrc = fnBody('function bindQuiz(){');
  assert.ok(bindSrc.includes('retryPool:rIdx'), 'the Second Chance button stores its draw on the run');
  assert.ok(bindSrc.includes('seededShuffle(t.retry.map'), 'the draw shuffles the retry bank with a fresh seed');
});
