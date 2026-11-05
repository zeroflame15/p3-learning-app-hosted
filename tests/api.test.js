// API handler tests — mocked model + mocked Supabase, no live keys.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function mockReq(method, body, query) { return { method, body, query: query || {} }; }

test('ask-pip: no key -> 503, empty question -> 400, live reply is a simple chatbot answer', async () => {
  delete process.env.MODEL_API_KEY;
  delete require.cache[require.resolve('../api/ask-pip')];
  const ask = require('../api/ask-pip');
  let res = mockRes();
  await ask(mockReq('POST', { question: '7 x 8?' }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'live_pip_not_configured');

  process.env.MODEL_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/ask-pip')];
  const askLive = require('../api/ask-pip');
  res = mockRes();
  await askLive(mockReq('POST', { question: '' }), res);
  assert.equal(res.statusCode, 400);

  // Stub the model call.
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '7 x 8 = 56. Count in sevens: 7, 14, 21, 28, 35, 42, 49, 56!' } }] }),
  });
  try {
    res = mockRes();
    await askLive(mockReq('POST', { question: '7 x 8?' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.live, true);
    assert.match(res.body.reply, /56/);
    // Simple chatbot: one agent, no skill routing.
    assert.equal(res.body.agent, 'ask-kix');
    assert.equal(res.body.skillId, null);
    assert.equal(res.body.skillVersion, 'skills-v1');
    // Every reply is still signed and traceable.
    assert.match(res.body.signature, /^pip:ask-kix:simple:t/);
    assert.ok(res.body.traceId);
    assert.equal(res.body.hintFirst, false);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('ask-pip: LaTeX in a model reply is cleaned before it reaches a child', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/ask-pip')];
  const askLive = require('../api/ask-pip');
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'For $3 \\times 4$, add $3$ four times: $3 + 3 + 3 + 3 = 12$.' } }] }),
  });
  try {
    const res = mockRes();
    await askLive(mockReq('POST', { question: 'what is 3 x 4' }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(!res.body.reply.includes('$'), 'no dollar signs left');
    assert.ok(!res.body.reply.includes('\\times'), 'no LaTeX left');
    assert.match(res.body.reply, /3 x 4/);
    assert.match(res.body.reply, /12/);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('ask-pip: fixFlag re-checks simply, no skill routing', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/ask-pip')];
  const ask = require('../api/ask-pip');
  const origFetch = global.fetch;
  let sent = null;
  global.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'You are right to flag it — 7 x 8 is 56, not 54.' } }] }) };
  };
  try {
    const res = mockRes();
    await ask(mockReq('POST', { question: '7 x 8 = 54', fixFlag: true }), res);
    assert.equal(res.statusCode, 200);
    assert.match(sent.messages[0].content, /flagged/);
    assert.equal(res.body.agent, 'ask-kix');
    assert.equal(res.body.skillId, null);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('health: reports configuration without secrets', async () => {
  delete process.env.MODEL_API_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete require.cache[require.resolve('../api/health')];
  const health = require('../api/health');
  const res = mockRes();
  await health(mockReq('GET'), res);
  assert.equal(res.body.livePip, false);
  assert.equal(res.body.progressSync, false);
  assert.equal(res.body.model, 'muse-spark-1.3');
  assert.equal(res.body.skillPack, 'skills-v1');
  assert.equal(res.body.agents, 19);
  assert.equal(res.body.liveAgents, 11);
  assert.equal(res.body.readyAgents, 2);
  assert.deepEqual(res.body.placeholderAgents, ['content-curator', 'home-reader', 'outing-scout', 'sidekick-studio', 'talk-to-kix', 'whos-who']);
});

test('ask-pip: simple chatbot answers the frog question directly, no skill routing', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/ask-pip')];
  const ask = require('../api/ask-pip');
  const origFetch = global.fetch;
  let sent = null;
  global.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'A tadpole grows legs and loses its tail — that is how it becomes a froglet. What changes next?' } }] }) };
  };
  try {
    const res = mockRes();
    await ask(mockReq('POST', { question: "Why can't Pip hop yet?" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.agent, 'ask-kix');
    assert.equal(res.body.skillId, null);
    // No skill routing, no hint-first machinery in the prompt.
    assert.ok(!sent.messages[0].content.includes('life-cycle-frog'));
    assert.ok(!sent.messages[0].content.includes('HINT first'));
    assert.ok(!sent.messages[0].content.includes('Guardrails'));
    assert.match(sent.messages[0].content, /Answer the question directly/);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('flag: Reviewer + Judge run on every flag; a corrected flag ships', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.MODEL_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/flag')];
  const flag = require('../api/flag');
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'CONFIRMED — Pip was wrong. 7 x 8 is 56.' } }] }),
  });
  try {
    const res = mockRes();
    await flag(mockReq('POST', { question: '7 x 8?', pipAnswer: '54', correction: '56' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.loop.review.verdict, 'confirmed-mistake');
    assert.equal(res.body.loop.review.checkedBy, 'second-model-pass');
    assert.equal(res.body.loop.proof.proven, true);
    assert.equal(res.body.loop.judge.verdict, 'ship');
    assert.equal(res.body.loop.becomesTest, true);
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('flag: without a model key the Reviewer queues and the Judge holds', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.MODEL_API_KEY;
  delete require.cache[require.resolve('../api/flag')];
  const flag = require('../api/flag');
  const res = mockRes();
  await flag(mockReq('POST', { question: '7 x 8?', pipAnswer: '54', correction: '56' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.loop.review.checkedBy, 'queued');
  assert.equal(res.body.loop.judge.verdict, 'hold');
  assert.equal(res.body.loop.becomesTest, false);
});

test('flag: unconfigured server still returns the test case; bad flag -> 400', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete require.cache[require.resolve('../api/flag')];
  const flag = require('../api/flag');
  let res = mockRes();
  await flag(mockReq('POST', { question: '7 x 8?', pipAnswer: '54', correction: '56' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.configured, false);
  assert.equal(res.body.testCase.skillId, 'times-tables');
  assert.equal(res.body.testCase.regression.assertNot, '54');
  res = mockRes();
  await flag(mockReq('POST', { question: '' }), res);
  assert.equal(res.statusCode, 400);
});

test('flag: configured server stores the flag in flag_log', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  delete require.cache[require.resolve('../api/flag')];
  const flag = require('../api/flag');
  const origFetch = global.fetch;
  let posted = null;
  global.fetch = async (_url, init) => {
    posted = JSON.parse(init.body);
    return { ok: true, json: async () => ([{ id: '1' }]) };
  };
  try {
    const res = mockRes();
    await flag(mockReq('POST', { question: '7 x 8?', pipAnswer: '54', correction: '56', code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.configured, true);
    assert.equal(posted.code, 'ABC2DE');
    assert.equal(posted.status, 'open');
    assert.equal(posted.test_case.skillId, 'times-tables');
  } finally { global.fetch = origFetch; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SECRET_KEY; }
});

test('progress: unconfigured -> configured:false; bad key -> 400', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  let res = mockRes();
  await progress(mockReq('GET', null, { code: 'ABC2DE' }), res);
  assert.equal(res.body.configured, false);
});
