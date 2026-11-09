// Two-tab persistence regression (seen live 2026-11-07): a new
// explorer survived an immediate reload and stayed listed across the
// 30s auto-pulls, but vanished after a delayed reload a few minutes
// later (only 1 of 5 delayed reloads survived) and never appeared in
// the other tab — even though the sync-drain fix had already shipped.
// Root cause: two tabs share one localStorage key, but each tab kept
// its own in-memory DB and save() wrote that DB straight over the
// stored copy. A stale tab's routine save (the 60s screen-time tick,
// or any tap) silently wiped an explorer another tab had just
// created, and the wipe then reached the server on the next upload.
// Fix: save() merges whatever is already stored into the in-memory
// DB first (mergeStoredIntoDB, explorers only, union — it can only
// add, never remove), and a 'storage' listener converges tabs as
// soon as another tab writes. These tests run the real page
// functions in two isolated vm contexts that share one localStorage
// store and one fake server, so the race is reproduced for real.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const LSKEY = 'jiyuna-learning-web-v1';

function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  // One-liner function: the first line is balanced and closes the body.
  const lineEnd = html.indexOf('\n', start);
  const line = html.slice(start, lineEnd);
  let depth = 0;
  for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0 && line.trimEnd().endsWith('}')) return line;
  // Multi-line function: slice to its column-0 closing brace.
  const end = html.indexOf('\n}\n', start);
  assert.ok(end >= 0, marker + ' body never closes');
  return html.slice(start, end + 3);
}
function varText(name) {
  const m = html.match(new RegExp('var ' + name + '=([^;]+);'));
  assert.ok(m, name + ' var not found in index.html');
  return 'var ' + name + '=' + m[1] + ';';
}
function storageSnippet() {
  const start = html.indexOf("window.addEventListener('storage'");
  assert.ok(start >= 0, 'storage listener not found in index.html');
  const end = html.indexOf('});', start) + 3;
  return html.slice(start, end);
}

const SYNC_FNS = [
  'function makeSyncCode(){', 'function syncCodeValid(v){', 'function ensureSyncCode(){',
  'function syncKey(){', 'function drainPendingUpload(){', 'function saveLocal(){',
  'function postToServer(key){', 'function syncToServer(){', 'function uploadAfterPull(){',
  'function unionArr(a,b){', 'function unionObjMax(a,b){', 'function unionObjLatest(a,b){',
  'function isThinkingMsg(m){', 'function mergeThreads(aThreads,bThreads){',
  'function pickCritterName(a,b){', 'function mergeCare(a,b){', 'function mergeExplorer(a,b){',
  'function mergeFamilyDB(local, server){', 'function syncFromServer(opts){',
  'function mergeStoredIntoDB(){', 'function save(){', 'function load(){',
  'function migrateStages(){', 'function isModalOpen(){', 'function safeToRender(){',
  'function newExplorer(name, code, level){', 'function genFriendCode(){',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeFamily(n, code) {
  const explorers = [];
  for (let i = 0; i < n; i++) {
    explorers.push({
      id: 'e' + i, name: 'Explorer' + i, stars: i, critterStage: 0,
      care: {}, badges: [], treasures: [], discoveredCritters: [],
      completed: {}, completedDay: {}, playDoneDay: {}, progress: {},
      playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
      threads: [], deletedThreadIds: [], flashcards: [], deletedFlashcards: [],
      planner: [], deletedPlanner: [], hclMissed: [], favAnswers: [],
      critterName: 'Splash', critterNameAt: null, nameAt: null, lookAt: null,
      glow: '#ffb020', badge: '⭐', careGrewDay: null,
    });
  }
  return { explorers, parentPin: null, dailyLimit: 30, activeId: 'e0', syncCode: code, updatedAt: new Date().toISOString(), flags: [], stageV: 2 };
}

// Fake /api/progress: a single server row keyed by family code, with
// the same 500KB cap as api/progress.js.
function mockFetch(server) {
  return function (url, opts) {
    if (opts && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      if (JSON.stringify(body.data).length > 500000) {
        return Promise.resolve({ ok: false, status: 413, json: async () => ({ error: 'progress too large' }) });
      }
      server.row = { code: body.code, data: JSON.parse(JSON.stringify(body.data)), updatedAt: new Date().toISOString() };
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt }) });
    }
    const m = String(url).match(/code=([^&]*)/);
    const code = m ? decodeURIComponent(m[1]) : null;
    const row = server.row && server.row.code === code ? server.row : null;
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ configured: true, data: row ? JSON.parse(JSON.stringify(row.data)) : null, updatedAt: row ? row.updatedAt : null }) });
  };
}

