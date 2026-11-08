// Maths boost + live-gen (2026-11-08, Bryan approved): when a Maths
// topic flags, the boost drill tries 5 live-made questions modelled
// on the exact question she missed (same skill, easier first). The
// set must pass the same recompute validator as the quest flow; ANY
// failure falls back silently to the bank cousins. A Maths drill may
// be retaken the same day until it clears (4/5); other subjects keep
// one drill per topic per day; stars stay once per day either way.
// Covers: the new rules in lib/rules.js, the boost prompt + endpoint
// gate, the client fetch + fallback, the start gate, the finish
// recording (source + tries), the merge, and the results/parent copy.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = require('../lib/rules.js');
const liveGen = require('../lib/live-gen');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const TODAY = '2026-11-08';
const YESTERDAY = '2026-11-07';

function Q(q, o, a, c, j) { return { q, o, a, c, j }; }
function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in public/index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
// Brace-matching extractor, string/comment aware (same idea as
// tests/live-gen-client.test.js): for functions followed by
// non-function code, the next-function heuristic swallows trailing
// statements and the eval breaks.
function fnExact(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in public/index.html');
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
function bankStemsFor(id) {
  const t = TOPICS.find((x) => x.id === id);
  return [...t.quest, ...(t.p4quest || []), ...(FRESH[id] || []), ...(t.p4fresh || []), ...t.warm, ...t.retry].map((q) => q.q);
}
const MRT_STEMS = bankStemsFor('math-mrt');
const HAWKER_STEMS = bankStemsFor('math-hawker');
const NTUC_STEMS = bankStemsFor('math-ntuc');
const FRAC_STEMS = bankStemsFor('math-frac');

// --- Fixtures -------------------------------------------------------
// A valid 5-question MRT set (checked against the REAL MRT bank:
// none of these stems is in it, every answer recomputes).
const GOOD_MRT = [
  { q: 'A train stops at 8 stations. Each station has 6 benches. How many benches in all?', o: ['42', '48', '54', '14'], a: 1, c: '8 x 6 = 48.' },
  { q: 'Mei rides 9 stops to school and 9 stops home. How many stops does she ride in all?', o: ['16', '18', '20', '27'], a: 1, c: '9 + 9 = 18.' },
  { q: 'There are 48 passengers. They sit 6 to a row. How many rows are there?', o: ['7', '8', '9', '6'], a: 1, c: '48 ÷ 6 = 8.' },
  { q: 'Ben counts 7 carriages. Each carriage has 5 windows. How many windows in all?', o: ['30', '35', '40', '12'], a: 1, c: '7 x 5 = 35.' },
  { q: 'A platform has 5 benches with 4 people on each bench. How many people in all?', o: ['16', '20', '24', '9'], a: 1, c: '5 x 4 = 20.' },
];
// The missed question the boost models on: a real MRT retry-bank
// question (12 stations, then 15 more — distinct from the bank's
// 14+9, 11+13 and 12+8 station questions).
const MODEL_MRT = { q: 'The train travels 12 stations, then 15 more. How many stations in all?', o: ['25', '27', '29', '17'], a: 1, c: '12 + 15.' };
// One distinct failure per question (same shapes as live-gen.test.js).
const FLAWED = [
  { q: 'There are 7 shelves with 8 cans each. How many cans in all?', o: ['48', '54', '56', '64'], a: 0, c: '7 x 8 = 56.' },
  { q: 'Estimate: 48 × 5 is closest to…', o: ['200', '250', '300', '150'], a: 1, c: '48 is about 50, and 50 x 5 = 250.' },
  { q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.' },
  { q: 'There are 7 boxes with 8 pencils in each box. How many pencils in all?', o: ['55', '56', '57', '54'], a: 1, c: '7 x 8 = 56. Count in eights!' },
  { q: 'Lily has 30 stickers. She gives 6 stickers to each of her 5 friends. How many stickers does each friend get?', o: ['5', '6', '7', '4'], a: 1, c: '30 ÷ 5 = 6. Share equally!' },
];

test('maths boost: the MRT fixture set is valid against the real MRT bank', () => {
  assert.ok(MRT_STEMS.length > 20, 'real MRT bank has stems to check against, got ' + MRT_STEMS.length);
  assert.deepEqual(liveGen.validateLiveGenSet(GOOD_MRT, MRT_STEMS), { ok: true, reasons: [] });
});

/* --- lib/rules.js: retake + tries rules ---------------------------- */
test('rules: Maths may retake the same day; other subjects get one drill a day', () => {
  assert.equal(R.boostRetakeAllowed(true, TODAY, TODAY), true, 'Maths retake allowed even after a drill today');
  assert.equal(R.boostRetakeAllowed(true, null, TODAY), true, 'Maths first drill allowed');
  assert.equal(R.boostRetakeAllowed(false, TODAY, TODAY), false, 'non-Maths second drill today refused');
  assert.equal(R.boostRetakeAllowed(false, YESTERDAY, TODAY), true, 'non-Maths drill allowed on a new day');
  assert.equal(R.boostRetakeAllowed(false, null, TODAY), true, 'non-Maths first drill allowed');
  assert.equal(R.boostRetakeAllowed(false, undefined, TODAY), true, 'no lastBoost yet means allowed');
});

test('rules: boostTriesToday counts only drills finished today', () => {
  assert.equal(R.boostTriesToday(null, TODAY), 0, 'no record yet');
  assert.equal(R.boostTriesToday({}, TODAY), 0, 'no counter yet');
  assert.equal(R.boostTriesToday({ triesDay: YESTERDAY, tries: 2 }, TODAY), 0, "yesterday's count does not carry over");
  assert.equal(R.boostTriesToday({ triesDay: TODAY, tries: 2 }, TODAY), 2, 'two drills finished today');
  assert.equal(R.boostTriesToday({ triesDay: TODAY }, TODAY), 0, 'day stamped but no count yet');
});

/* --- lib/live-gen.js: boost prompt ---------------------------------- */
test('live-gen: boost prompt names the model question, the skill and easier-first', () => {
  const p = liveGen.buildLiveGenBoostPrompt('math-mrt', 3, 5, [], MODEL_MRT);
  assert.match(p, /MRT Numbers/);
  assert.match(p, /The train travels 12 stations/);
  assert.match(p, /27/);
  assert.match(p, /SAME skill/);
  assert.match(p, /EASIER first/);
  assert.match(p, /JSON ONLY/);
  assert.match(p, /exactly 5 questions/);
  assert.match(p, /at most two steps/);
  assert.match(p, /NEVER write estimation/);
  assert.match(p, /must NOT appear as a number/);
  assert.match(p, /plain number/);
  const p4 = liveGen.buildLiveGenBoostPrompt('math-mrt', 4, 5, [], MODEL_MRT);
  assert.match(p4, /Primary 4/);
  const fr = liveGen.buildLiveGenBoostPrompt('math-frac', 3, 5, [], { q: 'Half of 16 muffins is…', a: '8' });
  assert.match(fr, /Fractions Feast/);
  assert.match(fr, /never a fraction like 1\/4/);
  assert.match(fr, /Half of 16 muffins/);
});

test('live-gen: the quest prompt is untouched by the boost builder', () => {
  const p = liveGen.buildLiveGenPrompt('NTUC Totals', 3, 5, []);
  assert.ok(p.indexOf('EASIER first') < 0, 'no model section in the quest prompt');
  assert.ok(p.indexOf('MODEL QUESTION') < 0, 'no model section in the quest prompt');
  assert.match(p, /NTUC Totals/);
  assert.deepEqual(liveGen.LIVE_GEN_BOOST_TOPICS, ['math-mrt', 'math-hawker', 'math-ntuc', 'math-frac']);
});

/* --- api/generate-questions.js: boost mode (mocked model) ----------- */
function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function mockReq(method, body) { return { method, body }; }
function loadHandler() {
  delete require.cache[require.resolve('../api/generate-questions')];
  return require('../api/generate-questions');
}

test('boost api: math-mrt + modelOn returns a live set; the prompt carries the model', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let sent = null;
  global.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD_MRT }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, day: TODAY, bankStems: MRT_STEMS, examples: [], modelOn: MODEL_MRT }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.live, true);
    assert.equal(res.body.validated, true);
    assert.equal(res.body.topicId, 'math-mrt');
    assert.deepEqual(res.body.questions, GOOD_MRT);
    assert.equal(res.body.attempts, 1);
    assert.match(sent.messages[0].content, /MRT Numbers/);
    assert.match(sent.messages[0].content, /The train travels 12 stations/);
    assert.match(sent.messages[0].content, /EASIER first/);
    assert.match(sent.messages[0].content, /JSON ONLY/);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('boost api: all four Maths topics may generate in boost mode', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD_MRT }) } }] }) });
  try {
    for (const [topicId, stems] of [['math-mrt', MRT_STEMS], ['math-hawker', HAWKER_STEMS], ['math-ntuc', NTUC_STEMS], ['math-frac', FRAC_STEMS]]) {
      const res = mockRes();
      await handler(mockReq('POST', { topicId, level: 3, day: TODAY, bankStems: stems, modelOn: MODEL_MRT }), res);
      assert.equal(res.statusCode, 200, topicId + ' generates in boost mode');
      assert.equal(res.body.live, true);
    }
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('boost api: modelOn with a string answer (live-made missed question) works', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let sent = null;
  global.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD_MRT }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, day: TODAY, bankStems: MRT_STEMS, modelOn: { q: 'The train travels 12 stations, then 15 more. How many stations in all?', a: '27' } }), res);
    assert.equal(res.statusCode, 200, 'a text answer is accepted when the missed question was itself live-made');
    assert.match(sent.messages[0].content, /Answer: 27/);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('boost api: non-Maths topic, malformed modelOn, and quest-mode gate stay shut', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD_MRT }) } }] }) });
  try {
    let res = mockRes();
    await handler(mockReq('POST', { topicId: 'eng-tense', level: 3, bankStems: MRT_STEMS, modelOn: MODEL_MRT }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'boost_maths_only');
    assert.equal(res.body.fallback, true);
    res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, bankStems: MRT_STEMS, modelOn: {} }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'bad modelOn');
    res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, bankStems: MRT_STEMS, modelOn: { q: 'x', o: ['1', '2', '3', '4'], a: 9 } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'bad modelOn');
    // Quest mode is untouched: math-mrt without modelOn is still refused.
    res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, bankStems: MRT_STEMS }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'experiment_topic_only');
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('boost api: a rejected set retries with the reasons fed back, then succeeds', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let calls = 0;
  const prompts = [];
  global.fetch = async (_url, init) => {
    calls++;
    prompts.push(JSON.parse(init.body).messages[0].content);
    const set = calls === 1 ? FLAWED : GOOD_MRT;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: set }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, day: TODAY, bankStems: MRT_STEMS, modelOn: MODEL_MRT }), res);
    assert.equal(calls, 2, 'one retry after the rejected set');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.attempts, 2);
    assert.match(prompts[1], /rejected for/);
    assert.match(prompts[1], /EASIER first/, 'the retry keeps the boost brief');
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('boost api: a failed model call still falls back (502, never a crash)', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = async () => { throw new Error('model down'); };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, day: TODAY, bankStems: MRT_STEMS, modelOn: MODEL_MRT }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.fallback, true);
    assert.equal(res.body.error, 'model_api_unreachable');
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

