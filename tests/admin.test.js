// Admin endpoints — api/admin-find.js, api/admin-reset-pin.js,
// lib/admin.js. Supabase is mocked via global.fetch (same style as
// tests/server-bank-api.test.js): no live keys, no network. The
// master password is ADMIN_PASSWORD; it is read per request, so the
// tests set it directly (no cache-busting needed for it), while the
// Supabase env vars need a re-require (read at module load).
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
  // lib/admin reads the Supabase env vars at module load, so bust
  // it too — otherwise a test that clears the env still sees the
  // credentials a previous test set.
  delete require.cache[require.resolve('../lib/admin')];
  return require('../api/' + name);
}
function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
}
function clearEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.ADMIN_PASSWORD;
}

// Fake family rows as Supabase returns them. Note the parent PINs:
// the find/reset replies must never contain them.
function familyRows() {
  return [
    {
      code: 'ABC2DE', data: {
        parentPin: '1111', syncCode: 'ABC2DE',
        explorers: [
          { id: 'e1', name: 'Star', level: 'P3' },
          { id: 'e2', name: 'Moon', level: 'P4' },
        ],
      },
    },
    {
      code: 'FGH3JK', data: {
        parentPin: '2222', syncCode: 'FGH3JK',
        explorers: [{ id: 'e3', name: 'Starfish', level: 'P2' }],
      },
    },
    {
      code: 'LMN4PQ', data: {
        parentPin: '3333', syncCode: 'LMN4PQ',
        explorers: [{ id: 'e4', name: 'River', level: 'P5' }],
      },
    },
  ];
}

