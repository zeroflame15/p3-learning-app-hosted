// Save-race regression (seen live 2026-11-09): the familyPlanRev fix
// (repo 266) plus the mergeStoredIntoDB localStorage fix (repo 269)
// made the save better but NOT reliable — 7 schedule saves, only 3
// stuck. Root cause (reproduced below): a stale tab's auto-pull GET
// is issued BEFORE a newer plan lands on the server but resolves
// AFTER it. The tab merges the STALE server snapshot into its stale
// in-memory DB, then saveLocal() + postToServer() write the old plan
// back over the store AND the server (last-write-wins), so a save
// that already landed is reverted and the next reload shows the old
// timetable. Fix: (A) the server is now the authority on revision
// (api/progress.js keeps a newer stored plan over a stale incoming
// one); (B) syncFromServer() and uploadAfterPull() converge from
// localStorage (mergeStoredIntoDB) BEFORE merging a server snapshot;
// (C) the timetable Save/Reset toast waits for a server confirmation
// (confirmPlanSaved) instead of claiming success on the local write.
// Plus (Task 3): rest-day tick disables subject checkboxes WITHOUT
// clearing them, so unticking restores the ticks (the draft keeps
// them; the SAVE still forces subs=[] for a rest day).
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
  'function postToServer(key){', 'function confirmPlanSaved(', 'function confirmFailReason(){', 'function syncToServer(){',
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
function planOf(db) {
  if (!db || !db.familyPlan || !db.familyPlan[1]) return '(none)';
  return db.familyPlan[1].study;
}

// Mock fetch. GETs from Tab B are DEFERRED (snapshot captured at call
// time, resolved only when the test flushes them) — a slow auto-pull
// whose response arrives after a newer plan has landed. All other
// requests resolve immediately. The server is last-write-wins,
// exactly like api/progress.js BEFORE the guard (so the test proves
// the CLIENT fix alone stops the revert).
function mockFetch(server, log, pendingB) {
  return function (url, opts) {
    if (opts && opts.method === 'POST') {
      const body = JSON.parse(opts.body);
      log.push({ type: 'POST', from: opts._from || '?', plan: body.data.familyPlan && body.data.familyPlan[1] ? body.data.familyPlan[1].study : '(none)', rev: body.data.familyPlanRev });
      server.row = { code: body.code, data: JSON.parse(JSON.stringify(body.data)), updatedAt: new Date().toISOString() };
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt }) });
    }
    const m = String(url).match(/code=([^&]*)/);
    const code = m ? decodeURIComponent(m[1]) : null;
    const row = server.row && server.row.code === code ? server.row : null;
    const snap = row ? { configured: true, data: JSON.parse(JSON.stringify(row.data)), updatedAt: row.updatedAt } : { configured: true, data: null, updatedAt: null };
    // The lightweight check (?check=1) is never deferred: it returns
    // only updatedAt and resolves at once, so the full GET is the one
    // that gets deferred (the stale pull under test).
    if (String(url).includes('check=1')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ configured: true, updatedAt: row ? row.updatedAt : null }) });
    }
    if (opts && opts._from === 'B') {
      return new Promise((resolve) => { pendingB.push(() => resolve({ ok: true, status: 200, json: async () => snap })); });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => snap });
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

function makeTab(store, server, log, deviceId, bus, tag, pendingB) {
  const listeners = {};
  const sandbox = {
    console, setTimeout, clearTimeout,
    JSON, Object, Array, Math, Date, Promise,
    DB: null, DEVICE_ID: deviceId,
    syncPulling: false, syncUploadPending: false, syncTimer: null, postRetryCount: 0,
    lastUploadStatus: 0, lastUploadOk: false, uploadsActive: 0, uploadFinal: false,
    route: 'parent',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); bus.queue.push({ key: k, from: sandbox }); },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: (url, opts) => mockFetch(server, log, pendingB)(url, Object.assign({}, opts, { _from: tag })),
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

