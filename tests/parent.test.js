// Parent page regressions (seen live 2026-11-07):
// (a) the dashboard said "22 explorers" while the grid showed 21 —
//     there was no count in the code at all, so the two could only
//     diverge across renders/tabs; the heading now shows the count
//     computed from the same array the grid maps, so they match by
//     construction. (b) tapping "🔒 Lock" opened the previous
//     explorer's home instead of the Grand Door.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('parent dashboard: the explorers count comes from the same array the grid maps', () => {
  const heading = html.indexOf('Explorers on this device');
  assert.ok(heading >= 0, 'the explorers heading exists');
  const line = html.slice(html.lastIndexOf('\n', heading), html.indexOf('\n', heading));
  assert.ok(line.includes('DB.explorers.length'), 'the heading shows DB.explorers.length');
  // The grid in the same parentHTML render maps the same array.
  const parent = html.slice(html.indexOf('function parentHTML'), html.indexOf('function bindParent'));
  assert.ok(parent.includes('DB.explorers.map('), 'the grid maps DB.explorers');
  assert.ok(parent.includes('DB.explorers.length'), 'heading and grid share the array, so they cannot disagree in one render');
});

test('parent page: Lock returns to the Grand Door, not the previous explorer home', () => {
  const i = html.indexOf("getElementById('pLock')");
  assert.ok(i >= 0, 'the Lock button binding exists');
  const line = html.slice(html.lastIndexOf('\n', i), html.indexOf('\n', i));
  assert.ok(line.includes("go('door')"), 'Lock goes to the Grand Door');
  assert.ok(!line.includes("go('home')"), 'Lock must not go home');
  assert.ok(line.includes('parentUnlocked=false'), 'Lock still locks the parent page');
});
