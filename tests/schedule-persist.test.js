'use strict';
// Schedule persistence regression (seen live 2026-11-09): a timetable
// saved in the parent page held in-session and briefly after a reload,
// then reverted to the old timetable, and the server never held the
// new edit. The familyPlanRev server merge was correct in isolation;
// the loss was in localStorage. mergeStoredIntoDB() merged explorers
// ONLY, so a stale tab's routine save() (the 60s screen-time tick)
// wrote its OLD timetable straight over the store, wiping the newer
// timetable another tab had just saved before it reached the server.
// Fix: mergeStoredIntoDB() now also converges the family schedule
// (familyPlan / familyPlanRev / familyPlanUpdatedAt, familyEvents +
// deletedFamilyEvents) from the stored copy, with the same newer-wins
// rules as mergeFamilyDB. (The parent PIN is deliberately NOT touched
// here — the server merge is the authority for it; see
// tests/sync-live.test.js.) These tests run the real
// page functions in two isolated vm contexts that share one
// localStorage store and one fake server, so the race is reproduced
// for real (same harness as tests/two-tab-sync.test.js).
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

const TEST_PLAN = { 1: { label: 'English + Science', subs: ['eng', 'sci'], study: 'Study 4:00–5:00pm TEST', note: '', rest: false, review: false, light: false } };
const TEST_EVENTS = [{ id: 'ev-test', date: '2026-11-20', name: 'Test Sports Day', kind: 'event', note: '' }];
const VERIFY_PLAN = { 1: { label: 'English + Maths + Science', subs: ['eng', 'math', 'sci'], study: 'Study 5:00–6:00pm VERIFY', note: '', rest: false, review: false, light: false } };

function makeFamily(withPlan) {
  const f = {
    explorers: [makeExplorer('e1', 'TestVerify1'), makeExplorer('e2', 'TestVerify2')],
    parentPin: '2468', dailyLimit: 30, playLimit: 20, activeId: 'e1',
    syncCode: '8SXU6S', updatedAt: new Date().toISOString(), flags: [], stageV: 2,
  };
  if (withPlan) {
    f.familyPlan = JSON.parse(JSON.stringify(TEST_PLAN));
    f.familyEvents = JSON.parse(JSON.stringify(TEST_EVENTS));
  }
  return f;
}

function mockFetch(server) {
  return function (url, opts) {
    if (opts && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      server.row = { code: body.code, data: JSON.parse(JSON.stringify(body.data)), updatedAt: new Date().toISOString() };
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt }) });
    }
    const m = String(url).match(/code=([^&]*)/);
    const code = m ? decodeURIComponent(m[1]) : null;
    const row = server.row && server.row.code === code ? server.row : null;
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ configured: true, data: row ? JSON.parse(JSON.stringify(row.data)) : null, updatedAt: row ? row.updatedAt : null }) });
  };
}

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
    route: 'parent',
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
      activeElement: null,
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
  return { get DB() { return sandbox.DB; }, run: (code) => vm.runInContext(code, ctx) };
}

function planOf(db) {
  if (!db || !db.familyPlan || !db.familyPlan[1]) return '(none)';
  return db.familyPlan[1].study || db.familyPlan[1].time || '(no study)';
}