test('stale-GET auto-pull must not revert a timetable save (repro3)', async () => {
  const store = {};
  const server = { row: null };
  const log = [];
  const pendingB = [];
  const bus = makeBus();
  store[LSKEY] = JSON.stringify(makeFamily(VERIFY_PLAN, 1, '2026-11-09T04:00:00.000Z'));
  server.row = { code: '8SXU6S', data: makeFamily(VERIFY_PLAN, 1, '2026-11-09T04:05:00.000Z'), updatedAt: '2026-11-09T04:05:00.000Z' };

  const tabA = makeTab(store, server, log, 'd-tab-a', bus, 'A', pendingB);
  const tabB = makeTab(store, server, log, 'd-tab-b', bus, 'B', pendingB);
  tabA.run('load()'); tabB.run('load()');

  // Tab B starts its auto-pull; its GET is deferred (stale snapshot).
  const bPull = tabB.run('syncFromServer({})');
  // The check GET resolves at once (microtasks); the full GET it
  // triggers is the deferred one. Let the check chain run first.
  await sleep(0);
  assert.equal(pendingB.length, 1, 'B full GET is deferred (check resolved first)');
  // Tab A saves the restore (TEST rev 2) and its upload lands.
  tabA.run("DB.familyPlan=" + JSON.stringify(TEST_PLAN) + "; DB.familyPlanUpdatedAt=new Date().toISOString(); DB.familyPlanRev=(DB.familyPlanRev||0)+1; save();");
  await sleep(1200);
  assert.equal(planOf(server.row.data), 'Study 4:00–5:00pm TEST', 'server holds TEST after A upload');
  assert.equal(server.row.data.familyPlanRev, 2, 'server rev is 2');
  // Now B's stale GET resolves (VERIFY rev 1 snapshot).
  pendingB.splice(0).forEach((fn) => fn());
  await bPull;
  await sleep(300);
  assert.equal(planOf(server.row.data), 'Study 4:00–5:00pm TEST', 'server still holds TEST after B stale pull');
  assert.equal(server.row.data.familyPlanRev, 2, 'server rev is still 2');
  assert.equal(planOf(JSON.parse(store[LSKEY])), 'Study 4:00–5:00pm TEST', 'store still holds TEST');
  // The verifier's next reload shows TEST.
  tabA.run('load()');
  assert.equal(planOf(tabA.DB), 'Study 4:00–5:00pm TEST', 'A holds TEST after reload');
  assert.equal(tabA.DB.familyPlanRev, 2, 'A rev is 2 after reload');
  // B must NOT have posted the stale VERIFY plan after A's TEST landed.
  const bPosts = log.filter((e) => e.type === 'POST' && e.from === 'B');
  assert.ok(bPosts.every((p) => p.rev >= 2 || p.plan.includes('TEST')), 'B never posts a stale rev-1 VERIFY plan after TEST landed (posts: ' + JSON.stringify(bPosts) + ')');
});

test('confirmPlanSaved exists and verifies the server holds the plan', () => {
  const code = fnText('function confirmPlanSaved(');
  assert.ok(code.includes('familyPlanRev'), 'checks the rev');
  assert.ok(code.includes('plansEqual(d.familyPlan'), 'checks the whole plan content');
  assert.ok(code.includes('syncToServer()'), 'retries the upload on a miss');
});

/* ---------- (A) server revision guard: api/progress.js ---------- */
function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function mockReq(method, body, query) { return { method, body, query: query || {} }; }

test('api/progress: a stale plan write (lower rev) must not overwrite a newer stored plan', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  const origFetch = global.fetch;
  // Stored row: VERIFY rev 2. Incoming POST: TEST rev 1 (stale).
  const stored = makeFamily(VERIFY_PLAN, 2, '2026-11-09T04:10:00.000Z');
  const incoming = makeFamily(TEST_PLAN, 1, '2026-11-09T04:05:00.000Z');
  let upsertBody = null;
  global.fetch = async (url, init) => {
    if (init && init.method === 'POST') {
      upsertBody = JSON.parse(init.body);
      return { ok: true, json: async () => [{ updated_at: new Date().toISOString() }] };
    }
    // Guard read: return the stored row.
    return { ok: true, json: async () => [{ data: JSON.parse(JSON.stringify(stored)) }] };
  };
  try {
    const res = mockRes();
    await progress(mockReq('POST', { code: '8SXU6S', device: 'D-test', data: incoming }), res);
    assert.equal(res.statusCode, 200, 'POST still succeeds');
    assert.ok(upsertBody, 'an upsert was issued');
    assert.equal(upsertBody.data.familyPlan[1].study, 'Study 5:00–6:00pm VERIFY', 'stored VERIFY plan is preserved in the write');
    assert.equal(upsertBody.data.familyPlanRev, 2, 'stored rev is preserved');
    assert.equal(res.body.planPreserved, true, 'response reports the plan was preserved');
    assert.equal(res.body.familyPlanRev, 2, 'response reports the effective rev');
    // The explorer progress in the incoming record is still saved.
    assert.equal(upsertBody.data.explorers.length, 2, 'explorer data is still written');
  } finally { global.fetch = origFetch; }
});

