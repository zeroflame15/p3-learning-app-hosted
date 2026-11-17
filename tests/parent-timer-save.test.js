// Parent-page timers won't save (Bryan 2026-11-17: "set timer for app
// and games unable to save"). Root cause: mergeFamilyDB took the
// server's dailyLimit/playLimit whenever set — no timestamp rule — so
// save()'s own pull-then-upload fetched the server's still-old limit
// and overwrote the just-saved one before the upload ran. The toast
// said "Daily limit saved." while the value reverted ~1s later, and a
// stale tab's routine save could wipe a newer limit the same way
// (the 2026-11-09 timetable wipe, same shape). The fix mirrors the
// Focus mode pattern exactly: dailyLimitUpdatedAt /
// playLimitUpdatedAt timestamps, stamped by the save handlers, with
// later-timestamp-wins in mergeFamilyDB AND convergence in
// mergeStoredIntoDB.
'use strict';
const assert = require('node:assert');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const html = indexSrc;

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

// Harness copied from tests/sync-light.test.js (SYNC_FNS, makeTab,
// makeFamily, mock server) — the proven two-tab sync harness.
const SYNC_FNS = [
  'function makeSyncCode(){', 'function syncCodeValid(v){', 'function ensureSyncCode(){',
  'function syncKey(){', 'function drainPendingUpload(){', 'function saveLocal(){',
  'function postToServer(key){', 'function planDayEqual(', 'function plansEqual(',
  'function confirmPlanSaved(', 'function confirmFailReason(){', 'function syncToServer(){',
  'function uploadAfterPull(){', 'function unionArr(a,b){', 'function unionObjMax(a,b){', 'function unionObjLatest(a,b){',
  'function isThinkingMsg(m){', 'function mergeThreads(aThreads,bThreads){',
  'function pickCritterName(a,b){', 'function mergeCare(a,b){', 'function hashStr(s){', 'function flashcardId(f, b, n){', 'function stampFlashcardIds(e){', 'function bridgeFlashcardTombstones(e){', 'function mergeExplorer(a,b){',
  'function mergeFamilyDB(local, server){', 'function syncFromServer(opts){',
  'function mergeStoredIntoDB(){', 'function save(){', 'function load(){',
  'function migrateStages(){', 'function isModalOpen(){', 'function safeToRender(){',
  'function newExplorer(name, code, level){', 'function genFriendCode(){',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    stuck: [],
  };
}

function makeFamily(plan, rev, updatedAt) {
  const f = {
    explorers: [makeExplorer('e1', 'TestVerify1'), makeExplorer('e2', 'TestVerify2')],
    parentPin: '2468', dailyLimit: 30, dailyLimitUpdatedAt: null,
    playLimit: 20, playLimitUpdatedAt: null, activeId: 'e1',
    syncCode: '8SXU6S', updatedAt: updatedAt, flags: [], stageV: 2,
    parentPinUpdatedAt: '2026-11-09T00:00:00.000Z',
    focusMode: false, focusModeUpdatedAt: null,
    familyEvents: [], deletedFamilyEvents: [],
  };
  if (plan) {
    f.familyPlan = JSON.parse(JSON.stringify(plan));
    f.familyPlanRev = rev;
    f.familyPlanUpdatedAt = updatedAt;
  }
  return jsonbNormalize(f);
}

