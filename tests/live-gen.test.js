// Live-generated questions — server handler + shared validator tests.
// No live keys: the model is stubbed via global.fetch throughout.
// Bank stems come from the REAL page (TOPICS + FRESH_BANK for
// math-ntuc), so the duplicate-of-bank checks are tested against the
// bank the experiment actually runs against.
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
function Q(q, o, a, c, j) { return { q, o, a, c, j }; }
const TOPICS = eval('(' + extractVar(html, 'TOPICS') + ')');
const FRESH = eval('(' + extractVar(html, 'FRESH_BANK') + ')');
const NTUC = TOPICS.find((t) => t.id === 'math-ntuc');
const BANK_STEMS = [...NTUC.quest, ...NTUC.p4quest, ...FRESH['math-ntuc'], ...NTUC.p4fresh,
  ...NTUC.warm, ...NTUC.retry].map((q) => q.q);

const liveGen = require('../lib/live-gen');

// --- Fixtures: the same sets the comparison script runs live. ---
const GOOD = [
  { q: 'Eggs come in trays of 12. You buy 4 trays. How many eggs in all?', o: ['36', '44', '48', '52'], a: 2, c: '12 x 4 = 48. Count in twelves!' },
  { q: 'One bottle of juice costs $3.50. How much do 3 bottles cost?', o: ['$9.50', '$10.50', '$10.00', '$11.50'], a: 1, c: '3 x $3.50 = $10.50.' },
  { q: 'There are 56 stickers shared equally among 7 friends. How many stickers does each friend get?', o: ['6', '7', '8', '9'], a: 2, c: '56 ÷ 7 = 8, because 7 x 8 = 56.' },
  { q: 'Mei buys 5 packs of pens at $4 each and a notebook for $7. How much does she spend in all?', o: ['$27', '$31', '$25', '$35'], a: 0, c: '5 x $4 = $20, then $20 + $7 = $27.' },
  { q: 'A baker packs 72 muffins into boxes of 9. How many boxes does he fill?', o: ['7', '8', '9', '6'], a: 1, c: '72 ÷ 9 = 8, because 9 x 8 = 72.' },
];
// One distinct failure per question: wrong answer, estimation,
// bank duplicate, lazy distractors, leaked answer.
const FLAWED = [
  { q: 'There are 7 shelves with 8 cans each. How many cans in all?', o: ['48', '54', '56', '64'], a: 0, c: '7 x 8 = 56.' },
  { q: 'Estimate: 48 × 5 is closest to…', o: ['200', '250', '300', '150'], a: 1, c: '48 is about 50, and 50 x 5 = 250.' },
  { q: 'Apples come in bags of 6. You buy 4 bags. How many apples?', o: ['18', '20', '24', '30'], a: 2, c: '6 x 4 = 24.' },
  { q: 'There are 7 boxes with 8 pencils in each box. How many pencils in all?', o: ['55', '56', '57', '54'], a: 1, c: '7 x 8 = 56. Count in eights!' },
  { q: 'Lily has 30 stickers. She gives 6 stickers to each of her 5 friends. How many stickers does each friend get?', o: ['5', '6', '7', '4'], a: 1, c: '30 ÷ 5 = 6. Share equally!' },
];
// All computable, all correct — but every distractor is a +/-1 or +/-2
// counting slip, so the whole set must fail on distractor quality.
const WEAK = [
  { q: 'There are 6 bags with 7 marbles in each bag. How many marbles in all?', o: ['41', '42', '43', '40'], a: 1, c: '6 x 7 = 42.' },
  { q: 'There are 6 boxes with 8 pencils in each box. How many pencils in all?', o: ['47', '48', '49', '46'], a: 1, c: '6 x 8 = 48.' },
  { q: 'There are 6 shelves with 9 books on each shelf. How many books in all?', o: ['53', '54', '55', '52'], a: 1, c: '6 x 9 = 54.' },
  { q: 'There are 7 trays with 9 cupcakes on each tray. How many cupcakes in all?', o: ['62', '63', '64', '61'], a: 1, c: '7 x 9 = 63.' },
  { q: 'There are 8 rows with 9 chairs in each row. How many chairs in all?', o: ['71', '72', '73', '70'], a: 1, c: '8 x 9 = 72.' },
];