test('api/progress: a newer plan write (higher rev) is accepted and not preserved', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  const origFetch = global.fetch;
  const stored = makeFamily(VERIFY_PLAN, 2, '2026-11-09T04:10:00.000Z');
  const incoming = makeFamily(TEST_PLAN, 3, '2026-11-09T04:20:00.000Z');
  let upsertBody = null;
  global.fetch = async (url, init) => {
    if (init && init.method === 'POST') {
      upsertBody = JSON.parse(init.body);
      return { ok: true, json: async () => [{ updated_at: new Date().toISOString() }] };
    }
    return { ok: true, json: async () => [{ data: JSON.parse(JSON.stringify(stored)) }] };
  };
  try {
    const res = mockRes();
    await progress(mockReq('POST', { code: '8SXU6S', device: 'D-test', data: incoming }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(upsertBody.data.familyPlan[1].study, 'Study 4:00–5:00pm TEST', 'the newer incoming plan is written');
    assert.equal(upsertBody.data.familyPlanRev, 3, 'the newer rev is written');
    assert.equal(res.body.planPreserved, false, 'nothing was preserved');
    assert.equal(res.body.familyPlanRev, 3);
  } finally { global.fetch = origFetch; }
});

test('api/progress: equal rev, stored timestamp later — the stored plan is preserved', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
  delete require.cache[require.resolve('../api/progress')];
  const progress = require('../api/progress');
  const origFetch = global.fetch;
  const stored = makeFamily(VERIFY_PLAN, 2, '2026-11-09T04:10:00.000Z');
  const incoming = makeFamily(TEST_PLAN, 2, '2026-11-09T04:05:00.000Z');
  let upsertBody = null;
  global.fetch = async (url, init) => {
    if (init && init.method === 'POST') {
      upsertBody = JSON.parse(init.body);
      return { ok: true, json: async () => [{ updated_at: new Date().toISOString() }] };
    }
    return { ok: true, json: async () => [{ data: JSON.parse(JSON.stringify(stored)) }] };
  };
  try {
    const res = mockRes();
    await progress(mockReq('POST', { code: '8SXU6S', device: 'D-test', data: incoming }), res);
    assert.equal(upsertBody.data.familyPlan[1].study, 'Study 5:00–6:00pm VERIFY', 'later-timestamp stored plan wins the rev tie');
    assert.equal(res.body.planPreserved, true);
  } finally { global.fetch = origFetch; }
});

