// Server bank — ENDPOINT tests (api/daily-set.js, api/report-answers.js).
// Supabase is mocked via global.fetch (same style as
// tests/live-gen.test.js): no live keys, no network. The mock routes
// by URL, so the read-then-write flow of each endpoint is exercised.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

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

// Fake question rows as Supabase returns them (15 servable + 2 warm
// rows that must never be served as a quest).
function poolRows() {
  const rows = [];
  for (let i = 1; i <= 15; i++) {
    rows.push({
      id: 's-p3-' + String(i).padStart(4, '0'),
      stem: 'Question ' + i + ' has numbers 2 and 3 in it?',
      options: ['4', '5', '6', '7'], answer: 2, explanation: '2 x 3 = 6.', joke: '',
      sub_topic: i <= 5 ? 'quest' : 'fresh',
    });
  }
  rows.push({ id: 's-warm-1', stem: 'Warm 1 has numbers 2 and 2?', options: ['3', '4', '5', '6'], answer: 1, explanation: '', joke: '', sub_topic: 'warm' });
  rows.push({ id: 's-retry-1', stem: 'Retry 1 has numbers 2 and 2?', options: ['3', '4', '5', '6'], answer: 1, explanation: '', joke: '', sub_topic: 'retry' });
  return rows;
}

// Mock Supabase: routes by URL. `routes` holds the rows each read
// returns; POST upserts are captured in routes.captured (parsed body).
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