// The bus holds the tabs and the storage events queued by writes.
// Delivery is manual (bus.deliver()) so a test can decide whether
// the other tab has seen the event yet — exactly the race.
function makeBus() {
  const bus = { tabs: [], queue: [] };
  bus.deliver = () => {
    const pending = bus.queue.splice(0);
    for (const ev of pending) {
      for (const tab of bus.tabs) {
        if (tab === ev.from) continue;
        const handlers = (tab._listeners && tab._listeners.storage) || [];
        for (const h of handlers) h({ key: ev.key });
      }
    }
  };
  return bus;
}

function makeTab(store, server, deviceId, bus) {
  const listeners = {};
  const sandbox = {
    console, setTimeout, clearTimeout,
    JSON, Object, Array, Math, Date, Promise,
    DB: null, DEVICE_ID: deviceId,
    syncPulling: false, syncUploadPending: false, syncTimer: null, postRetryCount: 0,
    lastUploadStatus: 0, lastUploadOk: false, uploadsActive: 0, uploadFinal: false,
    route: 'door',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); bus.queue.push({ key: k, from: sandbox }); },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: mockFetch(server),
    document: {
      visibilityState: 'visible',
      getElementById: () => null,
      addEventListener: () => {},
      querySelectorAll: () => [],
    },
    render: () => {},
    toast: () => {},
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  };
  sandbox.window = sandbox;
  sandbox._listeners = listeners;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(varText('LSKEY'), ctx);
  vm.runInContext(varText('SYNC_ALPHABET'), ctx);
  for (const marker of SYNC_FNS) vm.runInContext(fnText(marker), ctx);
  vm.runInContext(storageSnippet(), ctx);
  bus.tabs.push(sandbox);
  return {
    get DB() { return sandbox.DB; },
    run: (code) => vm.runInContext(code, ctx),
  };
}

function seedStoreAndServer(store, server) {
  const seed = makeFamily(20, 'TESTAB');
  store[LSKEY] = JSON.stringify(seed);
  server.row = { code: 'TESTAB', data: JSON.parse(JSON.stringify(seed)), updatedAt: new Date().toISOString() };
}

