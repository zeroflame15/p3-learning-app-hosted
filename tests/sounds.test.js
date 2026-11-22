// Sounds: a magical grand entrance when the picture code opens
// the Grand Door, and a mystery shimmer for sidebar selection.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

test('magical entrance sound exists: low pad, music-box phrase, high sparkle', () => {
  const fn = fnBody('function sndEntrance(){');
  assert.ok(fn.includes('130.81'), 'low warm pad');
  assert.ok(fn.includes('[523.25,659.25,783.99,1046.5,987.77,783.99,659.25,880]'), 'dreamy music-box phrase');
  assert.ok(fn.includes('celesta('), 'played as celesta notes, not plain tones');
  assert.ok(fn.includes('2093'), 'high sparkle');
});

test('the celesta helper is a sine plus a faint 4th harmonic', () => {
  const fn = fnBody('function celesta(');
  assert.ok(fn.includes("tone(freq,t0,dur,'sine'"), 'fundamental is a sine');
  assert.ok(fn.includes('freq*4'), 'a 4th harmonic gives the music-box ring');
});

test('entrance sound plays on a correct picture code', () => {
  const login = fnBody('function showDoorCode(){');
  assert.ok(login.includes('sndEntrance()'), 'login success plays the entrance');
  assert.ok(login.includes('sndWrong()'), 'a wrong code still plays the wrong sound, not the entrance');
});

test('entrance sound plays for a brand-new explorer too', () => {
  assert.ok(html.includes("sndEntrance(); autoVibe(); toast('Welcome, '+name+'!"), 'creation plays the entrance and auto-plays the music');
});

test('navigation sound lives in go(): one short celesta blip, gated', () => {
  // UI polish (2026-11-22): the old per-binding sounds are gone —
  // the sidebar used to play the mystery arpeggio and tiles a pop,
  // so the same action sounded two different ways and programmatic
  // navigation was silent. go() itself now plays one short nav
  // blip, gated so rapid taps never stack overlapping notes.
  const nav = html.match(/document\.querySelectorAll\('\[data-go\]'\)\.forEach\(function\(b\)\{[^}]*\}\);/);
  assert.ok(nav, 'nav handler found');
  assert.ok(!nav[0].includes('sndMystery()'), 'the nav binding no longer plays the mystery phrase');
  assert.ok(!nav[0].includes('sndPop()'), 'the nav binding no longer pops either');
  const go = fnBody('function go(');
  assert.ok(go.includes('sndNav()'), 'go() plays the single nav sound');
  const sndNav = fnBody('function sndNav(){');
  assert.ok(sndNav.includes('celesta(1318.5'), 'one short celesta note, not an arpeggio');
  assert.ok(sndNav.includes('<150'), 'a ~150ms gate stops rapid taps stacking notes');
  const mystery = fnBody('function sndMystery(){');
  assert.ok(mystery.includes('celesta(987.77'), 'music-box twinkle');
  assert.ok(mystery.includes('celesta(1318.5'), 'twinkle rises');
  assert.ok(mystery.includes('0.18'), 'short — navigation still feels instant');
});

test('other taps keep their sounds: correct answers still chime, and every route change now sounds once', () => {
  // Home tiles used to pop on their own binding; the pop now comes
  // from go() itself, so tapped and programmatic navigation sound
  // the same — and exactly once.
  assert.ok(!html.includes("sndPop(); go(b.getAttribute('data-go2'))"), 'home tiles no longer pop on their own binding');
  assert.ok(html.includes("go(b.getAttribute('data-go2'))"), 'home tiles still navigate through go()');
  assert.ok(html.includes('function sndCorrect(streak){'), 'correct-answer chime takes the streak (no argument: exactly as before)');
  assert.ok(html.includes('[523,659,784,1047]'), 'the same C–E–G–C arpeggio, transposed up by the streak');
  assert.ok(html.includes('function sndFanfare(){'), 'quest fanfare untouched');
});

test('keying the 3 picture-code animals plays one short note, not the full mystery phrase', () => {
  // UI polish (2026-11-22): every door picture tap used to play the
  // whole ~0.6s mystery arpeggio, so three taps stacked three
  // overlapping phrases. Each tap now plays a single short celesta
  // note; the full phrase is reserved for the door opening itself
  // (the entrance on a correct code), and the mystery twinkle lives
  // on the explorer-chip tap that opens the code panel.
  const picTap = html.match(/document\.querySelectorAll\('\[data-pic\]'\)\.forEach\(function\(b\)\{ b\.onclick=function\(\)\{[^}]*\}/);
  assert.ok(picTap, 'new-explorer picture tap found');
  assert.ok(picTap[0].includes('sndDoorTap()'), 'new-explorer picture tap plays one short note');
  assert.ok(!picTap[0].includes('sndMystery()'), 'new-explorer picture tap no longer plays the full phrase');
  const loginTap = html.slice(html.indexOf('function showDoorCode(){'));
  const loginTapBody = loginTap.slice(loginTap.indexOf('[data-lpic]'), loginTap.indexOf('[data-lpic]') + 200);
  assert.ok(loginTapBody.includes('sndDoorTap()'), 'login picture tap plays one short note');
  assert.ok(!loginTapBody.includes('sndMystery()'), 'login picture tap no longer plays the full phrase');
  // The grand entrance on a correct code, and the wrong-code sound, stay.
  assert.ok(loginTap.includes('sndEntrance()'), 'a correct code still plays the entrance');
  assert.ok(loginTap.includes('sndWrong()'), 'a wrong code still plays the wrong sound');
  // The mystery twinkle now lives on the explorer-chip tap (Grand Door only).
  const door = fnBody('function bindDoor(){');
  assert.ok(door.includes('sndMystery()'), 'the explorer-chip tap keeps the mystery twinkle');
});