/* --- Page mirrors of the rules (eval'd from public/index.html) ------ */
const pageRetakeAllowed = eval('(' + fnExact('function boostRetakeAllowed(isMaths, lastBoostDay, today){') + ')');
const pageTriesToday = eval('(' + fnExact('function boostTriesToday(rec, today){') + ')');

test('client mirror: page boostRetakeAllowed / boostTriesToday match lib/rules.js', () => {
  for (const [isMaths, day, today] of [[true, TODAY, TODAY], [false, TODAY, TODAY], [false, YESTERDAY, TODAY], [false, null, TODAY]]) {
    assert.equal(pageRetakeAllowed(isMaths, day, today), R.boostRetakeAllowed(isMaths, day, today));
  }
  for (const rec of [null, {}, { triesDay: YESTERDAY, tries: 2 }, { triesDay: TODAY, tries: 2 }, { triesDay: TODAY }]) {
    assert.equal(pageTriesToday(rec, TODAY), R.boostTriesToday(rec, TODAY));
  }
});

/* --- boostListFor: attempt seeds a different same-day set ----------- */
function mkQ(prefix, i) {
  return { q: prefix + ' question ' + i + '?', o: ['A' + i, 'B' + i, 'C' + i, 'D' + i], a: 0, c: 'Clue for ' + prefix + ' ' + i, j: 'Why ' + prefix + ' ' + i };
}
const MRT_TOPIC = {
  id: 'math-mrt', sub: 'math', subName: 'Maths', name: 'MRT Numbers',
  quest: [0, 1, 2, 3, 4].map((i) => mkQ('quest', i)),
  fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('fresh', i)),
  warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('warm', i)),
  retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('retry', i)),
};
const ENG_TOPIC = {
  id: 'eng-tense', sub: 'eng', subName: 'English', name: 'Tenses Trek',
  quest: [0, 1, 2, 3, 4].map((i) => mkQ('quest', i)),
  fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('fresh', i)),
  warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('warm', i)),
  retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('retry', i)),
};
const boostListFor = eval([
  fnExact('function bankFor(t, kind, level){'),
  fnExact('function hashStr(s){'),
  fnExact('function seededShuffle('),
  fnExact('function boostListFor('),
].join('\n') + '\n; boostListFor;');

