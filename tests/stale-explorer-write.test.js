// Stale-explorer writes (2026-11-17, seen live): adding a flashcard
// toasted "Flashcard added" but the card never appeared — not even
// after reload — while a planner add in the same session worked.
// Root cause: bind handlers captured `var e = ex()` once at bind
// time, but save() replaces DB.explorers[i] with a fresh merged
// copy — the 60s screen-time tick and the 30s auto-pull both do it
// WITHOUT re-rendering. A click after that mutates the detached old
// object, and the next save() serialises the new DB, so the write
// is silently lost. The merge/save path itself is fine (a card
// pushed to the LIVE explorer survives save() and the server-pull
// merge). Fix: every mutating handler in bindCreate and bindAsk
// re-fetches ex() first. These tests pin both the trap and the fix.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
function loadInto(ctx, marker) { vm.runInContext(fnText(marker), ctx); }

const LSKEY = 'test-key-stale-write';

function explorer(over) {
  return Object.assign({
    id: 'e-juhin', name: 'Juhin', level: 'P3',
    flashcards: [], deletedFlashcards: ['1zebra', 'fc-mig-1drwe8r', 'fc-mig-1wobii8'],
    planner: [], deletedPlanner: [], threads: [], deletedThreadIds: [],
    favAnswers: [], deletedFavAnswers: [],
    stars: 185, starsEarned: 185, starsSpent: 0, critterStage: 0,
    badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, progress: {}, playProgress: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    critterName: 'Greg Washington', care: {}, careGrewDay: null,
    spellingTests: [], deletedSpellingTests: [],
  }, over || {});
}
function makeDB(ex) {
  return {
    syncCode: '8SXU6S', activeId: 'e-juhin',
    explorers: [ex], deletedExplorers: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null,
    parentPin: null, dailyLimit: 30, playLimit: 20, updatedAt: '2026-11-17T00:00:00.000Z',
  };
}

function saveContext() {
  const store = new Map();
  const ctx = vm.createContext({
    console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    localStorage: {
      getItem: function (k) { return store.has(k) ? store.get(k) : null; },
      setItem: function (k, v) { store.set(k, v); },
      removeItem: function (k) { store.delete(k); },
    },
  });
  ctx.LSKEY = LSKEY;
  // No sync key in this harness: save() must stay local-only, exactly
  // like the offline repros — the pull/upload path is covered by
  // mergeFamilyDB below, not by a network round trip.
  ctx.syncKey = function () { return null; };
  ctx.syncTimer = null;
  [
    'function unionArr(a,b){', 'function unionObjMax(a,b){', 'function unionObjLatest(a,b){',
    'function isThinkingMsg(m){', 'function mergeThreads(aThreads,bThreads){',
    'function pickCritterName(a,b){', 'function mergeCare(a,b){', 'function hashStr(s){',
    'function flashcardId(f, b, n){', 'function stampFlashcardIds(e){',
    'function bridgeFlashcardTombstones(e){', 'function stripNulDeep(v){',
    'function mergeExplorer(a,b){', 'function mergeStoredIntoDB(){',
    'function makeSyncCode(){', 'function syncCodeValid(v){', 'function ensureSyncCode(){',
    'function mergeFamilyDB(local, server){', 'function saveLocal(){',
    'function syncToServer(){', 'function save(){', 'function ex(){',
  ].forEach(function (m) { loadInto(ctx, m); });
  ctx.DB = makeDB(explorer());
  ctx.localStorage.setItem(LSKEY, JSON.stringify(makeDB(explorer())));
  return { ctx, store };
}
function storedFlashcards(store) {
  return JSON.parse(store.get(LSKEY)).explorers[0].flashcards;
}

