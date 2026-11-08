// Dress-up expansion for "Change my name & look" (2026-11-07):
//  1. MORE ANIMALS: a "My animal friend" picker row with 25 cute
//     flat kawaii animals from the parent's reference sheet
//     (round 5: the otter and butterfly are gone, they are not on
//     the sheet); tapping one writes the DRAFT face (round 4:
//     Cancel must revert — picks never write to the live explorer
//     or save; only "Save my look" commits the draft), following
//     the exact glow/badge tap pattern (preserve a typed unsaved
//     name, update outlines in place, never rebuild the modal).
//  2. NO COLOUR OPTION (round 5): animals keep their own colours
//     from the sheet. A stored look.color is ignored.
//  3. CUSTOM BACKGROUND (round 5): a "My background" picker with
//     shape × colour × pattern × effect, part of the look, shown
//     everywhere the avatar appears (sidebar, topbar, Grand Door
//     tile). Patterns are drawn inside the shape; the effects
//     include three animated ones (twinkle, bubbles, petals).
//  4. TAP TO PLAY (round 5): tapping the animal makes it do a
//     happy jump with a sparkle burst (frog hops higher, rabbit
//     wiggles its ears faster).
//  4. MORE COLOURS: GLOWS grows from 6 to 12.
//  5. MORE BADGES: the badge list grows from 6 to 16.
// The 2026-11-06 merge fix is untouched: Save still resolves ex()
// fresh, never rebuilds the modal, and stamps nameAt; the draft
// commit stamps lookAt on Save.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}

const modal = fnBody('function openLookModal(){');
// Slice out just the pick handlers (lkSave legitimately calls
// render() after closing the modal, so the no-render check must be
// scoped to the pick handlers, not the whole function).
const faceHandler = modal.slice(modal.indexOf("document.querySelectorAll('.facePick')"), modal.indexOf("document.querySelectorAll('.bgShapePick')"));
const bgShapeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgShapePick')"), modal.indexOf("document.querySelectorAll('.bgColorPick')"));
const bgColorHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgColorPick')"), modal.indexOf("document.querySelectorAll('.bgPatternPick')"));
const bgPatternHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgPatternPick')"), modal.indexOf("document.querySelectorAll('.bgEffectPick')"));
const bgEffectHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgEffectPick')"), modal.indexOf("document.querySelectorAll('.glowPick')"));
const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
const badgeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.badgePick')"), modal.indexOf("document.getElementById('lkSave')"));
const saveHandler = modal.slice(modal.indexOf("document.getElementById('lkSave')"));

const ANIMALS25 = ['🐤', '🐴', '🐧', '🐻', '🐢', '🐼', '🦁', '🐱', '🐷', '🦊', '🐸', '🐘', '🦒', '🐰', '🦉', '🦝', '🐵', '🐯', '🐊', '🐶', '🦥', '🦆', '🦛', '🐑', '🐨'];
const GLOWS12 = ['#ffb020', '#2dd4bf', '#fb7185', '#7db4ff', '#4ade80', '#facc15', '#c084fc', '#f97316', '#84cc16', '#38bdf8', '#f472b6', '#a3e635'];
const BADGES16 = ['⭐', '🦦', '🌈', '🚀', '🍓', '⚡', '🐸', '🦋', '🌟', '💎', '🎨', '🏆', '🌸', '🍀', '🎵', '❤️'];

function arrayLiteralIn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, startMarker + ' not found');
  const open = src.indexOf('[', start);
  const close = src.indexOf(']', open);
  return eval(src.slice(open, close + 1)); // eslint-disable-line no-eval
}

test('25 animals render in the "My animal friend" row', () => {
  assert.ok(modal.includes('My animal friend'), 'modal must label the animal row');
  const animals = eval(grabVar('LOOK_FACES') + '\n;LOOK_FACES');
  assert.deepEqual(animals, ANIMALS25, 'exactly the 25 animals from the sheet, in sheet order');
  assert.ok(modal.includes('LOOK_FACES.map'), 'the animal row renders from the 25-animal list');
  assert.ok(modal.includes("class=\"iconbtn facePick\""), 'animals must use the same iconbtn style as glow/badge');
  assert.ok(modal.includes("data-f=\"'+a+'\""), 'each animal button must carry its animal in data-f');
  assert.ok(modal.includes("(e.face===a?'outline:3px solid var(--ink)':'')"), 'the current animal must be outlined like the current glow');
});

