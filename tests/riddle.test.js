// Riddles (requested 2026-11-22): a break section like Classroom
// Jokes — one riddle at a time, an 8-second countdown, then the
// answer reveals itself. "Show the answer" skips the wait; "Next
// riddle" deals a fresh one. Order is shuffled per visit, no
// repeats until all 36 have been told, then reshuffle — exactly
// the Jokes mechanism (session-only state, nothing saved, no new
// per-explorer field). Riddle is a fun break like Jokes, so Focus
// mode locks it the same way until the day's quest is done.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}
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

const NAV = eval(grabVar('NAV') + '\n;NAV');
const RIDDLES = eval(grabVar('RIDDLES') + '\n;RIDDLES');

test('Riddle is in NAV, in the More order Bryan asked for', () => {
  const riddle = NAV.find(function (n) { return n[0] === 'riddle'; });
  assert.ok(riddle, 'Riddle in NAV');
  assert.equal(riddle[1], '❓', 'Riddle uses the question-mark emoji');
  assert.equal(riddle[2], 'Riddle', 'Riddle label');
  assert.equal(riddle[3], 'icons/nav-riddle.webp', 'Riddle has a 3D icon file');
  assert.deepEqual(NAV.slice(6).map(function (n) { return n[0]; }),
    ['jokes', 'trivia', 'riddle', 'treasure', 'friends', 'vibe'],
    'More order is Jokes, Trivia, Riddle, Treasure, Friends, Vibe');
  assert.deepEqual(NAV.slice(0, 6).map(function (n) { return n[0]; }),
    ['home', 'learn', 'ask', 'critter', 'play', 'create'],
    'the core six are untouched');
  assert.equal(NAV[NAV.length - 1][0], 'vibe', 'Vibe stays last overall');
  assert.ok(html.includes("riddle:'Riddle Time'"), 'Riddle page title');
  assert.ok(html.includes("else if(route==='riddle')c.innerHTML=riddleHTML(),bindRiddle();"), 'riddle route renders riddleHTML');
});

test('RIDDLES bank: 36 clean riddles for a 9-year-old, no repeats, no spoilers', () => {
  assert.equal(RIDDLES.length, 36, '36 riddles, got ' + RIDDLES.length);
  const questions = new Set();
  const JOKES = eval(grabVar('CLASS_JOKES') + '\n;CLASS_JOKES');
  const jokeQs = new Set(JOKES.map(function (j) { return j.q; }));
  for (const r of RIDDLES) {
    assert.ok(typeof r.q === 'string' && r.q.length > 10, 'a real riddle: ' + r.q);
    assert.ok(typeof r.a === 'string' && r.a.length > 2, 'a real answer: ' + r.q);
    assert.ok(!r.q.includes(r.a), 'the answer is not spoiled inside the riddle: ' + r.q);
    assert.ok(!jokeQs.has(r.q), 'no riddle repeats a joke setup: ' + r.q);
    questions.add(r.q);
  }
  assert.equal(questions.size, RIDDLES.length, 'no duplicated riddles');
});

test('riddleOrder shuffles the full bank, like jokeOrder', () => {
  const orderFn = html.slice(html.indexOf('function riddleOrder(){'), html.indexOf('function riddleTick(){'));
  const shuffleStub = 'var shuffle=function(a){ return a.slice(); };';
  const order = eval(shuffleStub + '\nvar RIDDLES=' + JSON.stringify(RIDDLES) + ';\n' + orderFn + '\nriddleOrder()');
  assert.deepEqual(order, RIDDLES.map(function (r, i) { return i; }), 'with an identity shuffle the order is the full index list');
});

test('riddleHTML: riddle shown, answer hidden, 8s countdown visible; after reveal the answer shows', () => {
  const orderFn = html.slice(html.indexOf('function riddleOrder(){'), html.indexOf('function riddleTick(){'));
  const htmlFn = html.slice(html.indexOf('function riddleHTML(){'), html.indexOf('function bindRiddle(){'));
  const stub = 'var pageHero=function(){ return "HERO"; }; var esc=function(s){ return s; }; var shuffle=function(a){ return a.slice(); }; var riddleState=null;';
  const base = stub + '\nvar RIDDLES=' + JSON.stringify(RIDDLES) + ';\n' + orderFn + '\n' + htmlFn + '\n';
  const out = eval(base + 'riddleHTML()');
  assert.ok(out.includes(RIDDLES[0].q), 'the first riddle is shown');
  assert.ok(!out.includes(RIDDLES[0].a), 'the answer stays hidden until the reveal');
  assert.ok(out.includes('id="ridCount"'), 'a visible countdown element');
  assert.ok(out.includes('8s'), 'the countdown starts at 8 seconds');
  assert.ok(out.includes('id="ridBar"'), 'a countdown progress bar');
  assert.ok(out.includes('id="ridShow"'), 'a Show the answer button is offered');
  assert.ok(out.includes('Show the answer'), 'the button says what it does');
  const out2 = eval(base + 'riddleState={order:[0], idx:0, revealed:true, seen:0, left:0}; riddleHTML()');
  assert.ok(out2.includes(RIDDLES[0].a), 'after the reveal the answer shows');
  assert.ok(out2.includes('id="ridNext"'), 'a Next riddle button follows');
  assert.ok(out2.includes('Next riddle'), 'the button says what it does');
  assert.ok(!out2.includes('id="ridShow"'), 'no Show button once revealed');
  assert.ok(html.includes('if(riddleState.idx>=riddleState.order.length){ riddleState.order=riddleOrder(); riddleState.idx=0; }'), 'the order reshuffles once all riddles are told');
});

