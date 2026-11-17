// Sidebar regroup + Focus mode (Bryan approved 2026-11-17):
//  1. NAV regroup — core six first (Home, Learn, Ask Pip, Critter
//     Lab, Play, Create), then a "More" heading, then Trivia,
//     Treasure, Jokes, Friends, Vibe. Create is core (flashcards,
//     planner, school schedule are daily study tools) and is NEVER
//     locked. Vibe stays last overall.
//  2. Focus mode — a per-family toggle on the Grown-ups page, OFF
//     by default. When on, Play and Jokes stay locked until the
//     active explorer has done a quest today (streakLastDate ===
//     todayKey()); everything else stays open. The lock is enforced
//     centrally in go(), so sidebar, bottom nav, Home tiles and
//     data-go2 buttons are all covered. Moving inside Play (game ↔
//     arcade list) is allowed, so a child mid-game is never stranded
//     when a parent turns Focus mode on.
//  3. Merge — DB.focusMode + DB.focusModeUpdatedAt, later-timestamp
//     wins in mergeFamilyDB (mirroring the parent PIN rule), default
//     false; mergeStoredIntoDB converges the toggle from the store
//     with the same rule, so a stale tab's routine save never wipes
//     a change another tab just made (the family-timetable wipe of
//     2026-11-09, same shape).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
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

const NAV = eval(html.slice(html.indexOf('var NAV=['), html.indexOf('];', html.indexOf('var NAV=[')) + 2) + '\n;NAV');

test('NAV regroup: core six first in order, then the five More items, Vibe last', () => {
  assert.deepEqual(NAV.map(function (n) { return n[0]; }),
    ['home', 'learn', 'ask', 'critter', 'play', 'create', 'trivia', 'treasure', 'jokes', 'friends', 'vibe'],
    'nav order is core six then More five');
  assert.equal(NAV.length, 11, 'still 11 nav items');
  assert.equal(NAV[NAV.length - 1][0], 'vibe', 'Vibe stays last overall');
  assert.equal(NAV[NAV.length - 2][0], 'friends', 'Friends stays second-to-last');
  assert.ok(html.includes('var NAV_CORE=6;'), 'the core/more split point is a named constant');
});

test('sidebar renders core, then a More heading, then the rest — Create is core, never locked', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes("NAV.slice(0,NAV_CORE)"), 'sidebar builds the core section from the first NAV_CORE items');
  assert.ok(render.includes("'<div class=\"navmore\">More</div>'"), 'a More heading separates the two sections');
  assert.ok(render.includes("NAV.slice(NAV_CORE)"), 'the rest of NAV renders after the More heading');
  assert.ok(render.includes('focusLocked(n[0])'), 'each nav button checks the focus lock');
  assert.ok(render.includes("(locked?' locked':'')"), 'locked buttons get the locked class');
  assert.ok(render.includes("(locked?'🔒 ':'')"), 'locked buttons get a 🔒 prefix');
  const rule = html.match(/\.navbtn\.locked,[^}]*\}/);
  assert.ok(rule && rule[0].includes('opacity:.45'), 'locked nav buttons are dimmed');
  assert.ok(html.includes('.navmore{'), 'the More heading has a style');
  // Create sits at NAV index 5 (core) and is not in the locked set.
  assert.ok(NAV.findIndex(function (n) { return n[0] === 'create'; }) < 6, 'Create is in core');
  const locked = fnBody('function focusLocked(');
  assert.ok(!locked.includes("'create'"), 'the lock never mentions Create');
});

test('parent page has the Focus mode toggle, off by default', () => {
  const parent = fnBody('function parentHTML(');
  assert.ok(parent.includes('Focus mode'), 'parent page explains Focus mode');
  assert.ok(parent.includes('id="focusToggle"'), 'the toggle button exists');
  assert.ok(parent.includes("(DB.focusMode?'🔓 Focus mode: On':'🔒 Focus mode: Off')"), 'the toggle shows the live state');
  const bind = fnBody('function bindParent(){');
  assert.ok(bind.includes("document.getElementById('focusToggle').onclick"), 'the toggle is wired');
  assert.ok(bind.includes('DB.focusMode=!DB.focusMode; DB.focusModeUpdatedAt=new Date().toISOString();'), 'the toggle flips the live record and stamps the updated-at');
  assert.ok(bind.includes('save();'), 'the toggle saves');
});

test('new families start with Focus mode off (real load() literal)', () => {
  function makeSyncCode() { return 'ABCDEF'; } // stub for the new-family literal below
  const start = html.indexOf('DB={explorers:[], deletedExplorers:[], parentPin:null, dailyLimit:');
  assert.ok(start >= 0, 'the new-family DB literal is present');
  const end = html.indexOf('};', start) + 1;
  const fresh = eval('(' + html.slice(start + 3, end) + ')');
  assert.equal(fresh.focusMode, false, 'a new family starts with Focus mode off');
  assert.equal(fresh.focusModeUpdatedAt, null, 'no focus timestamp yet');
});

