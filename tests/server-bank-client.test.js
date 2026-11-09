// Server bank — CLIENT tests.
// Extracts the server-bank client functions from public/index.html
// and exercises them the same way tests/live-gen-client.test.js
// exercises the live-gen ones: cache (same day = same set, resume
// does not re-fetch), fetch success/failure/timeout fallback, the
// fire-and-forget report, and the questListFor server branch. The
// page is the source of truth — these tests fail until the diff is
// applied, exactly like the live-gen client tests did.
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
// Brace-matching extractor: for functions followed by non-function
// code (fetchServerBankQuestions is followed by `var cur=...`), the
// next-function heuristic swallows trailing statements and the eval
// breaks.
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
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  throw new Error('no end ' + marker);
}

// Five real bank questions (from the seed) as the server returns them.
const GOOD_SB = [
  { id: 'math-ntuc-p3-0001', q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 × 4 = 24.', j: '' },
  { id: 'math-ntuc-p3-0002', q: 'One carton of milk is $2. Three cartons cost…', o: ['$5', '$6', '$7', '$23'], a: 1, c: '2 × 3.', j: '' },
  { id: 'math-ntuc-p3-0003', q: 'A basket has 36 eggs shared equally into 4 trays. Each tray has…', o: ['8 eggs', '9 eggs', '10 eggs', '12 eggs'], a: 1, c: '36 ÷ 4 = 9.', j: '' },
  { id: 'math-ntuc-p3-0004', q: 'Bread $1.80 + jam $3.20 = ?', o: ['$4.80', '$5.00', '$5.20', '$4.00'], a: 1, c: '80 + 20 cents = $1.', j: '' },
  { id: 'math-ntuc-p3-0005', q: 'There are 7 shelves with 8 cans each. Total cans?', o: ['48', '54', '56', '64'], a: 2, c: '7 × 8 = 56.', j: '' },
];

function clientEngine() {
  const SB_TOPIC = 'math-ntuc';
  const SB_COUNT = 5;
  // questListFor's live branch also reads the live-gen constants.
  const LIVE_GEN_TOPIC = 'math-ntuc';
  const LIVE_GEN_COUNT = 5;
  var sbFetchState = { status: 'idle', reason: null };
  var sbFetchPromise = null;
  var localStorage = {
    store: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
    setItem(k, v) { this.store[k] = String(v); },
  };
  const hashStr = eval('(' + fnText('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
  const seededShuffle = eval('(' + fnText('function seededShuffle(') + ')'); // eslint-disable-line no-unused-vars
  const bankFor = eval('(' + fnText('function bankFor(t, kind, level){') + ')'); // eslint-disable-line no-unused-vars
  const poolQuestions = eval('(' + fnText('function poolQuestions(t,') + ')'); // eslint-disable-line no-unused-vars
  const optsShuffled = eval('(' + fnText('function optsShuffled(q, seed){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSGet = eval('(' + fnText('function liveGenLSGet(k){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSSet = eval('(' + fnText('function liveGenLSSet(k,v){') + ')'); // eslint-disable-line no-unused-vars
  // FIB helpers (public/index.html): sbShapeOk / saveSbCache call
  // these, so this harness must extract them too.
  const isFibQuestion = eval('(' + fnText('function isFibQuestion(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibExpected = eval('(' + fnText('function fibExpected(q){') + ')'); // eslint-disable-line no-unused-vars
  const fibAccepts = eval('(' + fnText('function fibAccepts(q){') + ')'); // eslint-disable-line no-unused-vars
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
  // todayKey / topicById / ex / syncKey are page functions the fetch
  // and report paths need; stub them here so they can be exercised.
  const NTUC = { id: 'math-ntuc',
    quest: [
      { q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.' },
      { q: 'One carton of milk is $2. Three cartons cost…', o: ['$5', '$6', '$7', '$23'], a: 1, c: '2 x 3.' },
    ], fresh: [], warm: [], retry: [] };
  function todayKey() { return '2026-11-08'; }
  function topicById(id) { return id === 'math-ntuc' ? NTUC : null; }
  function ex() { return { id: 'e-test-1' }; }
  function syncKey() { return 'ABC2DE'; }
  const fetchServerBankQuestions = eval('(' + fnExact('function fetchServerBankQuestions(topicId, level){') + ')'); // eslint-disable-line no-unused-vars
  return {
    sbCacheKey, loadSbCache, sbShapeOk, saveSbCache, sbPick, sbPickResume,
    sbUsable, fetchServerBankQuestions, reportServerBankAnswers,
    questListFor, localStorage, NTUC,
    get fetchState() { return sbFetchState; },
  };
}

test('server-bank client: cache — same day reuses, new day refuses, resume keeps any day', () => {
  const c = clientEngine();
  assert.equal(c.loadSbCache('e-test-1', 'math-ntuc'), null);
  const rec = c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', GOOD_SB);
  assert.equal(rec.day, '2026-11-08');
  assert.equal(rec.questions.length, 5);
  // Options were shuffled once at save time; the server ids ride
  // along — without them the report call would have nothing to send.
  assert.deepEqual(rec.questions.map((q) => q.id), GOOD_SB.map((q) => q.id), 'ids survive the option shuffle');
  assert.deepEqual(rec.questions.map((q) => q.o[q.a]), GOOD_SB.map((q) => q.o[q.a]), 'the shuffled options still point at the right answers');
  const rec2 = c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', GOOD_SB);
  assert.deepEqual(rec2.questions, rec.questions, 'same explorer+topic+day shuffles identically');
  assert.deepEqual(c.loadSbCache('e-test-1', 'math-ntuc').questions, rec.questions);
  assert.equal(c.sbPick(c.loadSbCache('e-test-1', 'math-ntuc'), '2026-11-08').source, 'server');
  assert.equal(c.sbPick(c.loadSbCache('e-test-1', 'math-ntuc'), '2026-11-09').source, 'bank');
  assert.equal(c.sbPickResume(c.loadSbCache('e-test-1', 'math-ntuc')).source, 'server', 'resume keeps the set whatever the day');
  // The cache is per topic: a set saved for one topic never leaks into another.
  const mrtRec = c.saveSbCache('e-test-1', 'math-mrt', '2026-11-08', GOOD_SB);
  assert.equal(mrtRec.topicId, 'math-mrt');
  assert.deepEqual(c.loadSbCache('e-test-1', 'math-mrt').questions.map((q) => q.id), GOOD_SB.map((q) => q.id));
  assert.deepEqual(c.loadSbCache('e-test-1', 'math-ntuc').questions.map((q) => q.id), GOOD_SB.map((q) => q.id), 'saving another topic does not clobber the pilot set');
  assert.equal(c.loadSbCache('e-test-1', 'eng-spelling'), null, 'no cache for a topic never saved');
  assert.equal(c.loadSbCache('e-other', 'math-ntuc'), null, 'cache is per explorer');
  assert.equal(c.sbUsable('e-test-1', 'math-ntuc', 3, '2026-11-08', false).source, 'server');
  assert.equal(c.sbUsable('e-test-1', 'math-ntuc', 3, '2026-11-09', false).source, 'bank');
});

test('server-bank client: shape check — ids required, 5 questions, 4 options, valid index', () => {
  const c = clientEngine();
  assert.equal(c.sbShapeOk(GOOD_SB), true);
  assert.equal(c.sbShapeOk(GOOD_SB.slice(0, 4)), false, 'a set must have 5');
  assert.equal(c.sbShapeOk(GOOD_SB.map((q, i) => (i === 0 ? { ...q, id: '' } : q))), false, 'every question needs its server id');
  assert.equal(c.sbShapeOk(GOOD_SB.map((q, i) => (i === 0 ? { ...q, o: ['1', '2', '3'] } : q))), false, '4 options');
  assert.equal(c.sbShapeOk(GOOD_SB.map((q, i) => (i === 0 ? { ...q, a: 4 } : q))), false, 'answer index 0-3');
  assert.equal(c.sbShapeOk(GOOD_SB.map((q, i) => (i === 0 ? { ...q, q: 'short?' } : q))), false, 'stem must be a real question');
  // A bank-shaped question WITHOUT an id is not a server set.
  assert.equal(c.sbShapeOk(GOOD_SB.map((q) => ({ q: q.q, o: q.o, a: q.a, c: q.c, j: q.j }))), false);
  // A corrupt cache is unusable, never played.
  c.saveSbCache('e-test-1', 'math-ntuc', '2026-11-08', GOOD_SB);
  c.localStorage.setItem(c.sbCacheKey('e-test-1', 'math-ntuc'), JSON.stringify({ topicId: 'math-ntuc', day: '2026-11-08', questions: GOOD_SB.slice(0, 3) }));
  assert.equal(c.sbUsable('e-test-1', 'math-ntuc', 3, '2026-11-08', false).source, 'bank');
});

test('server-bank client: fetch success caches the set; a second call reuses it without fetching', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  let calls = 0;
  let sentBody = null;
  global.fetch = async (url, opts) => {
    calls++;
    assert.equal(url, '/api/daily-set');
    sentBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ source: 'server', questions: GOOD_SB, served: 0, due: 0, fresh: 5 }) };
  };
  try {
    const first = await c.fetchServerBankQuestions('math-ntuc', 3);
    assert.equal(calls, 1);
    assert.equal(first.length, 5);
    assert.deepEqual(sentBody, { code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc', level: 3, count: 5, day: '2026-11-08' }, 'the fetch sends code + explorer id, never a name');
    assert.deepEqual(c.loadSbCache('e-test-1', 'math-ntuc').questions.map((q) => q.id), GOOD_SB.map((q) => q.id));
    const second = await c.fetchServerBankQuestions('math-ntuc', 3);
    assert.equal(calls, 1, 'second call reuses today’s cached set');
    assert.deepEqual(second, first);
    // A non-pilot topic fetches the same way and caches under its own key.
    const mrt = await c.fetchServerBankQuestions('math-mrt', 3);
    assert.equal(calls, 2, 'a non-pilot topic now fetches the server bank too');
    assert.equal(mrt.length, 5);
    assert.deepEqual(c.loadSbCache('e-test-1', 'math-mrt').questions.map((q) => q.id), GOOD_SB.map((q) => q.id));
    assert.deepEqual(c.loadSbCache('e-test-1', 'math-ntuc').questions.map((q) => q.id), GOOD_SB.map((q) => q.id), 'the pilot cache is untouched');
  } finally { global.fetch = origFetch; }
});

test('server-bank client: fetch failure and timeout fall back to null (bank)', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 502 });
  try {
    assert.equal(await c.fetchServerBankQuestions('math-ntuc', 3), null);
    assert.equal(c.fetchState.status, 'failed');
    assert.equal(c.fetchState.reason, 'daily-set-failed');
    assert.equal(c.loadSbCache('e-test-1', 'math-ntuc'), null, 'nothing cached on failure');
  } finally { global.fetch = origFetch; }
  // A non-server reply (e.g. a bank fallback body) is also a miss.
  const c2 = clientEngine();
  global.fetch = async () => ({ ok: true, json: async () => ({ source: 'bank', questions: [] }) });
  try {
    assert.equal(await c2.fetchServerBankQuestions('math-ntuc', 3), null);
  } finally { global.fetch = origFetch; }
  // Hanging fetch: force every timer to fire at once so the 25s
  // hard race resolves immediately instead of in 25 real seconds.
  const c3 = clientEngine();
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { fn(); return 0; };
  global.fetch = async () => new Promise(() => {});
  try {
    assert.equal(await c3.fetchServerBankQuestions('math-ntuc', 3), null);
    assert.equal(c3.fetchState.status, 'failed');
    assert.equal(c3.fetchState.reason, 'timeout-or-fetch-failed');
  } finally { global.fetch = origFetch; global.setTimeout = origSetTimeout; }
});

test('server-bank client: report fires on finish with per-question results, and never blocks', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  let captured = null;
  global.fetch = async (url, opts) => {
    captured = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ ok: true, mastered: 3, due: 2 }) };
  };
  try {
    // Wrong indices 1 and 3: those two are reported due, the rest mastered.
    c.reportServerBankAnswers('math-ntuc', GOOD_SB, [1, 3]);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(captured.url, '/api/report-answers');
    assert.deepEqual(captured.body, {
      code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc',
      results: GOOD_SB.map((q, i) => ({ questionId: q.id, correct: [1, 3].indexOf(i) < 0 })),
    });
  } finally { global.fetch = origFetch; }
  // A dead report endpoint must never throw into the quest flow.
  global.fetch = async () => { throw new Error('network down'); };
  try {
    assert.doesNotThrow(() => c.reportServerBankAnswers('math-ntuc', GOOD_SB, []));
    await new Promise((r) => setTimeout(r, 0));
  } finally { global.fetch = origFetch; }
  // No ids, no call: a bank/live set has nothing to report.
  let calls = 0;
  global.fetch = async () => { calls++; return { ok: true, json: async () => ({}) }; };
  try {
    c.reportServerBankAnswers('math-ntuc', GOOD_SB.map((q) => ({ q: q.q, o: q.o, a: q.a, c: q.c, j: q.j })), []);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls, 0, 'a set without server ids reports nothing');
    // A non-pilot topic reports the same way now (no pilot gate).
    c.reportServerBankAnswers('math-mrt', GOOD_SB, []);
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(calls, 1, 'a non-pilot topic reports its answers too');
  } finally { global.fetch = origFetch; }
});

test('server-bank client: questListFor plays the server set verbatim, bank otherwise', () => {
  const c = clientEngine();
  const t = { id: 'math-ntuc', quest: [{ q: 'bank1' }, { q: 'bank2' }, { q: 'bank3' }, { q: 'bank4' }, { q: 'bank5' }], fresh: [] };
  const server = GOOD_SB.map((q) => ({ ...q }));
  assert.deepEqual(c.questListFor(t, { phase: 'quest', liveGen: server }, 3), server, 'server set returned as-is, no re-shuffle');
  assert.deepEqual(c.questListFor(t, { phase: 'quest', pool: [0, 1, 2, 3, 4] }, 3).map((q) => q.q), ['bank1', 'bank2', 'bank3', 'bank4', 'bank5']);
});

test('server-bank client: page wiring — topic, distinct tag, endpoints, no Supabase key', () => {
  assert.ok(html.includes("var SB_TOPIC='math-ntuc'"), 'pilot topic constant in page');
  assert.ok(html.includes("📚 Pip’s shelf"), 'server sets carry their own tag, distinct from live-gen');
  assert.ok(html.includes("liveGenSource==='server'"), 'tag branches on the server source');
  assert.ok(html.includes("✨ Fresh from Pip"), 'live-gen tag is unchanged');
  assert.ok(html.includes('/api/daily-set'), 'client calls the daily-set endpoint');
  assert.ok(html.includes('/api/report-answers'), 'client reports answers on finish');
  assert.ok(!html.includes('SUPABASE_SECRET_KEY'), 'no Supabase secret anywhere in client code');
  assert.ok(!html.includes('NEXT_PUBLIC_SUPABASE_URL'), 'no Supabase URL in client code either');
});
