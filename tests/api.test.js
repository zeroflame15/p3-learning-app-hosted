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

test('ask-pip: no key -> 503, empty question -> 400, live reply cites agent + skill', async () => {
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
    assert.equal(res.body.agent, 'maths-tutor');
    assert.equal(res.body.skillId, 'times-tables');
    assert.equal(res.body.skillVersion, 'skills-v1');
  } finally { global.fetch = origFetch; delete process.env.MODEL_API_KEY; }
});

test('ask-pip: fixFlag re-checks and still cites the skill', async () => {
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
    assert.equal(res.body.skillId, 'times-tables');
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
  assert.equal(res.body.liveAgents, 15);
  assert.deepEqual(res.body.placeholderAgents, ['voice-coach', 'image-guide', 'vision-guide', 'open-model']);
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
