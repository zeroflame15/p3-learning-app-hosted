'use strict';
// Save -> upload -> confirm, end to end (seen live 2026-11-09):
// the timetable save itself works and the confirmation logic is
// correct, but a live verification showed every save ending with the
// failure toast "Couldn't confirm the timetable saved to the server"
// even though the fix (plansEqual) was deployed. Diagnosis, proven
// in a real headless-Chrome drive of the live app against the real
// server (new-save-confirm2/repro-browser.js): in a fresh browser the
// whole path works — save() POSTs the new plan+rev, the server holds
// it, and the real confirmPlanSaved then reports success. The
// verification browsers' upload POSTs never reached the server at
// all (the server row stayed at rev 1 through both verifications,
// while the same POSTs succeed from curl and from a locally driven
// browser), so the confirmation was HONESTLY reporting a missing
// upload — the failure was in the upload reaching the server, not
// in the comparison. These tests lock in the end-to-end path:
// (1) a real save() must actually POST the new plan+rev to the
// server, and the real confirmPlanSaved must then succeed;
// (2) when the upload never lands, the confirm must honestly fail
// (the verification symptom), so a future upload regression is
// caught here instead of being mistaken for a confirm bug.
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

// Mock server: stores the POSTed record JSONB-normalised (like the
// real Supabase column) and answers GETs from it. `dropPosts` makes
// every POST fail, simulating an upload that never lands.
function makeMockServer(opts) {
  const server = { row: null, posts: [], dropPosts: !!(opts && opts.dropPosts) };
  server.fetch = function (url, fetchOpts) {
    if (fetchOpts && fetchOpts.method === 'POST') {
      const body = JSON.parse(fetchOpts.body);
      server.posts.push({ code: body.code, rev: body.data.familyPlanRev, mon: body.data.familyPlan && body.data.familyPlan[1] ? body.data.familyPlan[1].study : '(none)' });
      if (server.dropPosts) {
        return Promise.resolve({ ok: false, status: 502, json: async () => ({ error: 'supabase_write_failed' }) });
      }
      server.row = { code: body.code, data: jsonbNormalize(JSON.parse(JSON.stringify(body.data))), updatedAt: new Date().toISOString() };
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt, familyPlanRev: server.row.data.familyPlanRev || 0, planPreserved: false }) });
    }
    const m = String(url).match(/code=([^&]*)/);
    const code = m ? decodeURIComponent(m[1]) : null;
    const row = server.row && server.row.code === code ? server.row : null;
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

test('save() uploads the new plan and the real confirm then succeeds (end-to-end)', async () => {
  const store = {};
  const server = makeMockServer();
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z'));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z')), updatedAt: '2026-11-09T05:00:00.000Z' };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.familyPlan[1].study'), 'Study 4:00–5:00pm TEST', 'tab loads the TEST plan');

  // Simulate the timetable Save handler: new plan, rev bump, save().
  tab.run("DB.familyPlan=" + JSON.stringify(VERIFY_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; var rev=DB.familyPlanRev; save();");
  // The upload is debounced 800ms, then pull-then-POST. Wait for the POST to land.
  await waitFor(() => server.posts.some((p) => p.rev === 2 && p.mon === 'Study 5:00–6:00pm VERIFY'), 6000, 'upload POST with rev 2 + VERIFY plan');
  assert.equal(server.row.data.familyPlanRev, 2, 'server holds rev 2 after the upload');
  assert.equal(server.row.data.familyPlan[1].study, 'Study 5:00–6:00pm VERIFY', 'server holds the VERIFY plan after the upload');
  assert.equal(tab.run('DB.familyPlanRev'), 2, 'local rev is 2');

  // Now the real confirmation, against the server that holds the plan
  // (JSONB-reordered keys, as the real Supabase round-trip produces).
  tab.run("confirmPlanSaved(2, " + JSON.stringify(VERIFY_PLAN) + ", function(ok){ __confirmResult = ok; });");
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 6000, 'confirmPlanSaved to call back');
  assert.equal(tab.run('__confirmResult'), true, 'confirm must succeed once the server holds the new plan — the success toast, not the failure one');
});

test('confirm honestly fails when the upload never lands', async () => {
  // The live-verification symptom: every save ended with the failure
  // toast although the comparison was correct, because the upload
  // POST never reached the server. The confirm must fail in that
  // case (it must not claim success it cannot verify).
  const store = {};
  const server = makeMockServer({ dropPosts: true });
  store['jiyuna-learning-web-v1'] = JSON.stringify(makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z'));
  server.row = { code: '8SXU6S', data: jsonbNormalize(makeFamily(TEST_PLAN, 1, '2026-11-09T05:00:00.000Z')), updatedAt: '2026-11-09T05:00:00.000Z' };
  const tab = makeTab(store, server);
  tab.run('load()');
  tab.run("DB.familyPlan=" + JSON.stringify(VERIFY_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; var rev=DB.familyPlanRev; save();");
  await sleep(2500);
  assert.ok(server.posts.length > 0, 'the upload was attempted');
  assert.equal(server.row.data.familyPlanRev, 1, 'server still holds rev 1 — the upload never landed');
  assert.equal(server.row.data.familyPlan[1].study, 'Study 4:00–5:00pm TEST', 'server still holds the TEST plan');
  tab.run("confirmPlanSaved(2, " + JSON.stringify(VERIFY_PLAN) + ", function(ok){ __confirmResult = ok; });");
  await waitFor(() => tab.run('typeof __confirmResult !== "undefined"'), 6000, 'confirmPlanSaved to call back');
  assert.equal(tab.run('__confirmResult'), false, 'confirm must fail when the server does not hold the new plan — that failure is honest, and the fix belongs in the upload, not the confirm');
});
