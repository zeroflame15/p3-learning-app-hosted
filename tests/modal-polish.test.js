// Modal polish (Bryan, 2026-11-17, from a screenshot of the
// "Change my name & look" editor):
//  1. Modal overlay contrast — the white card blended into the light
//     page behind it. The overlay now blurs the page behind it and
//     the modal card carries a soft drop shadow, so it pops forward.
//  2. Header status — the top-left sidebar card ("My Terrarium /
//     Primary N · name badge") now shows a star badge with the
//     explorer's stars, plus the current streak when it is above 0,
//     so levelling up feels rewarding. Deliberately NOT a progress
//     bar: there is no XP/level-up system in the app (the Primary
//     level is parent-set and changes once a year), so a bar toward
//     the next level would imply progress that is not tracked.
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

test('modal overlay blurs the page behind it so the card pops forward', () => {
  const rule = html.match(/\.overlay\{[^}]*\}/);
  assert.ok(rule, '.overlay rule exists');
  assert.ok(rule[0].includes('backdrop-filter:blur(3px)'), 'overlay blurs the backdrop');
  assert.ok(rule[0].includes('-webkit-backdrop-filter:blur(3px)'), 'overlay blurs on Safari too');
});

test('modal card carries a soft drop shadow', () => {
  const rule = html.match(/\.modal\{[^}]*\}/);
  assert.ok(rule, '.modal rule exists');
  assert.ok(rule[0].includes('box-shadow:var(--shadow)'), 'modal uses the app shadow');
});

test('sidebar brand shows a star badge with stars and streak', () => {
  const render = fnBody('function render(){');
  const brand = render.slice(render.indexOf('My Terrarium'));
  assert.ok(brand.includes("⭐ '+(ex().stars||0)"), 'badge shows the explorer’s star count');
  assert.ok(brand.includes("(ex().streak||0)>0?' · 🔥 '+(ex().streak||0)+'-day streak'"), 'badge adds the streak only when it is above 0');
  const bsub = brand.indexOf("class=\"bsub\"");
  const badge = brand.indexOf("⭐ '+(ex().stars||0)");
  assert.ok(bsub >= 0 && badge > bsub, 'badge sits under the level line in the brand block');
});
