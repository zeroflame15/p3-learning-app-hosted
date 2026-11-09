'use strict';
// Schedule-save sync: the confirm window was shorter than the upload
// pipeline (ROOT CAUSE, measured live 2026-11-09).
//
// What Bryan saw: saving a timetable on the parent page always ended
// with "Couldn't confirm the timetable saved to the server", although
// the local save worked. The TEST family row is 39,609 bytes — 12.6x
// headroom under the server's 500,000 byte cap — so row size is NOT
// the cause. The cause is timing, measured live the same day:
//   * every /api/progress round trip takes ~1.0-1.4s (Vercel function
//     in iad1 + Supabase in Singapore);
//   * the upload pipeline is 800ms debounce + a ?check=1 GET + a full
//     pull GET + the POST = ~3-5s, longer on a cold start;
//   * the old confirm gave up after 2 attempts (first check 1.2s,
//     one retry 1.5s later), and the first check ALWAYS missed — the
//     POST cannot start before 800ms + check-RTT + pull-RTT (~3s) —
//     so the confirm effectively had ONE attempt racing the POST.
// The fix (see new-fixes-20261109/sync/apply-sync-fix.js):
//   (1) uploadAfterPull skips the ?check=1 hop, which can never hit
//       on the upload path (save() always re-stamps DB.updatedAt) and
//       cost a whole ~1.2s round trip;
//   (2) confirmPlanSaved polls up to 5 times (~7.2s) and only
//       re-triggers the upload on the first miss, when no upload is
//       already running;
//   (3) postToServer records the last upload outcome, and the failure
//       toast names the actual reason (too-large / server / network /
//       pending) instead of one generic message.
// These tests use the REAL extracted functions with a mock server
// that has REALISTIC latencies (GET 1000ms, POST 1800ms — the POST
// does two Supabase calls, read-guard + upsert, where a GET does
// one — plus a 1500ms cold-start penalty on the first request, as a
// rarely-used serverless function has after sitting idle). The old
// instant-fetch mocks hid this bug completely: with 0ms latency the
// whole pipeline finishes inside the 800ms debounce + a tick.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const lineEnd = html.indexOf('\n', start);
  const line = html.slice(start, lineEnd);
  let depth = 0;
  for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0 && line.trimEnd().endsWith('}')) return line;
  const end = html.indexOf('\n}\n', start);
  assert.ok(end >= 0, marker + ' body never closes');
  return html.slice(start, end + 3);
}
function varText(name) {
  const m = html.match(new RegExp('var ' + name + '=([^;]+);'));
  assert.ok(m, name + ' var not found in index.html');
  return 'var ' + name + '=' + m[1] + ';';
}

const SYNC_FNS = [
  'function makeSyncCode(){', 'function syncCodeValid(v){', 'function ensureSyncCode(){',
  'function syncKey(){', 'function drainPendingUpload(){', 'function saveLocal(){',
  'function postToServer(key){', 'function planDayEqual(', 'function plansEqual(',
  'function confirmPlanSaved(', 'function confirmFailReason(){', 'function planSaveFailToast(',
  'function syncToServer(){',
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
  return {
    id, name, stars: 5, critterStage: 3, care: {}, badges: [], treasures: [],
    discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
    progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {},
    stuckCount: {}, threads: [], deletedThreadIds: [], flashcards: [],
    deletedFlashcards: [], planner: [], deletedPlanner: [], hclMissed: [],
    favAnswers: [], critterName: 'Splash', critterNameAt: null, nameAt: null,
    lookAt: null, glow: '#ffb020', badge: '⭐', careGrewDay: null,
  };
}
const VERIFY_PLAN = { 1: { label: 'English + Maths + Science', subs: ['eng', 'math', 'sci'], study: 'Study 5:00–6:00pm VERIFY', note: '', rest: false, review: false, light: false } };
const TEST_PLAN = { 1: { label: 'English + Science', subs: ['eng', 'sci'], study: 'Study 4:00–5:00pm TEST', note: '', rest: false, review: false, light: false } };

function makeFamily(plan, rev, updatedAt) {
  const f = {
    explorers: [makeExplorer('e1', 'TestVerify1'), makeExplorer('e2', 'TestVerify2')],
    parentPin: '2468', dailyLimit: 30, playLimit: 20, activeId: 'e1',
    syncCode: '8SXU6S', updatedAt: updatedAt, flags: [], stageV: 2,
  };
  if (plan) {
    f.familyPlan = JSON.parse(JSON.stringify(plan));
    f.familyPlanRev = rev;
    f.familyPlanUpdatedAt = updatedAt;
  }
  return f;
}

