// NUL sanitizer (2026-11-09): Postgres text/JSONB cannot store \u0000.
// A payload containing one is rejected with 22P05 "unsupported Unicode
// escape sequence" and the whole upsert fails with HTTP 502. The live
// symptom was the timetable save always ending in "the server answered
// with an error (HTTP 502)" while the local save worked — the app's
// local DB had a NUL somewhere in it (the server's stored copy did
// not, which is why direct terminal POSTs of the stored data returned
// 200). The fix strips \u0000 from every string before the data is
// saved or synced (client) and before the upsert (server, defense in
// depth). A NUL is invisible and carries no meaning, so removing it
// loses nothing.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function extractFn(name, startMarker) {
  const i = html.indexOf(startMarker);
  assert.ok(i >= 0, startMarker + ' must exist in public/index.html');
  // Find the matching closing brace by counting braces from the opening one.
  const open = html.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces for ' + name);
}

function loadClientFn(name, startMarker) {
  const src = extractFn(name, startMarker);
  const ctx = vm.createContext({ console });
  vm.runInContext(src + '\nthis.__fn=' + name + ';', ctx);
  return ctx.__fn;
}

test('stripNulDeep removes NULs from nested strings, arrays and objects', () => {
  const stripNulDeep = loadClientFn('stripNulDeep', 'function stripNulDeep(v){');
  assert.equal(stripNulDeep('a\u0000b'), 'ab');
  assert.equal(stripNulDeep('clean'), 'clean');
  assert.equal(stripNulDeep('a\u0000b\u0000c'), 'abc');
  const obj = { name: 'x\u0000y', list: ['p\u0000', { note: 'n\u0000ote' }], n: 42, b: true, z: null };
  stripNulDeep(obj);
  assert.deepEqual(obj, { name: 'xy', list: ['p', { note: 'note' }], n: 42, b: true, z: null });
  // Non-string scalars pass through untouched.
  assert.equal(stripNulDeep(7), 7);
  assert.equal(stripNulDeep(null), null);
  assert.equal(stripNulDeep(undefined), undefined);
});

test('save() strips NULs from the DB before writing it locally', () => {
  const b = html.slice(html.indexOf('function save(){'), html.indexOf('function save(){') + 400);
  assert.ok(b.includes('stripNulDeep(DB)'), 'save() must strip NULs from DB before saveLocal()');
  assert.ok(b.indexOf('stripNulDeep(DB)') < b.indexOf('saveLocal()'), 'the strip must happen before the local write');
});

test('postToServer strips NULs before sending the payload', () => {
  const b = extractFn('postToServer', 'function postToServer(key){');
  assert.ok(b.includes('stripNulDeep(DB)'), 'postToServer must strip NULs from DB before the fetch');
  assert.ok(b.indexOf('stripNulDeep(DB)') < b.indexOf("fetch('/api/progress'"), 'the strip must happen before the POST');
});

// Server-side: api/progress.js must strip NULs before the Supabase
// upsert, so a stray NUL from any client can never produce a 502.
function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}

test('server strips NULs from the payload before the upsert', async () => {
  delete require.cache[require.resolve('../api/progress')];
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-key';
  let upsertBody = null;
  global.fetch = async (url, init) => {
    if (String(url).includes('/rest/v1/family_progress?code=eq.')) {
      // Revision-guard read: no stored row.
      return { ok: true, json: async () => [] };
    }
    if (String(url).includes('/rest/v1/family_progress?on_conflict=code')) {
      upsertBody = JSON.parse(init.body);
      return { ok: true, json: async () => [{ updated_at: '2026-11-09T00:00:00.000Z' }] };
    }
    throw new Error('unexpected fetch: ' + url);
  };
  const handler = require('../api/progress');
  const data = { syncCode: '8SXU6S', explorers: [{ name: 'A\u0000B', notes: ['x\u0000'] }], familyPlan: { 1: { study: 'Study\u0000 4:00pm' } } };
  const res = mockRes();
  await handler({ method: 'POST', query: {}, body: { code: '8SXU6S', data } }, res);
  assert.equal(res.statusCode, 200, 'the upsert must succeed once NULs are stripped');
  assert.ok(upsertBody, 'the upsert must have been called');
  const s = JSON.stringify(upsertBody.data);
  assert.ok(!s.includes('\\u0000'), 'the upserted payload must contain no NUL escape');
  assert.equal(upsertBody.data.explorers[0].name, 'AB');
  assert.equal(upsertBody.data.familyPlan[1].study, 'Study 4:00pm');
  delete global.fetch;
});
