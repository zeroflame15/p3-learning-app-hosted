// Avatar level label: the level shown next to the explorer's avatar
// must reflect the explorer's CURRENT level, not a hardcoded "Primary 3".
// Regression: changing an explorer to P6 via the parent-page level picker
// updated "Current level: P6" but the sidebar ("Primary 3 · Bryan") and the
// profile menu ("Primary 3 explorer") still said Primary 3, because both
// labels were literal strings. They must derive the level from the explorer.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

test('sidebar brand shows the explorer’s current level, not a hardcoded Primary 3', function () {
  // The sidebar brand under "My Terrarium" shows the active explorer's level.
  assert.ok(
    html.includes("Primary '+levelNum(ex())+' · '+esc(ex().name)"),
    'sidebar must build the level label from levelNum(ex())'
  );
  assert.ok(
    !html.includes("Primary 3 · '+esc(ex().name)"),
    'sidebar must not hardcode "Primary 3" for the explorer level'
  );
});

test('profile menu shows the explorer’s current level, not a hardcoded Primary 3', function () {
  // The profile menu header shows the explorer's level next to their name.
  assert.ok(
    html.includes("Primary '+levelNum(e)+' explorer"),
    'menu must build the level label from levelNum(e)'
  );
  assert.ok(
    !html.includes('Primary 3 explorer'),
    'menu must not hardcode "Primary 3 explorer"'
  );
});

test('levelNum maps the stored level string to the right number (P1–P6)', function () {
  const start = html.indexOf('function levelNum(e){');
  assert.ok(start >= 0, 'levelNum not found in ' + PAGE_PATH);
  const end = html.indexOf('\nfunction ', start + 1);
  const src = end >= 0 ? html.slice(start, end) : html.slice(start);
  const levelNum = eval(src + '\n; levelNum;');
  assert.equal(levelNum({ level: 'P1' }), 1);
  assert.equal(levelNum({ level: 'P3' }), 3);
  assert.equal(levelNum({ level: 'P6' }), 6);
  assert.equal(levelNum({}), 3, 'missing level defaults to P3');
});