// Mock server with REALISTIC latencies. `latency` is { get, post } in
// ms; `coldStartMs` is added to the FIRST request only (a serverless
// function idle since the last save cold-starts). `postStatus` makes
// every POST answer that HTTP status; `failAll` makes every request
// reject (device offline). `?check=1` answers like the real API:
// { configured, updatedAt } only, no data.
function makeMockServer(opts) {
  opts = opts || {};
  const latency = opts.latency || { get: 50, post: 50 };
  const server = { row: null, posts: [], requests: [], postLandedAt: null, t0: Date.now() };
  let firstReq = true;
  server.fetch = function (url, fetchOpts) {
    const method = (fetchOpts && fetchOpts.method) || 'GET';
    const isPost = method === 'POST';
    const extra = firstReq ? (opts.coldStartMs || 0) : 0;
    firstReq = false;
    const wait = (isPost ? latency.post : latency.get) + extra;
    server.requests.push({ method, url: String(url), at: Date.now() - server.t0 });
    const work = () => {
      if (opts.failAll) throw new Error('network down');
      if (isPost) {
        const body = JSON.parse(fetchOpts.body);
        server.posts.push({ code: body.code, rev: body.data.familyPlanRev, mon: body.data.familyPlan && body.data.familyPlan[1] ? body.data.familyPlan[1].study : '(none)' });
        if (opts.postStatus && opts.postStatus !== 200) {
          return { ok: false, status: opts.postStatus, json: async () => ({ error: opts.postStatus === 413 ? 'progress too large' : 'supabase_write_failed' }) };
        }
        server.row = { code: body.code, data: jsonbNormalize(JSON.parse(JSON.stringify(body.data))), updatedAt: new Date().toISOString() };
        server.postLandedAt = Date.now() - server.t0;
        return { ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt, familyPlanRev: server.row.data.familyPlanRev || 0, planPreserved: false }) };
      }
      const m = String(url).match(/code=([^&]*)/);
      const code = m ? decodeURIComponent(m[1]) : null;
      const row = server.row && server.row.code === code ? server.row : null;
      if (String(url).indexOf('check=1') >= 0) {
        return { ok: true, status: 200, json: async () => ({ configured: true, updatedAt: row ? row.updatedAt : null }) };
      }
      const snap = row ? { configured: true, data: JSON.parse(JSON.stringify(row.data)), updatedAt: row.updatedAt } : { configured: true, data: null, updatedAt: null };
      return { ok: true, status: 200, json: async () => snap };
    };
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try { resolve(work()); } catch (e) { reject(e); }
      }, wait);
    });
  };
  return server;
}

function makeTab(store, server) {
  const sandbox = {
    console, setTimeout, clearTimeout,
    JSON, Object, Array, Math, Date, Promise,
    DB: null, DEVICE_ID: 'd-test-tab',
    syncPulling: false, syncUploadPending: false, syncTimer: null, postRetryCount: 0,
    lastUploadStatus: 0, lastUploadOk: false, uploadsActive: 0, uploadFinal: false,
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

function seedTab(server) {
  const store = {};
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z'));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z')), updatedAt: '2026-11-09T05:00:00.000Z' };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.familyPlan[1].study'), 'Study 4:00–5:00pm TEST', 'tab loads the TEST plan');
  return tab;
}

