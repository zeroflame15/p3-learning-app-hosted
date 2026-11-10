// Explorer removal tombstone (2026-11-10, Bryan: "can't remove
// explorer"): the parent page "Remove explorer" button filtered the
// explorer out of DB.explorers and called save(), but save() merges
// the stored copy first (mergeStoredIntoDB) and the stored copy
// still held the explorer — the union pushed it straight back, and
// the server merge (mergeFamilyDB) is a union too. Fix: a
// family-level tombstone `deletedExplorers` (array of explorer ids),
// recorded before save(), that both merges respect — never re-add a
// tombstoned explorer, and union the tombstone from the stored /
// server copy so a removal reaches every linked device.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const LSKEY = 'jiyuna-learning-web-v1';

// Brace-matching extractor (from tests/phase2-fixes.test.js): several
// of these functions nest other functions, so slicing to the next
// '\nfunction ' would cut them short.
function extractBlock(marker) {
  const i = html.indexOf(marker);
  assert.ok(i >= 0, marker + ' found');
  let j = html.indexOf('{', i);
  const stack = [];
  let inStr = false, strCh = '', inLine = false, inBlock = false;
  for (; j < html.length; j++) {
    const ch = html[j], nx = html[j + 1] || '';
    if (inLine) { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; j++; } continue; }
    if (inStr) { if (ch === '\\') { j++; continue; } if (ch === strCh) inStr = false; continue; }
    if (ch === '/' && nx === '/') { inLine = true; continue; }
    if (ch === '/' && nx === '*') { inBlock = true; continue; }
    if (ch === '"' || ch === "'" || ch.charCodeAt(0) === 96) { inStr = true; strCh = ch; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') { stack.pop(); if (stack.length === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces for ' + marker);
}
function loadInto(ctx, marker) { vm.runInContext(extractBlock(marker), ctx); }
function varText(name) {
  const m = html.match(new RegExp('var ' + name + '=([^;]+);'));
  assert.ok(m, name + ' var not found in index.html');
  return 'var ' + name + '=' + m[1] + ';';
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
  'function migrateStages(){', 'function newExplorer(name, code, level){',
  'function genFriendCode(){', 'function ex(){', 'function todayKey(){',
];

function makeSaveCtx(extra) {
  const store = {};
  const server = { row: null };
  const sandbox = {
    console, setTimeout, clearTimeout, JSON, Object, Array, Math, Date, Promise,
    DB: null, DEVICE_ID: 'd-remove-explorer',
    syncPulling: false, syncUploadPending: false, syncTimer: null, postRetryCount: 0,
    lastUploadStatus: 0, lastUploadOk: false, uploadsActive: 0, uploadFinal: false,
    route: 'home',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: (url, opts) => {
      if (opts && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        server.row = { code: body.code, data: JSON.parse(JSON.stringify(body.data)), updatedAt: new Date().toISOString() };
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt }) });
      }
      const m = String(url).match(/code=([^&]*)/);
      const code = m ? decodeURIComponent(m[1]) : null;
      const row = server.row && server.row.code === code ? server.row : null;
      const snap = row ? { configured: true, data: JSON.parse(JSON.stringify(row.data)), updatedAt: row.updatedAt } : { configured: true, data: null, updatedAt: null };
      return Promise.resolve({ ok: true, status: 200, json: async () => snap });
    },
    document: { visibilityState: 'visible', getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], activeElement: null },
    render: () => {}, toast: () => {}, addEventListener: () => {},
  };
  sandbox.window = sandbox;
  Object.assign(sandbox, extra || {});
  const ctx = vm.createContext(sandbox);
  vm.runInContext(varText('LSKEY'), ctx);
  vm.runInContext(varText('SYNC_ALPHABET'), ctx);
  for (const marker of SYNC_FNS) loadInto(ctx, marker);
  return { ctx, store, server, run: (code) => vm.runInContext(code, ctx) };
}