test('12 glows render (the original 6 first, then 6 new)', () => {
  const glows = arrayLiteralIn(html, 'var GLOWS=');
  assert.deepEqual(glows, GLOWS12, 'GLOWS must be exactly the 12 specified colours, in order');
  assert.deepEqual(glows.slice(0, 6), ['#ffb020', '#2dd4bf', '#fb7185', '#7db4ff', '#4ade80', '#facc15'], 'the original 6 glows keep their order');
  assert.ok(modal.includes("class=\"iconbtn glowPick\""), 'glows still render as iconbtn glowPick buttons');
});

test('16 badges render (the original 6 first, then 10 new)', () => {
  const badges = arrayLiteralIn(modal, 'My badge');
  assert.deepEqual(badges, BADGES16, 'exactly the 16 specified badges, in order');
  assert.deepEqual(badges.slice(0, 6), ['⭐', '🦦', '🌈', '🚀', '🍓', '⚡'], 'the original 6 badges keep their order');
  assert.ok(modal.includes("(e.badge===b?'outline:3px solid var(--amber)':'')"), 'the current badge keeps the amber outline');
});

test('animal tap writes the draft face and preserves a typed unsaved name', () => {
  assert.ok(faceHandler.length > 0, 'facePick handler found');
  assert.ok(faceHandler.includes('draft.face='), 'animal tap must write the face to the draft');
  assert.ok(!faceHandler.includes('live.face='), 'animal tap must not touch the live face');
  assert.ok(!faceHandler.includes('live.lookAt='), 'animal tap must not stamp lookAt (Save does that)');
  assert.ok(!faceHandler.includes('save()'), 'animal tap must not save (Cancel must still revert it)');
  assert.ok(faceHandler.includes("document.getElementById('lkName')"), 'animal tap must read the name input so the typed name is preserved');
  assert.ok(faceHandler.includes('keepEl.value=keep'), 'animal tap must restore the typed name after updating the outlines');
  assert.ok(faceHandler.includes('style.outline'), 'animal tap must update the button outlines in place');
  assert.ok(faceHandler.includes("3px solid var(--ink)"), 'selected animal keeps the ink outline');
  assert.ok(!faceHandler.includes('openLookModal()'), 'animal tap must not rebuild the modal (that cleared the typed name)');
  assert.ok(!faceHandler.includes('render()'), 'animal tap must not re-render while the modal is open');
});

test('background taps write to the draft background and preserve a typed unsaved name', () => {
  for (const [name, h, field] of [
    ['shape', bgShapeHandler, 'draft.look.background.shape='],
    ['colour', bgColorHandler, 'draft.look.background.color='],
    ['pattern', bgPatternHandler, 'draft.look.background.pattern='],
    ['effect', bgEffectHandler, 'draft.look.background.effect='],
  ]) {
    assert.ok(h.length > 0, name + ' handler found');
    assert.ok(h.includes(field), name + ' tap must write the background field to the draft');
    assert.ok(!h.includes('live.look'), name + ' tap must not touch the live look');
    assert.ok(!h.includes('live.lookAt='), name + ' tap must not stamp lookAt (Save does that)');
    assert.ok(!h.includes('save()'), name + ' tap must not save (Cancel must still revert it)');
    assert.ok(h.includes("document.getElementById('lkName')"), name + ' tap must read the name input so the typed name is preserved');
    assert.ok(h.includes('keepEl.value=keep'), name + ' tap must restore the typed name after updating the outlines');
    assert.ok(h.includes('style.outline'), name + ' tap must update the button outlines in place');
    assert.ok(h.includes("3px solid var(--ink)"), 'selected ' + name + ' keeps the ink outline');
    assert.ok(h.includes('refreshLookPreview()'), name + ' tap must refresh the preview in place');
    assert.ok(!h.includes('openLookModal()'), name + ' tap must not rebuild the modal (that cleared the typed name)');
    assert.ok(!h.includes('render()'), name + ' tap must not re-render while the modal is open');
  }
  assert.ok(modal.includes('My background'), 'modal must label the background section');
  assert.ok(modal.includes("class=\"iconbtn bgShapePick\""), 'background shapes must use the iconbtn style');
  assert.ok(modal.includes("class=\"iconbtn bgColorPick\""), 'background colours must use the iconbtn style');
  assert.ok(modal.includes("class=\"iconbtn bgPatternPick\""), 'background patterns must use the iconbtn style');
  assert.ok(modal.includes("class=\"iconbtn bgEffectPick\""), 'background effects must use the iconbtn style');
});

