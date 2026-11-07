// Profile menu: the explorer's shareable friend code sits at the top
// of the menu, right below the name, and tapping it copies it.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in ' + PAGE_PATH);
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

test('menu shows the explorer friend code right below the name', function () {
  const body = fnBody('function toggleMenu(){');
  assert.ok(body.includes('Friend code'), 'menu must show the friend code');
  const namePos = body.indexOf("esc(e.name)");
  const codePos = body.indexOf('Friend code');
  assert.ok(namePos >= 0 && codePos > namePos, 'friend code must come after the name in the menu header');
  assert.ok(body.includes('esc(e.friendCode'), 'menu must show this explorer’s own friend code, never the family sync code');
  assert.ok(!body.includes('syncCode'), 'menu must not show the family sync code here');
});

test('menu gives every explorer a friend code and copies it on tap', function () {
  const body = fnBody('function toggleMenu(){');
  assert.ok(body.includes("if(e&&!e.friendCode){ e.friendCode=genFriendCode(); save(); }"), 'an explorer without a code must get one when the menu opens');
  assert.ok(body.includes("getElementById('mFriendCode')"), 'the code must be tappable');
  assert.ok(body.includes('navigator.clipboard'), 'tapping the code must try to copy it');
  assert.ok(body.includes('Friend code copied'), 'tapping the code must confirm the copy');
});