test('go() gates Play and Jokes through focusLocked, with a friendly toast', () => {
  const goFn = fnText('function go(');
  assert.ok(goFn.includes('if(focusLocked(r)){'), 'go() checks the lock first');
  assert.ok(goFn.includes("Finish today's quest first to unlock Jokes! 😂"), 'Jokes gets its own unlock line');
  assert.ok(goFn.includes("Finish today's quest first to unlock Play! 🎮"), 'Play gets its own unlock line');
});

// ---- Functional: go() / focusLocked in a vm sandbox ----
function goContext(focusMode, streakLastDate, startRoute) {
  const toasts = [];
  let renderCalls = 0;
  const ctx = vm.createContext({
    console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    window: { scrollTo: function () {} },
    toast: function (m) { toasts.push(m); },
    render: function () { renderCalls++; },
    syncFromServer: function () { return { then: function () {} }; },
    safeToRender: function () { return true; },
  });
  ctx.route = startRoute || 'home';
  ctx.askReturn = null;
  ctx.DB = {
    focusMode: focusMode, focusModeUpdatedAt: focusMode ? '2026-11-17T00:00:00.000Z' : null,
    activeId: 'e1',
    explorers: [{ id: 'e1', name: 'Juhin', streak: 1, streakLastDate: streakLastDate || null }],
  };
  loadInto(ctx, 'function ex(){');
  loadInto(ctx, 'function todayKey(){');
  loadInto(ctx, 'function focusLocked(');
  loadInto(ctx, 'function go(');
  return {
    ctx, toasts,
    renderCalls: function () { return renderCalls; },
    go: function (r) { return vm.runInContext('go(' + JSON.stringify(r) + ')', ctx); },
    route: function () { return ctx.route; },
    today: function () { return vm.runInContext('todayKey()', ctx); },
  };
}

test('go(): Focus off — Play and Jokes open normally', () => {
  const g = goContext(false, null);
  g.go('play');
  assert.equal(g.route(), 'play', 'Play opens when Focus mode is off');
  assert.equal(g.renderCalls(), 1, 'render runs once');
  g.go('jokes');
  assert.equal(g.route(), 'jokes', 'Jokes opens when Focus mode is off');
  assert.equal(g.toasts.length, 0, 'no lock toast');
});

test('go(): Focus on, no quest today — Play and Jokes are blocked, Home is open', () => {
  const g = goContext(true, null);
  g.go('play');
  assert.equal(g.route(), 'home', 'Play does not open');
  assert.equal(g.renderCalls(), 0, 'no render on a blocked nav');
  assert.ok(g.toasts[0].includes('unlock Play'), 'Play toast names Play: ' + g.toasts[0]);
  g.go('jokes');
  assert.equal(g.route(), 'home', 'Jokes does not open');
  assert.ok(g.toasts[1].includes('unlock Jokes'), 'Jokes toast names Jokes: ' + g.toasts[1]);
  g.go('home');
  assert.equal(g.route(), 'home', 'Home still opens');
  g.go('learn');
  assert.equal(g.route(), 'learn', 'Learn still opens');
  g.go('create');
  assert.equal(g.route(), 'create', 'Create still opens');
});

test('go(): Focus on, quest done today — Play and Jokes open', () => {
  const g = goContext(true, null);
  const today = g.today();
  g.ctx.DB.explorers[0].streakLastDate = today;
  g.go('play');
  assert.equal(g.route(), 'play', 'Play opens after today’s quest');
  g.go('jokes');
  assert.equal(g.route(), 'jokes', 'Jokes opens after today’s quest');
  assert.equal(g.toasts.length, 0, 'no lock toast once the quest is done');
});

test('go(): Focus on mid-game — moving inside Play still works, entering from outside does not', () => {
  const g = goContext(true, null, 'game');
  g.go('play');
  assert.equal(g.route(), 'play', 'back from a game to the arcade list still works');
  const h = goContext(true, null, 'play');
  h.go('game');
  assert.equal(h.route(), 'game', 'arcade list into a game still works');
  const o = goContext(true, null, 'home');
  o.go('game');
  assert.equal(o.route(), 'home', 'a game cannot be entered from outside Play while locked');
  assert.ok(o.toasts[0].includes('unlock Play'), 'the game toast names Play');
});