// Simulate the real timetable Save handler: new plan, rev bump,
// save(), then confirmPlanSaved immediately (it runs concurrently
// with the upload, exactly as on the parent page).
function saveAndConfirm(tab) {
  tab.run("DB.familyPlan=" + JSON.stringify(VERIFY_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; var rev=DB.familyPlanRev; save();");
  tab.run("confirmPlanSaved(2, " + JSON.stringify(VERIFY_PLAN) + ", function(ok, reason){ __confirmResult = ok; __confirmReason = (typeof reason === 'undefined' ? null : reason); });");
}

test('schedule save confirms with realistic latency (root-cause regression)', async () => {
  // GET 1000ms, POST 1800ms, first request +1500ms cold start — the
  // measured live shape. Upload lands at ~5.1s, AFTER the old
  // 2-attempt window (first check 1.2s + retry 1.5s = 2.7s), so the
  // old confirm reported failure on this exact timeline while the
  // upload itself succeeded. The fixed confirm (5 polls, ~7.2s)
  // must succeed.
  const server = makeMockServer({ latency: { get: 1000, post: 1800 }, coldStartMs: 1500 });
  const tab = seedTab(server);
  const t0 = Date.now();
  saveAndConfirm(tab);
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 12000, 'confirmPlanSaved to call back');
  assert.equal(tab.run('__confirmResult'), true, 'confirm must succeed once the server holds the new plan — the success toast, not the failure one');
  assert.equal(server.row.data.familyPlanRev, 2, 'server holds rev 2 after the upload');
  assert.equal(server.row.data.familyPlan[1].study, 'Study 5:00–6:00pm VERIFY', 'server holds the VERIFY plan after the upload');
  assert.ok(server.postLandedAt > 2700, 'upload landed at ' + server.postLandedAt + 'ms — after the old 2-attempt window (2.7s), so the old confirm would have failed this exact save');
  assert.equal(server.requests.filter((r) => r.url.indexOf('check=1') >= 0).length, 0, 'the upload path must not spend a round trip on ?check=1 — it can never hit after a save');
});

test('upload path skips the ?check=1 hop', async () => {
  const server = makeMockServer({ latency: { get: 50, post: 50 } });
  const tab = seedTab(server);
  tab.run("DB.familyPlan=" + JSON.stringify(VERIFY_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; save();");
  await waitFor(() => server.posts.some((p) => p.rev === 2), 6000, 'upload POST with rev 2');
  assert.equal(server.requests.filter((r) => r.url.indexOf('check=1') >= 0).length, 0, 'no ?check=1 request during a save upload — save() re-stamps DB.updatedAt, so the check can never match and only costs a round trip');
  assert.ok(server.requests.some((r) => r.method === 'POST'), 'the upload POST still happens');
});

test('413 too large fails fast and names the reason', async () => {
  // The server refuses the whole family record (over 500 KB). The
  // confirm must NOT burn the full ~7s window polling for a plan
  // that can never land — a 413 fails fast on the first check
  // (~1.2s), because retrying the same oversized payload cannot
  // shrink it.
  const server = makeMockServer({ latency: { get: 50, post: 50 }, postStatus: 413 });
  const tab = seedTab(server);
  const t0 = Date.now();
  saveAndConfirm(tab);
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 12000, 'confirmPlanSaved to call back');
  const elapsed = Date.now() - t0;
  assert.equal(tab.run('__confirmResult'), false, 'confirm must fail when the server refuses the upload');
  assert.equal(tab.run('__confirmReason'), 'too-large', 'reason must be too-large, not a generic failure');
  assert.ok(elapsed < 4000, '413 must fail fast (' + elapsed + 'ms), not after the full polling window');
  assert.equal(server.row.data.familyPlanRev, 1, 'server still holds rev 1 — the oversized upload never landed');
});

test('server error names the reason', async () => {
  // POSTs keep answering 502. Once the bounded retries are
  // exhausted and no POST is on the wire, the confirm fails fast
  // from the second check (~2.8s) with 'server' instead of polling
  // the full ~7s window — but never before the first miss, so the
  // transient failure still gets its one rescue re-trigger.
  const server = makeMockServer({ latency: { get: 50, post: 50 }, postStatus: 502 });
  const tab = seedTab(server);
  saveAndConfirm(tab);
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 12000, 'confirmPlanSaved to call back');
  assert.equal(tab.run('__confirmResult'), false, 'confirm must fail when the server keeps erroring');
  assert.equal(tab.run('__confirmReason'), 'server', 'reason must be server for an HTTP 502');
  assert.equal(tab.run('lastUploadStatus'), 502, 'postToServer must record the 502 it was answered with');
});

test('network failure names the reason', async () => {
  // Every request rejects. Same settled-failure shape as the 502
  // test: fail fast from the second check (~2.8s) with 'network',
  // after the one rescue re-trigger has also failed to reach the
  // server.
  const server = makeMockServer({ latency: { get: 50, post: 50 }, failAll: true });
  const tab = seedTab(server);
  saveAndConfirm(tab);
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 12000, 'confirmPlanSaved to call back');
  assert.equal(tab.run('__confirmResult'), false, 'confirm must fail when the server cannot be reached');
  assert.equal(tab.run('__confirmReason'), 'network', 'reason must be network when every request rejects');
});

test('failure toasts name the actual reason', () => {
  const server = makeMockServer();
  const tab = seedTab(server);
  assert.match(tab.run("planSaveFailToast('too-large')"), /500 KB/, 'too-large toast must say the record is over the 500 KB limit');
  assert.match(tab.run("planSaveFailToast('too-large')"), /too big to upload/, 'too-large toast must say the upload was refused for size');
  assert.match(tab.run("planSaveFailToast('network')"), /reach the server/, 'network toast must say the server could not be reached');
  assert.match(tab.run("planSaveFailToast('network')"), /Check the connection/, 'network toast must suggest checking the connection');
  tab.run('lastUploadStatus=502;');
  assert.match(tab.run("planSaveFailToast('server')"), /HTTP 502/, 'server toast must carry the HTTP status the server answered with');
  assert.equal(
    tab.run("planSaveFailToast('pending')"),
    'Couldn’t confirm the timetable saved to the server — it’s saved on this device. Try saving again.',
    'pending keeps the legacy generic message (upload still in flight or lost)');
  assert.equal(
    tab.run("planSaveFailToast('pending', 'reset')"),
    'Couldn’t confirm the reset saved to the server — it’s reset on this device. Try again.',
    'pending reset keeps the legacy generic reset message');
  assert.match(tab.run("planSaveFailToast('too-large', 'reset')"), /reset on this device/, 'reset wording must fit a reset, not a save');
});