test('a stale tab saving must not wipe a new explorer from localStorage or the server', async () => {
  const store = {};
  const server = { row: null };
  seedStoreAndServer(store, server);
  const bus = makeBus();
  const tabA = makeTab(store, server, 'd-tab-a', bus);
  const tabB = makeTab(store, server, 'd-tab-b', bus);
  tabA.run('load()'); tabB.run('load()');
  assert.equal(tabA.DB.explorers.length, 20, 'tab A loads the 20 seeded explorers');
  assert.equal(tabB.DB.explorers.length, 20, 'tab B loads the 20 seeded explorers');

  // Tab A creates a new explorer (Grand Door create) and saves. The
  // localStorage write is synchronous; the 800ms upload has not
  // fired yet, and the storage event has NOT been delivered to B.
  tabA.run("DB.explorers.push(newExplorer('Newbie','')); save();");
  assert.equal(JSON.parse(store[LSKEY]).explorers.length, 21, 'the new explorer is in the store right after creation');

  // Tab B is stale (still 20 in memory). Its 60s screen-time tick saves.
  // Before the fix this overwrote the store with the stale 20.
  tabB.run('save()');
  const storedNow = JSON.parse(store[LSKEY]);
  assert.equal(storedNow.explorers.length, 21, 'a stale tab save must not wipe the new explorer from localStorage');
  assert.ok(storedNow.explorers.some((e) => e.name === 'Newbie'), 'the new explorer is still in the store after the stale save');

  // Tab A reloads a few minutes later (delayed reload): Newbie must still be listed.
  tabA.run('load()');
  assert.ok(tabA.DB.explorers.some((e) => e.name === 'Newbie'), 'the new explorer survives a delayed reload');

  // Let both tabs' debounced uploads settle: the server must end up with Newbie too.
  await sleep(1600);
  assert.ok(server.row && server.row.data.explorers.some((e) => e.name === 'Newbie'), 'the new explorer reaches the server');
  assert.equal(server.row.data.explorers.length, 21, 'the server holds all 21 explorers');
});

test('a storage event converges a second tab without it saving', () => {
  const store = {};
  const server = { row: null };
  seedStoreAndServer(store, server);
  const bus = makeBus();
  const tabA = makeTab(store, server, 'd-tab-a', bus);
  const tabB = makeTab(store, server, 'd-tab-b', bus);
  tabA.run('load()'); tabB.run('load()');
  tabA.run("DB.explorers.push(newExplorer('Newbie','')); save();");
  // No delivery yet: tab B is still stale.
  assert.equal(tabB.DB.explorers.length, 20, 'tab B is still stale before the storage event');
  // The browser delivers the storage event to the other tab.
  bus.deliver();
  assert.ok(tabB.DB.explorers.some((e) => e.name === 'Newbie'), 'the storage event brings the new explorer into the other tab');
  assert.equal(tabB.DB.explorers.length, 21, 'tab B now holds all 21 explorers');
  assert.equal(JSON.parse(store[LSKEY]).explorers.length, 21, 'the store still holds all 21 after convergence');
  // Let tab A's pending upload settle so no timer leaks into the next test.
  return sleep(1100);
});

test('mergeStoredIntoDB is a union: it never drops an explorer this tab already has', () => {
  const store = {};
  const server = { row: null };
  seedStoreAndServer(store, server);
  const bus = makeBus();
  const tabA = makeTab(store, server, 'd-tab-a', bus);
  tabA.run('load()');
  // This tab renames an explorer, another tab (via the store) adds one.
  tabA.run("DB.explorers[0].name='Renamed'; DB.explorers[0].nameAt=new Date().toISOString();");
  const stored = JSON.parse(store[LSKEY]);
  stored.explorers.push({
    id: 'e-other', name: 'FromOtherTab', stars: 3, critterStage: 1,
    care: {}, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, playDoneDay: {}, progress: {},
    playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads: [], deletedThreadIds: [], flashcards: [], deletedFlashcards: [],
    planner: [], deletedPlanner: [], hclMissed: [], favAnswers: [],
    critterName: 'Splash', critterNameAt: null, nameAt: null, lookAt: null,
    glow: '#ffb020', badge: '⭐', careGrewDay: null,
  });
  store[LSKEY] = JSON.stringify(stored);
  tabA.run('save()');
  assert.equal(tabA.DB.explorers.length, 21, 'the other tab explorer is merged in');
  assert.equal(tabA.DB.explorers[0].name, 'Renamed', 'this tab rename survives the merge (local wins the name tie)');
  assert.ok(tabA.DB.explorers.some((e) => e.name === 'FromOtherTab'), 'the other tab explorer survives the merge');
  const after = JSON.parse(store[LSKEY]);
  assert.equal(after.explorers.length, 21, 'the store holds the union after the save');
  assert.equal(after.explorers[0].name, 'Renamed', 'the rename reaches the store');
  return sleep(1100);
});
