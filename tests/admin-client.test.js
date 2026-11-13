// Admin page — client side (public/index.html).
// The family code must be hidden from the child-facing sidebar
// (the parent page keeps showing it), the admin page must not be
// linked from anywhere a child or another parent can see, and the
// admin page must ask for the master password before showing any
// search UI. The real adminHTML is eval'd with stubs, same pattern
// as tests/learn-restructure.test.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, 'function ' + name + ' found in index.html');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
function grabLiteral(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' found in index.html');
  let i = start + marker.length;
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '[' || html[i] === '{') depth++;
    else if (html[i] === ']' || html[i] === '}') { depth--; if (depth === 0) return html.slice(start + marker.length, i + 1); }
  }
  assert.fail(marker + ' literal never balanced');
}

// --- the real adminHTML, eval'd with the page's esc and the admin
// state vars it closes over (same pattern as learnHTML in
// tests/learn-restructure.test.js) -------------------------------
var adminPw = null, adminResults = [], adminMsg = '', adminOk = '', adminResetCode = null, adminCrittersCode = null;
const esc = eval('(' + grabFn('esc(') + ')');
const adminHTML = eval('(' + grabFn('adminHTML(') + ')');
// adminHTML calls the real usage renderer once unlocked, so load it
// (with its data + number helper) into this harness too.
function grabObj(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' found in index.html');
  const open = html.indexOf('{', start);
  let depth = 0;
  for (let k = open; k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}') { depth--; if (depth === 0) return html.slice(open, k + 1); }
  }
  assert.fail(marker + ' braces never balanced');
}
const APP_USAGE = eval('(' + grabObj('var APP_USAGE = {') + ')');
const fmtUsageNum = eval('(' + grabFn('fmtUsageNum(') + ')');
const appUsageHTML = eval('(' + grabFn('appUsageHTML(') + ')');

test('sidebar: the child-facing sidebar shows a sync indicator but NOT the family code', () => {
  const renderSrc = grabFn('render(');
  // The old doorlink printed the code; the new one must not.
  assert.ok(!renderSrc.includes("family code '+esc(DB.syncCode)"), 'sidebar must not print the family code');
  assert.ok(!renderSrc.includes('esc(DB.syncCode)'), 'sidebar must not reference the code at all');
  assert.ok(renderSrc.includes('🔗 Synced across linked devices'), 'sidebar still shows the sync indicator');
  assert.ok(renderSrc.includes('Progress is saved on this device only.'), 'unlinked wording kept');
});

test('parent page: the Grown-ups page still shows the family code (behind the PIN)', () => {
  const parentSrc = grabFn('parentHTML(');
  assert.ok(parentSrc.includes('Family sync code'), 'parent page keeps the Family sync card');
  assert.ok(parentSrc.includes("esc(DB.syncCode||'—')"), 'parent page still prints the code');
});

test('admin page: not linked from anywhere a child or another parent can see', () => {
  assert.ok(!html.includes('data-go="admin"'), 'no nav button goes to admin');
  const navSrc = grabLiteral('var NAV=');
  assert.ok(!/admin/i.test(navSrc), 'sidebar nav has no admin item');
  assert.ok(!/admin/i.test(grabFn('doorHTML(')), 'Grand Door has no admin link');
  assert.ok(!/admin/i.test(grabFn('parentHTML(')), 'parent page has no admin link');
  const renderSrc = grabFn('render(');
  assert.ok(!renderSrc.includes('data-go="admin"'), 'render builds no admin nav button');
});

test('admin route: render() handles #admin as a standalone page, and the boot wires the hash', () => {
  const renderSrc = grabFn('render(');
  assert.ok(renderSrc.includes("route==='admin'"), 'render has an admin branch');
  assert.ok(renderSrc.includes('adminHTML()'), 'admin branch renders adminHTML');
  assert.ok(html.includes("location.hash==='#admin'"), 'boot checks the #admin hash');
  assert.ok(grabFn('safeToRender(').includes("route!=='admin'"), 'auto-pull never re-renders the admin page');
});

test('adminHTML: locked state asks for the password and shows no search UI', () => {
  adminPw = null; adminResults = []; adminMsg = ''; adminOk = ''; adminResetCode = null;
  const out = adminHTML();
  assert.ok(out.includes('Master admin password'), 'password field shown');
  assert.ok(out.includes('id="admUnlock"'), 'unlock button shown');
  assert.ok(!out.includes('Family code or explorer name'), 'no search box before unlock');
  assert.ok(!out.includes('id="admSearch"'), 'no search button before unlock');
  assert.ok(!out.includes('Matching families'), 'no results before unlock');
  assert.ok(!out.includes('App usage'), 'no usage card before unlock');
});

test('adminHTML: unlocked state shows search, results, and the reset form for a picked family', () => {
  adminPw = 'master-123';
  adminResults = [
    { code: 'ABC2DE', explorers: [{ name: 'Star', level: 'P3' }, { name: 'Moon', level: 'P4' }] },
    { code: 'FGH3JK', explorers: [{ name: 'Starfish', level: 'P2' }] },
  ];
  adminMsg = ''; adminOk = ''; adminResetCode = null;
  let out = adminHTML();
  assert.ok(out.includes('Family code, friend code, or explorer name'), 'search box names all three ways to find a family');
  assert.ok(out.includes('id="admSearch"'), 'search button shown after unlock');
  assert.ok(out.includes('ABC2DE'), 'first matching family listed');
  assert.ok(out.includes('Star (P3)'), 'explorer name and level listed');
  assert.ok(out.includes('FGH3JK'), 'second matching family listed');
  assert.ok(out.includes('data-admreset="ABC2DE"'), 'reset action per family');
  assert.ok(!out.includes('New PIN for family'), 'no reset form until a family is picked');
  assert.ok(out.includes('📊 App usage — against the free caps'), 'usage card shows once unlocked');
  assert.ok(out.includes('Vercel'), 'usage card lists the services');

  adminResetCode = 'ABC2DE';
  out = adminHTML();
  assert.ok(out.includes('New PIN for family ABC2DE'), 'reset form names the picked family');
  assert.ok(out.includes('id="admPin1"') && out.includes('id="admPin2"'), 'new PIN typed twice');
  assert.ok(out.includes('Tell the parent the new PIN'), 'tells the admin to pass the PIN on');
  assert.ok(!out.includes('1111'), 'no PIN is ever printed by the page');
});

test('bindAdmin: posts the password to the admin endpoints and handles 401/503', () => {
  const src = grabFn('bindAdmin(');
  assert.ok(src.includes("'/api/admin-find'"), 'find goes to /api/admin-find');
  assert.ok(src.includes("'/api/admin-reset-pin'"), 'reset goes to /api/admin-reset-pin');
  assert.ok(src.includes('401'), 'wrong password is handled');
  assert.ok(src.includes('ADMIN_PASSWORD'), 'unconfigured admin is explained');
  assert.ok(src.includes('password:adminPw') || src.includes('password: adminPw'), 'password sent with each request');
  assert.ok(!src.includes('localStorage'), 'admin password is never stored on the device');
});
