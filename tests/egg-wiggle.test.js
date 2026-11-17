// Egg wiggle micro-animation on Home (2026-11-17, Bryan: "add the
// egg wiggle"). At Egg stage (critterStage 0) ONLY, tapping the Home
// critter hero card wiggles the eggs and plays a bubble sound, then
// opens Critter Lab after a short delay so the wiggle is actually
// seen. Later stages keep the plain instant navigation. No state is
// saved; re-tappable.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnSlice(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  assert.ok(start >= 0, startMarker + ' not found');
  const end = html.indexOf(endMarker, start);
  assert.ok(end > start, endMarker + ' not found after ' + startMarker);
  return html.slice(start, end);
}

test('the Egg-stage hero image carries the wiggle trigger — and only at Egg stage', () => {
  const homeSrc = fnSlice('function homeHTML(){', 'function bindHome(){');
  assert.ok(homeSrc.includes("(e.critterStage===0?'id=\"heroEggImg\" ':'')"), 'the hero image gets id heroEggImg only when critterStage is 0');
  assert.ok(!homeSrc.includes('id="heroEggImg" src'), 'the id must not be unconditional — later stages get no trigger');
  assert.ok(html.includes("var STAGE_IMGS=['assets/stage-eggs.webp'"), 'stage 0 is the frogspawn eggs image');
});

test('the wiggle animation exists and is brief', () => {
  assert.ok(html.includes('@keyframes eggwiggle'), 'an eggwiggle keyframe must exist');
  assert.ok(html.includes('.eggwiggle{animation:eggwiggle .35s ease-in-out}'), 'the eggwiggle class runs a brief animation');
});

test('sndBubble exists, is built on the mute-gated helpers, and is wired to the tap', () => {
  const sndStart = html.indexOf('function sndBubble(){');
  assert.ok(sndStart >= 0, 'sndBubble must exist');
  const sndSrc = html.slice(sndStart, html.indexOf('\n}', sndStart) + 2);
  assert.ok(sndSrc.includes('slide('), 'sndBubble rises like a bubble via slide()');
  assert.ok(sndSrc.includes('tone('), 'sndBubble adds a soft blip via tone()');
  const bindSrc = fnSlice('function bindHome(){', '/* ============================================================ LEARN + WARM-UP + QUIZ */');
  assert.ok(bindSrc.includes("document.getElementById('heroEggImg')"), 'bindHome looks up the Egg-stage hero image');
  assert.ok(bindSrc.includes("classList.add('eggwiggle')"), 'the tap adds the wiggle class to the image');
  assert.ok(bindSrc.includes('sndBubble()'), 'the tap plays the bubble sound');
  assert.ok(bindSrc.includes("classList.remove('eggwiggle')"), 'the wiggle class is removed so it can re-trigger');
});

test('navigation to Critter Lab still happens — delayed, not removed', () => {
  const bindSrc = fnSlice('function bindHome(){', '/* ============================================================ LEARN + WARM-UP + QUIZ */');
  assert.ok(bindSrc.includes("setTimeout(function(){ go('critter'); },350)"), 'the Egg tap navigates to Critter Lab after ~350ms');
  assert.ok(bindSrc.includes("document.querySelectorAll('[data-go2]')"), 'the generic data-go2 binding is untouched for other buttons');
  assert.ok(bindSrc.includes("go(b.getAttribute('data-go2'))"), 'later stages still navigate instantly via the generic binding');
});
