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

test('the Treasure route is light lavender now, so the top-bar star count reads fine', () => {
  const main = html.match(/\.app\.route-treasure \.main\{background:(#[0-9a-f]{6})\}/);
  assert.ok(main, 'a treasure-route background rule exists');
  assert.equal(main[1], '#ece7f7', 'soft lavender, in the same light family as the mint world');
  assert.ok(!/\.app\.route-treasure \.chip\{/.test(html), 'no treasure chip override left — the plain .chip reads fine on a light route');
  assert.ok(!html.includes('#2a1b4d') && !html.includes('#1b1030'), 'the deep purple cave colours are gone');
});

test('the top-bar star count is a button that jumps to the Treasure Realm', () => {
  assert.ok(html.includes("'<button class=\"chip\" id=\"tbStars\""), 'the star count renders as a button, not a span');
  assert.ok(html.includes("tbStars')"), 'the shell looks the button up to bind it');
  const bind = html.slice(html.indexOf("getElementById('tbStars')"), html.indexOf("getElementById('tbStars')") + 200);
  assert.ok(bind.includes("go('treasure')"), 'tapping the stars goes to the Treasure Realm: ' + bind);
  assert.ok(!html.includes("'<span class=\"chip\">⭐ '+ex().stars+'</span>'"), 'no plain star span left in the top bar');
});

test('the next-treasure line does not force dark-green text onto the card', () => {
  const start = html.indexOf('function treasureHTML(){');
  const end = html.indexOf('function bindTreasure(){', start);
  const src = html.slice(start, end);
  assert.ok(!src.includes('color:var(--ink)'), 'no dark --ink text inside the dark Treasure cards');
  assert.ok(src.includes('Next closest treasure'), 'the next-treasure hint is still there');
  assert.ok(src.includes("⭐ '+e.stars+' stars"), 'the hero still shows the star balance');
});