test('boost drill: attempt 0 is the old draw; a retake draws a different set', () => {
  const first = boostListFor(MRT_TOPIC, 3, 'e1', TODAY);
  const again = boostListFor(MRT_TOPIC, 3, 'e1', TODAY);
  assert.deepEqual(first, again, 'same day + topic + explorer still gives the same first drill');
  assert.deepEqual(first, boostListFor(MRT_TOPIC, 3, 'e1', TODAY, 0), 'attempt 0 is exactly the old draw');
  const second = boostListFor(MRT_TOPIC, 3, 'e1', TODAY, 1);
  assert.equal(second.length, 5, 'a retake still has 5 questions');
  assert.notDeepEqual(second, first, 'a retake draws different questions, not the same five from memory');
  assert.ok(second.slice(0, 3).every((q) => MRT_TOPIC.retry.indexOf(q) >= 0), 'retake still leads with retry cousins');
  assert.ok(second.slice(3).every((q) => MRT_TOPIC.fresh.indexOf(q) >= 0), 'retake still ends with fresh');
  assert.equal(new Set(second.map((q) => q.q)).size, 5, 'no repeats inside the retake');
  assert.deepEqual(boostListFor(MRT_TOPIC, 3, 'e1', TODAY, 1), second, 'same attempt is deterministic');
});