test('existing glow/badge/name behaviour is unchanged', () => {
  // Glow and badge handlers keep the 2026-11-06 fix exactly, except
  // they now write to the draft (round 4) instead of the live explorer.
  for (const h of [glowHandler, badgeHandler]) {
    assert.ok(h.length > 0, 'pick handler found');
    assert.ok(!h.includes('var live=ex();'), 'pick tap must not resolve the live explorer — it writes the draft');
    assert.ok(!h.includes('live.lookAt=new Date().toISOString()'), 'pick tap must not stamp lookAt (Save does that)');
    assert.ok(!h.includes('save()'), 'pick tap must not save');
    assert.ok(h.includes("document.getElementById('lkName')"), 'pick tap must read the name input');
    assert.ok(h.includes('keepEl.value=keep'), 'pick tap must restore the typed name');
    assert.ok(!h.includes('openLookModal()'), 'pick tap must not rebuild the modal');
    assert.ok(!h.includes('render()'), 'pick tap must not re-render while the modal is open');
  }
  assert.ok(glowHandler.includes('draft.glow='), 'glow tap writes the draft glow');
  assert.ok(badgeHandler.includes('draft.badge='), 'badge tap writes the draft badge');
  // Save still resolves the live explorer fresh and stamps nameAt —
  // and now it commits the whole draft and stamps lookAt too.
  assert.ok(saveHandler.includes('var live=ex();'), 'Save must resolve the live explorer at click time');
  assert.ok(saveHandler.includes('live.face=draft.face'), 'Save must commit the draft face');
  assert.ok(saveHandler.includes('live.look={background:{shape:draft.look.background.shape'), 'Save must commit the draft look, background included');
  assert.ok(saveHandler.includes('pattern:draft.look.background.pattern'), 'Save must commit the draft background pattern');
  assert.ok(saveHandler.includes('effect:draft.look.background.effect'), 'Save must commit the draft background effect');
  assert.ok(saveHandler.includes('live.lookAt=new Date().toISOString()'), 'Save must stamp lookAt');
  assert.ok(saveHandler.includes('live.name='), 'Save must assign the name to the live explorer');
  assert.ok(saveHandler.includes('live.nameAt=new Date().toISOString()'), 'Save must stamp nameAt');
  assert.ok(!/\be\.name=v/.test(saveHandler), 'Save must not write the name to the captured explorer object');
  assert.ok(!/\be\.nameAt=/.test(saveHandler), 'Save must not stamp the captured explorer object');
  // Modal layout: the extra rows wrap like the others; Save/Cancel identical.
  assert.ok(modal.includes("id=\"lkSave\""), 'Save button still present');
  assert.ok(modal.includes('onclick="closeModal()">Cancel'), 'Cancel button still closes the modal');
});

test('the chosen animal flows everywhere e.face is already used', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes('avatarLookHTML(ex().face,ex().look,ex().glow,130)'), 'sidebar brand must show the chosen animal as its full-body character, big');
  const door = fnBody('function doorHTML(){');
  assert.ok(door.includes('avatarLookHTML(e.face,e.look,e.glow,56)'), 'Grand Door explorer chips must show the chosen animal on its background');
  // Default for new explorers is the chick, the first animal on the sheet.
  const creator = fnBody('function newExplorer(name, code, level){');
  assert.ok(creator.includes("face:'🐤'"), 'new explorers default to the chick');
});