function family(explorerNames, activeId) {
  const explorers = explorerNames.map((n, i) => ({
    id: 'e' + i, name: n, stars: 0, critterStage: 0, care: {}, badges: [],
    treasures: [], discoveredCritters: [], completed: {}, completedDay: {},
    playDoneDay: {}, progress: {}, playProgress: {}, daily: {}, totalMinutes: 0,
    mood: {}, stuckCount: {}, threads: [], deletedThreadIds: [], flashcards: [],
    deletedFlashcards: [], planner: [], deletedPlanner: [], friends: [],
    deletedFriends: [], friendCode: 'ABCDE' + i, critterName: 'Splash',
    critterNameAt: null, nameAt: null, lookAt: null, glow: '#ffb020',
    badge: '⭐', careGrewDay: null,
  }));
  return {
    explorers, deletedExplorers: [], parentPin: '2468', dailyLimit: 90,
    playLimit: 20, activeId: activeId || (explorers.length ? explorers[0].id : null),
    syncCode: 'ABCDEF', updatedAt: new Date().toISOString(), flags: [],
  };
}

// The parent page "Yes, remove" handler: record the tombstone, filter
// the explorer out, move activeId, then save(). Reproduced here
// (same order as the handler) so the merge round-trip is tested
// through the real save() path.
function removeExplorer(run, id) {
  run('if(!DB.deletedExplorers)DB.deletedExplorers=[];');
  run('if(DB.deletedExplorers.indexOf(' + JSON.stringify(id) + ')<0)DB.deletedExplorers.push(' + JSON.stringify(id) + ');');
  run('DB.explorers=DB.explorers.filter(function(x){return x.id!==' + JSON.stringify(id) + ';});');
  run('if(DB.activeId===' + JSON.stringify(id) + ')DB.activeId=DB.explorers.length?DB.explorers[0].id:null;');
  run('save();');
}

test('removing an explorer then saving does NOT bring it back', () => {
  const { ctx, store, run } = makeSaveCtx();
  run('DB=' + JSON.stringify(family(['Alice', 'Bob'])) + ';');
  run('save();');
  removeExplorer(run, 'e1');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers.map(function(e){return e.id;}))')), ['e0'], 'Bob is gone immediately after removal');
  // A second save must not resurrect Bob from the stored copy:
  // save() merges the stored copy first, and the stored copy held
  // Bob before the removal.
  run('save();');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers.map(function(e){return e.id;}))')), ['e0'], 'Bob stays gone after a second save');
  const stored = JSON.parse(store[LSKEY]);
  assert.deepEqual(stored.explorers.map((e) => e.id), ['e0'], 'the stored copy no longer holds Bob');
  assert.deepEqual(stored.deletedExplorers, ['e1'], 'the tombstone is persisted');
});

test('mergeStoredIntoDB never re-adds a tombstoned explorer from localStorage', () => {
  const { ctx, store, run } = makeSaveCtx();
  // Stored copy (e.g. another tab) still holds both explorers and
  // no tombstone; the in-memory DB has removed Bob and tombstoned it.
  store[LSKEY] = JSON.stringify(family(['Alice', 'Bob']));
  run('DB=' + JSON.stringify(family(['Alice'])) + ';');
  run('DB.deletedExplorers=["e1"];');
  run('mergeStoredIntoDB();');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers.map(function(e){return e.id;}))')), ['e0'], 'Bob must not be resurrected from the stored copy');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.deletedExplorers)')), ['e1'], 'the tombstone is kept');
});

test('mergeStoredIntoDB unions the tombstone from the stored copy', () => {
  const { ctx, store, run } = makeSaveCtx();
  // Another tab removed Bob (tombstone in the stored copy); this
  // tab still has Bob in memory and no tombstone.
  const stored = family(['Alice', 'Bob']);
  stored.deletedExplorers = ['e1'];
  store[LSKEY] = JSON.stringify(stored);
  run('DB=' + JSON.stringify(family(['Alice', 'Bob'])) + ';');
  run('mergeStoredIntoDB();');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers.map(function(e){return e.id;}))')), ['e0'], 'the other tab removal reaches this tab through the merged tombstone');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.deletedExplorers)')), ['e1'], 'the tombstone is unioned from the stored copy');
});