/* --- fetchBoostLiveQuestions: client fetch + silent fallback --------- */
function boostClient() {
  const LIVE_GEN_COUNT = 5;
  var boostFetchState = { status: 'idle', reason: null, topicId: null };
  var boostFetchPromise = null;
  var localStorage = {
    store: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
    setItem(k, v) { this.store[k] = String(v); },
  };
  const hashStr = eval('(' + fnText('function hashStr(s){') + ')'); // eslint-disable-line no-unused-vars
  const seededShuffle = eval('(' + fnText('function seededShuffle(') + ')'); // eslint-disable-line no-unused-vars
  const bankFor = eval('(' + fnText('function bankFor(t, kind, level){') + ')'); // eslint-disable-line no-unused-vars
  const poolQuestions = eval('(' + fnText('function poolQuestions(t,') + ')'); // eslint-disable-line no-unused-vars
  const liveGenNormStem = eval('(' + fnText('function liveGenNormStem(s){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenOptNum = eval('(' + fnText('function liveGenOptNum(o){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenNumbers = eval('(' + fnText('function liveGenNumbers(stem){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenApply = eval('(' + fnText('function liveGenApply(a,op,b){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenRecompute = eval('(' + fnText('function liveGenRecompute(stem, answer){') + ')'); // eslint-disable-line no-unused-vars
  const validateLiveGenClient = eval('(' + fnText('function validateLiveGenClient(questions, bankStems){') + ')'); // eslint-disable-line no-unused-vars
  const liveGenBankStems = eval('(' + fnText('function liveGenBankStems(t, level){') + ')'); // eslint-disable-line no-unused-vars
  function todayKey() { return TODAY; }
  function topicById(id) { return id === 'math-mrt' ? MRT_TOPIC : (id === 'eng-tense' ? ENG_TOPIC : null); }
  function ex() { return { id: 'e-test-1' }; }
  const fetchBoostLiveQuestions = eval('(' + fnExact('function fetchBoostLiveQuestions(topicId, level, modelOn){') + ')'); // eslint-disable-line no-unused-vars
  return {
    fetchBoostLiveQuestions, liveGenBankStems, validateLiveGenClient,
    get fetchState() { return boostFetchState; },
  };
}

test('boost client: a good live set comes back; a second topic never shares a pending fetch', async () => {
  const c = boostClient();
  const origFetch = global.fetch;
  let calls = 0;
  let sentBody = null;
  global.fetch = async (_url, opts) => {
    calls++;
    sentBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ live: true, questions: GOOD_MRT }) };
  };
  try {
    const out = await c.fetchBoostLiveQuestions('math-mrt', 3, MODEL_MRT);
    assert.deepEqual(out, GOOD_MRT, 'the live set is returned as-is');
    assert.equal(c.fetchState.status, 'ok');
    assert.equal(calls, 1);
    assert.equal(sentBody.topicId, 'math-mrt');
    assert.deepEqual(sentBody.modelOn, { q: MODEL_MRT.q, o: MODEL_MRT.o, a: MODEL_MRT.a, c: MODEL_MRT.c });
    assert.ok(Array.isArray(sentBody.bankStems) && sentBody.bankStems.length > 0, 'bank stems are sent for duplicate checks');
  } finally { global.fetch = origFetch; }
});

test('boost client: non-Maths topics and a missing model never fetch at all', async () => {
  const c = boostClient();
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return { ok: true, json: async () => ({ live: true, questions: GOOD_MRT }) }; };
  try {
    assert.equal(await c.fetchBoostLiveQuestions('eng-tense', 3, MODEL_MRT), null, 'English never generates');
    assert.equal(await c.fetchBoostLiveQuestions('math-mrt', 3, null), null, 'no model, no fetch');
    assert.equal(await c.fetchBoostLiveQuestions('math-mrt', 3, { q: 42 }), null, 'a malformed model is refused client-side');
    assert.equal(calls, 0, 'nothing was sent to the server');
  } finally { global.fetch = origFetch; }
});

test('boost client: 502, a failed fetch and a bad set all fall back to null (bank)', async () => {
  const origFetch = global.fetch;
  try {
    let c = boostClient();
    global.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: 'generated_set_invalid' }) });
    assert.equal(await c.fetchBoostLiveQuestions('math-mrt', 3, MODEL_MRT), null, 'a 502 validation rejection is a fallback, not an error');
    assert.equal(c.fetchState.status, 'failed');
    assert.equal(c.fetchState.reason, 'validation-failed');
    c = boostClient();
    global.fetch = async () => { throw new Error('network down'); };
    assert.equal(await c.fetchBoostLiveQuestions('math-mrt', 3, MODEL_MRT), null, 'a thrown fetch is a fallback');
    assert.equal(c.fetchState.status, 'failed');
    assert.equal(c.fetchState.reason, 'timeout-or-fetch-failed');
    c = boostClient();
    global.fetch = async () => ({ ok: true, json: async () => ({ live: true, questions: FLAWED }) });
    assert.equal(await c.fetchBoostLiveQuestions('math-mrt', 3, MODEL_MRT), null, 'a set that fails the client validator is a fallback');
    assert.equal(c.fetchState.status, 'failed');
    assert.equal(c.fetchState.reason, 'client-validation-failed');
  } finally { global.fetch = origFetch; }
});

