// Server bank — ALL TOPICS (gate lift, 2026-11-09).
// daily-set + report-answers serve ANY topic (not just the pilot
// math-ntuc), the client fetches the server bank for every topic, and
// the per-day cache is per topic. The pilot topic works exactly as
// before. Supabase is mocked (no live keys, no network).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// ---------------------------------------------------------------- API harness
function mockRes() {
  const r = { statusCode: 200, body: undefined };
  r.status = (code) => { r.statusCode = code; return r; };
  r.setHeader = () => {};
  r.json = (body) => { r.body = body; };
  return r;
}
function mockReq(method, body) { return { method, body, headers: {} }; }
function loadHandler(name) {
  const file = path.join(root, 'api', name + '.js');
  delete require.cache[require.resolve(file)];
  return require(file);
}
function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'secret-test-key';
}
function clearEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
}

// Servable pool rows for one topic+level (all kind 'quest').
function mkRows(ids) {
  return ids.map((id, i) => ({
    id,
    stem: 'Question number ' + (i + 1) + ' for testing here',
    options: ['alpha option', 'beta option', 'gamma option', 'delta option'],
    answer: i % 4,
    explanation: 'Because testing says so',
    joke: '',
    sub_topic: 'quest',
  }));
}

// Mock fetch serving sb_questions filtered by topic+level from `bank`,
// where bank keys are 'topic|level'. Explorer-question states are
// always empty (every question is fresh); upserts echo the payload.
function topicLevelMock(bank) {
  return async (url, init) => {
    const method = (init && init.method) || 'GET';
    const pool = url.match(/sb_questions\?topic=eq\.([^&]+)&level=eq\.(\d+)/);
    if (pool) {
      const key = decodeURIComponent(pool[1]) + '|' + pool[2];
      return { ok: true, json: async () => bank[key] || [] };
    }
    if (url.indexOf('sb_questions?id=in.') >= 0) {
      const ids = url.split('id=in.(')[1].split(')')[0].split(',').map(decodeURIComponent);
      return { ok: true, json: async () => ids.map((id) => ({ id })) };
    }
    if (url.indexOf('sb_explorer_questions?') >= 0 && method !== 'POST') {
      return { ok: true, json: async () => [] };
    }
    if (url.indexOf('sb_explorer_questions?on_conflict=') >= 0 && method === 'POST') {
      return { ok: true, json: async () => JSON.parse(init.body) };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
}

test('daily-set serves a non-pilot topic when questions exist', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  const bank = {
    'eng-spelling|3': mkRows(['esp-p3-0001', 'esp-p3-0002', 'esp-p3-0003', 'esp-p3-0004', 'esp-p3-0005']),
  };
  global.fetch = topicLevelMock(bank);
  try {
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'eng-spelling', level: 3, day: '2026-11-08' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.source, 'server');
    assert.equal(res.body.topicId, 'eng-spelling');
    assert.equal(res.body.level, 3);
    assert.equal(res.body.questions.length, 5);
    assert.ok(res.body.questions.every((q) => q.id && q.q && Array.isArray(q.o) && q.o.length === 4));
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('daily-set returns the fallback (502 not-seeded) when a topic has no rows', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  global.fetch = topicLevelMock({});
  try {
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'eng-spelling', level: 3 }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'not-seeded');
    assert.equal(res.body.fallback, true, 'the client falls back to the local bank');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('daily-set level filtering: P3 gets P3 only, P4 gets P4 only', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  const bank = {
    'eng-spelling|3': mkRows(['esp-p3-0001', 'esp-p3-0002', 'esp-p3-0003', 'esp-p3-0004', 'esp-p3-0005', 'esp-p3-0006']),
    'eng-spelling|4': mkRows(['esp-p4-0001', 'esp-p4-0002', 'esp-p4-0003', 'esp-p4-0004', 'esp-p4-0005', 'esp-p4-0006']),
  };
  global.fetch = topicLevelMock(bank);
  try {
    let res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'eng-spelling', level: 3, day: '2026-11-08' }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.questions.every((q) => q.id.indexOf('esp-p3-') === 0), 'P3 request serves only P3 questions');
    assert.ok(!res.body.questions.some((q) => q.id.indexOf('esp-p4-') === 0), 'no P4 question leaks into a P3 set');
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'eng-spelling', level: 4, day: '2026-11-08' }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.questions.every((q) => q.id.indexOf('esp-p4-') === 0), 'P4 request serves only P4 questions');
    assert.ok(!res.body.questions.some((q) => q.id.indexOf('esp-p3-') === 0), 'no P3 question leaks into a P4 set');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('report-answers accepts a non-pilot topic and marks mastered/due', async () => {
  setEnv();
  const handler = loadHandler('report-answers');
  const origFetch = global.fetch;
  let captured = null;
  global.fetch = async (url, init) => {
    const method = (init && init.method) || 'GET';
    if (url.indexOf('sb_questions?id=in.') >= 0) {
      const ids = url.split('id=in.(')[1].split(')')[0].split(',').map(decodeURIComponent);
      return { ok: true, json: async () => ids.map((id) => ({ id })) };
    }
    if (url.indexOf('sb_explorer_questions?') >= 0 && method !== 'POST') return { ok: true, json: async () => [] };
    if (url.indexOf('sb_explorer_questions?on_conflict=') >= 0 && method === 'POST') {
      captured = JSON.parse(init.body);
      return { ok: true, json: async () => captured };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', {
      code: 'ABC2DE', explorerId: 'e1', topicId: 'eng-spelling',
      results: [
        { questionId: 'esp-p3-0001', correct: true },
        { questionId: 'esp-p3-0002', correct: false },
      ],
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 1, due: 1 });
    assert.equal(captured.length, 2, 'both answers were upserted');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('pilot topic still works unchanged', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  const bank = {
    'math-ntuc|3': mkRows(['ntuc-p3-0001', 'ntuc-p3-0002', 'ntuc-p3-0003', 'ntuc-p3-0004', 'ntuc-p3-0005']),
  };
  global.fetch = topicLevelMock(bank);
  try {
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', level: 3, day: '2026-11-08' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.source, 'server');
    assert.equal(res.body.topicId, 'math-ntuc');
    assert.equal(res.body.questions.length, 5);
  } finally { global.fetch = origFetch; clearEnv(); }
});

// ---------------------------------------------------------------- client harness
const src = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
function fnText(marker) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, 'marker missing: ' + marker);
  let depth = 0;
  let j = i;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(i, j);
}
function fnExact(marker) { return fnText(marker); }

