// Treasure Realm star balance (reported 2026-11-07): the star
// count in the top bar was unreadable on the Treasure route — the
// plain .chip inherits the route's cream text on its pale-mint pill
// (the same invisible-chip trap already fixed on the Play route).
// Tapping the star count must also jump to the Treasure Realm.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

test('the top-bar star count is dark text on white on the Treasure route', () => {
  const rule = html.match(/\.app\.route-treasure \.chip\{[^}]*\}/);
  assert.ok(rule, 'a treasure-route chip rule exists');
  assert.ok(rule[0].includes('color:#1e3a24'), 'dark text: ' + rule[0]);
  assert.ok(rule[0].includes('background:#fff'), 'white pill: ' + rule[0]);
});

test('the top-bar star count is a button that jumps to the Treasure Realm', () => {
  assert.ok(html.includes("'<button class=\"chip\" id=\"tbStars\""), 'the star count renders as a button, not a span');
  assert.ok(html.includes("tbStars')"), 'the shell looks the button up to bind it');
  const bind = html.slice(html.indexOf("getElementById('tbStars')"), html.indexOf("getElementById('tbStars')") + 200);
  assert.ok(bind.includes("go('treasure')"), 'tapping the stars goes to the Treasure Realm: ' + bind);
  assert.ok(!html.includes("'<span class=\"chip\">⭐ '+ex().stars+'</span>'"), 'no plain star span left in the top bar');
});

test('the next-treasure line does not force dark-green text onto the dark card', () => {
  const start = html.indexOf('function treasureHTML(){');
  const end = html.indexOf('function bindTreasure(){', start);
  const src = html.slice(start, end);
  assert.ok(!src.includes('color:var(--ink)'), 'no dark --ink text inside the dark Treasure cards');
  assert.ok(src.includes('Next closest treasure'), 'the next-treasure hint is still there');
  assert.ok(src.includes("⭐ '+e.stars+' stars"), 'the hero still shows the star balance');
});