// ---- Functional: mergeFamilyDB / mergeStoredIntoDB in a vm sandbox ----
function mergeContext() {
  const store = new Map();
  const ctx = vm.createContext({
    console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    localStorage: {
      getItem: function (k) { return store.has(k) ? store.get(k) : null; },
      setItem: function (k, v) { store.set(k, v); },
      removeItem: function (k) { store.delete(k); },
    },
  });
  ctx.LSKEY = 'test-key-focus';
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
  return { ctx, store };
}
function explorer(over) {
  return Object.assign({
    id: 'e1', name: 'Juhin', stars: 0, critterStage: 0, badges: [], treasures: [],
    discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
    hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, playBest: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [],
    deletedThreadIds: [], flashcards: [], deletedFlashcards: [], planner: [],
    deletedPlanner: [], friends: [], deletedFriends: [], friendCode: 'ABCDEF',
    nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦', lookAt: null,
    critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
    spellingTests: [], deletedSpellingTests: [], streak: 0, streakLastDate: null,
  }, over || {});
}
function familyDB(over) {
  return Object.assign({
    explorers: [explorer({})], deletedExplorers: [], parentPin: null, dailyLimit: 90, playLimit: 20,
    activeId: 'e1', syncCode: 'ABCDEF', updatedAt: '2026-11-17T00:00:00.000Z', flags: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null, familyPlanRev: 0,
    focusMode: false, focusModeUpdatedAt: null,
  }, over || {});
}

test('mergeFamilyDB: later timestamp wins, either side', () => {
  const { ctx } = mergeContext();
  const later = '2026-11-17T07:00:00.000Z', earlier = '2026-11-17T06:00:00.000Z';
  let m = vm.runInContext(
    'mergeFamilyDB(' + JSON.stringify(familyDB({ focusMode: true, focusModeUpdatedAt: later })) +
    ',' + JSON.stringify(familyDB({ focusMode: false, focusModeUpdatedAt: earlier })) + ')', ctx);
  assert.equal(m.focusMode, true, 'local ON with the later timestamp wins');
  assert.equal(m.focusModeUpdatedAt, later, 'the winning timestamp is kept');
  m = vm.runInContext(
    'mergeFamilyDB(' + JSON.stringify(familyDB({ focusMode: false, focusModeUpdatedAt: earlier })) +
    ',' + JSON.stringify(familyDB({ focusMode: true, focusModeUpdatedAt: later })) + ')', ctx);
  assert.equal(m.focusMode, true, 'server ON with the later timestamp wins');
  assert.equal(m.focusModeUpdatedAt, later, 'the winning timestamp is kept');
});

test('mergeFamilyDB: default false when neither side ever set it', () => {
  const { ctx } = mergeContext();
  const local = familyDB({}); delete local.focusMode; delete local.focusModeUpdatedAt;
  const server = familyDB({}); delete server.focusMode; delete server.focusModeUpdatedAt;
  const m = vm.runInContext('mergeFamilyDB(' + JSON.stringify(local) + ',' + JSON.stringify(server) + ')', ctx);
  assert.equal(m.focusMode, false, 'Focus mode defaults off');
});

test('mergeFamilyDB: empty local copy adopts the server toggle', () => {
  const { ctx } = mergeContext();
  const local = familyDB({ explorers: [] });
  const server = familyDB({ focusMode: true, focusModeUpdatedAt: '2026-11-17T07:00:00.000Z' });
  const m = vm.runInContext('mergeFamilyDB(' + JSON.stringify(local) + ',' + JSON.stringify(server) + ')', ctx);
  assert.equal(m.focusMode, true, 'the server toggle survives the empty-local path');
});

test('mergeStoredIntoDB: a newer toggle in the store is adopted, an older one never reverts', () => {
  const { ctx, store } = mergeContext();
  const later = '2026-11-17T07:00:00.000Z', earlier = '2026-11-17T06:00:00.000Z';
  ctx.DB = familyDB({ focusMode: false, focusModeUpdatedAt: earlier });
  ctx.localStorage.setItem('test-key-focus', JSON.stringify(familyDB({ focusMode: true, focusModeUpdatedAt: later })));
  vm.runInContext('mergeStoredIntoDB()', ctx);
  assert.equal(ctx.DB.focusMode, true, 'the newer stored toggle is adopted');
  assert.equal(ctx.DB.focusModeUpdatedAt, later, 'the newer timestamp is adopted');
  ctx.DB = familyDB({ focusMode: true, focusModeUpdatedAt: later });
  ctx.localStorage.setItem('test-key-focus', JSON.stringify(familyDB({ focusMode: false, focusModeUpdatedAt: earlier })));
  vm.runInContext('mergeStoredIntoDB()', ctx);
  assert.equal(ctx.DB.focusMode, true, 'an older stored toggle never reverts the live one');
});