test('live-gen: validator accepts a good NTUC set against the real bank', () => {
  assert.equal(BANK_STEMS.length, 5 + 5 + 10 + 10 + 8 + 6, 'real math-ntuc bank is 44 stems');
  const r = liveGen.validateLiveGenSet(GOOD, BANK_STEMS);
  assert.deepEqual(r, { ok: true, reasons: [] });
});

test('live-gen: validator rejects each flawed shape with the right reason', () => {
  const r = liveGen.validateLiveGenSet(FLAWED, BANK_STEMS);
  assert.equal(r.ok, false);
  for (const want of ['q1:answer-does-not-recompute', 'q2:non-computable-type', 'q3:duplicate-of-bank', 'q4:weak-distractors', 'q5:answer-in-stem']) {
    assert.ok(r.reasons.includes(want), 'expected ' + want + ' in ' + r.reasons.join(', '));
  }
});

test('live-gen: a set of only +/-1 distractors fails on distractor quality', () => {
  const r = liveGen.validateLiveGenSet(WEAK, BANK_STEMS);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.every((x) => x.endsWith('weak-distractors')), r.reasons.join(', '));
});

test('live-gen: recompute covers two-step money, change, and two-product problems', () => {
  const twoStep = { q: 'Mei buys 4 notebooks at $6 each and pays with $50. How much change does she get?', o: ['$24', '$26', '$30', '$20'], a: 1, c: '4 x $6 = $24, then $50 − $24 = $26.' };
  assert.deepEqual(liveGen.validateLiveGenQuestion(twoStep, [], []), []);
  const twoProduct = { q: 'Ben buys 4 notebooks at $6 each and 2 pens at $3 each. How much does he spend in all?', o: ['$28', '$30', '$32', '$26'], a: 1, c: '4 x $6 = $24 and 2 x $3 = $6, then $24 + $6 = $30.' };
  assert.deepEqual(liveGen.validateLiveGenQuestion(twoProduct, [], []), []);
  // The intermediate step as the answer: 24 IS computable from the
  // stem (4 x 6) but ignores the $50, so it must fail distinctly.
  const intermediate = { ...twoStep, a: 0 };
  assert.ok(liveGen.validateLiveGenQuestion(intermediate, [], []).includes('answer-ignores-numbers'));
  // A value no computation reaches at all fails differently.
  const wrong = { ...twoStep, a: 2 };
  assert.ok(liveGen.validateLiveGenQuestion(wrong, [], []).includes('answer-does-not-recompute'));
});

test('live-gen: format rejections — count, options, index, explanation, duplicates', () => {
  const base = GOOD[0];
  const withQ = (patch) => [{ ...base, ...patch }, ...GOOD.slice(1)];
  assert.ok(liveGen.validateLiveGenSet(GOOD.slice(0, 4), []).reasons.includes('set-must-have-5-questions'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ o: ['36', '44', '48'] }), []).reasons.includes('q1:options-not-4'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ o: ['36', '44', '48', '48'] }), []).reasons.includes('q1:duplicate-options'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ a: 4 }), []).reasons.includes('q1:bad-answer-index'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ c: '' }), []).reasons.includes('q1:explanation-missing'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ c: 'Count carefully!' }), []).reasons.includes('q1:explanation-has-no-working'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ o: ['36', '44', 'lots', '52'] }), []).reasons.includes('q1:non-numeric-option'));
  assert.ok(liveGen.validateLiveGenSet([GOOD[0], GOOD[0], ...GOOD.slice(2)], []).reasons.includes('q2:duplicate-in-set'));
  assert.ok(liveGen.validateLiveGenSet(withQ({ o: ['$36', '$44', '$48', '$52'] }), []).reasons.includes('q1:non-numeric-option') === false, 'money options are numeric');
});

test('live-gen: prompt demands JSON-only, exact computation, and forbids estimation', () => {
  const p = liveGen.buildLiveGenPrompt('NTUC Totals', 3, 5, NTUC.quest.slice(0, 2));
  assert.match(p, /JSON ONLY/);
  assert.match(p, /exactly 5 questions/);
  assert.match(p, /at most two steps/);
  assert.match(p, /NEVER write estimation/);
  assert.match(p, /must NOT appear as a number/);
  const p4 = liveGen.buildLiveGenPrompt('NTUC Totals', 4, 5, []);
  assert.match(p4, /Primary 4/);
  assert.match(p4, /2-digit number by a 1-digit number/);
});

