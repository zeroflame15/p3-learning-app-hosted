// Create Studio + Change name & look regressions (reported by Bryan, 2026-11-06):
//  1. Flashcards: mergeExplorer checked x.q===f.q but cards are {f,b},
//     so both sides were undefined and a 2nd local card was dropped on sync.
//  2. Planner: the merge kept only the server copy for a shared title,
//     so a local tick (d:true) was reverted by the server's d:false, and
//     deletes resurrected because the merge was union-only with no tombstone.
//  3. Change name & look: mergeExplorer started from the server copy and
//     never merged e.name/glow/badge from local, so a rename reverted.
// Fixes: flashcards union by front+back with a deletedFlashcards tombstone;
// planner unions by title with done = either side done, plus a
// deletedPlanner tombstone; name/look merge by later timestamp (tie -> local),
// same pattern as the critter rename rule.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}

// Same eval chain as tests/threads-clear.test.js — mergeExplorer must
// stay eval-able with only these helpers (no new top-level helpers).
const mergeExplorer = eval(
  fnText('function unionArr(a,b){') + '\n' +
  fnText('function unionObjMax(a,b){') + '\n' +
  fnText('function unionObjLatest(a,b){') + '\n' +
  fnText('function isThinkingMsg(m){') + '\n' +
  fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
  fnText('function pickCritterName(a,b){') + '\n' +
  fnText('function mergeCare(a,b){') + '\n' +
  '(' + fnText('function mergeExplorer(a,b){') + ')'
);

function explorer(over) {
  return Object.assign({
    name: 'MightyOtter', nameAt: null, glow: '#ffb020', badge: '⭐', lookAt: null,
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [],
    progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads: [], threadsClearedAt: null, deletedThreadIds: [],
    flashcards: [], deletedFlashcards: [], planner: [], deletedPlanner: [],
    critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
  }, over || {});
}