function makeMockServer(opts) {
  const server = { row: null, posts: [], log: [], failCheck: !!(opts && opts.failCheck) };
  if (opts && opts.failCheck === 'reject') server.failCheck = 'reject';
  server.fetch = function (url, fetchOpts) {
    if (fetchOpts && fetchOpts.method === 'POST') {
      const body = JSON.parse(fetchOpts.body);
      server.log.push({ method: 'POST', kind: 'post', rev: body.data.familyPlanRev });
      server.posts.push({ code: body.code, rev: body.data.familyPlanRev });
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

const LSKEY = 'jiyuna-learning-web-v1';
const T1 = '2026-11-17T07:00:00.000Z'; // older
const T2 = '2026-11-17T08:00:00.000Z'; // newer

// --- Pure mergeFamilyDB, eval'd straight from the page (approach
// copied from tests/scroll-position.test.js) ------------------------
function grabFn(name) {
  const start = indexSrc.indexOf('function ' + name);
  assert.ok(start >= 0, 'function ' + name + ' found in index.html');
  let i = indexSrc.indexOf('{', start);
  let depth = 0;
  for (; i < indexSrc.length; i++) {
    if (indexSrc[i] === '{') depth++;
    else if (indexSrc[i] === '}') { depth--; if (depth === 0) return indexSrc.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
const mergeFamilyDB = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'hashStr', 'flashcardId', 'stampFlashcardIds', 'bridgeFlashcardTombstones', 'mergeExplorer', 'mergeFamilyDB',
].map(grabFn).join('\n') + '\n; mergeFamilyDB;');

function fam(over) {
  const base = {
    explorers: [{ id: 'e1', name: 'Test', completed: {}, completedDay: {}, progress: {}, badges: [], treasures: [], stars: 0, critterStage: 0, threads: [], flashcards: [], deletedFlashcards: [], planner: [], deletedPlanner: [], friends: [], deletedFriends: [], spellingTests: [], deletedSpellingTests: [], playBest: {}, learnBest: {}, stuck: [] }],
    parentPin: '2468', parentPinUpdatedAt: null,
    dailyLimit: null, dailyLimitUpdatedAt: null,
    playLimit: null, playLimitUpdatedAt: null,
    activeId: 'e1', syncCode: '8SXU6S', updatedAt: '2026-11-17T00:00:00.000Z', flags: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null, familyPlanRev: 0,
  };
  return Object.assign(base, over);
}

/* ================= handlers + defaults ================= */

test('save handlers stamp the timestamp (validation and toast wording unchanged)', () => {
  const bind = bodyOf('function bindParent(){');
  assert.ok(bind.includes("DB.dailyLimit=v; DB.dailyLimitUpdatedAt=new Date().toISOString(); save(); toast('Daily limit saved.');"),
    'daily-limit handler stamps dailyLimitUpdatedAt before saving');
  assert.ok(bind.includes("DB.playLimit=v; DB.playLimitUpdatedAt=new Date().toISOString(); save(); toast('Play limit saved.');"),
    'play-limit handler stamps playLimitUpdatedAt before saving');
  assert.ok(bind.includes("if(v>=5&&v<=240){ DB.dailyLimit=v;"), 'daily validation is still 5–240 min');
  assert.ok(bind.includes("if(v>=5&&v<=240){ DB.playLimit=v;"), 'play validation is still 5–240 min');
});

test('new families start with null limit timestamps (real load() literal)', () => {
  const start = html.indexOf('DB={explorers:[], deletedExplorers:[], parentPin:null, dailyLimit:');
  assert.ok(start >= 0, 'the new-family DB literal is present');
  const end = html.indexOf('};', start) + 1;
  function makeSyncCode() { return 'ABCDEF'; } // stub for the literal below
  const fresh = eval('(' + html.slice(start + 3, end) + ')');
  assert.equal(fresh.dailyLimit, 90, 'daily default is still 90');
  assert.equal(fresh.playLimit, 20, 'play default is still 20');
  assert.equal(fresh.dailyLimitUpdatedAt, null, 'daily timestamp starts null');
  assert.equal(fresh.playLimitUpdatedAt, null, 'play timestamp starts null');
});

/* ================= mergeFamilyDB: later timestamp wins ================= */

test('mergeFamilyDB: the newer limit wins — local change beats older server copy', () => {
  const merged = mergeFamilyDB(
    fam({ dailyLimit: 120, dailyLimitUpdatedAt: T2, playLimit: 45, playLimitUpdatedAt: T2 }),
    fam({ dailyLimit: 90, dailyLimitUpdatedAt: T1, playLimit: 20, playLimitUpdatedAt: T1 }));
  assert.equal(merged.dailyLimit, 120, 'local daily 120 (newer) wins over server 90');
  assert.equal(merged.dailyLimitUpdatedAt, T2, 'the winning timestamp is kept');
  assert.equal(merged.playLimit, 45, 'local play 45 (newer) wins over server 20');
  assert.equal(merged.playLimitUpdatedAt, T2, 'the winning play timestamp is kept');
});

test('mergeFamilyDB: the newer limit wins — server change beats older local copy', () => {
  const merged = mergeFamilyDB(
    fam({ dailyLimit: 120, dailyLimitUpdatedAt: T1, playLimit: 45, playLimitUpdatedAt: T1 }),
    fam({ dailyLimit: 90, dailyLimitUpdatedAt: T2, playLimit: 20, playLimitUpdatedAt: T2 }));
  assert.equal(merged.dailyLimit, 90, 'server daily 90 (newer) wins over local 120');
  assert.equal(merged.dailyLimitUpdatedAt, T2, 'the winning timestamp is kept');
  assert.equal(merged.playLimit, 20, 'server play 20 (newer) wins over local 45');
  assert.equal(merged.playLimitUpdatedAt, T2, 'the winning play timestamp is kept');
});

test('mergeFamilyDB: a tie on timestamps keeps the local value (mirrors PIN / Focus mode)', () => {
  const merged = mergeFamilyDB(
    fam({ dailyLimit: 120, dailyLimitUpdatedAt: T2, playLimit: 45, playLimitUpdatedAt: T2 }),
    fam({ dailyLimit: 90, dailyLimitUpdatedAt: T2, playLimit: 20, playLimitUpdatedAt: T2 }));
  assert.equal(merged.dailyLimit, 120, 'tied daily timestamps keep the local value');
  assert.equal(merged.playLimit, 45, 'tied play timestamps keep the local value');
});

test('mergeFamilyDB: untimestamped rows keep the old behaviour (server wins when set, fallback 90/20)', () => {
  assert.equal(mergeFamilyDB(fam({}), fam({ dailyLimit: 45 })).dailyLimit, 45, 'server 45 wins when neither side is timestamped');
  assert.equal(mergeFamilyDB(fam({ playLimit: 15 }), fam({})).playLimit, 15, 'local 15 kept when the server has none');
  assert.equal(mergeFamilyDB(fam({ dailyLimit: 30 }), fam({})).dailyLimit, 30, 'a stored Daily 30 is never migrated');
  const bothNull = mergeFamilyDB(fam({}), fam({}));
  assert.equal(bothNull.dailyLimit, 90, 'fallback is 90 when neither side has a value');
  assert.equal(bothNull.playLimit, 20, 'play fallback stays 20');
});

test('mergeFamilyDB: empty local explorers still default the limits from the server copy', () => {
  const merged = mergeFamilyDB(
    { explorers: [], deletedExplorers: [], parentPin: null, activeId: null, syncCode: '8SXU6S' },
    fam({ dailyLimit: null, playLimit: null, dailyLimitUpdatedAt: null, playLimitUpdatedAt: null }));
  assert.equal(merged.dailyLimit, 90, 'empty-local path defaults daily to 90');
  assert.equal(merged.playLimit, 20, 'empty-local path defaults play to 20');
});

/* ================= mergeStoredIntoDB convergence ================= */

test('mergeStoredIntoDB: a newer limit in the store is adopted; an older one never clobbers', async () => {
  const S = '2026-11-17T00:00:00.000Z';
  const store = {};
  const server = makeMockServer();
  // The tab loads with the OLD limits (30/20, stamped T1).
  const oldFam = makeFamily(null, 0, S);
  oldFam.dailyLimit = 30; oldFam.dailyLimitUpdatedAt = T1;
  oldFam.playLimit = 20; oldFam.playLimitUpdatedAt = T1;
  store[LSKEY] = JSON.stringify(oldFam);
  server.row = { code: '8SXU6S', data: jsonbNormalize(JSON.parse(JSON.stringify(oldFam))), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.dailyLimit'), 30, 'tab starts on the old daily limit');
  // Another tab saves newer limits to the shared store (upload not
  // landed on the server yet).
  const newFam = makeFamily(null, 0, S);
  newFam.dailyLimit = 120; newFam.dailyLimitUpdatedAt = T2;
  newFam.playLimit = 45; newFam.playLimitUpdatedAt = T2;
  store[LSKEY] = JSON.stringify(newFam);
  tab.run('mergeStoredIntoDB()');
  assert.equal(tab.run('DB.dailyLimit'), 120, 'the newer daily limit is adopted from the store');
  assert.equal(tab.run('DB.playLimit'), 45, 'the newer play limit is adopted from the store');
  assert.equal(tab.run('DB.dailyLimitUpdatedAt'), T2, 'the newer daily timestamp is adopted');
  // Reverse: the store holds an OLDER limit than the tab — it must
  // not clobber the tab's newer one.
  store[LSKEY] = JSON.stringify(oldFam);
  tab.run('mergeStoredIntoDB()');
  assert.equal(tab.run('DB.dailyLimit'), 120, 'an older stored daily limit never clobbers the newer one');
  assert.equal(tab.run('DB.playLimit'), 45, 'an older stored play limit never clobbers the newer one');
});

/* ================= end to end: the exact failure Bryan hit ================= */

test('a save keeps the new limits through its own pull-then-upload (server still holds the old ones)', async () => {
  const S = '2026-11-17T00:00:00.000Z';
  const store = {};
  const server = makeMockServer();
  const startFam = makeFamily(null, 0, S); // daily 30, play 20, no timestamps (legacy row)
  store[LSKEY] = JSON.stringify(startFam);
  server.row = { code: '8SXU6S', data: jsonbNormalize(JSON.parse(JSON.stringify(startFam))), updatedAt: S };
  const tab = makeTab(store, server);
  tab.run('load()');
  assert.equal(tab.run('DB.dailyLimit'), 30, 'tab starts on the old daily limit');
  // What the parent-page handlers do: set the value and stamp it.
  tab.run("DB.dailyLimit=120; DB.dailyLimitUpdatedAt='" + T2 + "'; DB.playLimit=45; DB.playLimitUpdatedAt='" + T2 + "';");
  tab.run('save()');
  // save() already wrote localStorage; the pull-then-upload runs
  // ~800ms later against a server that still holds 30/20.
  assert.equal(JSON.parse(store[LSKEY]).dailyLimit, 120, 'localStorage holds the new daily limit right after save()');
  await waitFor(() => server.row.data.dailyLimit === 120, 6000, 'server holds the new daily limit after the upload');
  assert.equal(server.row.data.dailyLimit, 120, 'the server ends up with the new daily limit, not the old 30');
  assert.equal(server.row.data.playLimit, 45, 'the server ends up with the new play limit, not the old 20');
  assert.equal(tab.run('DB.dailyLimit'), 120, 'the tab still shows 120 after its own pull-then-upload');
  assert.equal(tab.run('DB.playLimit'), 45, 'the tab still shows 45 after its own pull-then-upload');
  assert.equal(JSON.parse(store[LSKEY]).dailyLimit, 120, 'localStorage still holds 120 after the round trip');
});

test('a stale tab routine-save cannot wipe a newer limit another tab just saved', async () => {
  const S = '2026-11-17T00:00:00.000Z';
  const store = {};
  const server = makeMockServer();
  const oldFam = makeFamily(null, 0, S);
  oldFam.dailyLimit = 30; oldFam.dailyLimitUpdatedAt = T1;
  store[LSKEY] = JSON.stringify(oldFam);
  server.row = { code: '8SXU6S', data: jsonbNormalize(JSON.parse(JSON.stringify(oldFam))), updatedAt: S };
  // Tab B loaded earlier and still holds the old limit in memory.
  const tabB = makeTab(store, server);
  tabB.run('load()');
  assert.equal(tabB.run('DB.dailyLimit'), 30, 'stale tab starts on the old daily limit');
  // Tab A saves a newer limit to the shared store; its upload has
  // not landed on the server yet (server still holds 30).
  const newFam = makeFamily(null, 0, S);
  newFam.dailyLimit = 120; newFam.dailyLimitUpdatedAt = T2;
  store[LSKEY] = JSON.stringify(newFam);
  // Tab B's routine save (e.g. the 60s screen-time tick) must adopt
  // the newer limit from the store instead of writing 30 over it.
  tabB.run('save()');
  assert.equal(tabB.run('DB.dailyLimit'), 120, 'the stale tab adopts the newer limit from the store on save()');
  assert.equal(JSON.parse(store[LSKEY]).dailyLimit, 120, 'the store still holds 120 after the stale tab saves');
  await waitFor(() => server.row.data.dailyLimit === 120, 6000, 'server holds 120 after the stale tab uploads');
  assert.equal(server.row.data.dailyLimit, 120, 'the server ends up with 120, not the stale 30');
});
