// Dress-up expansion for "Change my name & look" (2026-11-07):
//  1. MORE ANIMALS: a "My animal friend" picker row with 12 cute
//     animated animals; tapping one sets live.face and stamps lookAt,
//     following the exact glow/badge tap pattern (resolve the live
//     explorer fresh, preserve a typed unsaved name, update outlines
//     in place, never rebuild the modal).
//  2. MORE COLOURS: GLOWS grows from 6 to 12.
//  3. MORE BADGES: the badge list grows from 6 to 16.
// The 2026-11-06 merge fix is untouched: glow/badge taps still
// resolve ex() fresh, never rebuild the modal, and stamp lookAt;
// Save still stamps nameAt on the live explorer.
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

const modal = fnBody('function openLookModal(){');
// Slice out just the three pick handlers (lkSave legitimately calls
// render() after closing the modal, so the no-render check must be
// scoped to the pick handlers, not the whole function).
const faceHandler = modal.slice(modal.indexOf("document.querySelectorAll('.facePick')"), modal.indexOf("document.querySelectorAll('.glowPick')"));
const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
const badgeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.badgePick')"), modal.indexOf("document.getElementById('lkSave')"));
const saveHandler = modal.slice(modal.indexOf("document.getElementById('lkSave')"));

const ANIMALS = ['🦦', '🐸', '🦋', '🐱', '🐶', '🐰', '🦁', '🐼', '🦊', '🐢', '🐷', '🐵'];
const GLOWS12 = ['#ffb020', '#2dd4bf', '#fb7185', '#7db4ff', '#4ade80', '#facc15', '#c084fc', '#f97316', '#84cc16', '#38bdf8', '#f472b6', '#a3e635'];
const BADGES16 = ['⭐', '🦦', '🌈', '🚀', '🍓', '⚡', '🐸', '🦋', '🌟', '💎', '🎨', '🏆', '🌸', '🍀', '🎵', '❤️'];

function arrayLiteralIn(src, startMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, startMarker + ' not found');
  const open = src.indexOf('[', start);
  const close = src.indexOf(']', open);
  return eval(src.slice(open, close + 1)); // eslint-disable-line no-eval
}

test('12 animals render in the "My animal friend" row', () => {
  assert.ok(modal.includes('My animal friend'), 'modal must label the animal row');
  const animals = arrayLiteralIn(modal, 'My animal friend');
  assert.deepEqual(animals, ANIMALS, 'exactly the 12 specified animals, in order');
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

test('animal tap sets face + lookAt on the live explorer and preserves a typed unsaved name', () => {
  assert.ok(faceHandler.length > 0, 'facePick handler found');
  assert.ok(faceHandler.includes('var live=ex();'), 'animal tap must resolve the live explorer at click time');
  assert.ok(faceHandler.includes('live.face='), 'animal tap must write the face to the live explorer');
  assert.ok(faceHandler.includes('live.lookAt=new Date().toISOString()'), 'animal tap must stamp lookAt, same as glow/badge');
  assert.ok(faceHandler.includes("document.getElementById('lkName')"), 'animal tap must read the name input so the typed name is preserved');
  assert.ok(faceHandler.includes('keepEl.value=keep'), 'animal tap must restore the typed name after updating the outlines');
  assert.ok(faceHandler.includes('style.outline'), 'animal tap must update the button outlines in place');
  assert.ok(faceHandler.includes("3px solid var(--ink)"), 'selected animal keeps the ink outline');
  assert.ok(!faceHandler.includes('openLookModal()'), 'animal tap must not rebuild the modal (that cleared the typed name)');
  assert.ok(!faceHandler.includes('render()'), 'animal tap must not re-render while the modal is open');
});

test('existing glow/badge/name behaviour is unchanged', () => {
  // Glow and badge handlers keep the 2026-11-06 fix exactly.
  for (const h of [glowHandler, badgeHandler]) {
    assert.ok(h.length > 0, 'pick handler found');
    assert.ok(h.includes('var live=ex();'), 'pick tap must resolve the live explorer at click time');
    assert.ok(h.includes('live.lookAt=new Date().toISOString()'), 'pick tap must stamp lookAt');
    assert.ok(h.includes("document.getElementById('lkName')"), 'pick tap must read the name input');
    assert.ok(h.includes('keepEl.value=keep'), 'pick tap must restore the typed name');
    assert.ok(!h.includes('openLookModal()'), 'pick tap must not rebuild the modal');
    assert.ok(!h.includes('render()'), 'pick tap must not re-render while the modal is open');
  }
  assert.ok(glowHandler.includes('live.glow='), 'glow tap still writes to the live explorer');
  assert.ok(badgeHandler.includes('live.badge='), 'badge tap still writes to the live explorer');
  // Save still stamps nameAt on the live explorer only.
  assert.ok(saveHandler.includes('var live=ex();'), 'Save must resolve the live explorer at click time');
  assert.ok(saveHandler.includes('live.name='), 'Save must assign the name to the live explorer');
  assert.ok(saveHandler.includes('live.nameAt=new Date().toISOString()'), 'Save must stamp nameAt');
  assert.ok(!/\be\.name=v/.test(saveHandler), 'Save must not write the name to the captured explorer object');
  assert.ok(!/\be\.nameAt=/.test(saveHandler), 'Save must not stamp the captured explorer object');
  // Modal layout: the extra row wraps like the others; Save/Cancel identical.
  assert.ok(modal.includes("id=\"lkSave\""), 'Save button still present');
  assert.ok(modal.includes('onclick="closeModal()">Cancel'), 'Cancel button still closes the modal');
});

test('the chosen animal flows everywhere e.face is already used', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes('avatarLookHTML(ex().face,ex().look,ex().glow,130)'), 'sidebar brand must show the chosen animal as its full-body character, big');
  const door = fnBody('function doorHTML(){');
  assert.ok(door.includes("<span class=\"face\">'+e.face+'</span>"), 'Grand Door explorer chips must show the chosen animal');
  // Default for existing explorers stays their current face.
  const creator = fnBody('function newExplorer(name, code, level){');
  assert.ok(creator.includes("face:'🦦'"), 'new explorers still default to the otter');
});
