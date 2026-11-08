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

test('sidebar selection uses the mystery sound, not the old pop', () => {
  const nav = html.match(/document\.querySelectorAll\('\[data-go\]'\)\.forEach\(function\(b\)\{[^}]*\}\);/);
  assert.ok(nav, 'nav handler found');
  assert.ok(nav[0].includes('sndMystery()'), 'sidebar selection plays mystery');
  assert.ok(!nav[0].includes('sndPop()'), 'sidebar no longer pops');
  const mystery = fnBody('function sndMystery(){');
  assert.ok(mystery.includes('celesta(987.77'), 'music-box twinkle');
  assert.ok(mystery.includes('celesta(1318.5'), 'twinkle rises');
  assert.ok(mystery.includes('0.18'), 'short — navigation still feels instant');
});

test('other taps keep their sounds: tiles still pop, correct answers still chime', () => {
  assert.ok(html.includes("sndPop(); go(b.getAttribute('data-go2'))"), 'home tiles still pop');
  assert.ok(html.includes('function sndCorrect(streak){'), 'correct-answer chime takes the streak (no argument: exactly as before)');
  assert.ok(html.includes('[523,659,784,1047]'), 'the same C–E–G–C arpeggio, transposed up by the streak');
  assert.ok(html.includes('function sndFanfare(){'), 'quest fanfare untouched');
});

test('keying the 3 picture-code animals plays the sidebar twinkle, not the pop', () => {
  // New-explorer creation taps ([data-pic]) and returning-explorer
  // login taps ([data-lpic]) both use the mystery twinkle Bryan
  // approved for the sidebar (2026-11-05).
  const picTap = html.match(/document\.querySelectorAll\('\[data-pic\]'\)\.forEach\(function\(b\)\{ b\.onclick=function\(\)\{[^}]*\}/);
  assert.ok(picTap, 'new-explorer picture tap found');
  assert.ok(picTap[0].includes('sndMystery()'), 'new-explorer picture tap plays the twinkle');
  assert.ok(!picTap[0].includes('sndPop()'), 'new-explorer picture tap no longer pops');
  const loginTap = html.slice(html.indexOf('function showDoorCode(){'));
  const loginTapBody = loginTap.slice(loginTap.indexOf('[data-lpic]'), loginTap.indexOf('[data-lpic]') + 200);
  assert.ok(loginTapBody.includes('sndMystery()'), 'login picture tap plays the twinkle');
  assert.ok(!loginTapBody.includes('sndPop()'), 'login picture tap no longer pops');
  // The grand entrance on a correct code, and the wrong-code sound, stay.
  assert.ok(loginTap.includes('sndEntrance()'), 'a correct code still plays the entrance');
  assert.ok(loginTap.includes('sndWrong()'), 'a wrong code still plays the wrong sound');
});