test('boost client: a hanging fetch times out to null (bank), fast', async () => {
  const c = boostClient();
  const origFetch = global.fetch;
  const origSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { fn(); return 0; };
  global.fetch = async () => new Promise(() => {});
  try {
    assert.equal(await c.fetchBoostLiveQuestions('math-mrt', 3, MODEL_MRT), null);
    assert.equal(c.fetchState.status, 'failed');
  } finally { global.fetch = origFetch; global.setTimeout = origSetTimeout; }
});

/* --- startBoostFlow: the gate + the live swap ------------------------ */
// The eval'd page functions close over these module-level bindings.
let cur = null;
let EX = null;
let calls = null;
let toasts = [];
let goes = [];
let fetchCalls = [];
let fetchStub = null;
const LIVE_GEN_COUNT = 5;
function ex() { return EX; }
function todayKey() { return TODAY; }
function levelNum() { return 3; }
function toast(m) { toasts.push(m); }
function go(r) { goes.push(r); }
function topicById(id) { return id === 'math-mrt' ? MRT_TOPIC : (id === 'eng-tense' ? ENG_TOPIC : null); }
function questListFor(t, c) { return (c && c.boostList) || (t ? t.quest : []); }
function fetchBoostLiveQuestions(topicId, level, modelOn) {
  fetchCalls.push({ topicId, level, modelOn });
  return fetchStub ? fetchStub(topicId, level, modelOn) : Promise.resolve(null);
}
function recordLearnBest() { return false; }
function earnStars(e, n) { e.stars = (e.stars || 0) + n; e.starsEarned = (e.starsEarned || 0) + n; }
function awardBadge(id) { calls.badges.push(id); }
function save() { calls.saves++; }
function sndFanfare() {}
function confettiStars() {}
function reportServerBankAnswers() {}
function esc(s) { return String(s == null ? '' : s); }
function pipSVG() { return ''; }
function fmtPlaySecs(s) { return s + 's'; }
const bankFor = eval('(' + fnExact('function bankFor(t, kind, level){') + ')');
const boostRetakeAllowed = eval('(' + fnExact('function boostRetakeAllowed(isMaths, lastBoostDay, today){') + ')');
const boostTriesToday = eval('(' + fnExact('function boostTriesToday(rec, today){') + ')');
const startBoostFlow = eval('(' + fnExact('function startBoostFlow(topicId){') + ')');
const finishRound = eval('(' + fnExact('function finishRound(t){') + ')');
const quizDoneHTML = eval('(' + fnExact('function quizDoneHTML(t){') + ')');
const bindQuiz = eval('(' + fnExact('function bindQuiz(){') + ')');

function explorer(over) {
  return Object.assign({
    id: 'e1', name: 'Test', stars: 0, starsEarned: 0, starsSpent: 0,
    badges: [], completed: {}, completedDay: {}, progress: {},
    stuck: [], stuckCount: {}, boost: {},
  }, over || {});
}
function flaggedRec(over) {
  return Object.assign({
    at: '2026-11-07T10:00:00.000Z', flagScore: 1, prevScore: 2, lastScore: 1,
    lastDay: TODAY, missed: { q: MRT_TOPIC.retry[0].q, a: MRT_TOPIC.retry[0].o[MRT_TOPIC.retry[0].a] },
  }, over || {});
}
function resetStart() {
  cur = null; toasts = []; goes = []; fetchCalls = []; fetchStub = null;
}

test('start gate: a Maths drill starts with the bank list and asks Pip for a live set on the missed question', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec() } });
  resetStart();
  startBoostFlow('math-mrt');
  assert.ok(cur, 'the drill started');
  assert.equal(cur.phase, 'boost');
  assert.equal(cur.boostList.length, 5, 'five bank questions while Pip works');
  assert.equal(cur.boostSource, 'bank', 'bank until a live set lands');
  assert.deepEqual(goes, ['quiz']);
  assert.equal(fetchCalls.length, 1, 'one live fetch was kicked off');
  assert.equal(fetchCalls[0].topicId, 'math-mrt');
  assert.equal(fetchCalls[0].modelOn.q, MRT_TOPIC.retry[0].q, 'the model is the exact missed question');
  assert.equal(fetchCalls[0].modelOn.a, 0, 'the model carries the answer index from the bank question');
  assert.deepEqual(fetchCalls[0].modelOn.o, MRT_TOPIC.retry[0].o);
});

test('start gate: a live-made missed question is still a model (text answer, no bank lookup)', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec({ missed: { q: 'A live-made question she missed?', a: '42' } }) } });
  resetStart();
  startBoostFlow('math-mrt');
  assert.ok(cur, 'the drill started');
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(fetchCalls[0].modelOn, { q: 'A live-made question she missed?', a: '42' }, 'the record carries the question + answer text');
});

