// tests/sync-light.test.js — lightweight "has it changed" sync check.
// Regression tests for the 2026-11-09 change that makes every pull do a
// cheap ?check=1 GET first (~100 bytes) and skip the full-row download
// (~40 KB) when the server row has not changed since the local DB was
// last synced. Covers: the check endpoint shape, skip-on-match, download
// on mismatch, fail-open on a bad check, never-synced always downloads,
// a save still uploading when the check says unchanged, postToServer
// bookkeeping (POST updatedAt stored), confirmPlanSaved still using the
// full GET, and the server revision guard still working.
//
// The harness (fnText/varText, SYNC_FNS, makeTab, makeFamily, the mock
// server) is copied from tests/save-upload-confirm.test.js, with the mock
// extended to distinguish check GETs from full GETs and log every request.
'use strict';
const assert = require('node:assert');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');

function fnText(marker) {
  const start = indexSrc.indexOf(marker);
  if (start < 0) throw new Error('missing function ' + marker);
  const end = indexSrc.indexOf('\n}\n', start);
  if (end < 0) throw new Error('no body close for ' + marker);
  return indexSrc.slice(start, end + 3);
}
function varText(name) {
  const m = indexSrc.match(new RegExp('var ' + name + '=([^;]+);'));
  assert.ok(m, name + ' var not found in index.html');
  return 'var ' + name + '=' + m[1] + ';';
}
function bodyOf(marker) {
  const start = indexSrc.indexOf(marker);
  const next = indexSrc.indexOf('\nfunction ', start + marker.length);
  return indexSrc.slice(start, next < 0 ? undefined : next);
}

const SYNC_FNS = [
  'function makeSyncCode(){', 'function syncCodeValid(v){', 'function ensureSyncCode(){',
  'function syncKey(){', 'function drainPendingUpload(){', 'function saveLocal(){',
  'function postToServer(key){', 'function planDayEqual(', 'function plansEqual(',
  'function confirmPlanSaved(', 'function syncToServer(){',
  'function uploadAfterPull(){',
  'function unionArr(a,b){', 'function unionObjMax(a,b){', 'function unionObjLatest(a,b){',
  'function isThinkingMsg(m){', 'function mergeThreads(aThreads,bThreads){',
  'function pickCritterName(a,b){', 'function mergeCare(a,b){', 'function mergeExplorer(a,b){',
  'function mergeFamilyDB(local, server){', 'function syncFromServer(opts){',
  'function mergeStoredIntoDB(){', 'function save(){', 'function load(){',
  'function migrateStages(){', 'function isModalOpen(){', 'function safeToRender(){',
  'function newExplorer(name, code, level){', 'function genFriendCode(){',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Postgres JSONB key order: sort object keys by length, then bytewise.
// The mock server stores POSTed data through this, exactly like the
// real Supabase JSONB column, so the confirm GET returns reordered
// keys and plansEqual is genuinely exercised.
function jsonbNormalize(v) {
  if (Array.isArray(v)) return v.map(jsonbNormalize);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0))
      .forEach((k) => { out[k] = jsonbNormalize(v[k]); });
    return out;
  }
  return v;
}

function makeExplorer(id, name) {
  // A realistic explorer: every field newExplorer() creates, so that
  // mergeExplorer() merging two identical copies is a true no-op
  // (it rebuilds the object and would otherwise ADD the missing
  // fields — starsEarned, playBest, ... — making the merge report a
  // change even when nothing differs).
  return {
    id, name, code: '8SXU6S', codeAt: null, level: 'P3', levelAt: 1700000000000,
    friendCode: 'FR' + id, friends: [], nameAt: null, lookAt: null,
    face: '🐤', glow: '#ffb020', badge: '⭐',
    look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } },
    stars: 5, starsEarned: 5, starsSpent: 0, badges: [],
    completed: {}, completedDay: {}, progress: {},
    playProgress: {}, playFresh: {}, playDoneDay: {}, playDaily: {}, playSeen: {},
    playBest: {}, learnBest: {},
    critterName: 'Splash', critterNameAt: null, critterStage: 3, critterStageDays: 0,
    care: {}, careGrewDay: null, discoveredCritters: [],
    theme: 'Frog Pond', themeAt: null, treasures: [],
    threads: [], deletedThreadIds: [], threadSeq: 0, daily: {}, totalMinutes: 0,
    lastTopic: null, favAnswers: [], deletedFavAnswers: [], swapIdx: 0,
    mood: {}, stuckCount: {}, boost: {},
    flashcards: [], deletedFlashcards: [], deletedPlanner: [], spellingTests: [],
    deletedSpellingTests: [], planner: [], flags: [], created: 1700000000000,
    hclMissed: [], deletedFriends: [], threadsClearedAt: null,
    // Backfilled by mergeExplorer() on the first merge (not created by
    // newExplorer): without these, the merge adds them and reports a
    // change even when nothing differs.
    playBest: {}, learnBest: {}, stuck: [],
  };
}
const VERIFY_PLAN = { 1: { label: 'English + Maths + Science', subs: ['eng', 'math', 'sci'], study: 'Study 5:00–6:00pm VERIFY', note: '', rest: false, review: false, light: false } };
const TEST_PLAN = { 1: { label: 'English + Science', subs: ['eng', 'sci'], study: 'Study 4:00–5:00pm TEST', note: '', rest: false, review: false, light: false } };