test('live-gen: reply parser takes plain and fenced JSON, rejects garbage', () => {
  assert.deepEqual(liveGen.parseLiveGenReply(JSON.stringify({ questions: GOOD })).questions, GOOD);
  assert.deepEqual(liveGen.parseLiveGenReply('```json\n' + JSON.stringify(GOOD) + '\n```').questions, GOOD);
  assert.deepEqual(liveGen.parseLiveGenReply(JSON.stringify(GOOD)).questions, GOOD);
  assert.equal(liveGen.parseLiveGenReply('hello there').error, 'unparseable_json');
  assert.equal(liveGen.parseLiveGenReply('').error, 'empty_reply');
  assert.equal(liveGen.parseLiveGenReply('{"nope":1}').error, 'no_questions_array');
});

// --- Server handler (mocked model) ---
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

test('live-gen api: good model output -> 200 live set; flawed -> 502 with reasons', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD }) } }] }) });
    let res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3, day: '2026-11-07', bankStems: BANK_STEMS, examples: NTUC.quest.slice(0, 2) }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.live, true);
    assert.equal(res.body.validated, true);
    assert.equal(res.body.topicId, 'math-ntuc');
    assert.deepEqual(res.body.questions, GOOD);
    assert.equal(typeof res.body.generatedMs, 'number');

    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: FLAWED }) } }] }) });
    res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3, day: '2026-11-07', bankStems: BANK_STEMS }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'generated_set_invalid');
    assert.equal(res.body.fallback, true);
    assert.ok(res.body.reasons.includes('q1:answer-does-not-recompute'));
    assert.ok(res.body.reasons.includes('q4:weak-distractors'));
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('live-gen api: wrong topic, missing bankStems, no key, GET, unparseable output', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }) });
  try {
    let res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-mrt', level: 3, bankStems: BANK_STEMS }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'experiment_topic_only');
    res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3 }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'bankStems required');
    res = mockRes();
    await handler(mockReq('GET', {}), res);
    assert.equal(res.statusCode, 405);
    res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3, bankStems: BANK_STEMS }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'unparseable_json');
    assert.equal(res.body.fallback, true);
  } finally { global.fetch = origFetch; }
  delete process.env.MODEL_API_KEY;
  const noKey = loadHandler();
  const res = mockRes();
  await noKey(mockReq('POST', { topicId: 'math-ntuc', level: 3, bankStems: BANK_STEMS }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'live_pip_not_configured');
});

test('live-gen api: a transient 503 retries once and then succeeds', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503, text: async () => 'high demand' };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 4, day: '2026-11-07', bankStems: BANK_STEMS }), res);
    assert.equal(calls, 2, 'one retry after the transient 503');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.level, 4);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('live-gen api: the prompt sent to the model names the topic and level', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let sent = null;
  global.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: GOOD }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3, bankStems: BANK_STEMS, examples: NTUC.quest.slice(0, 2) }), res);
    assert.equal(res.statusCode, 200);
    assert.match(sent.messages[0].content, /NTUC Totals/);
    assert.match(sent.messages[0].content, /Primary 3/);
    assert.match(sent.messages[0].content, /JSON ONLY/);
    assert.equal(sent.model, process.env.MODEL_ID || 'muse-spark-1.3');
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('live-gen api: a validation failure retries with the reasons fed back, then succeeds', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let calls = 0;
  const prompts = [];
  global.fetch = async (_url, init) => {
    calls++;
    prompts.push(JSON.parse(init.body).messages[0].content);
    const set = calls === 1 ? FLAWED : GOOD;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: set }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3, day: '2026-11-07', bankStems: BANK_STEMS }), res);
    assert.equal(calls, 2, 'one retry after the rejected set');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.live, true);
    assert.equal(res.body.attempts, 2);
    assert.match(prompts[1], /rejected for:/, 'second prompt carries the rejection reasons');
    assert.match(prompts[1], /answer-does-not-recompute/, 'the actual reason is named');
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('live-gen api: three rejected sets -> 502 with the last reasons and attempts: 3', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  const handler = loadHandler();
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: FLAWED }) } }] }) };
  };
  try {
    const res = mockRes();
    await handler(mockReq('POST', { topicId: 'math-ntuc', level: 3, day: '2026-11-07', bankStems: BANK_STEMS }), res);
    assert.equal(calls, 3, 'max three generation attempts');
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'generated_set_invalid');
    assert.equal(res.body.attempts, 3);
    assert.ok(res.body.reasons.includes('q1:answer-does-not-recompute'));
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});