test('daily-set: due first (oldest), then fresh; mastered excluded; warm rows never served', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  const routes = {
    questions: poolRows(),
    states: [
      { question_id: 's-p3-0003', status: 'due', updated_at: '2026-11-01T00:00:00Z' },
      { question_id: 's-p3-0001', status: 'mastered', updated_at: '2026-11-07T00:00:00Z' },
      { question_id: 's-p3-0002', status: 'served', updated_at: '2026-11-07T00:00:00Z' },
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
    assert.equal(res.body.topicId, 'math-ntuc');
    assert.equal(res.body.level, 3);
    assert.equal(res.body.day, '2026-11-08');
    assert.equal(res.body.questions.length, 5);
    assert.equal(res.body.questions[0].id, 's-p3-0003', 'the due question comes first');
    assert.equal(res.body.due, 1);
    assert.equal(res.body.served + res.body.fresh, 4, 'the rest are served-or-fresh');
    assert.equal(res.body.served + res.body.due + res.body.fresh, 5);
    const ids = res.body.questions.map((q) => q.id);
    assert.ok(!ids.includes('s-p3-0001'), 'a mastered question is never served');
    assert.ok(!ids.includes('s-warm-1') && !ids.includes('s-retry-1'), 'warm/retry rows are never served as a quest');
    assert.ok(res.body.questions.every((q) => q.q && Array.isArray(q.o) && q.o.length === 4 && typeof q.a === 'number'), 'question shape for the client');
    // The mark-served upsert covers only the picked questions that
    // had no row: the due one is not re-marked, the served one is
    // not re-marked, the mastered one is never touched.
    const marked = (routes.captured || []).map((r) => r.question_id);
    assert.ok(!marked.includes('s-p3-0003'), 'a due row stays due until reported');
    assert.ok(!marked.includes('s-p3-0002'), 'an already-served row is not re-marked');
    assert.ok(!marked.includes('s-p3-0001'), 'a mastered row is never touched');
    assert.ok(marked.every((id) => ids.includes(id)), 'only picked questions are marked');
    assert.ok((routes.captured || []).every((r) => r.status === 'served' && r.family_code === 'ABC2DE' && r.explorer_id === 'e-test-1'));
    // Deterministic: the same inputs serve the same set again.
    routes.captured = null;
    const res2 = mockRes();
    await handler(mockReq('POST', body), res2);
    assert.deepEqual(res2.body.questions.map((q) => q.id), ids, 'a lost client cache re-serves the same set for the day');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('daily-set: two due questions come first, oldest first', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  const routes = {
    questions: poolRows(),
    states: [
      { question_id: 's-p3-0009', status: 'due', updated_at: '2026-11-07T00:00:00Z' },
      { question_id: 's-p3-0004', status: 'due', updated_at: '2026-11-02T00:00:00Z' },
    ],
  };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc', level: 3, day: '2026-11-08' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.questions.slice(0, 2).map((q) => q.id), ['s-p3-0004', 's-p3-0009'], 'oldest due first');
    assert.equal(res.body.due, 2);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('daily-set: empty bank, unseeded topic, bad input, GET, no env, supabase failure', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  try {
    // Empty bank -> 502 (the client falls back to the bank).
    global.fetch = supabaseMock({ questions: [], states: [] });
    let res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', level: 3 }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'not-seeded');
    // A topic with no questions -> 502 (not-seeded); the client falls back to the bank.
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-mrt', level: 3 }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'not-seeded');
    // Missing topicId -> 400.
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', level: 3 }), res);
    assert.equal(res.statusCode, 400);
    // Missing code / explorerId -> 400.
    res = mockRes();
    await handler(mockReq('POST', { code: '', explorerId: 'e1', topicId: 'math-ntuc', level: 3 }), res);
    assert.equal(res.statusCode, 400);
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', topicId: 'math-ntuc', level: 3 }), res);
    assert.equal(res.statusCode, 400);
    // GET -> 405.
    res = mockRes();
    await handler(mockReq('GET', {}), res);
    assert.equal(res.statusCode, 405);
    // Supabase read failure -> 502.
    global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', level: 3 }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'supabase_read_failed');
  } finally { global.fetch = origFetch; clearEnv(); }
  // No env at all -> 502 (not configured).
  const noEnv = loadHandler('daily-set');
  const res = mockRes();
  await noEnv(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', level: 3 }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'server_bank_not_configured');
});

test('daily-set: count is honoured and level defaults to 3', async () => {
  setEnv();
  const handler = loadHandler('daily-set');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ questions: poolRows(), states: [] });
  try {
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', count: 3, day: '2026-11-08' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.questions.length, 3);
    assert.equal(res.body.level, 3, 'level defaults to 3 when omitted');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('report-answers: correct masters, wrong goes due, attempts increment, bad rows skipped', async () => {
  setEnv();
  const handler = loadHandler('report-answers');
  const origFetch = global.fetch;
  const routes = {
    known: [{ id: 'q1' }, { id: 'q2' }],
    states: [
      { question_id: 'q1', status: 'due', attempts: 1, correct: 0 },
      { question_id: 'q2', status: 'served', attempts: 0, correct: 0 },
    ],
    captured: null,
  };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await handler(mockReq('POST', {
      code: 'ABC2DE', explorerId: 'e-test-1', topicId: 'math-ntuc',
      results: [
        { questionId: 'q1', correct: true },
        { questionId: 'q2', correct: false },
        { questionId: '', correct: true },
        { questionId: 'q3', correct: 'yes' },
        { questionId: 'nope', correct: true },
        { questionId: 'q1', correct: true },
      ],
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 1, due: 1 });
    const rows = routes.captured;
    assert.equal(rows.length, 2, 'bad rows and unknown ids are skipped, duplicates collapse to one row');
    const r1 = rows.find((r) => r.question_id === 'q1');
    const r2 = rows.find((r) => r.question_id === 'q2');
    assert.deepEqual(
      { status: r1.status, attempts: r1.attempts, correct: r1.correct },
      { status: 'mastered', attempts: 2, correct: 1 },
      'a correct answer masters, attempts and correct both increment'
    );
    assert.deepEqual(
      { status: r2.status, attempts: r2.attempts, correct: r2.correct },
      { status: 'due', attempts: 1, correct: 0 },
      'a wrong answer goes due, attempts increment, correct does not'
    );
    assert.ok(rows.every((r) => r.family_code === 'ABC2DE' && r.explorer_id === 'e-test-1' && typeof r.updated_at === 'string'));
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('report-answers: all rows bad -> 200 with zero counts; bad shape -> 400; write failure -> 502', async () => {
  setEnv();
  const handler = loadHandler('report-answers');
  const origFetch = global.fetch;
  try {
    global.fetch = supabaseMock({ known: [], states: [] });
    let res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', results: [{ questionId: '', correct: true }] }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 0, due: 0 });
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', results: [] }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 0, due: 0 });
    // A non-pilot topic is accepted now (no pilot gate); empty results -> 200 with zero counts.
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-mrt', results: [] }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, mastered: 0, due: 0 });
    // Missing topicId -> 400.
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', results: [] }), res);
    assert.equal(res.statusCode, 400);
    // Missing results -> 400.
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc' }), res);
    assert.equal(res.statusCode, 400);
    // GET -> 405.
    res = mockRes();
    await handler(mockReq('GET', {}), res);
    assert.equal(res.statusCode, 405);
    // Supabase write failure -> 502, never a 500.
    global.fetch = async (url, init) => {
      if (url.indexOf('sb_questions?id=in.') >= 0) return { ok: true, json: async () => [{ id: 'q1' }] };
      if (url.indexOf('sb_explorer_questions?') >= 0 && (!init || !init.method || init.method !== 'POST')) return { ok: true, json: async () => [] };
      return { ok: false, status: 500, json: async () => ({}) };
    };
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', results: [{ questionId: 'q1', correct: true }] }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'supabase_write_failed');
  } finally { global.fetch = origFetch; clearEnv(); }
  const noEnv = loadHandler('report-answers');
  const res = mockRes();
  await noEnv(mockReq('POST', { code: 'ABC2DE', explorerId: 'e1', topicId: 'math-ntuc', results: [] }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'server_bank_not_configured');
});