test('the trap, pinned: a write through a pre-tick explorer object is lost on save', () => {
  const { ctx, store } = saveContext();
  const captured = ctx.ex(); // what bindCreate/bindAsk used to capture
  assert.strictEqual(captured, ctx.ex(), 'the captured object starts out live');
  ctx.save(); // the 60s tick (or an auto-pull): save() swaps the object
  assert.notStrictEqual(captured, ctx.ex(), 'save() replaces DB.explorers[i] with a merged copy');
  captured.flashcards.push({ f: 'TESTCARD', b: 'test', id: 'fc-stale-1' });
  ctx.save();
  assert.equal(ctx.ex().flashcards.length, 0, 'the card pushed to the detached object never reaches the live DB');
  assert.equal(storedFlashcards(store).length, 0, 'and it never reaches localStorage either — a reload shows nothing');
});

test('fixed pattern: re-fetching ex() after a tick keeps the write', () => {
  const { ctx, store } = saveContext();
  ctx.ex(); // bind time
  ctx.save(); // a tick fires while the child types the card's sides
  const fresh = ctx.ex(); // what the fixed handlers do first
  fresh.flashcards.push({ f: 'TESTCARD', b: 'test', id: 'fc-fresh-1' });
  ctx.save();
  assert.equal(ctx.ex().flashcards.length, 1, 'the card lands in the live DB');
  assert.equal(ctx.ex().flashcards[0].f, 'TESTCARD');
  assert.equal(storedFlashcards(store).length, 1, 'and in localStorage, so a reload still shows it');
  assert.equal(storedFlashcards(store)[0].id, 'fc-fresh-1');
});

test('flashcard add survives save, a reload, and a stale-server pull merge', () => {
  const { ctx, store } = saveContext();
  // The add, as bindCreate does it now: fresh explorer, unique id,
  // legacy tombstone forms cleared, then save().
  const e = ctx.ex();
  e.flashcards.push({ f: 'TESTCARD', b: 'test', id: 'fc-' + Date.now().toString(36) + '-abc123' });
  e.deletedFlashcards = e.deletedFlashcards.filter(function (k) {
    return k !== 'TESTCARD' + '\u0000test' && k !== 'TESTCARDtest' && k !== ctx.flashcardId('TESTCARD', 'test', 0);
  });
  ctx.save();
  assert.equal(ctx.ex().flashcards.length, 1, 'the card is in the live DB after save()');
  // Reload: a fresh DB built from what saveLocal wrote.
  const reloaded = JSON.parse(store.get(LSKEY));
  assert.equal(reloaded.explorers[0].flashcards.length, 1, 'the card is still there after a reload');
  assert.equal(reloaded.explorers[0].flashcards[0].f, 'TESTCARD');
  // A stale server copy pulls in (the auto-pull after the save):
  // the union merge must keep the local card, not revert to empty.
  const serverStale = makeDB(explorer());
  ctx.DB = ctx.mergeFamilyDB(ctx.DB, serverStale);
  assert.equal(ctx.ex().flashcards.length, 1, 'the card survives the stale-server pull merge');
});

test('bindCreate re-fetches the explorer in every mutating handler', () => {
  const bind = fnText('function bindCreate(){');
  const hits = bind.split('e=ex(); if(!e)return;').length - 1;
  assert.equal(hits, 6, 'all six mutating handlers (add-plan, delete-card, add-card, tick-plan, delete-plan, add-plan-item) must re-fetch ex() first, got ' + hits);
  assert.ok(bind.indexOf("document.getElementById('fcAdd').onclick=function(){\n    e=ex(); if(!e)return;") >= 0, 'the flashcard add re-fetches before it reads the inputs');
});

test('bindAsk re-fetches the explorer in every mutating handler', () => {
  const bind = fnText('function bindAsk(){');
  const hits = bind.split('e=ex(); if(!e)return;').length - 1;
  assert.equal(hits, 7, 'all seven mutating/read handlers (new chat, clear all, delete chat, un-bookmark, listen, bookmark, flag) must re-fetch ex() first, got ' + hits);
});