test('start gate: a Maths retake the same day starts and draws a different bank set', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec({ lastBoost: { score: 2, day: TODAY }, tries: 1, triesDay: TODAY }) } });
  resetStart();
  startBoostFlow('math-mrt');
  assert.ok(cur, 'the Maths retake is allowed');
  assert.notDeepEqual(cur.boostList, boostListFor(MRT_TOPIC, 3, 'e1', TODAY), 'not the first drill again');
  assert.deepEqual(cur.boostList, boostListFor(MRT_TOPIC, 3, 'e1', TODAY, 1), 'it is the attempt-1 draw');
});

test('start gate: a second non-Maths drill the same day is refused with a kind toast', () => {
  EX = explorer({ boost: { 'eng-tense': flaggedRec({ lastBoost: { score: 2, day: TODAY } }) } });
  resetStart();
  startBoostFlow('eng-tense');
  assert.equal(cur, null, 'no drill started');
  assert.equal(toasts.length, 1, 'she is told, not left wondering');
  assert.match(toasts[0], /tomorrow/);
  assert.equal(fetchCalls.length, 0, 'no live fetch for a refused drill');
  assert.deepEqual(goes, [], 'nowhere to go');
});

test('start gate: a non-Maths drill is allowed again on a new day', () => {
  EX = explorer({ boost: { 'eng-tense': flaggedRec({ lastBoost: { score: 2, day: YESTERDAY } }) } });
  resetStart();
  startBoostFlow('eng-tense');
  assert.ok(cur, 'a new day means a new drill');
  assert.equal(fetchCalls.length, 0, 'non-Maths never asks Pip for a live set');
});

test('live swap: a set that lands before Start replaces the bank list', async () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec() } });
  resetStart();
  fetchStub = async () => GOOD_MRT;
  startBoostFlow('math-mrt');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(cur.boostList, GOOD_MRT, 'the live set is playing');
  assert.equal(cur.boostSource, 'live');
});

test('live swap: a set that lands after Start never swaps questions mid-drill', async () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec() } });
  resetStart();
  let resolveFetch;
  fetchStub = () => new Promise((r) => { resolveFetch = r; });
  startBoostFlow('math-mrt');
  const bankList = cur.boostList.slice();
  cur.tipSeen = true; // she tapped Start before the fetch landed
  resolveFetch(GOOD_MRT);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(cur.boostList, bankList, 'the bank list she started with stays');
  assert.equal(cur.boostSource, 'bank');
});

test('live swap: a failed fetch leaves the bank list in place, silently', async () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec() } });
  resetStart();
  fetchStub = async () => null;
  startBoostFlow('math-mrt');
  await new Promise((r) => setImmediate(r));
  assert.equal(cur.boostList.length, 5, 'five bank questions');
  assert.equal(cur.boostSource, 'bank');
  assert.equal(toasts.length, 0, 'no error shown to the child');
});

/* --- finishRound: source + tries recording --------------------------- */
function runBoost(topicId, topic, score, opts) {
  opts = opts || {};
  const list = opts.boostList || topic.retry.slice(0, 3).concat(topic.fresh.slice(0, 2));
  cur = {
    topicId, phase: 'boost', idx: 5, score,
    wrong: [], picked: null, answered: true,
    boostList: list, boostSource: opts.source || 'bank',
    answerSecs: 0, startedAt: null,
  };
  calls = { badges: [], saves: 0 };
  finishRound(topic);
  return EX.boost[topicId];
}
function isActive(rec) {
  return !!rec && rec.lastScore < 3 && rec.prevScore != null && rec.prevScore < 3
    && !(rec.dismissedAt && rec.at && rec.dismissedAt >= rec.at)
    && !(rec.clearedAt && rec.at && rec.clearedAt >= rec.at);
}

test('finish: a Maths boost records its source and counts the try; stars only the first time', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec() } });
  let rec = runBoost('math-mrt', MRT_TOPIC, 2, { source: 'bank' });
  assert.equal(isActive(rec), true, '2/5 keeps the flag');
  assert.deepEqual(rec.lastBoost, { score: 2, day: TODAY, source: 'bank' }, 'the bank drill is recorded');
  assert.equal(rec.tries, 1, 'first try counted');
  assert.equal(rec.triesDay, TODAY);
  assert.equal(cur.starsEarned, 2, 'the first drill earns its stars');
  assert.equal(EX.stars, 2);
  // A retake on a live set: no extra stars, but the try counts and the source is recorded.
  rec = runBoost('math-mrt', MRT_TOPIC, 3, { source: 'live' });
  assert.equal(isActive(rec), true, '3/5 still keeps the flag');
  assert.deepEqual(rec.lastBoost, { score: 3, day: TODAY, source: 'live' }, 'the live drill is recorded');
  assert.equal(rec.tries, 2, 'second try counted');
  assert.equal(cur.starsEarned, 0, 'a same-day retake earns no extra stars');
  assert.equal(EX.stars, 2, 'star total unchanged by the retake');
  // 4/5 clears, and the third try is counted too.
  rec = runBoost('math-mrt', MRT_TOPIC, 4, { source: 'live' });
  assert.ok(rec.clearedAt, '4/5 clears the flag');
  assert.equal(isActive(rec), false, 'no longer active');
  assert.equal(rec.tries, 3);
  assert.equal(rec.lastScore, 1, 'quest scores untouched by boost scores');
});