// A well-shaped server-bank set for the non-pilot topic eng-spelling.
const GOOD_ESP = [
  { id: 'esp-p3-0001', q: 'Which word is spelled correctly here?', o: ['edge', 'ege', 'ejge', 'edgee'], a: 0, c: 'edge is correct', j: '', sb: true },
  { id: 'esp-p3-0002', q: 'Pick the correct spelling for the word.', o: ['muffin', 'muffen', 'muffn', 'muffyn'], a: 0, c: 'muffin is correct', j: '', sb: true },
  { id: 'esp-p3-0003', q: 'Which sentence uses "disappointed" well?', o: ['She felt disappointed today.', 'She felt disappointedly today.', 'She felt disappoint today.', 'She felt disapoint today.'], a: 0, c: 'disappointed is the adjective', j: '', sb: true },
  { id: 'esp-p3-0004', q: 'Choose the word that means "to take quickly".', o: ['snatched', 'snatchd', 'snachted', 'snached'], a: 0, c: 'snatched is correct', j: '', sb: true },
  { id: 'esp-p3-0005', q: 'Which word fits: "The ice cream ___ off the cone."', o: ['slid', 'slidd', 'slied', 'slidde'], a: 0, c: 'slid is correct', j: '', sb: true },
];
// The pilot set, reused to check the pilot cache is untouched.
const GOOD_SB = [
  { id: 'ntuc-p3-0001', q: 'A $2 bun and a $3 drink cost how much?', o: ['$4', '$5', '$6', '$3'], a: 1, c: '2+3=5', j: '', sb: true },
  { id: 'ntuc-p3-0002', q: 'A $4 snack and a $1 coin — total paid?', o: ['$5', '$4', '$6', '$3'], a: 0, c: '4+1=5', j: '', sb: true },
  { id: 'ntuc-p3-0003', q: 'You pay $5 for a $2 item. Change?', o: ['$2', '$4', '$3', '$1'], a: 2, c: '5-2=3', j: '', sb: true },
  { id: 'ntuc-p3-0004', q: 'Three $1 coins make how much?', o: ['$1', '$2', '$3', '$4'], a: 2, c: '1+1+1=3', j: '', sb: true },
  { id: 'ntuc-p3-0005', q: 'A $10 note buys two $4 toys. Left?', o: ['$0', '$2', '$4', '$1'], a: 1, c: '10-8=2', j: '', sb: true },
];