test('a stale tab routine save must not wipe a newer timetable from localStorage or the server', async () => {
  const store = {};
  const server = { row: null };
  const bus = makeBus();
  // Live state: the store holds the TEST plan, the server holds NO plan.
  store[LSKEY] = JSON.stringify(makeFamily(true));
  server.row = { code: '8SXU6S', data: makeFamily(false), updatedAt: new Date().toISOString() };
  const tabA = makeTab(store, server, 'd-tab-a', bus);
  const tabB = makeTab(store, server, 'd-tab-b', bus);
  tabA.run('load()'); tabB.run('load()');
  assert.equal(planOf(tabA.DB), 'Study 4:00–5:00pm TEST', 'tab A loads the TEST plan');
  assert.equal(planOf(tabB.DB), 'Study 4:00–5:00pm TEST', 'tab B loads the TEST plan');

  // Tab B saves a new timetable (the parent-page Save): VERIFY, rev 1.
  // The storage event has NOT been delivered to A yet.
  tabB.run("DB.familyPlan=" + JSON.stringify(VERIFY_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; save();");
  assert.equal(planOf(JSON.parse(store[LSKEY])), 'Study 5:00–6:00pm VERIFY', 'the new timetable is in the store right after the save');
  assert.equal(JSON.parse(store[LSKEY]).familyPlanRev, 1, 'the store holds rev 1 after the save');
  assert.equal(planOf(tabA.DB), 'Study 4:00–5:00pm TEST', 'tab A is still stale in memory');

  // Tab A does a routine save (the 60s screen-time tick) before it ever
  // sees the storage event. Before the fix this overwrote the store
  // with the stale TEST plan.
  tabA.run('save()');
  assert.equal(planOf(JSON.parse(store[LSKEY])), 'Study 5:00–6:00pm VERIFY', 'a stale tab save must not wipe the new timetable from localStorage');
  assert.equal(JSON.parse(store[LSKEY]).familyPlanRev, 1, 'the store keeps rev 1 after the stale save');
  assert.equal(planOf(tabA.DB), 'Study 5:00–6:00pm VERIFY', 'the stale tab adopts the newer timetable on save');

  // Let both tabs' debounced uploads settle: the server must hold VERIFY.
  await sleep(1600);
  assert.ok(server.row, 'the server has a row after the uploads');
  assert.equal(planOf(server.row.data), 'Study 5:00–6:00pm VERIFY', 'the new timetable reaches the server');
  assert.equal(server.row.data.familyPlanRev, 1, 'the server holds rev 1');

  // Tab B reloads and pulls (the verifier's "next reload"): VERIFY survives.
  tabB.run('load()');
  assert.equal(planOf(tabB.DB), 'Study 5:00–6:00pm VERIFY', 'the new timetable survives a reload');
  await tabB.run('syncFromServer({})');
  await sleep(300);
  assert.equal(planOf(tabB.DB), 'Study 5:00–6:00pm VERIFY', 'the new timetable survives the opening pull');
  assert.equal(planOf(server.row.data), 'Study 5:00–6:00pm VERIFY', 'the server still holds the new timetable after the pull');
});

test('a storage event converges a stale tab to the new timetable without it saving', () => {
  const store = {};
  const server = { row: null };
  const bus = makeBus();
  store[LSKEY] = JSON.stringify(makeFamily(true));
  server.row = { code: '8SXU6S', data: makeFamily(false), updatedAt: new Date().toISOString() };
  const tabA = makeTab(store, server, 'd-tab-a', bus);
  const tabB = makeTab(store, server, 'd-tab-b', bus);
  tabA.run('load()'); tabB.run('load()');
  tabB.run("DB.familyPlan=" + JSON.stringify(VERIFY_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; save();");
  assert.equal(planOf(tabA.DB), 'Study 4:00–5:00pm TEST', 'tab A is still stale before the storage event');
  bus.deliver();
  assert.equal(planOf(tabA.DB), 'Study 5:00–6:00pm VERIFY', 'the storage event brings the new timetable into the other tab');
  assert.equal(tabA.DB.familyPlanRev, 1, 'the other tab holds rev 1 after convergence');
  assert.equal(planOf(JSON.parse(store[LSKEY])), 'Study 5:00–6:00pm VERIFY', 'the store still holds the new timetable after convergence');
  return sleep(1100);
});

test('a deliberate reset (stored plan null, higher rev) is not resurrected by a stale tab', async () => {
  const store = {};
  const server = { row: null };
  const bus = makeBus();
  store[LSKEY] = JSON.stringify(makeFamily(true));
  server.row = { code: '8SXU6S', data: makeFamily(false), updatedAt: new Date().toISOString() };
  const tabA = makeTab(store, server, 'd-tab-a', bus);
  const tabB = makeTab(store, server, 'd-tab-b', bus);
  tabA.run('load()'); tabB.run('load()');
  // Tab B resets to the built-in default: plan null, rev bumped.
  tabB.run("DB.familyPlan=null; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; save();");
  assert.equal(JSON.parse(store[LSKEY]).familyPlan, null, 'the reset clears the plan in the store');
  assert.equal(JSON.parse(store[LSKEY]).familyPlanRev, 1, 'the reset bumps the rev in the store');
  // Tab A (stale, still holding TEST) does a routine save: it must adopt
  // the reset, not resurrect TEST.
  tabA.run('save()');
  assert.equal(JSON.parse(store[LSKEY]).familyPlan, null, 'a stale tab save must not resurrect a reset timetable');
  assert.equal(tabA.DB.familyPlan, null, 'the stale tab adopts the reset');
  await sleep(1600);
  assert.equal(server.row.data.familyPlan, null, 'the reset reaches the server');
  assert.equal(server.row.data.familyPlanRev, 1, 'the server holds rev 1 after the reset');
});
