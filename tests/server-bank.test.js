// Server bank — PURE logic tests (lib/server-bank.js).
// No fetch, no env: pickSet ordering, day-seed determinism, the
// mastered/due transitions, and parity with the page's own
// hashStr/seededShuffle (the server must pick exactly what the page
// would pick for the same inputs).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
const pageHashStr = eval('(' + fnText('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
const pageSeededShuffle = eval('(' + fnText('function seededShuffle(') + ')'); // eslint-disable-line no-unused-vars

const sb = require('../lib/server-bank');

function q(id) { return { id, q: 'Q ' + id, o: ['1', '2', '3', '4'], a: 0, c: '1.', j: '' }; }

test('server-bank: sbHash/sbShuffle match the page exactly', () => {
  for (const s of ['', 'a', 'math-ntuc', 'e-test-1|math-ntuc|2026-11-08', 'FlagTest08|math-ntuc|2026-11-07']) {
    assert.equal(sb.sbHash(s), pageHashStr(s), 'hash of ' + JSON.stringify(s));
  }
  for (const seed of [1, 2, 42, 123456, 2166136261]) {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    assert.deepEqual(sb.sbShuffle(arr, seed), pageSeededShuffle(arr, seed), 'shuffle seed ' + seed);
    assert.deepEqual(arr, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'shuffle does not mutate its input');
  }
});

test('server-bank: sbDaySeed is deterministic and varies by day, explorer and topic', () => {
  assert.equal(sb.sbDaySeed('e1', 'math-ntuc', '2026-11-08'), sb.sbHash('e1|math-ntuc|2026-11-08'), 'same inputs as the page rotation (explorer|topic|day)');
  assert.equal(sb.sbDaySeed('e1', 'math-ntuc', '2026-11-08'), sb.sbDaySeed('e1', 'math-ntuc', '2026-11-08'));
  assert.notEqual(sb.sbDaySeed('e1', 'math-ntuc', '2026-11-08'), sb.sbDaySeed('e1', 'math-ntuc', '2026-11-09'), 'a new day draws a new set');
  assert.notEqual(sb.sbDaySeed('e1', 'math-ntuc', '2026-11-08'), sb.sbDaySeed('e2', 'math-ntuc', '2026-11-08'), 'a different explorer draws a different set');
});

test('server-bank: pickSet serves due first (in order), then fresh shuffled, up to count', () => {
  const due = [q('d1'), q('d2')];
  const fresh = [q('f1'), q('f2'), q('f3'), q('f4'), q('f5'), q('f6')];
  const r = sb.pickSet({ due, fresh, count: 5, seed: 7 });
  assert.equal(r.questions.length, 5);
  assert.deepEqual(r.questions.slice(0, 2).map((x) => x.id), ['d1', 'd2'], 'due first, oldest first, in the order given');
  assert.equal(r.dueCount, 2);
  assert.equal(r.freshCount, 3);
  assert.equal(new Set(r.questions.map((x) => x.id)).size, 5, 'no question twice');
  // Deterministic: the same seed draws the same fresh three.
  const r2 = sb.pickSet({ due, fresh, count: 5, seed: 7 });
  assert.deepEqual(r2.questions.map((x) => x.id), r.questions.map((x) => x.id));
  // A different day-seed draws a different fresh mix.
  const r3 = sb.pickSet({ due, fresh, count: 5, seed: 8 });
  assert.notDeepEqual(r3.questions.map((x) => x.id), r.questions.map((x) => x.id));
  // Inputs are not mutated.
  assert.deepEqual(due.map((x) => x.id), ['d1', 'd2']);
  assert.deepEqual(fresh.map((x) => x.id), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']);
});

test('server-bank: pickSet caps at count and copes with a short pool', () => {
  const due = [q('d1'), q('d2'), q('d3'), q('d4'), q('d5'), q('d6')];
  const r = sb.pickSet({ due, fresh: [q('f1')], count: 5, seed: 1 });
  assert.equal(r.questions.length, 5);
  assert.deepEqual(r.questions.map((x) => x.id), ['d1', 'd2', 'd3', 'd4', 'd5'], 'due longer than count: only due, in order');
  assert.equal(r.dueCount, 5);
  assert.equal(r.freshCount, 0);
  const short = sb.pickSet({ due: [], fresh: [q('f1'), q('f2')], count: 5, seed: 1 });
  assert.equal(short.questions.length, 2, 'fewer than count available: serve what there is');
  assert.equal(short.freshCount, 2);
  const empty = sb.pickSet({ due: [], fresh: [], count: 5, seed: 1 });
  assert.deepEqual(empty, { questions: [], dueCount: 0, freshCount: 0 });
  const def = sb.pickSet({ due: [q('d1')], fresh: [q('f1'), q('f2'), q('f3'), q('f4'), q('f5'), q('f6')] });
  assert.equal(def.questions.length, 5, 'count defaults to 5');
});

test('server-bank: nextStatus — correct masters, wrong goes due, whatever it was', () => {
  for (const was of ['served', 'due', 'mastered', undefined]) {
    assert.equal(sb.nextStatus({ was, correct: true }), 'mastered', 'correct masters from ' + was);
    assert.equal(sb.nextStatus({ was, correct: false }), 'due', 'wrong goes due from ' + was);
  }
  assert.equal(sb.nextStatus({}), 'due', 'no report is not a pass');
});

test('server-bank: constants — one pilot topic, five-question sets', () => {
  assert.equal(sb.SB_TOPIC, 'math-ntuc');
  assert.equal(sb.SB_COUNT, 5);
  assert.deepEqual(sb.SB_SERVABLE_KINDS, ['quest', 'fresh']);
});
