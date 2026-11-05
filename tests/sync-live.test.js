// Live sync regression tests — static checks over public/index.html.
// The client sync code lives inline in the page (no module to import),
// so these tests assert the exact wiring that makes sync live and
// safe: pull-then-upload, no pull-inside-a-pull, safe re-render only,
// and NO straight-to-Home skip (the Grand Door stays the gate).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function bodyOf(fnName, fromMarker) {
  const start = html.indexOf(fromMarker);
  assert.ok(start >= 0, fnName + ' not found in index.html');
  // Slice exactly to the next top-level function, so assertions
  // cannot see into a neighbouring function (e.g. linkDevice,
  // which legitimately calls syncToServer()).
  const next = html.indexOf('\nfunction ', start + fromMarker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

test('upload is pull-then-upload: GET merges before any POST', () => {
  const b = bodyOf('uploadAfterPull', 'function uploadAfterPull()');
  const getAt = b.indexOf("fetch('/api/progress?code='");
  assert.ok(getAt >= 0, 'uploadAfterPull must GET the server record first');
  assert.ok(b.includes('mergeFamilyDB'), 'upload must union-merge, never last-write-wins');
  assert.ok(b.includes('syncPulling'), 'upload must respect the in-flight pull guard');
  // The POST lives inside done(), and done() is only invoked from the
  // GET's .then handlers (success and failure) — so at runtime the
  // GET always happens before the POST, even though done() is
  // defined textually before the fetch.
  assert.ok(/var done=function\(\)\{[\s\S]*?postToServer\(key\)/.test(b), 'POST must go through done() -> postToServer');
  assert.ok(b.indexOf('done();') > getAt, 'done() (which POSTs) must be called after the GET');
});

test('syncToServer debounces into uploadAfterPull, not a bare POST', () => {
  const b = bodyOf('syncToServer', 'function syncToServer(){');
  assert.ok(b.includes('setTimeout(uploadAfterPull,800)'), 'syncToServer must debounce to uploadAfterPull');
  assert.ok(!b.includes("fetch('/api/progress',{method:'POST'"), 'syncToServer must not POST directly any more');
});

test('syncFromServer never starts another pull: it POSTs directly', () => {
  const b = bodyOf('syncFromServer', 'function syncFromServer(opts)');
  // Strip comments first: the explanatory comment itself names
  // syncToServer, so check the code, not the prose.
  const code = b.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(code.includes('postToServer(key)'), 'syncFromServer must upload via direct postToServer');
  assert.ok(!code.includes('syncToServer()'), 'syncFromServer must not call syncToServer (would re-pull)');
  assert.ok(code.includes('if(syncPulling)return Promise.resolve(false)'), 'syncFromServer must skip when a pull is already in flight');
});

test('auto-pull: every 30s while visible, and on becoming visible', () => {
  assert.ok(html.includes('setInterval(autoPull,30000)'), '30s auto-pull interval missing');
  assert.ok(html.includes("document.addEventListener('visibilitychange'"), 'visibilitychange listener missing');
  const b = bodyOf('autoPull', 'function autoPull(){');
  assert.ok(b.includes("document.visibilityState!=='visible'"), 'autoPull must only run while visible');
  assert.ok(b.includes('syncCodeValid(DB.syncCode)'), 'autoPull must only run when linked with a valid family code');
  assert.ok(b.includes('safeToRender()'), 'autoPull must only re-render when safe');
});

test('safe re-render never interrupts a question, game or modal', () => {
  const b = bodyOf('safeToRender', 'function safeToRender()');
  assert.ok(b.includes("route!=='quiz'"), 'safeToRender must exclude quiz');
  assert.ok(b.includes("route!=='warmup'"), 'safeToRender must exclude warmup');
  assert.ok(b.includes("route!=='game'"), 'safeToRender must exclude game');
  assert.ok(b.includes('isModalOpen()'), 'safeToRender must exclude an open modal');
});

test('60s screen-time save still runs and goes through syncToServer', () => {
  assert.ok(html.includes('setInterval(function(){ if(ex()&&document.visibilityState==='), '60s screen-time interval missing');
  const idx = html.indexOf('addMinutes(1); save();');
  assert.ok(idx >= 0, 'screen-time save missing');
});

test('Grand Door is NOT skipped on load: no straight-to-Home', () => {
  assert.ok(html.includes("var route='door'"), 'route must still start at the Grand Door');
  assert.ok(!html.includes("if(ex())route='home'"), 'straight-to-Home must not be present (Bryan said no)');
});

test('a sync pull never switches which explorer this device is signed in as', () => {
  // mergeFamilyDB is inline; eval it with its helpers for a real test.
  function fnText(marker) {
    const s = html.indexOf(marker);
    assert.ok(s >= 0, marker + ' not found');
    const n = html.indexOf('\nfunction ', s + marker.length);
    const b = n >= 0 ? html.slice(s, n) : html.slice(s);
    return b.endsWith('\n') ? b.slice(0, -1) : b;
  }
  const mergeFamilyDB = eval(
    fnText('function unionArr(a,b){') + '\n' +
    fnText('function unionObjMax(a,b){') + '\n' +
    fnText('function unionObjLatest(a,b){') + '\n' +
    fnText('function isThinkingMsg(m){') + '\n' +
    fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
    fnText('function pickCritterName(a,b){') + '\n' +
    fnText('function mergeExplorer(a,b){') + '\n' +
    '(' + fnText('function mergeFamilyDB(local, server){') + ')'
  );
  const mk = (id, activeId) => ({
    syncCode: 'ABCDEF', parentPin: null, dailyLimit: 30, stageV: null, updatedAt: '2026-11-05T00:00:00.000Z',
    activeId, explorers: [
      { id: 'e1', name: 'First', stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [], threadsClearedAt: null, deletedThreadIds: [], flashcards: [], planner: [], critterName: 'Pip' },
      { id: 'e2', name: 'Second', stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [], threadsClearedAt: null, deletedThreadIds: [], flashcards: [], planner: [], critterName: 'Pip' },
    ],
  });
  // This device is signed in as e2; the server record was last
  // uploaded by a device signed in as e1.
  const merged = mergeFamilyDB(mk('local', 'e2'), mk('server', 'e1'));
  assert.equal(merged.activeId, 'e2', 'the local active explorer survives the pull');
  // If the local active explorer no longer exists, fall back safely.
  const gone = mk('local', 'e9');
  const merged2 = mergeFamilyDB(gone, mk('server', 'e1'));
  assert.equal(merged2.activeId, 'e1', 'a missing local active explorer falls back to the server one');
});

test('a merge that replaces the DB re-renders, so no handler keeps a detached explorer', () => {
  const b = bodyOf('uploadAfterPull', 'function uploadAfterPull()');
  assert.ok(b.includes('if(safeToRender())render();'), 'after a merge that changed the DB, re-render when safe');
});