test('finish: a non-Maths boost records the same way (the gate, not the finish, is what differs)', () => {
  EX = explorer({ boost: { 'eng-tense': flaggedRec() } });
  const rec = runBoost('eng-tense', ENG_TOPIC, 2, { source: 'bank' });
  assert.deepEqual(rec.lastBoost, { score: 2, day: TODAY, source: 'bank' });
  assert.equal(rec.tries, 1);
  assert.equal(cur.starsEarned, 2);
});

/* --- mergeExplorer: tries + lastBoost source ------------------------- */
const mergeExplorer = eval([
  'function unionArr(a,b){', 'function unionObjMax(a,b){', 'function unionObjLatest(a,b){',
  'function isThinkingMsg(m){', 'function mergeThreads(aThreads,bThreads){', 'function pickCritterName(a,b){',
  'function mergeCare(a,b){', 'function mergeLetters(a,b){', 'function mergeExplorer(a,b){',
].map(fnExact).join('\n') + '\n; mergeExplorer;');

function mergeBase(over) {
  return explorer(Object.assign({
    critterStage: 0, treasures: [], discoveredCritters: [],
    playDoneDay: {}, hclMissed: [], favAnswers: [], progress: {}, playProgress: {},
    playBest: {}, learnBest: {}, daily: {}, totalMinutes: 0, mood: {},
    threads: [], deletedThreadIds: [], flashcards: [], deletedFlashcards: [],
    planner: [], deletedPlanner: [], friends: [], deletedFriends: [],
    friendCode: 'ABCDEF', nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦',
    lookAt: null, critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
  }, over || {}));
}

test('merge: the retake count follows the later day, or the higher count on the same day', () => {
  const oneTry = flaggedRec({ tries: 1, triesDay: TODAY, lastBoost: { score: 2, day: TODAY, source: 'bank' } });
  const twoTries = flaggedRec({ tries: 2, triesDay: TODAY, lastBoost: { score: 3, day: TODAY, source: 'live' } });
  let merged = mergeExplorer(mergeBase({ boost: { 'math-mrt': oneTry } }), mergeBase({ boost: { 'math-mrt': twoTries } }));
  assert.equal(merged.boost['math-mrt'].tries, 2, 'same day: the higher count wins');
  assert.equal(merged.boost['math-mrt'].triesDay, TODAY);
  const older = flaggedRec({ tries: 2, triesDay: YESTERDAY });
  merged = mergeExplorer(mergeBase({ boost: { 'math-mrt': older } }), mergeBase({ boost: { 'math-mrt': oneTry } }));
  assert.equal(merged.boost['math-mrt'].tries, 1, 'a later day beats a higher old count');
  assert.equal(merged.boost['math-mrt'].triesDay, TODAY);
  // A stale device with no counter cannot wipe the count.
  merged = mergeExplorer(mergeBase({ boost: { 'math-mrt': twoTries } }), mergeBase({ boost: { 'math-mrt': flaggedRec() } }));
  assert.equal(merged.boost['math-mrt'].tries, 2, 'no counter on one side keeps the other side');
});

test('merge: lastBoost source rides with lastBoost (later day wins, tie to the local side)', () => {
  const bank = flaggedRec({ lastBoost: { score: 2, day: TODAY, source: 'bank' } });
  const live = flaggedRec({ lastBoost: { score: 3, day: TODAY, source: 'live' } });
  let merged = mergeExplorer(mergeBase({ boost: { 'math-mrt': bank } }), mergeBase({ boost: { 'math-mrt': live } }));
  assert.equal(merged.boost['math-mrt'].lastBoost.source, 'live', 'same day: the local (newer) drill wins');
  assert.equal(merged.boost['math-mrt'].lastBoost.score, 3);
  const olderLive = flaggedRec({ lastBoost: { score: 3, day: YESTERDAY, source: 'live' } });
  merged = mergeExplorer(mergeBase({ boost: { 'math-mrt': olderLive } }), mergeBase({ boost: { 'math-mrt': bank } }));
  assert.equal(merged.boost['math-mrt'].lastBoost.source, 'bank', 'a later-day bank drill beats an older live one');
});

/* --- quizDoneHTML: Maths copy + retry button -------------------------- */
test('results: a Maths boost that did not clear offers a fresh retake now', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec() } });
  cur = { topicId: 'math-mrt', phase: 'boost', score: 2, starsEarned: 2, boostList: MRT_TOPIC.retry.slice(0, 3).concat(MRT_TOPIC.fresh.slice(0, 2)) };
  const out = quizDoneHTML(MRT_TOPIC);
  assert.ok(out.indexOf('try again now') >= 0, 'Maths says try again now, not tomorrow');
  assert.ok(out.indexOf('id="boostRetry"') >= 0, 'retake button present');
  assert.ok(out.indexOf('5 fresh ones') >= 0, 'the button promises fresh questions');
  cur.starsEarned = 0;
  assert.ok(quizDoneHTML(MRT_TOPIC).indexOf('no extra stars this time') >= 0, 'a retake says plainly it earned nothing extra');
});

