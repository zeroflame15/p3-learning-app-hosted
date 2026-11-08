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

test('parent page: the flag date is the local date of the flag, not the UTC date', () => {
  // A flag raised at 01:30 Singapore time is 17:30 UTC the day
  // before — slicing the ISO string showed the wrong day.
  const parent = html.slice(html.indexOf('function parentHTML'), html.indexOf('function bindParent'));
  assert.ok(parent.includes('dateKey(r.at)'), 'the flag date goes through the local-date helper');
  assert.ok(!parent.includes('r.at.slice(0,10)'), 'no raw UTC slice of the flag date remains');
  const dkSrc = html.slice(html.indexOf('function dateKey('), html.indexOf('\n', html.indexOf('function dateKey(')));
  const dateKey = eval('(' + dkSrc + ')');
  const at = '2026-11-07T17:30:00.000Z'; // 01:30 on 2026-11-08 in Singapore
  const d = new Date(at);
  const expected = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  assert.equal(dateKey(at), expected, 'dateKey renders the local date of the instant');
});