// Mock Supabase: routes by URL. Reads return rows; the upsert POST
// is captured in routes.captured (parsed body) and counted in
// routes.writes, so tests can prove a reset did (or did not) write.
function supabaseMock(routes) {
  return async (url, init) => {
    const method = (init && init.method) || 'GET';
    if (url.indexOf('family_progress?code=eq.') >= 0 && method !== 'POST') {
      const code = decodeURIComponent(url.split('code=eq.')[1].split('&')[0]);
      return { ok: true, json: async () => routes.rows.filter((r) => r.code === code) };
    }
    if (url.indexOf('family_progress?select=code,data') >= 0 && method !== 'POST') {
      return { ok: true, json: async () => routes.rows };
    }
    if (url.indexOf('family_progress?on_conflict=code') >= 0 && method === 'POST') {
      routes.captured = JSON.parse(init.body);
      routes.writes = (routes.writes || 0) + 1;
      return { ok: true, json: async () => [routes.captured] };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
}

test('admin-find: ADMIN_PASSWORD unset -> 503 admin_not_configured, no data', async () => {
  setEnv();
  delete process.env.ADMIN_PASSWORD;
  const find = loadHandler('admin-find');
  const res = mockRes();
  await find(mockReq('POST', { password: 'anything', code: 'ABC2DE' }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'admin_not_configured');
  assert.ok(!('families' in res.body), 'no family data when unconfigured');
  clearEnv();
});

test('admin-find: wrong or missing password -> 401, no family data', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    let res = mockRes();
    await find(mockReq('POST', { password: 'wrong', code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'unauthorized');
    assert.ok(!('families' in res.body), 'no family data on a wrong password');
    res = mockRes();
    await find(mockReq('POST', { code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 401);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: code lookup returns the family summary and nothing else', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    const res = mockRes();
    // Lower-case code: normalisation must still find the family.
    await find(mockReq('POST', { password: 'master-123', code: 'abc2de' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.families.length, 1);
    assert.equal(res.body.families[0].code, 'ABC2DE');
    assert.deepEqual(res.body.families[0].explorers, [
      { name: 'Star', level: 'P3' },
      { name: 'Moon', level: 'P4' },
    ]);
    // No PIN, no progress, no chats anywhere in the reply.
    const flat = JSON.stringify(res.body);
    assert.ok(!flat.includes('1111'), 'old PIN must not leak');
    assert.ok(!flat.includes('parentPin'), 'no parentPin key');
    assert.ok(!flat.includes('2222') && !flat.includes('3333'), 'no other family PIN');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: code lookup with no match -> empty families', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    const res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: 'ZZZ9ZZ' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.families, []);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: name search is case-insensitive and returns all matches', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    let res = mockRes();
    await find(mockReq('POST', { password: 'master-123', name: 'star' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.families.length, 2, 'Star and Starfish both match');
    assert.deepEqual(res.body.families.map((f) => f.code).sort(), ['ABC2DE', 'FGH3JK']);
    res = mockRes();
    await find(mockReq('POST', { password: 'master-123', name: 'STAR' }), res);
    assert.equal(res.body.families.length, 2, 'upper-case query matches too');
    res = mockRes();
    await find(mockReq('POST', { password: 'master-123', name: 'river' }), res);
    assert.equal(res.body.families.length, 1);
    assert.equal(res.body.families[0].code, 'LMN4PQ');
    const flat = JSON.stringify(res.body);
    assert.ok(!flat.includes('3333'), 'no PIN in a name search either');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: name with no match -> empty; neither code nor name -> 400; bad code -> 400', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    let res = mockRes();
    await find(mockReq('POST', { password: 'master-123', name: 'nobody' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.families, []);
    res = mockRes();
    await find(mockReq('POST', { password: 'master-123' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'code or name required');
    res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: 'ABC' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'invalid_code');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: non-POST -> 405', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const res = mockRes();
  await find(mockReq('GET', null), res);
  assert.equal(res.statusCode, 405);
  clearEnv();
});

test('admin-reset-pin: correct password sets the new PIN and never returns the old one', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-pin');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ABC2DE', newPin: '9999' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.code, 'ABC2DE');
    assert.deepEqual(res.body.explorers, [
      { name: 'Star', level: 'P3' },
      { name: 'Moon', level: 'P4' },
    ]);
    assert.equal(routes.writes, 1, 'one Supabase write');
    assert.equal(routes.captured.code, 'ABC2DE');
    assert.equal(routes.captured.data.parentPin, '9999', 'new PIN written');
    // The old PIN is gone from the saved record and from the reply.
    assert.ok(!JSON.stringify(routes.captured.data).includes('"parentPin":"1111"'), 'old PIN replaced in the saved record');
    assert.ok(!JSON.stringify(res.body).includes('1111'), 'old PIN not in the reply');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-reset-pin: wrong password -> 401 and the PIN is unchanged (no write)', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-pin');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await reset(mockReq('POST', { password: 'wrong', code: 'ABC2DE', newPin: '9999' }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(routes.writes, 0, 'no Supabase write on a wrong password');
    assert.equal(routes.captured, null);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-reset-pin: bad newPin -> 400 and the PIN is unchanged (no write)', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-pin');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    for (const bad of ['99', 'abcd', '12345', '', '12 4']) {
      const res = mockRes();
      await reset(mockReq('POST', { password: 'master-123', code: 'ABC2DE', newPin: bad }), res);
      assert.equal(res.statusCode, 400, 'newPin ' + JSON.stringify(bad) + ' rejected');
      assert.equal(res.body.error, 'invalid_pin');
    }
    assert.equal(routes.writes, 0, 'no Supabase write for a bad PIN');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-reset-pin: unknown code -> 404; ADMIN_PASSWORD unset -> 503; non-POST -> 405', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-pin');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    let res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ZZZ9ZZ', newPin: '9999' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'family_not_found');
    assert.equal(routes.writes, 0);
    delete process.env.ADMIN_PASSWORD;
    res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ABC2DE', newPin: '9999' }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'admin_not_configured');
    assert.equal(routes.writes, 0, 'no write when unconfigured');
    process.env.ADMIN_PASSWORD = 'master-123';
    res = mockRes();
    await reset(mockReq('GET', null), res);
    assert.equal(res.statusCode, 405);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin: Supabase unconfigured -> 502, not a bypass', async () => {
  clearEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const reset = loadHandler('admin-reset-pin');
  let res = mockRes();
  await find(mockReq('POST', { password: 'master-123', code: 'ABC2DE' }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'supabase_not_configured');
  res = mockRes();
  await reset(mockReq('POST', { password: 'master-123', code: 'ABC2DE', newPin: '9999' }), res);
  assert.equal(res.statusCode, 502);
  clearEnv();
});