function clientEngine() {
  const SB_TOPIC = 'math-ntuc'; // eslint-disable-line no-unused-vars
  const SB_COUNT = 5;
  const LIVE_GEN_TOPIC = 'math-ntuc'; // eslint-disable-line no-unused-vars
  const LIVE_GEN_COUNT = 5; // eslint-disable-line no-unused-vars
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
  const todayKey = () => '2026-11-08';
  const ex = () => ({ id: 'e-test-1', level: 3 });
  const syncKey = () => 'ABC2DE';
  var sbFetchState = { status: 'idle', reason: null };
  var sbFetchPromise = null;
  const hashStr = eval('(' + fnText('function hashStr(s){') + ')');
  const seededShuffle = eval('(' + fnText('function seededShuffle(arr, seed){') + ')');
  const liveGenLSGet = eval('(' + fnText('function liveGenLSGet(k){') + ')');
  const liveGenLSSet = eval('(' + fnText('function liveGenLSSet(k,v){') + ')');
  const sbCacheKey = eval('(' + fnText('function sbCacheKey(eid, topicId){') + ')');
  const loadSbCache = eval('(' + fnText('function loadSbCache(eid, topicId){') + ')');
  // FIB helpers (public/index.html): sbShapeOk / saveSbCache call
  // these, so this harness must extract them too.
  const isFibQuestion = eval('(' + fnText('function isFibQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibExpected = eval('(' + fnText('function fibExpected(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibAccepts = eval('(' + fnText('function fibAccepts(q){') + ')'); // eslint-disable-line no-unused-vars
  const sbNormalizeQuestion = eval('(' + fnText('function sbNormalizeQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const sbShapeOk = eval('(' + fnText('function sbShapeOk(questions){') + ')');
  const saveSbCache = eval('(' + fnText('function saveSbCache(eid, topicId, day, questions){') + ')');
  const sbPick = eval('(' + fnText('function sbPick(cached, today){') + ')');
  const sbPickResume = eval('(' + fnText('function sbPickResume(cached){') + ')');
  const sbUsable = eval('(' + fnText('function sbUsable(eid, topicId, level, today, allowStale){') + ')');
  const reportServerBankAnswers = eval('(' + fnText('function reportServerBankAnswers(topicId, list, wrongIdx){') + ')');
  const fetchServerBankQuestions = eval('(' + fnText('function fetchServerBankQuestions(topicId, level){') + ')');
  const bankFor = eval('(' + fnText('function bankFor(t, kind, level){') + ')');
  const poolQuestions = eval('(' + fnText('function poolQuestions(t, level){') + ')');
  const optsShuffled = eval('(' + fnText('function optsShuffled(q, seed){') + ')');
  const questListFor = eval('(' + fnExact('function questListFor(t, c, level){') + ')');
  return {
    localStorage, sbCacheKey, loadSbCache, saveSbCache, sbUsable,
    reportServerBankAnswers, fetchServerBankQuestions, questListFor,
  };
}

test('client: fetchServerBankQuestions tries the server bank for a non-pilot topic', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  let calls = 0;
  let sentBody = null;
  global.fetch = async (url, opts) => {
    calls++;
    assert.equal(url, '/api/daily-set');
    sentBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ source: 'server', questions: GOOD_ESP, served: 0, due: 0, fresh: 5 }) };
  };
  try {
    const first = await c.fetchServerBankQuestions('eng-spelling', 3);
    assert.equal(calls, 1);
    assert.equal(first.length, 5);
    assert.deepEqual(sentBody, { code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'eng-spelling', level: 3, count: 5, day: '2026-11-08' });
    assert.deepEqual(c.loadSbCache('e-test-1', 'eng-spelling').questions.map((q) => q.id), GOOD_ESP.map((q) => q.id));
    const second = await c.fetchServerBankQuestions('eng-spelling', 3);
    assert.equal(calls, 1, 'second call reuses the cached set');
    assert.deepEqual(second, first);
  } finally { global.fetch = origFetch; }
});

test('client: when the server has nothing for a topic, the fetch returns null and the quest falls back to the bank', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 502 });
  try {
    assert.equal(await c.fetchServerBankQuestions('eng-spelling', 3), null);
    assert.equal(c.loadSbCache('e-test-1', 'eng-spelling'), null, 'nothing cached on failure');
    assert.equal(c.sbUsable('e-test-1', 'eng-spelling', 3, '2026-11-08', false).source, 'bank');
  } finally { global.fetch = origFetch; }
  // The quest itself then plays the local bank for that topic.
  const t = { id: 'eng-spelling', quest: [
    { q: 'bank1', o: ['a', 'b', 'c', 'd'], a: 0, c: '' },
    { q: 'bank2', o: ['a', 'b', 'c', 'd'], a: 0, c: '' },
    { q: 'bank3', o: ['a', 'b', 'c', 'd'], a: 0, c: '' },
    { q: 'bank4', o: ['a', 'b', 'c', 'd'], a: 0, c: '' },
    { q: 'bank5', o: ['a', 'b', 'c', 'd'], a: 0, c: '' },
  ], fresh: [] };
  assert.deepEqual(c.questListFor(t, { phase: 'quest', pool: [0, 1, 2, 3, 4] }, 3).map((q) => q.q), ['bank1', 'bank2', 'bank3', 'bank4', 'bank5']);
});