function makeFamily(plan, rev, updatedAt) {
  const f = {
    explorers: [makeExplorer('e1', 'TestVerify1'), makeExplorer('e2', 'TestVerify2')],
    parentPin: '2468', dailyLimit: 30, playLimit: 20, activeId: 'e1',
    syncCode: '8SXU6S', updatedAt: updatedAt, flags: [], stageV: 2,
    parentPinUpdatedAt: '2026-11-09T00:00:00.000Z',
    familyEvents: [], deletedFamilyEvents: [],
  };
  if (plan) {
    f.familyPlan = JSON.parse(JSON.stringify(plan));
    f.familyPlanRev = rev;
    f.familyPlanUpdatedAt = updatedAt;
  }
  // Normalised (Supabase JSONB) key order, so a local copy and the
  // server copy stringify identically when their content matches —
  // otherwise mergeFamilyDB (which starts from a copy of the server
  // row) would report a change on key order alone.
  return jsonbNormalize(f);
}

// Mock server: stores the POSTed record JSONB-normalised (like the
// real Supabase column) and answers GETs from it. It distinguishes the
// lightweight check GET (?check=1, returns ONLY updatedAt, no data)
// from full GETs, logs every request, and can fail the check.
function makeMockServer(opts) {
  const server = { row: null, posts: [], log: [], failCheck: !!(opts && opts.failCheck) };
  if (opts && opts.failCheck === 'reject') server.failCheck = 'reject';
  server.fetch = function (url, fetchOpts) {
    if (fetchOpts && fetchOpts.method === 'POST') {
      const body = JSON.parse(fetchOpts.body);
      server.log.push({ method: 'POST', kind: 'post', rev: body.data.familyPlanRev });
      server.posts.push({ code: body.code, rev: body.data.familyPlanRev, mon: body.data.familyPlan && body.data.familyPlan[1] ? body.data.familyPlan[1].study : '(none)' });
      server.row = { code: body.code, data: jsonbNormalize(JSON.parse(JSON.stringify(body.data))), updatedAt: new Date().toISOString() };
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt, familyPlanRev: server.row.data.familyPlanRev || 0, planPreserved: false }) });
    }
    const m = String(url).match(/code=([^&]*)/);
    const code = m ? decodeURIComponent(m[1]) : null;
    const row = server.row && server.row.code === code ? server.row : null;
    if (String(url).includes('check=1')) {
      server.log.push({ method: 'GET', kind: 'check' });
      if (server.failCheck === 'reject') return Promise.reject(new Error('network down'));
      if (server.failCheck) return Promise.resolve({ ok: false, status: 502, json: async () => ({ error: 'supabase_read_failed' }) });
      // The real check endpoint returns ONLY updatedAt — no data key.
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ configured: true, updatedAt: row ? row.updatedAt : null }) });
    }
    server.log.push({ method: 'GET', kind: 'full' });
    const snap = row ? { configured: true, data: JSON.parse(JSON.stringify(row.data)), updatedAt: row.updatedAt } : { configured: true, data: null, updatedAt: null };
    return Promise.resolve({ ok: true, status: 200, json: async () => snap });
  };
  return server;
}