test('bindRiddle: Show stops the timer, Next resets to 8s, sounds are the shared helpers', () => {
  const bind = fnBody('function bindRiddle(){');
  assert.ok(bind.includes("document.getElementById('ridShow')"), 'Show button is wired');
  assert.ok(bind.includes("document.getElementById('ridNext')"), 'Next button is wired');
  assert.ok(bind.includes('riddleState.revealed=true;'), 'Show reveals');
  assert.ok(bind.includes('riddleState.left=8;'), 'Next resets the countdown to 8 seconds');
  assert.ok(bind.includes('riddleStartTimer();'), 'the countdown restarts on the riddle screen');
  assert.ok(bind.includes('sndPop();'), 'reveal/next use the shared pop sound');
  const startTimer = fnBody('function riddleStartTimer(){');
  assert.ok(startTimer.includes('setInterval(riddleTick,1000)'), 'the countdown ticks once a second');
  const tick = fnBody('function riddleTick(){');
  assert.ok(tick.includes('sndTick(riddleState.left)'), 'each tick plays the shared light tick');
  assert.ok(tick.includes('riddleState.revealed=true;'), 'hitting zero reveals the answer');
});

// ---- Functional: the 8-second countdown in a vm sandbox ----
function tickContext() {
  const els = {
    ridCount: { textContent: '⏳ 8s' },
    ridBar: { style: { width: '100%' } },
  };
  const calls = { pops: 0, ticks: [], renders: 0, cleared: 0 };
  const ctx = vm.createContext({
    console,
    document: { getElementById: function (id) { return els[id] || null; } },
    setInterval: function () { return 1; },
    clearInterval: function () { calls.cleared++; },
    sndPop: function () { calls.pops++; },
    sndTick: function (n) { calls.ticks.push(n); },
    render: function () { calls.renders++; },
  });
  ctx.riddleState = { order: [0, 1], idx: 0, revealed: false, seen: 0, left: 8 };
  ctx.riddleTimer = 1;
  loadInto(ctx, 'function riddleTick(){');
  return {
    ctx, els, calls,
    tick: function () { vm.runInContext('riddleTick()', ctx); },
    state: function () { return ctx.riddleState; },
    setCountEl: function (el) { els.ridCount = el; },
  };
}

test('riddleTick: counts 8→1 with a tick each second, then auto-reveals at 0', () => {
  const t = tickContext();
  for (let i = 0; i < 7; i++) t.tick();
  assert.equal(t.state().left, 1, 'after 7 ticks, 1 second is left');
  assert.equal(t.state().revealed, false, 'not revealed yet');
  assert.equal(t.els.ridCount.textContent, '⏳ 1s', 'the countdown text shows 1s');
  assert.equal(t.calls.ticks.length, 7, 'one light tick per second');
  assert.equal(t.calls.pops, 0, 'no reveal pop yet');
  t.tick();
  assert.equal(t.state().left, 0, 'countdown reaches zero');
  assert.equal(t.state().revealed, true, 'the answer auto-reveals at zero');
  assert.equal(t.calls.pops, 1, 'the reveal pop plays once');
  assert.equal(t.calls.renders, 1, 'the card re-renders to show the answer');
  assert.equal(t.calls.cleared, 1, 'the timer stops itself');
  assert.equal(t.ctx.riddleTimer, null, 'no interval left running');
});

test('riddleTick: leaving the riddle screen stops the timer', () => {
  const t = tickContext();
  t.setCountEl(null);
  t.tick();
  assert.equal(t.calls.cleared, 1, 'the timer clears when the countdown element is gone');
  assert.equal(t.ctx.riddleTimer, null, 'no interval left running');
  assert.equal(t.state().revealed, false, 'leaving does not reveal the answer');
});

// ---- Functional: Focus lock covers Riddle, same as Jokes ----
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
  ctx.DB = {
    focusMode: focusMode, focusModeUpdatedAt: focusMode ? '2026-11-22T00:00:00.000Z' : null,
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
    today: function () { return vm.runInContext('todayKey()', ctx); },
  };
}

test('go(): Focus on, no quest today — Riddle is blocked like Jokes, with its own toast', () => {
  const g = goContext(true, null);
  g.go('riddle');
  assert.equal(g.route(), 'home', 'Riddle does not open');
  assert.equal(g.renderCalls(), 0, 'no render on a blocked nav');
  assert.ok(g.toasts[0].includes('unlock Riddles'), 'Riddle toast names Riddles: ' + g.toasts[0]);
  g.go('jokes');
  assert.ok(g.toasts[1].includes('unlock Jokes'), 'Jokes still gets its own toast');
});

test('go(): Focus on, quest done today — Riddle opens; Focus off — Riddle opens', () => {
  const g = goContext(true, null);
  g.ctx.DB.explorers[0].streakLastDate = g.today();
  g.go('riddle');
  assert.equal(g.route(), 'riddle', 'Riddle opens after today’s quest');
  assert.equal(g.toasts.length, 0, 'no lock toast once the quest is done');
  const h = goContext(false, null);
  h.go('riddle');
  assert.equal(h.route(), 'riddle', 'Riddle opens when Focus mode is off');
});

test('Focus lock never mentions Create; Riddle is locked, Create is not', () => {
  const locked = fnBody('function focusLocked(');
  assert.ok(locked.includes("'riddle'"), 'the lock covers Riddle');
  assert.ok(!locked.includes("'create'"), 'the lock never mentions Create');
});
