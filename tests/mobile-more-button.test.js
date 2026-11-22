// Mobile bottom nav "More" button (Bryan approved 2026-11-17):
// on phones the sidebar is hidden and the bottom bar is the whole
// nav, so the regroup was invisible there — the bar showed all 11
// items flat. Now the bar shows the core six plus a "More" button,
// and the five More items live in a sheet directly above the bar.
//   • Tapping More toggles the sheet; tapping a sheet item navigates
//     and closes it (go() clears the flag on every navigation);
//     tapping outside the sheet closes it (document listener, once
//     at boot) without re-rendering mid-quiz/warmup/game or while a
//     modal is open (safeToRender guards that — the flag still clears).
//   • The sheet reuses navBtnHTML, so Focus-lock rendering (dimmed
//     + 🔒) and the friend badge carry over, and the existing go()
//     gate still blocks locked navigation — no second gate.
//   • More shows active when the current route is a More route.
//   • Desktop sidebar is unchanged (core six + "More" heading).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const lineEnd = html.indexOf('\n', start);
  const line = html.slice(start, lineEnd);
  let depth = 0;
  for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0 && line.trimEnd().endsWith('}')) return line;
  const end = html.indexOf('\n}\n', start);
  assert.ok(end >= 0, marker + ' body never closes');
  return html.slice(start, end + 3);
}
function loadInto(ctx, marker) { vm.runInContext(fnText(marker), ctx); }
// Extract a `function...{...}` expression starting at a marker,
// brace-matching while skipping quoted strings.
function extractFn(marker) {
  const m = html.indexOf(marker);
  assert.ok(m >= 0, marker + ' not found in index.html');
  const f = html.indexOf('function', m);
  const open = html.indexOf('{', f);
  let depth = 0, quote = null;
  for (let i = open; i < html.length; i++) {
    const ch = html[i];
    if (quote) { if (ch === quote && html[i - 1] !== '\\') quote = null; continue; }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return html.slice(f, i + 1); }
  }
  throw new Error(marker + ' function never closes');
}

const NAV = eval(html.slice(html.indexOf('var NAV=['), html.indexOf('];', html.indexOf('var NAV=[')) + 2) + '\n;NAV');
const CORE = ['home', 'learn', 'ask', 'critter', 'play', 'create'];
const MORE = ['jokes', 'trivia', 'riddle', 'treasure', 'friends', 'vibe'];

test('bottom bar renders the six core items plus a More button — never the six More items directly', () => {
  const render = fnBody('function render(){');
  assert.ok(!render.includes('var btm=NAV.map('), 'the old flat 12-item bar is gone');
  assert.ok(render.includes("NAV.slice(0,NAV_CORE).map(function(n){ return navBtnHTML(n,''); })"), 'the bar builds the core six through the shared helper');
  assert.ok(render.includes('id="btmMoreBtn"'), 'a More button sits on the bar');
  assert.ok(render.includes('<span class="nic">⋯</span>More'), 'the More button reads "⋯ More"');
  assert.ok(render.includes("btmMoreOpen?'<div class=\"btmmore\" id=\"btmMorePop\">'+NAV.slice(NAV_CORE).map(function(n){ return navBtnHTML(n,''); }).join('')+'</div>':''"), 'the six More items live only in the sheet, shown when btmMoreOpen');
  assert.deepEqual(NAV.slice(0, 6).map(function (n) { return n[0]; }), CORE, 'the bar core is the regroup core');
  assert.deepEqual(NAV.slice(6).map(function (n) { return n[0]; }), MORE, 'the sheet holds the regroup More six in order');
});

test('the More sheet reuses navBtnHTML, so Focus locks and the friend badge carry over', () => {
  const helper = html.slice(html.indexOf('function navBtnHTML('), html.indexOf('var navBtns='));
  assert.ok(helper.includes('focusLocked(n[0])'), 'sheet items check the focus lock');
  assert.ok(helper.includes("(locked?'🔒 ':'')"), 'locked sheet items get a 🔒 prefix');
  assert.ok(helper.includes("friendBadgeHTML()"), 'the Friends sheet item keeps its badge');
  assert.ok(html.includes('.navbtn.locked,.bottomnav button.locked{opacity:.45}'), 'locked bottom-nav buttons are dimmed');
});

test('More button shows active when the current route is a More route', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes('var moreActive=NAV.slice(NAV_CORE).some(function(n){ return n[0]===route; });'), 'More-active is computed from the current route');
  assert.ok(render.includes("id=\"btmMoreBtn\" class=\"'+(moreActive?'active':'')+'\""), 'the More button takes the active class on a More route');
});

test('desktop sidebar is unchanged by the mobile bar work', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes("NAV.slice(0,NAV_CORE).map(function(n){ return navBtnHTML(n,'navbtn'); })"), 'sidebar still builds the core section');
  assert.ok(render.includes("'<div class=\"navmore\">More</div>'"), 'sidebar still has its More heading');
  assert.ok(render.includes("NAV.slice(NAV_CORE).map(function(n){ return navBtnHTML(n,'navbtn'); })"), 'sidebar still lists the More six after the heading');
});