function makeTab(store, server) {
  const sandbox = {
    console, setTimeout, clearTimeout,
    JSON, Object, Array, Math, Date, Promise,
    DB: null, DEVICE_ID: 'd-test-tab',
    syncPulling: false, syncUploadPending: false, syncTimer: null, postRetryCount: 0,
    route: 'parent',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: (url, opts) => server.fetch(url, opts),
    document: {
      visibilityState: 'visible',
      getElementById: () => null,
      addEventListener: () => {},
      querySelectorAll: () => [],
      activeElement: null,
    },
    render: () => {},
    toast: () => {},
    addEventListener: () => {},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(varText('LSKEY'), ctx);
  vm.runInContext(varText('SYNC_ALPHABET'), ctx);
  for (const marker of SYNC_FNS) vm.runInContext(fnText(marker), ctx);
  return { run: (code) => vm.runInContext(code, ctx) };
}

async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await sleep(100);
  }
  assert.fail('timed out waiting for: ' + label);
}

/* ---- Minimal req/res for the api/progress tests ---- */
function mockReq(method, body, query) {
  return { method, body: body || {}, query: query || {}, headers: {} };
}
function mockRes() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

/* ================= server: the check endpoint ================= */

test('check endpoint (?check=1) returns only updatedAt, never the data; the full GET is unchanged', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  const origFetch = global.fetch;
  const family = makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z');
  const supabaseCalls = [];
  global.fetch = async (url) => {
    supabaseCalls.push(String(url));
    return { ok: true, json: async () => [{ data: JSON.parse(JSON.stringify(family)), updated_at: '2026-11-09T05:00:00.000Z' }] };
  };
  try {
    // Check mode.
    const resCheck = mockRes();
    await progress(mockReq('GET', null, { code: '8SXU6S', check: '1' }), resCheck);
    assert.equal(resCheck.statusCode, 200);
    assert.equal(resCheck.body.configured, true);
    assert.equal(resCheck.body.updatedAt, '2026-11-09T05:00:00.000Z');
    assert.ok(!('data' in resCheck.body), 'the check response must NOT carry the data field');
    const checkBytes = JSON.stringify(resCheck.body).length;
    assert.ok(supabaseCalls[0].includes('select=updated_at'), 'the check must query updated_at only, got: ' + supabaseCalls[0]);
    assert.ok(!supabaseCalls[0].includes('select=data'), 'the check must not select the data column');
    // Full GET is unchanged.
    const resFull = mockRes();
    await progress(mockReq('GET', null, { code: '8SXU6S' }), resFull);
    assert.equal(resFull.statusCode, 200);
    assert.ok(resFull.body.data && resFull.body.data.explorers, 'the full GET still returns the data');
    assert.equal(resFull.body.updatedAt, '2026-11-09T05:00:00.000Z');
    assert.ok(supabaseCalls[1].includes('select=data,updated_at'), 'the full GET still selects data,updated_at');
    const fullBytes = JSON.stringify(resFull.body).length;
    assert.ok(checkBytes < 200, 'the check response is tiny (' + checkBytes + ' bytes)');
    assert.ok(fullBytes > checkBytes * 10, 'the full row (' + fullBytes + ' bytes) is far larger than the check (' + checkBytes + ' bytes)');
  } finally { global.fetch = origFetch; }
});

test('check endpoint returns updatedAt:null for an unknown family code', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => [] });
  try {
    const res = mockRes();
    await progress(mockReq('GET', null, { code: 'ZZZZZZ', check: '1' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.configured, true);
    assert.equal(res.body.updatedAt, null);
    assert.ok(!('data' in res.body));
  } finally { global.fetch = origFetch; }
});

/* ================= client: syncFromServer ================= */

test('syncFromServer skips the full download when the server has not changed', async () => {
  const store = {};
  const server = makeMockServer();
  const S = '2026-11-09T05:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.updatedAt'), S, 'the tab starts synced at S');
  server.log.length = 0;
  const changed = await tab.run('syncFromServer({})');
  assert.equal(changed, false, 'no change when the server has not changed');
  assert.deepEqual(server.log.map((e) => e.kind), ['check'], 'only the cheap check GET runs — no full download');
  assert.equal(tab.run('DB.updatedAt'), S, 'DB.updatedAt is unchanged');
  assert.equal(server.posts.length, 0, 'no upload is needed when nothing changed');
});