test('flashcards: two different cards both survive a server+local merge', () => {
  const server = explorer({ flashcards: [{ f: 'What is 7 x 8?', b: '56' }] });
  const local = explorer({ flashcards: [{ f: 'What is 7 x 8?', b: '56' }, { f: 'What is 6 x 7?', b: '42' }] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.flashcards.length, 2, 'the local 2nd card must not be dropped on sync');
  assert.deepEqual(merged.flashcards.map(function (c) { return c.f; }), ['What is 7 x 8?', 'What is 6 x 7?']);
});

test('flashcards: cards unique to either side are unioned, same front+back is not duplicated', () => {
  const server = explorer({ flashcards: [{ f: 'A', b: '1' }] });
  const local = explorer({ flashcards: [{ f: 'B', b: '2' }, { f: 'A', b: '1' }] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.flashcards.length, 2, 'one card from each side, shared card counted once');
  const sameFront = mergeExplorer(
    explorer({ flashcards: [{ f: 'Q', b: '1' }] }),
    explorer({ flashcards: [{ f: 'Q', b: '2' }] })
  );
  assert.equal(sameFront.flashcards.length, 2, 'same front with a different back is a different card');
});

test('flashcards: a deleted card does not come back from the server', () => {
  const key = 'What is 7 x 8?\u000056';
  const server = explorer({ flashcards: [{ f: 'What is 7 x 8?', b: '56' }] });
  const local = explorer({ flashcards: [], deletedFlashcards: [key] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.flashcards.length, 0, 'the deleted card must stay deleted');
  assert.deepEqual(merged.deletedFlashcards, [key], 'the tombstone must survive the merge');
  const merged2 = mergeExplorer(local, server);
  assert.equal(merged2.flashcards.length, 0, 'tombstone works whichever side holds it');
});

test('planner: a tick on local survives when the server says unticked, and vice versa', () => {
  const server = explorer({ planner: [{ t: 'Finish today’s quest', d: false }] });
  const local = explorer({ planner: [{ t: 'Finish today’s quest', d: true }] });
  assert.equal(mergeExplorer(server, local).planner[0].d, true, 'local tick must survive the server unticked copy');
  assert.equal(mergeExplorer(local, server).planner[0].d, true, 'done is either-side-done, regardless of argument order');
  const merged = mergeExplorer(
    explorer({ planner: [{ t: 'A', d: false }] }),
    explorer({ planner: [{ t: 'B', d: true }] })
  );
  assert.deepEqual(merged.planner.map(function (p) { return p.t; }), ['A', 'B'], 'plans unique to either side are kept, server order first');
});

test('planner: a deleted plan does not come back from the server', () => {
  const server = explorer({ planner: [{ t: 'Practise piano', d: false }] });
  const local = explorer({ planner: [], deletedPlanner: ['Practise piano'] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.planner.length, 0, 'the deleted plan must stay deleted');
  assert.deepEqual(merged.deletedPlanner, ['Practise piano'], 'the tombstone must survive the merge');
});

test('explorer rename: a later rename wins even when shorter, an older rename loses', () => {
  const server = explorer({ name: 'MightyOtter', nameAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ name: 'Ted', nameAt: '2026-11-06T08:00:00.000Z' });
  assert.equal(mergeExplorer(server, local).name, 'Ted', 'the later rename wins');
  assert.equal(mergeExplorer(local, server).name, 'Ted', 'argument order must not matter');
  assert.equal(mergeExplorer(server, local).nameAt, '2026-11-06T08:00:00.000Z', 'the winning timestamp is kept');
  const older = explorer({ name: 'Ted', nameAt: '2026-11-01T10:00:00.000Z' });
  const newer = explorer({ name: 'MightyOtter', nameAt: '2026-11-06T08:00:00.000Z' });
  assert.equal(mergeExplorer(older, newer).name, 'MightyOtter', 'the newer rename wins even if it is the longer old name');
});

test('explorer rename: with no timestamps on either side the server name stays (legacy)', () => {
  const server = explorer({ name: 'OldName', nameAt: null });
  const local = explorer({ name: 'NewName', nameAt: null });
  assert.equal(mergeExplorer(server, local).name, 'OldName', 'legacy explorers keep the old server-wins rule until a stamped rename happens');
});

test('explorer look: a later glow/badge change wins, whichever side it is on', () => {
  const server = explorer({ glow: '#ffb020', badge: '⭐', lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ glow: '#2dd4bf', badge: '🚀', lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.glow, '#2dd4bf', 'the later glow wins');
  assert.equal(merged.badge, '🚀', 'the later badge wins with it');
  assert.equal(merged.lookAt, '2026-11-06T08:00:00.000Z', 'the winning look timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.equal(merged2.glow, '#2dd4bf', 'argument order must not matter for look either');
  assert.equal(merged2.badge, '🚀');
});

test('merge uses front+back for flashcards and a done-OR for planner, never the old rules', () => {
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.includes('x.f===f.f && x.b===f.b'), 'flashcards must merge by front+back identity');
  assert.ok(!merge.includes('x.q===f.q'), 'the old x.q===f.q check (both sides undefined) must be gone');
  assert.ok(merge.includes('deletedFlashcards'), 'flashcard tombstone must be merged');
  assert.ok(merge.includes('deletedPlanner'), 'planner tombstone must be merged');
  assert.ok(merge.includes('||!!p.d'), 'planner done must be either-side-done');
  assert.ok(merge.includes('nameAt'), 'name must merge by timestamp');
  assert.ok(merge.includes('lookAt'), 'look must merge by timestamp');
});

test('delete handlers record the tombstones, and re-adding clears them', () => {
  const bind = fnBody('function bindCreate(){');
  assert.ok(bind.includes('e.deletedFlashcards'), 'flashcard delete must record a tombstone');
  assert.ok(bind.includes("e.deletedFlashcards.push(_k)"), 'flashcard delete must push the front+back key');
  assert.ok(bind.includes('e.deletedPlanner'), 'planner delete must record a tombstone');
  assert.ok(bind.includes('e.deletedPlanner.push(_p.t)'), 'planner delete must push the plan title');
  assert.ok(bind.includes("e.deletedFlashcards=e.deletedFlashcards.filter(function(k){ return k!==f+'\\u0000'+bk; });"), 're-adding a flashcard must clear its tombstone');
  assert.ok(bind.includes("e.deletedPlanner=e.deletedPlanner.filter(function(t){ return t!==v; });"), 're-adding a plan must clear its tombstone');
});

test('look modal stamps the time on a real name/glow/badge change, and new explorers start clean', () => {
  const look = fnBody('function openLookModal(){');
  assert.ok(look.includes('e.nameAt=new Date().toISOString()'), 'saving a new name must stamp when it changed');
  assert.ok(look.includes('e.lookAt=new Date().toISOString()'), 'changing glow/badge must stamp when it changed');
  assert.ok(html.includes('nameAt:null'), 'new explorers start with no rename timestamp');
  assert.ok(html.includes('lookAt:null'), 'new explorers start with no look timestamp');
  assert.ok(html.includes('deletedFlashcards:[]'), 'new explorers start with an empty flashcard tombstone list');
  assert.ok(html.includes('deletedPlanner:[]'), 'new explorers start with an empty planner tombstone list');
});