test('results: a cleared Maths boost and any non-Maths boost offer no retake button', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec({ clearedAt: TODAY + 'T12:00:00.000Z', lastScore: 4 }) } });
  cur = { topicId: 'math-mrt', phase: 'boost', score: 4, starsEarned: 4, boostList: MRT_TOPIC.retry.slice(0, 3).concat(MRT_TOPIC.fresh.slice(0, 2)) };
  const cleared = quizDoneHTML(MRT_TOPIC);
  assert.ok(cleared.indexOf('took it off the boost list') >= 0, 'cleared wording');
  assert.ok(cleared.indexOf('id="boostRetry"') < 0, 'nothing to retake once cleared');
  EX = explorer({ boost: { 'eng-tense': flaggedRec() } });
  cur = { topicId: 'eng-tense', phase: 'boost', score: 2, starsEarned: 2, boostList: ENG_TOPIC.retry.slice(0, 3).concat(ENG_TOPIC.fresh.slice(0, 2)) };
  const eng = quizDoneHTML(ENG_TOPIC);
  assert.ok(eng.indexOf('try again tomorrow') >= 0, 'non-Maths still waits until tomorrow');
  assert.ok(eng.indexOf('id="boostRetry"') < 0, 'no retake button for non-Maths');
});

/* --- bindQuiz: the retry button starts a fresh drill ------------------ */
test('wiring: tapping Try again on a Maths result starts a fresh boost drill', () => {
  EX = explorer({ boost: { 'math-mrt': flaggedRec({ lastBoost: { score: 2, day: TODAY }, tries: 1, triesDay: TODAY }) } });
  resetStart();
  const list = MRT_TOPIC.retry.slice(0, 3).concat(MRT_TOPIC.fresh.slice(0, 2));
  cur = { topicId: 'math-mrt', phase: 'boost', idx: 5, score: 2, boostList: list, boostSource: 'bank', tipSeen: true };
  const btns = {};
  const mkBtn = (id) => { const b = { id, onclick: null }; btns[id] = b; return b; };
  mkBtn('doneHome'); mkBtn('boostRetry');
  const origDoc = global.document;
  global.document = { getElementById: (id) => btns[id] || null };
  try {
    bindQuiz();
    assert.ok(btns.boostRetry.onclick, 'the retry button is wired');
    btns.boostRetry.onclick();
    assert.ok(cur, 'a fresh drill started');
    assert.equal(cur.phase, 'boost');
    assert.equal(cur.idx, 0, 'from question 1, not a resume');
    assert.notDeepEqual(cur.boostList, list, 'a different set from the one just finished');
    assert.ok(goes.indexOf('quiz') >= 0, 'back to the quiz');
  } finally { global.document = origDoc; }
});

/* --- Rendering: the cards and the parent line ------------------------- */
test('parent page: the boost card shows whether Pip made the questions or the bank did', () => {
  const parent = fnBody('function parentHTML(){');
  assert.ok(parent.indexOf('Pip-made questions') >= 0, 'live source shown');
  assert.ok(parent.indexOf('bank questions') >= 0, 'bank source shown');
  assert.ok(parent.indexOf('Last boost: ') >= 0, 'last boost line still there');
  assert.ok(parent.indexOf('Maths boosts can be retaken') >= 0, 'the explainer names the Maths retake rule');
});

test('home and learn: a non-Maths boost done today shows a wait-until-tomorrow note, not a dead button', () => {
  const home = fnBody('function homeHTML(){');
  assert.ok(home.indexOf('Boost done for today') >= 0, 'Home notes a finished non-Maths boost');
  assert.ok(home.indexOf('Start my boost') >= 0, 'the start button still exists for allowed drills');
  const learn = fnBody('function learnHTML(){');
  assert.ok(learn.indexOf('done for today, fresh questions tomorrow') >= 0, 'Learn notes it too');
  assert.ok(learn.indexOf('data-boost') >= 0, 'the boost button is still wired for allowed drills');
});

test('wiring: the gate lives in startBoostFlow, not just on the cards', () => {
  const start = fnBody('function startBoostFlow(topicId){');
  assert.ok(start.indexOf('boostRetakeAllowed') >= 0, 'the gate is checked when a drill starts');
  assert.ok(start.indexOf('fetchBoostLiveQuestions') >= 0, 'Maths drills kick off the live fetch');
  assert.ok(start.indexOf('boostTriesToday') >= 0, 'the attempt seeds the bank draw');
  const finish = fnBody('function finishRound(t){');
  assert.ok(finish.indexOf('lastBoost={score:cur.score,day:todayKey(),source:') >= 0, 'the finish records the source');
  assert.ok(finish.indexOf('_bb.tries') >= 0, 'the finish counts the try');
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.indexOf('triesDay') >= 0, 'the merge carries the try count');
});