test('syncFromServer downloads the full row when the server has changed', async () => {
  const store = {};
  const server = makeMockServer();
  const S = '2026-11-09T05:00:00.000Z';
  const S2 = '2026-11-09T06:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(VERIFY_PLAN, 2, S2)), updatedAt: S2 };
  const tab = makeTab(store, server);
  tab.run('load()');
  server.log.length = 0;
  const changed = await tab.run('syncFromServer({})');
  assert.equal(changed, true, 'the server change is picked up');
  assert.ok(server.log.some((e) => e.kind === 'check'), 'a check GET ran first');
  assert.ok(server.log.some((e) => e.kind === 'full'), 'a full GET followed because the check said changed');
  assert.equal(tab.run('DB.familyPlan[1].study'), 'Study 5:00–6:00pm VERIFY', 'the tab adopts the server plan');
  // The pull changed the DB, so it uploads back; the upload's response
  // timestamp is then what DB.updatedAt tracks (the bookkeeping fix).
  await waitFor(() => tab.run('DB.updatedAt') === server.row.updatedAt, 3000, 'DB.updatedAt tracks the server after the pull+upload');
});

test('syncFromServer falls back to the full download when the check answers non-OK', async () => {
  const store = {};
  const server = makeMockServer({ failCheck: true });
  const S = '2026-11-09T05:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  server.log.length = 0;
  const changed = await tab.run('syncFromServer({})');
  assert.equal(changed, false, 'no change (the server matches the local copy)');
  assert.ok(server.log.some((e) => e.kind === 'check'), 'the check was attempted');
  assert.ok(server.log.some((e) => e.kind === 'full'), 'the failed check fell back to a full GET');
});

test('syncFromServer falls back to the full download when the check request throws', async () => {
  const store = {};
  const server = makeMockServer({ failCheck: 'reject' });
  const S = '2026-11-09T05:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  server.log.length = 0;
  await tab.run('syncFromServer({})');
  assert.ok(server.log.some((e) => e.kind === 'check'), 'the check was attempted');
  assert.ok(server.log.some((e) => e.kind === 'full'), 'the thrown check fell back to a full GET');
});

test('syncFromServer always downloads when the local DB has no updatedAt', async () => {
  const store = {};
  const server = makeMockServer();
  const S = '2026-11-09T05:00:00.000Z';
  const fam = makeFamily(TEST_PLAN, 1, S);
  fam.updatedAt = null;
  store['jiyuna-learning-web-v1'] = JSON.stringify(fam);
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.updatedAt'), null, 'the local DB has no updatedAt (never synced)');
  server.log.length = 0;
  await tab.run('syncFromServer({})');
  assert.ok(server.log.some((e) => e.kind === 'full'), 'a full GET runs when the local DB has never synced');
  // The pull adopts the server plan (changed, so it uploads back) and
  // DB.updatedAt ends up tracking the server's current timestamp.
  await waitFor(() => tab.run('DB.updatedAt') === server.row.updatedAt, 3000, 'DB.updatedAt tracks the server after the pull+upload');
});

/* ================= client: uploadAfterPull + postToServer ================= */

test('uploadAfterPull skips the pull but still uploads when the check says unchanged', async () => {
  const store = {};
  const server = makeMockServer();
  const S = '2026-11-09T05:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  // A local change that has NOT gone through save() (so DB.updatedAt is
  // still the server timestamp S). This is the state after an auto-pull
  // synced in between a save and its debounced upload: the check says
  // unchanged, so the pull may be skipped — but the upload must go on.
  tab.run('DB.familyPlan=' + JSON.stringify(VERIFY_PLAN) + '; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1;');
  assert.equal(tab.run('DB.updatedAt'), S, 'DB.updatedAt is still the server timestamp');
  server.log.length = 0;
  tab.run('uploadAfterPull()');
  await waitFor(() => server.posts.some((p) => p.rev === 2), 6000, 'upload POST with rev 2');
  assert.ok(server.log.some((e) => e.kind === 'check'), 'the check ran');
  assert.ok(!server.log.some((e) => e.kind === 'full'), 'NO full GET — the pull was skipped');
  assert.equal(server.row.data.familyPlanRev, 2, 'the upload still landed');
  assert.equal(server.row.data.familyPlan[1].study, 'Study 5:00–6:00pm VERIFY', 'the server holds the new plan');
  // Bookkeeping: after the upload, DB.updatedAt is the server's
  // post-upload timestamp — otherwise the next auto-pull would see a
  // mismatch and download the whole row for no reason.
  await waitFor(() => tab.run('DB.updatedAt') === server.row.updatedAt, 3000, 'DB.updatedAt tracks the server after the upload');
});

