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
//  4. (Round 4, found live 2026-11-08) Picking an animal, then tapping
//     Cancel, still changed the stored look: every pick saved live on
//     tap. Picks now write to a DRAFT only; Save commits the draft
//     into the live explorer (resolved fresh) and stamps lookAt.
//  5. (Round 5, 2026-11-08) The background picker joins the draft:
//     shape, colour, pattern and effect taps write to
//     draft.look.background only, never to the live look, never
//     save — Cancel reverts them too, and Save commits the whole
//     background with the look. Accessories were dropped, so
//     there is no accessory picker and a stored accessory is
//     ignored. Tap to play needs no modal wiring: the preview svg
//     carries its own onclick.
// Fixes: pick taps update only the outlines in place and never rebuild
// the modal or re-render; Save writes to the live object resolved with
// ex() at click time; the chosen badge emoji now shows next to the
// explorer's name in the sidebar, profile menu, Grand Door chips and
// Home greeting.
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
// Slice out just the pick handlers (lkSave legitimately calls
// render() after closing the modal, so the no-render check must be
// scoped to the pick handlers, not the whole function).
const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
const badgeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.badgePick')"), modal.indexOf("document.getElementById('lkSave')"));
const bgShapeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgShapePick')"), modal.indexOf("document.querySelectorAll('.bgColorPick')"));
const bgColorHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgColorPick')"), modal.indexOf("document.querySelectorAll('.bgPatternPick')"));
const bgPatternHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgPatternPick')"), modal.indexOf("document.querySelectorAll('.bgEffectPick')"));
const bgEffectHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgEffectPick')"), modal.indexOf("document.querySelectorAll('.glowPick')"));
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

test('background taps never rebuild the modal, never re-render, and write to the draft only', () => {
  for (const [name, h, field] of [
    ['shape', bgShapeHandler, 'draft.look.background.shape='],
    ['colour', bgColorHandler, 'draft.look.background.color='],
    ['pattern', bgPatternHandler, 'draft.look.background.pattern='],
    ['effect', bgEffectHandler, 'draft.look.background.effect='],
  ]) {
    assert.ok(h.length > 0, name + ' handler found');
    assert.ok(h.includes(field), name + ' tap must write to the draft background');
    assert.ok(!h.includes('live.look'), name + ' tap must not touch the live look');
    assert.ok(!h.includes('save()'), name + ' tap must not save');
    assert.ok(!h.includes('openLookModal()'), name + ' tap must not rebuild the modal');
    assert.ok(!h.includes('render()'), name + ' tap must not re-render while the modal is open');
    assert.ok(h.includes("document.getElementById('lkName')"), name + ' tap must read the name input so the typed name is preserved');
    assert.ok(h.includes('keepEl.value=keep'), name + ' tap must restore the typed name');
    assert.ok(h.includes('refreshLookPreview()'), name + ' tap must refresh the preview in place');
  }
});

test('glow/badge taps write to the draft; Save resolves the live explorer fresh, never the captured one', () => {
  assert.ok(glowHandler.includes('draft.glow='), 'glow tap must write to the draft');
  assert.ok(badgeHandler.includes('draft.badge='), 'badge tap must write to the draft');
  assert.ok(!glowHandler.includes('var live=ex();'), 'glow tap must not resolve the live explorer — it writes the draft');
  assert.ok(!badgeHandler.includes('var live=ex();'), 'badge tap must not resolve the live explorer — it writes the draft');
  assert.ok(!glowHandler.includes('live.glow='), 'glow tap must not write to the live explorer');
  assert.ok(!badgeHandler.includes('live.badge='), 'badge tap must not write to the live explorer');
  assert.ok(!glowHandler.includes('save()'), 'glow tap must not save');
  assert.ok(!badgeHandler.includes('save()'), 'badge tap must not save');
  assert.ok(saveHandler.includes('var live=ex();'), 'Save must resolve the live explorer at click time, not the one captured at modal open');
  assert.ok(saveHandler.includes('live.face=draft.face'), 'Save must commit the draft face');
  assert.ok(saveHandler.includes('live.glow=draft.glow'), 'Save must commit the draft glow');
  assert.ok(saveHandler.includes('live.badge=draft.badge'), 'Save must commit the draft badge');
  assert.ok(saveHandler.includes('live.look={background:{shape:draft.look.background.shape'), 'Save must commit the draft look, background included');
  assert.ok(saveHandler.includes('background:{shape:draft.look.background.shape'), 'Save must commit the draft background shape');
  assert.ok(saveHandler.includes('color:draft.look.background.color'), 'Save must commit the draft background colour');
  assert.ok(saveHandler.includes('pattern:draft.look.background.pattern'), 'Save must commit the draft background pattern');
  assert.ok(saveHandler.includes('effect:draft.look.background.effect'), 'Save must commit the draft background effect');
  assert.ok(saveHandler.includes('live.name='), 'Save must assign the name to the live explorer');
  assert.ok(saveHandler.includes('live.nameAt='), 'Save must stamp the rename time on the live explorer');
  // Note: 'live.name=' contains 'e.name=' as a substring, so match on a
  // word boundary — \b does not fire inside 'live.name='.
  assert.ok(!/\be\.name=v/.test(saveHandler), 'Save must not write the name to the captured explorer object');
  assert.ok(!/\be\.nameAt=/.test(saveHandler), 'Save must not stamp the captured explorer object');
  assert.ok(saveHandler.includes("toast('Looking great, '+live.name"), 'the success toast must name the live explorer');
});

test('the timestamped name/look merge is unchanged by the draft fix', () => {
  assert.ok(!glowHandler.includes('live.lookAt=new Date().toISOString()'), 'glow tap no longer stamps lookAt (Save does)');
  assert.ok(!badgeHandler.includes('live.lookAt=new Date().toISOString()'), 'badge tap no longer stamps lookAt (Save does)');
  assert.ok(saveHandler.includes('live.lookAt=new Date().toISOString()'), 'Save stamps lookAt when it commits the draft');
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
