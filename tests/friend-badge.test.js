// Friend-request badge (requested 2026-11-07): a red count bubble
// on the Friends nav item while requests wait for a grown-up to
// approve — hidden when there are none.
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
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}

test('friendBadgeHTML shows the count only when requests are pending', () => {
  const badge = eval('var pendingReqCount=0;\n' + fnText('function friendBadgeHTML(){') + '\n;function badge(n){ pendingReqCount=n; return friendBadgeHTML(); }\n;badge');
  assert.equal(badge(0), '', 'no badge when nothing is pending');
  assert.ok(badge(1).includes('>1<'), 'one request shows 1');
  assert.ok(badge(3).includes('>3<'), 'three requests show 3');
  assert.ok(badge(2).includes('class="frbadge"'), 'the badge has its red-bubble class');
  assert.ok(badge(2).includes('waiting for a grown-up'), 'the badge says what it is waiting for');
});

test('the Friends nav item carries the badge in both the sidebar and the bottom nav', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes("(n[0]==='friends'?friendBadgeHTML():'')"), 'both nav builders add the badge to Friends');
  assert.equal((render.match(/friendBadgeHTML\(\)/g) || []).length, 2, 'sidebar and bottom nav, exactly two');
  assert.ok(html.includes('.frbadge{'), 'the badge has CSS');
  assert.ok(html.includes('background:#dc2626'), 'the badge is red');
});

test('the badge refreshes on boot, on auto-pull, and after accept/decline', () => {
  const boot = html.slice(html.indexOf('/* ============================================================ BOOT */'));
  assert.ok(boot.includes('refreshFriendBadge();'), 'boot refreshes the badge once');
  const auto = fnBody('function autoPull(){');
  assert.ok(auto.includes('refreshFriendBadge();'), 'every 30s auto-pull refreshes the badge');
  const parent = fnBody('function renderParentFriends(sel){');
  assert.ok(parent.includes('pendingReqCount=reqs.length'), 'the parent page reuses its inbox fetch for the badge');
  const panel = fnBody('function bindFriendPanelButtons(sel){');
  assert.equal((panel.match(/refreshFriendBadge\(\);/g) || []).length, 2, 'accept and decline both refresh the badge');
  const friends = fnBody('function bindFriends(){');
  assert.ok(friends.includes('refreshFriendBadge();'), 'opening the Friends page refreshes the badge');
});

test('the Friends page shows a pending line that jumps to the grown-ups page', () => {
  const list = fnBody('function friendsListHTML(){');
  assert.ok(list.includes('id="frPendingLine"'), 'a pending line exists on the Friends page');
  assert.ok(list.includes('waiting for a grown-up to approve'), 'it says a grown-up must approve');
  assert.ok(list.includes('id="frSeeReq"'), 'a button leads to the requests');
  const bind = fnBody('function bindFriends(){');
  assert.ok(bind.includes("go('parent')"), 'the button opens the PIN-gated grown-ups page');
  const paint = fnBody('function paintFriendBadge(){');
  assert.ok(paint.includes("getElementById('frPendingLine')"), 'the badge painter keeps the line in step');
  assert.ok(paint.includes("style.display=pendingReqCount>0?'':'none'"), 'the line hides when nothing is pending');
});