test('mergeFamilyDB excludes tombstoned explorers and unions the tombstone', () => {
  const { ctx, run } = makeSaveCtx();
  const server = family(['Alice', 'Bob']);
  const local = family(['Alice']);
  local.deletedExplorers = ['e1'];
  const merged = JSON.parse(run('JSON.stringify(mergeFamilyDB(' + JSON.stringify(local) + ', ' + JSON.stringify(server) + '))'));
  assert.deepEqual(merged.explorers.map((e) => e.id), ['e0'], 'the server copy must not resurrect Bob through the union');
  assert.deepEqual(merged.deletedExplorers, ['e1'], 'the tombstone survives the server merge');
  // The other direction: the server tombstones Bob, the local copy
  // still has him.
  const server2 = family(['Alice', 'Bob']);
  server2.deletedExplorers = ['e1'];
  const local2 = family(['Alice', 'Bob']);
  const merged2 = JSON.parse(run('JSON.stringify(mergeFamilyDB(' + JSON.stringify(local2) + ', ' + JSON.stringify(server2) + '))'));
  assert.deepEqual(merged2.explorers.map((e) => e.id), ['e0'], 'a server-side tombstone also removes Bob from the local list');
  assert.deepEqual(merged2.deletedExplorers, ['e1'], 'the server tombstone is unioned in');
});

test('removing the active explorer moves activeId to another explorer', () => {
  const { ctx, run } = makeSaveCtx();
  run('DB=' + JSON.stringify(family(['Alice', 'Bob'], 'e1')) + ';');
  run('save();');
  removeExplorer(run, 'e1');
  assert.equal(run('DB.activeId'), 'e0', 'activeId moves to the remaining explorer');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers.map(function(e){return e.id;}))')), ['e0'], 'only Alice remains');
  // And a reload (load from the stored copy) keeps it that way.
  run('load();');
  assert.equal(run('DB.activeId'), 'e0', 'activeId still Alice after reload');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers.map(function(e){return e.id;}))')), ['e0'], 'Bob still gone after reload');
});

test('removing the last explorer leaves an empty list and a null activeId', () => {
  const { ctx, store, run } = makeSaveCtx();
  run('DB=' + JSON.stringify(family(['Alice'])) + ';');
  run('save();');
  removeExplorer(run, 'e0');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers)')), [], 'no explorers remain');
  assert.equal(run('DB.activeId'), null, 'activeId is null with no explorers');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.deletedExplorers)')), ['e0'], 'the tombstone records the removal');
  run('save();');
  run('load();');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.explorers)')), [], 'the list is still empty after a save and reload');
  assert.equal(run('DB.activeId'), null, 'activeId still null after reload');
  const stored = JSON.parse(store[LSKEY]);
  assert.deepEqual(stored.explorers, [], 'the stored copy is empty too');
  assert.deepEqual(stored.deletedExplorers, ['e0'], 'the tombstone persists');
});

test('mergeFamilyDB with every explorer tombstoned leaves a null activeId, not a crash', () => {
  const { ctx, run } = makeSaveCtx();
  const server = family(['Alice', 'Bob']);
  const local = family([]);
  local.deletedExplorers = ['e0', 'e1'];
  const merged = JSON.parse(run('JSON.stringify(mergeFamilyDB(' + JSON.stringify(local) + ', ' + JSON.stringify(server) + '))'));
  assert.deepEqual(merged.explorers, [], 'no explorers survive when all are tombstoned');
  assert.equal(merged.activeId, null, 'activeId is null instead of throwing on an empty list');
});

test('load() initialises deletedExplorers for legacy families', () => {
  const { ctx, store, run } = makeSaveCtx();
  const legacy = family(['Alice']);
  delete legacy.deletedExplorers;
  store[LSKEY] = JSON.stringify(legacy);
  run('load();');
  assert.deepEqual(JSON.parse(run('JSON.stringify(DB.deletedExplorers)')), [], 'a legacy family without the field gets an empty tombstone on load');
});

test('the remove handler records the tombstone before saving', () => {
  const start = html.indexOf("document.getElementById('rmYes')");
  assert.ok(start >= 0, 'remove confirmation handler not found');
  const b = html.slice(start, html.indexOf('\n', start));
  assert.ok(b.includes('DB.deletedExplorers'), 'the handler must record the tombstone');
  assert.ok(b.includes("DB.deletedExplorers.push(target.id)"), 'the handler must push the removed id into the tombstone');
  const tomb = b.indexOf('DB.deletedExplorers.push(target.id)');
  const saveAt = b.indexOf('save();');
  assert.ok(tomb >= 0 && saveAt > tomb, 'the tombstone must be recorded BEFORE save(), or the merge in save() resurrects the explorer');
});