/* ---------- (Task 3) rest-day: disable without clearing ---------- */
function editorEngine(days) {
  const els = {};
  function mkEl(kind, dow, sub) {
    const d = days[dow] || {};
    if (kind === 'rest') return { checked: !!d.rest, disabled: false, getAttribute: () => String(dow) };
    if (kind === 'sub') return { checked: (d.subs || []).indexOf(sub) >= 0, disabled: false, getAttribute: () => dow + ':' + sub };
    if (kind === 'time') return { value: d.study || '', disabled: false };
    return { value: d.note || '', disabled: false };
  }
  for (let dow = 0; dow < 7; dow++) {
    els['[data-fsrest="' + dow + '"]'] = mkEl('rest', dow);
    for (const s of ['eng', 'math', 'sci', 'chi']) els['[data-fssub="' + dow + ':' + s + '"]'] = mkEl('sub', dow, s);
    els['[data-fsstime="' + dow + '"]'] = mkEl('time', dow);
    els['[data-fsnote="' + dow + '"]'] = mkEl('note', dow);
  }
  const documentStub = {
    querySelector: (sel) => els[sel] || null,
    querySelectorAll: () => [],
  };
  const code = fnText('function planDayLabel(') + '\n'
    + fnText('function readFamilyPlanFromForm(') + '\n'
    + fnText('function syncRestDay(');
  const sandbox = { document: documentStub, SUBJECTS: { eng: 'English', math: 'Maths', sci: 'Science', chi: 'Chinese' } };
  const ctx = vm.createContext(sandbox);
  vm.runInContext('var SUBJECTS={eng:"English",math:"Maths",sci:"Science",chi:"Chinese"};\n' + code, ctx);
  return { read: ctx.readFamilyPlanFromForm, sync: ctx.syncRestDay, els, ctx };
}

test('rest-day: tick disables without clearing, untick restores the ticks', () => {
  const { sync, els } = editorEngine({ 3: { rest: false, subs: ['chi', 'eng'], study: 'Light study 3:00–4:00pm', note: 'Higher Chinese 5:00–7:00pm' } });
  sync(3);
  assert.equal(els['[data-fssub="3:chi"]'].disabled, false, 'subjects enabled while not a rest day');
  els['[data-fsrest="3"]'].checked = true;
  sync(3);
  assert.equal(els['[data-fssub="3:chi"]'].checked, true, 'chi tick is KEPT on rest (only disabled)');
  assert.equal(els['[data-fssub="3:eng"]'].checked, true, 'eng tick is KEPT on rest');
  assert.equal(els['[data-fssub="3:chi"]'].disabled, true, 'subject checkbox is disabled on rest');
  assert.equal(els['[data-fssub="3:eng"]'].disabled, true, 'all four subjects are disabled on rest');
  assert.equal(els['[data-fsstime="3"]'].disabled, true, 'study time is disabled on rest');
  els['[data-fsrest="3"]'].checked = false;
  sync(3);
  assert.equal(els['[data-fssub="3:chi"]'].checked, true, 'chi tick is restored when rest is unticked');
  assert.equal(els['[data-fssub="3:eng"]'].checked, true, 'eng tick is restored when rest is unticked');
  assert.equal(els['[data-fssub="3:chi"]'].disabled, false, 'subjects re-enable when rest is unticked');
  assert.equal(els['[data-fsstime="3"]'].disabled, false, 'study time re-enables when rest is unticked');
});

test('rest-day: the draft keeps the ticks and study time, but the SAVE still forces subs=[] and no study time', () => {
  const { read } = editorEngine({ 6: { rest: true, subs: ['eng', 'math'], study: '3:00–4:30pm', note: 'Dance 12:00–1:00pm · Art 1:30–3:00pm' } });
  // Save mode (no flag): a rest day saves with no subjects / no study.
  const saved = read();
  assert.equal(saved[6].subs.length, 0, 'saved rest day has no subjects');
  assert.equal(saved[6].study, '', 'saved rest day has no study time');
  assert.equal(saved[6].rest, true);
  assert.equal(saved[6].label, 'Rest day');
  assert.equal(saved[6].note, 'Dance 12:00–1:00pm · Art 1:30–3:00pm', 'the activity stays in the Note');
  // Draft mode (forDraft): the ticks and study time are kept, so a
  // re-render after unticking rest restores them.
  const draft = read(true);
  assert.equal([...draft[6].subs].join(','), 'eng,math', 'draft keeps the ticked subjects on a rest day');
  assert.equal(draft[6].study, '3:00–4:30pm', 'draft keeps the study time on a rest day');
  assert.equal(draft[6].label, 'Rest day', 'the label still says Rest day');
});

test('rest-day: the draft capture reads the form as a draft', () => {
  assert.ok(html.includes('capturePlanDraft(){ fsPlanDraft=readFamilyPlanFromForm(true); }'), 'capturePlanDraft passes forDraft');
  assert.ok(html.includes('if(rest)cb.checked=false') === false, 'syncRestDay no longer clears ticks');
});
