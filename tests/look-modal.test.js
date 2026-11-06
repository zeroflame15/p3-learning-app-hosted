// Change my name & look modal regressions (reported by Bryan, 2026-11-06):
//  1. Typing a new name, then tapping a glow colour or badge, cleared the
//     typed name: the pick handlers rebuilt the whole modal from the saved
//     name, discarding unsaved input.
//  2. Tapping glow/badge first, then typing a name and saving, did not
//     take effect: the modal held the explorer captured at open time, and
//     the background sync (~800ms after a save) replaces the whole DB
//     object, so Save wrote to a detached copy while the toast still
//     claimed success.
//  3. The "My badge" emoji picker (e.badge) was saved but NEVER displayed
//     anywhere — only the earned achievement badges (e.badges) show.
// Fixes: pick taps update only the outlines in place and never rebuild
// the modal or re-render; every handler resolves the live explorer with
// ex() at click time; Save writes to that live object; the chosen badge
// emoji now shows next to the explorer's name in the sidebar, profile
// menu, Grand Door chips and Home greeting.
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

const modal = fnBody('function openLookModal(){');
// Slice out just the two pick handlers (lkSave legitimately calls
// render() after closing the modal, so the no-render check must be
// scoped to the pick handlers, not the whole function).
const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
const badgeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.badgePick')"), modal.indexOf("document.getElementById('lkSave')"));
const saveHandler = modal.slice(modal.indexOf("document.getElementById('lkSave')"));

test('glow/badge taps never rebuild the modal and never re-render', () => {
  assert.ok(glowHandler.length > 0, 'glowPick handler found');
  assert.ok(badgeHandler.length > 0, 'badgePick handler found');
  assert.ok(!glowHandler.includes('openLookModal()'), 'glow tap must not rebuild the modal (that cleared the typed name)');
  assert.ok(!badgeHandler.includes('openLookModal()'), 'badge tap must not rebuild the modal (that cleared the typed name)');
  assert.ok(!glowHandler.includes('render()'), 'glow tap must not re-render while the modal is open');
  assert.ok(!badgeHandler.includes('render()'), 'badge tap must not re-render while the modal is open');
});

test('glow/badge taps update only the outlines in place and keep the typed name', () => {
  for (const h of [glowHandler, badgeHandler]) {
    assert.ok(h.includes("document.getElementById('lkName')"), 'pick handler must read the name input so the typed name is preserved');
    assert.ok(h.includes('keepEl.value=keep'), 'pick handler must restore the typed name after updating the outlines');
    assert.ok(h.includes('style.outline'), 'pick handler must update the button outlines in place');
  }
  assert.ok(glowHandler.includes("3px solid var(--ink)"), 'selected glow keeps the ink outline');
  assert.ok(badgeHandler.includes("3px solid var(--amber)"), 'selected badge keeps the amber outline');
});

test('glow/badge taps and Save resolve the live explorer fresh, never the captured one', () => {
  assert.ok(glowHandler.includes('var live=ex();'), 'glow tap must resolve the live explorer at click time');
  assert.ok(badgeHandler.includes('var live=ex();'), 'badge tap must resolve the live explorer at click time');
  assert.ok(glowHandler.includes('live.glow='), 'glow tap must write to the live explorer');
  assert.ok(badgeHandler.includes('live.badge='), 'badge tap must write to the live explorer');
  assert.ok(saveHandler.includes('var live=ex();'), 'Save must resolve the live explorer at click time, not the one captured at modal open');
  assert.ok(saveHandler.includes('live.name='), 'Save must assign the name to the live explorer');
  assert.ok(saveHandler.includes('live.nameAt='), 'Save must stamp the rename time on the live explorer');
  // Note: 'live.name=' contains 'e.name=' as a substring, so match on a
  // word boundary — \b does not fire inside 'live.name='.
  assert.ok(!/\be\.name=v/.test(saveHandler), 'Save must not write the name to the captured explorer object');
  assert.ok(!/\be\.nameAt=/.test(saveHandler), 'Save must not stamp the captured explorer object');
  assert.ok(saveHandler.includes("toast('Looking great, '+live.name"), 'the success toast must name the live explorer');
});

test('the timestamped name/look merge is unchanged by the modal fix', () => {
  assert.ok(glowHandler.includes('live.lookAt=new Date().toISOString()'), 'glow change still stamps lookAt');
  assert.ok(badgeHandler.includes('live.lookAt=new Date().toISOString()'), 'badge change still stamps lookAt');
  assert.ok(saveHandler.includes('live.nameAt=new Date().toISOString()'), 'rename still stamps nameAt');
});

test('the chosen badge shows next to the explorer name in the sidebar, profile menu, Grand Door and Home', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes("esc(ex().name)+' '+(ex().badge||'⭐')"), 'sidebar brand must show the chosen badge next to the name');
  const menu = fnBody('function toggleMenu(){');
  assert.ok(menu.includes("esc(e.name)+' '+(e.badge||'⭐')"), 'profile menu header must show the chosen badge next to the name');
  const door = fnBody('function doorHTML(){');
  assert.ok(door.includes("esc(e.name)+' '+(e.badge||'⭐')"), 'Grand Door explorer chips must show the chosen badge next to the name');
  const home = fnBody('function homeHTML(){');
  assert.ok(home.includes("esc(e.name)+' '+(e.badge||'⭐')"), 'Home greeting must show the chosen badge next to the name');
  // Legacy explorers without a badge still render (fallback star), and
  // the earned-achievement badges are untouched by this change.
  assert.ok(home.includes('badgeHTML'), 'earned achievement badges must still render on Home');
});

test('rename after a glow change still wins by timestamp in the merge', () => {
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
  // Server: old name, glow picked at 10:00. Local: glow picked at 11:00,
  // then renamed at 12:00 — both the later look and the later name win.
  const server = explorer({ name: 'MightyOtter', nameAt: '2026-11-06T10:00:00.000Z', glow: '#ffb020', badge: '⭐', lookAt: '2026-11-06T10:00:00.000Z' });
  const local = explorer({ name: 'Fix6', nameAt: '2026-11-06T12:00:00.000Z', glow: '#2dd4bf', badge: '🚀', lookAt: '2026-11-06T11:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.name, 'Fix6', 'the later rename wins even when it follows a glow/badge tap');
  assert.equal(merged.glow, '#2dd4bf', 'the later glow wins');
  assert.equal(merged.badge, '🚀', 'the later badge wins');
  const merged2 = mergeExplorer(local, server);
  assert.equal(merged2.name, 'Fix6', 'timestamp order must not depend on argument order');
  assert.equal(merged2.badge, '🚀', 'badge must not depend on argument order');
});
