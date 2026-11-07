// Live-generated questions — CLIENT mirror tests.
// Extracts the client validator / cache / quest-list functions from
// public/index.html and runs the SAME fixture matrix as the server
// tests, so the two copies cannot drift apart silently. Also covers
// caching (same day = same set, resume does not regenerate), the
// questListFor live branch, and the fetch fallback paths (stubbed
// fetch; the hanging-fetch timeout is forced with an immediate
// setTimeout stub so the test stays fast).
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
// code (questListFor is followed by the inserted snippet's var lines;
// liveGenExperimentHTML by `var cur=...`), the next-function heuristic
// swallows trailing statements and the eval breaks.
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

// Fixtures shared with live-gen.test.js (same sets, same verdicts).
const GOOD = [
  { q: 'Eggs come in trays of 12. You buy 4 trays. How many eggs in all?', o: ['36', '44', '48', '52'], a: 2, c: '12 x 4 = 48. Count in twelves!' },
  { q: 'One bottle of juice costs $3.50. How much do 3 bottles cost?', o: ['$9.50', '$10.50', '$10.00', '$11.50'], a: 1, c: '3 x $3.50 = $10.50.' },
  { q: 'There are 56 stickers shared equally among 7 friends. How many stickers does each friend get?', o: ['6', '7', '8', '9'], a: 2, c: '56 ÷ 7 = 8, because 7 x 8 = 56.' },
  { q: 'Mei buys 5 packs of pens at $4 each and a notebook for $7. How much does she spend in all?', o: ['$27', '$31', '$25', '$35'], a: 0, c: '5 x $4 = $20, then $20 + $7 = $27.' },
  { q: 'A baker packs 72 muffins into boxes of 9. How many boxes does he fill?', o: ['7', '8', '9', '6'], a: 1, c: '72 ÷ 9 = 8, because 9 x 8 = 72.' },
];
const FLAWED = [
  { q: 'There are 7 shelves with 8 cans each. How many cans in all?', o: ['48', '54', '56', '64'], a: 0, c: '7 x 8 = 56.' },
  { q: 'Estimate: 48 × 5 is closest to…', o: ['200', '250', '300', '150'], a: 1, c: '48 is about 50, and 50 x 5 = 250.' },
  { q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.' },
  { q: 'There are 7 boxes with 8 pencils in each box. How many pencils in all?', o: ['55', '56', '57', '54'], a: 1, c: '7 x 8 = 56. Count in eights!' },
  { q: 'Lily has 30 stickers. She gives 6 stickers to each of her 5 friends. How many stickers does each friend get?', o: ['5', '6', '7', '4'], a: 1, c: '30 ÷ 5 = 6. Share equally!' },
];
const BANK_STEMS = ['apples come in bags of 6 you buy 4 bags how many apples', 'estimate 48 5 is closest to'];

function clientEngine() {
  const LIVE_GEN_TOPIC = 'math-ntuc';
  const LIVE_GEN_COUNT = 5;
  var liveGenFetchState = { status: 'idle', reason: null };
  var liveGenFetchPromise = null;
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
  const liveGenNormStem = eval('(' + fnText('function liveGenNormStem(s){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenOptNum = eval('(' + fnText('function liveGenOptNum(o){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenNumbers = eval('(' + fnText('function liveGenNumbers(stem){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenApply = eval('(' + fnText('function liveGenApply(a,op,b){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenRecompute = eval('(' + fnText('function liveGenRecompute(stem, answer){') + ')'); // eslint-disable-line no-unused-vars
  const validateLiveGenClient = eval('(' + fnText('function validateLiveGenClient(questions, bankStems){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenCacheKey = eval('(' + fnText('function liveGenCacheKey(eid){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenStatsKey = eval('(' + fnText('function liveGenStatsKey(){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSGet = eval('(' + fnText('function liveGenLSGet(k){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenLSSet = eval('(' + fnText('function liveGenLSSet(k,v){') + ')'); // eslint-disable-line no-unused-vars
  const loadLiveGenCache = eval('(' + fnText('function loadLiveGenCache(eid, topicId){') + ')'); // eslint-disable-line no-unused-vars
  const saveLiveGenCache = eval('(' + fnText('function saveLiveGenCache(eid, topicId, day, questions){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenPick = eval('(' + fnText('function liveGenPick(cached, today){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenPickResume = eval('(' + fnText('function liveGenPickResume(cached){') + ')'); // eslint-disable-line no-unused-vars
  const loadLiveGenStats = eval('(' + fnText('function loadLiveGenStats(){') + ')'); // eslint-disable-line no-unused-vars
  const recordLiveGenStat = eval('(' + fnText('function recordLiveGenStat(kind, ms, reason){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenBankStems = eval('(' + fnText('function liveGenBankStems(t, level){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenUsable = eval('(' + fnText('function liveGenUsable(eid, topicId, level, today, allowStale){') + ')'); // eslint-disable-line no-unused-vars
  const questListFor = eval('(' + fnExact('function questListFor(t, c, level){') + ')'); // eslint-disable-line no-unused-vars
  const esc = (s) => String(s == null ? '' : s);
  const liveGenExperimentHTML = eval('(' + fnExact('function liveGenExperimentHTML(sel){') + ')'); // eslint-disable-line no-unused-vars
  // todayKey / topicById / ex are page functions the fetch path needs;
  // stub them here so fetchLiveGenQuestions can be exercised.
  const NTUC = { id: 'math-ntuc',
    quest: [
      { q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.' },
      { q: 'One carton of milk is $2. Three cartons cost…', o: ['$5', '$6', '$7', '$23'], a: 1, c: '2 x 3.' },
    ], fresh: [], warm: [], retry: [] };
  function todayKey() { return '2026-11-07'; }
  function topicById(id) { return id === 'math-ntuc' ? NTUC : null; }
  function ex() { return { id: 'e-test-1' }; }
  const fetchLiveGenQuestions = eval('(' + fnText('function fetchLiveGenQuestions(topicId, level){') + ')'); // eslint-disable-line no-unused-vars
  return {
    liveGenNormStem, liveGenOptNum, liveGenNumbers, liveGenApply, liveGenRecompute,
    validateLiveGenClient, liveGenCacheKey, liveGenStatsKey, liveGenLSGet, liveGenLSSet,
    loadLiveGenCache, saveLiveGenCache, liveGenPick, liveGenPickResume,
    loadLiveGenStats, recordLiveGenStat, liveGenBankStems, liveGenUsable,
    questListFor, liveGenExperimentHTML, fetchLiveGenQuestions, localStorage, NTUC,
    get fetchState() { return liveGenFetchState; },
  };
}

test('live-gen client: mirror validator matches the server verdicts', () => {
  const c = clientEngine();
  assert.deepEqual(c.validateLiveGenClient(GOOD, BANK_STEMS), { ok: true, reasons: [] });
  const r = c.validateLiveGenClient(FLAWED, BANK_STEMS);
  assert.equal(r.ok, false);
  for (const want of ['q1:answer-does-not-recompute', 'q2:non-computable-type', 'q3:duplicate-of-bank', 'q4:weak-distractors', 'q5:answer-in-stem']) {
    assert.ok(r.reasons.includes(want), 'expected ' + want + ' in ' + r.reasons.join(', '));
  }
});

test('live-gen client: recompute rejects a wrong answer and accepts change problems', () => {
  const c = clientEngine();
  assert.deepEqual(c.liveGenRecompute('Mei buys 4 notebooks at $6 each and pays with $50. How much change does she get?', 26), { ok: true, value: 26 });
  assert.equal(c.liveGenRecompute('Mei buys 4 notebooks at $6 each and pays with $50. How much change does she get?', 24).reason, 'answer-ignores-numbers', '24 is the first step only — it ignores the $50');
  assert.equal(c.liveGenRecompute('Mei buys 4 notebooks at $6 each and pays with $50. How much change does she get?', 30).reason, 'answer-does-not-recompute');
  assert.equal(c.liveGenRecompute('Estimate: 48 × 5 is closest to…', 250).reason, 'non-computable-type');
});

test('live-gen client: cache — same day reuses, new day refuses, resume keeps any day', () => {
  const c = clientEngine();
  assert.equal(c.loadLiveGenCache('e-test-1', 'math-ntuc'), null);
  const rec = c.saveLiveGenCache('e-test-1', 'math-ntuc', '2026-11-07', GOOD);
  assert.equal(rec.day, '2026-11-07');
  assert.equal(rec.questions.length, 5);
  // Options were shuffled once at save time: same questions, same
  // correct values, different order is allowed — but deterministic.
  const rec2 = c.saveLiveGenCache('e-test-1', 'math-ntuc', '2026-11-07', GOOD);
  assert.deepEqual(rec2.questions, rec.questions, 'same explorer+topic+day shuffles identically');
  assert.deepEqual(c.loadLiveGenCache('e-test-1', 'math-ntuc').questions, rec.questions);
  assert.equal(c.liveGenPick(c.loadLiveGenCache('e-test-1', 'math-ntuc'), '2026-11-07').source, 'live');
  assert.equal(c.liveGenPick(c.loadLiveGenCache('e-test-1', 'math-ntuc'), '2026-11-08').source, 'bank');
  assert.equal(c.liveGenPickResume(c.loadLiveGenCache('e-test-1', 'math-ntuc')).source, 'live', 'resume keeps the set whatever the day');
  assert.equal(c.loadLiveGenCache('e-test-1', 'math-mrt'), null, 'cache is per experiment topic only');
  assert.equal(c.loadLiveGenCache('e-other', 'math-ntuc'), null, 'cache is per explorer');
});

test('live-gen client: stats count generated vs fallback', () => {
  const c = clientEngine();
  assert.deepEqual(c.loadLiveGenStats(), { generated: 0, fallback: 0, lastMs: null, lastDay: null, lastReason: null });
  c.recordLiveGenStat('generated', 3200, 'live');
  c.recordLiveGenStat('fallback', null, 'still-loading');
  const s = c.loadLiveGenStats();
  assert.equal(s.generated, 1);
  assert.equal(s.fallback, 1);
  assert.equal(s.lastMs, 3200);
  assert.equal(s.lastReason, 'still-loading');
});

test('live-gen client: questListFor plays the live set verbatim, bank otherwise', () => {
  const c = clientEngine();
  const t = { id: 'math-ntuc', quest: [{ q: 'bank1' }, { q: 'bank2' }, { q: 'bank3' }, { q: 'bank4' }, { q: 'bank5' }], fresh: [] };
  const live = GOOD.map((q) => ({ ...q }));
  assert.deepEqual(c.questListFor(t, { phase: 'quest', liveGen: live }, 3), live, 'live set returned as-is, no re-shuffle');
  assert.deepEqual(c.questListFor(t, { phase: 'quest', pool: [0, 1, 2, 3, 4] }, 3).map((q) => q.q), ['bank1', 'bank2', 'bank3', 'bank4', 'bank5']);
  const mrt = { id: 'math-mrt', quest: [{ q: 'm1' }], fresh: [] };
  assert.deepEqual(c.questListFor(mrt, { phase: 'quest', pool: [0] }, 3).map((q) => q.q), ['m1'], 'a non-experiment topic never sees a live set');
  assert.deepEqual(c.questListFor(t, { phase: 'retry', retryPool: [0] }, 3), [], 'retry without a retry bank stays empty (live set never leaks into Second Chance)');
});

test('live-gen client: fetch success caches the set; a second call reuses it without fetching', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = async (url, opts) => {
    calls++;
    assert.equal(url, '/api/generate-questions');
    const body = JSON.parse(opts.body);
    assert.equal(body.topicId, 'math-ntuc');
    assert.ok(Array.isArray(body.bankStems) && body.bankStems.length > 0, 'bank stems are sent for server dedupe');
    return { ok: true, json: async () => ({ live: true, questions: GOOD, generatedMs: 2400 }) };
  };
  try {
    const first = await c.fetchLiveGenQuestions('math-ntuc', 3);
    assert.equal(calls, 1);
    assert.equal(first.length, 5);
    assert.equal(c.loadLiveGenStats().generated, 1);
    const second = await c.fetchLiveGenQuestions('math-ntuc', 3);
    assert.equal(calls, 1, 'second call reuses today’s cached set');
    assert.deepEqual(second, first);
    // A non-experiment topic never fetches at all.
    assert.equal(await c.fetchLiveGenQuestions('math-mrt', 3), null);
    assert.equal(calls, 1);
  } finally { global.fetch = origFetch; }
});

test('live-gen client: fetch failure and timeout fall back to null (bank)', async () => {
  const c = clientEngine();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 502 });
  try {
    assert.equal(await c.fetchLiveGenQuestions('math-ntuc', 3), null);
    assert.equal(c.fetchState.status, 'failed');
    assert.equal(c.loadLiveGenCache('e-test-1', 'math-ntuc'), null, 'nothing cached on failure');
  } finally { global.fetch = origFetch; }
  // Hanging fetch: force every timer to fire at once so the 25s
  // hard race resolves immediately instead of in 25 real seconds.
  const c2 = clientEngine();
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { fn(); return 0; };
  global.fetch = async () => new Promise(() => {});
  try {
    assert.equal(await c2.fetchLiveGenQuestions('math-ntuc', 3), null);
    assert.equal(c2.fetchState.status, 'failed');
  } finally { global.fetch = origFetch; global.setTimeout = origSetTimeout; }
});

test('live-gen client: page wiring — tag, experiment topic, parent card', () => {
  assert.ok(html.includes("LIVE_GEN_TOPIC='math-ntuc'"), 'experiment topic constant in page');
  assert.ok(html.includes('✨ Fresh from Pip'), 'live tag shown on the experiment quest');
  assert.ok(html.includes('liveGenExperimentHTML(sel)'), 'parent page shows the experiment card');
  assert.ok(html.includes("t.id===LIVE_GEN_TOPIC?'"), 'Learn card carries the experiment note for the topic only');
  assert.ok(html.includes('/api/generate-questions'), 'client calls the new endpoint');
  assert.ok(!html.includes('MODEL_API_KEY'), 'no model key anywhere in client code');
  const c = clientEngine();
  const card = c.liveGenExperimentHTML({ name: 'Test' });
  assert.match(card, /NTUC Totals only/);
  assert.match(card, /No live questions generated on this device yet/);
});