test('postToServer stores the server post-upload timestamp into DB.updatedAt', async () => {
  const store = {};
  const server = makeMockServer();
  const S = '2026-11-09T05:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.updatedAt'), S);
  tab.run('postToServer("8SXU6S")');
  await waitFor(() => server.posts.length === 1, 3000, 'the POST lands');
  await waitFor(() => tab.run('DB.updatedAt') === server.row.updatedAt, 3000, 'DB.updatedAt is the POST response timestamp');
  assert.notEqual(tab.run('DB.updatedAt'), S, 'DB.updatedAt moved on from the pre-upload timestamp');
  // A pull right after the upload now skips the download: the check
  // sees the server timestamp matches DB.updatedAt.
  server.log.length = 0;
  const changed = await tab.run('syncFromServer({})');
  assert.equal(changed, false);
  assert.deepEqual(server.log.map((e) => e.kind), ['check'], 'the post-upload pull is check-only');
});

/* ================= confirmPlanSaved still uses the full GET ================= */

test('confirmPlanSaved still uses the full GET, never the check', async () => {
  const src = bodyOf('function confirmPlanSaved(');
  assert.ok(src.includes("fetch('/api/progress?code='"), 'confirmPlanSaved fetches the progress endpoint');
  assert.ok(!src.includes('check=1'), 'confirmPlanSaved must not use the lightweight check — it needs the full row');
  // Behavioural: run it against the mock and confirm a full GET lands.
  const store = {};
  const server = makeMockServer();
  const S = '2026-11-09T05:00:00.000Z';
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(VERIFY_PLAN, 2, S));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(VERIFY_PLAN, 2, S)), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  server.log.length = 0;
  tab.run('confirmPlanSaved(2,' + JSON.stringify(VERIFY_PLAN) + ',function(ok){ __confirmResult = ok; });');
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 6000, 'confirmPlanSaved to call back');
  assert.equal(tab.run('__confirmResult'), true, 'confirmPlanSaved confirms the plan on the server');
  assert.ok(server.log.some((e) => e.kind === 'full'), 'confirmPlanSaved issued a full GET');
  assert.ok(!server.log.some((e) => e.kind === 'check'), 'confirmPlanSaved issued no check GET');
});

/* ================= server: the revision guard still works ================= */

test('the server revision guard still rejects a stale lower-rev write', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  const origFetch = global.fetch;
  let stored = null;
  const S = '2026-11-09T05:00:00.000Z';
  const newer = makeFamily(VERIFY_PLAN, 2, S);
  global.fetch = async (url, init) => {
    const u = String(url);
    if (init && init.method === 'POST') {
      const body = JSON.parse(init.body);
      const incomingRev = body.data.familyPlanRev || 0;
      if (stored && stored.data.familyPlanRev > incomingRev) {
        return { ok: true, json: async () => ({ ok: true, updatedAt: stored.updatedAt, familyPlanRev: stored.data.familyPlanRev, planPreserved: true }) };
      }
      stored = { code: body.code, data: JSON.parse(JSON.stringify(body.data)), updatedAt: new Date().toISOString() };
      return { ok: true, json: async () => ({ ok: true, updatedAt: stored.updatedAt, familyPlanRev: stored.data.familyPlanRev, planPreserved: false }) };
    }
    if (u.includes('select=updated_at')) return { ok: true, json: async () => (stored ? [{ updated_at: stored.updatedAt }] : []) };
    return { ok: true, json: async () => (stored ? [{ data: JSON.parse(JSON.stringify(stored.data)), updated_at: stored.updatedAt }] : []) };
  };
  try {
    // Store rev 2 first.
    const resNew = mockRes();
    await progress(mockReq('POST', { code: '8SXU6S', device: 'd1', data: newer }, {}), resNew);
    assert.equal(resNew.statusCode, 200);
    assert.equal(resNew.body.planPreserved, false);
    // Then a stale rev-1 write must be rejected and the stored plan kept.
    const stale = makeFamily(TEST_PLAN, 1, '2026-11-09T04:00:00.000Z');
    const resStale = mockRes();
    await progress(mockReq('POST', { code: '8SXU6S', device: 'd2', data: stale }, {}), resStale);
    assert.equal(resStale.statusCode, 200);
    assert.equal(resStale.body.planPreserved, true, 'the stale write is flagged as preserved');
    assert.equal(stored.data.familyPlanRev, 2, 'the stored plan is still rev 2');
    assert.equal(stored.data.familyPlan[1].study, 'Study 5:00–6:00pm VERIFY', 'the stored plan is still the newer one');
  } finally { global.fetch = origFetch; }
});
