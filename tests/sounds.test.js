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

test('magical entrance sound exists: warm pad, rising arpeggio, high twinkles', () => {
  const fn = fnBody('function sndEntrance(){');
  assert.ok(fn.includes('261.63'), 'low warm pad');
  assert.ok(fn.includes('[523.25,659.25,783.99,1046.5,1318.5]'), 'rising arpeggio');
  // The arpeggio must rise, not fall.
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i] > notes[i - 1], 'arpeggio rises');
  assert.ok(fn.includes('2093'), 'high twinkle');
});

test('entrance sound plays on a correct picture code', () => {
  const login = fnBody('function showDoorCode(){');
  assert.ok(login.includes('sndEntrance()'), 'login success plays the entrance');
  assert.ok(login.includes('sndWrong()'), 'a wrong code still plays the wrong sound, not the entrance');
});

test('entrance sound plays for a brand-new explorer too', () => {
  assert.ok(html.includes("sndEntrance(); toast('Welcome, '+name+'!"), 'creation plays the entrance');
});

test('sidebar selection uses the mystery sound, not the old pop', () => {
  const nav = html.match(/document\.querySelectorAll\('\[data-go\]'\)\.forEach\(function\(b\)\{[^}]*\}\);/);
  assert.ok(nav, 'nav handler found');
  assert.ok(nav[0].includes('sndMystery()'), 'sidebar selection plays mystery');
  assert.ok(!nav[0].includes('sndPop()'), 'sidebar no longer pops');
  const mystery = fnBody('function sndMystery(){');
  assert.ok(mystery.includes('233.08'), 'minor third gives the mystery');
});

test('other taps keep their sounds: tiles still pop, correct answers still chime', () => {
  assert.ok(html.includes("sndPop(); go(b.getAttribute('data-go2'))"), 'home tiles still pop');
  assert.ok(html.includes('function sndCorrect(){'), 'correct-answer chime untouched');
  assert.ok(html.includes('function sndFanfare(){'), 'quest fanfare untouched');
});