test('client: the pilot cache key is unchanged and caches are per topic', () => {
  const c = clientEngine();
  assert.equal(c.sbCacheKey('e-test-1', 'math-ntuc'), 'jyn-servbank-v1:e-test-1:math-ntuc', 'pilot key byte-identical to before the lift');
  assert.equal(c.sbCacheKey('e-test-1', 'eng-spelling'), 'jyn-servbank-v1:e-test-1:eng-spelling');
  assert.notEqual(c.sbCacheKey('e-test-1', 'math-ntuc'), c.sbCacheKey('e-test-1', 'eng-spelling'));
  // Saving one topic never touches another topic's slot.
  c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', GOOD_SB);
  c.saveSbCache('e-test-1', 'eng-spelling', '2026-11-08', GOOD_ESP);
  assert.deepEqual(c.loadSbCache('e-test-1', 'math-ntuc').questions.map((q) => q.id), GOOD_SB.map((q) => q.id));
  assert.deepEqual(c.loadSbCache('e-test-1', 'eng-spelling').questions.map((q) => q.id), GOOD_ESP.map((q) => q.id));
});

test('client: reportServerBankAnswers fires for a non-pilot topic', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  let captured = null;
  global.fetch = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ ok: true, mastered: 4, due: 1 }) };
  };
  try {
    c.reportServerBankAnswers('eng-spelling', GOOD_ESP, [4]);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(captured.url, '/api/report-answers');
    assert.equal(captured.body.topicId, 'eng-spelling');
    assert.deepEqual(captured.body.results, GOOD_ESP.map((q, i) => ({ questionId: q.id, correct: i !== 4 })));
  } finally { global.fetch = origFetch; }
});