test('the More sheet has its own styles above the bar, below modals', () => {
  const rule = html.match(/\.btmmore\{[^}]*\}/);
  assert.ok(rule, '.btmmore rule exists');
  assert.ok(rule[0].includes('position:absolute'), 'the sheet is positioned over the page');
  assert.ok(rule[0].includes('bottom:calc(100% + 8px)'), 'the sheet sits directly above the bar');
  assert.ok(rule[0].includes('z-index:45'), 'the sheet sits above the bar (40) but below the modal overlay (80) and toasts (95)');
  const btn = html.match(/\.bottomnav \.btmmore button\{[^}]*\}/);
  assert.ok(btn, 'sheet buttons have their own rule');
  assert.ok(btn[0].includes('display:flex'), 'sheet buttons are rows, not the bar columns');
  assert.ok(btn[0].includes('flex-direction:row'), 'sheet buttons lay out icon + label side by side');
  assert.ok(html.includes('.bottomnav .btmmore button.active{'), 'the active sheet item is highlighted');
});

// ---- Functional: go() closes the sheet on navigation ----
function goContext(focusMode, streakLastDate, startRoute) {
  const toasts = [];
  let renderCalls = 0;
  const ctx = vm.createContext({
    console, setTimeout: setTimeout, clearTimeout: clearTimeout,
    window: { scrollTo: function () {} },
    toast: function (m) { toasts.push(m); },
    render: function () { renderCalls++; },
    syncFromServer: function () { return { then: function () {} }; },
    safeToRender: function () { return true; },
  });
  ctx.route = startRoute || 'home';
  ctx.askReturn = null;
  ctx.btmMoreOpen = true; // the sheet starts open in these tests
  ctx.DB = {
    focusMode: focusMode, focusModeUpdatedAt: focusMode ? '2026-11-17T00:00:00.000Z' : null,
    activeId: 'e1',
    explorers: [{ id: 'e1', name: 'Juhin', streak: 1, streakLastDate: streakLastDate || null }],
  };
  loadInto(ctx, 'function ex(){');
  loadInto(ctx, 'function todayKey(){');
  loadInto(ctx, 'function focusLocked(');
  loadInto(ctx, 'function go(');
  return {
    ctx, toasts,
    renderCalls: function () { return renderCalls; },
    go: function (r) { return vm.runInContext('go(' + JSON.stringify(r) + ')', ctx); },
    route: function () { return ctx.route; },
    sheetOpen: function () { return ctx.btmMoreOpen; },
  };
}

test('go(): navigating closes the More sheet, including a Focus-blocked tap', () => {
  const g = goContext(false, null);
  g.go('learn');
  assert.equal(g.sheetOpen(), false, 'an ordinary navigation closes the sheet');
  assert.equal(g.route(), 'learn', 'navigation still happens');
  // A blocked tap also closes the sheet (the toast is the feedback).
  const locked = goContext(true, null);
  locked.go('play');
  assert.equal(locked.sheetOpen(), false, 'a blocked Play tap closes the sheet too');
  assert.equal(locked.route(), 'home', 'Play stays blocked');
  assert.ok(locked.toasts[0].includes('unlock Play'), 'the lock toast still shows');
});

test('the More button toggles the sheet open and closed (real handler code)', () => {
  const handler = extractFn("mb.onclick=function(){");
  const ctx = vm.createContext({ console });
  ctx.btmMoreOpen = false;
  ctx.renderCalls = 0;
  ctx.sndPop = function () {};
  ctx.render = function () { ctx.renderCalls++; };
  vm.runInContext('var toggle=' + handler + ';', ctx);
  vm.runInContext('toggle();', ctx);
  assert.equal(ctx.btmMoreOpen, true, 'first tap opens the sheet');
  assert.equal(ctx.renderCalls, 1, 'opening re-renders');
  vm.runInContext('toggle();', ctx);
  assert.equal(ctx.btmMoreOpen, false, 'second tap closes it again');
  assert.equal(ctx.renderCalls, 2, 'closing re-renders');
});

// ---- Functional: the boot-time outside-tap listener ----
function docClickContext(safe) {
  const ctx = vm.createContext({ console });
  ctx.btmMoreOpen = true;
  ctx.safe = safe;
  ctx.renderCalls = 0;
  ctx.safeToRender = function () { return ctx.safe; };
  ctx.render = function () { ctx.renderCalls++; };
  const listener = extractFn("document.addEventListener('click',function(ev){");
  vm.runInContext('var onDocClick=' + listener + ';', ctx);
  return {
    ctx,
    click: function (matches) {
      // Build the fake target inside the vm so no object crosses contexts.
      vm.runInContext('onDocClick({target: {closest: function(sel){ return ' + JSON.stringify(matches) + '.indexOf(sel) >= 0 ? {id: sel} : null; } }})', ctx);
    },
    sheetOpen: function () { return ctx.btmMoreOpen; },
    renderCalls: function () { return ctx.renderCalls; },
  };
}

test('outside tap closes the sheet; taps inside it or on More do not', () => {
  const d = docClickContext(true);
  d.click(['#btmMorePop']);
  assert.equal(d.sheetOpen(), true, 'a tap inside the sheet leaves it open');
  assert.equal(d.renderCalls(), 0, 'no re-render for an inside tap');
  d.click(['#btmMoreBtn']);
  assert.equal(d.sheetOpen(), true, 'a tap on the More button leaves it open (its own handler toggles)');
  d.click([]);
  assert.equal(d.sheetOpen(), false, 'a tap anywhere else closes it');
  assert.equal(d.renderCalls(), 1, 'closing re-renders once');
  d.click([]);
  assert.equal(d.renderCalls(), 1, 'a closed sheet ignores further taps');
});

test('outside tap never re-renders mid-quiz or while a modal is open', () => {
  const d = docClickContext(false); // safeToRender() false: quiz/warmup/game/modal
  d.click([]);
  assert.equal(d.sheetOpen(), false, 'the flag still clears');
  assert.equal(d.renderCalls(), 0, 'no re-render while unsafe');
});
