// Mouse-drag regression (seen live 2026-11-07, 13:12–13:20 SGT): in a
// held-drag test the frog stayed at (1184,333) while the pointer moved
// 1184→1454 over 4.3s, then wandered off; two manual held drags likewise
// ended with the frog far from the pointer. Touch drag was not tested
// (no touch input in that browser). Drag had WORKED in the previous live
// verification (~11:33 SGT).
//
// Two defects in the same path:
// (1) The drag's pointermove/pointerup handlers were bound to #frogWrap,
//     an element render() destroys and rebuilds. The cross-tab 'storage'
//     listener added in cbebe5c (plus the 30s auto-pull) re-renders
//     mid-drag: the captured element is gone, pointer capture is
//     released, and later moves go to the pond, not the new wrap — the
//     frog freezes. frogDragging stays true, so the wander timer stays
//     suppressed until the drag pause expires, then the frog "wanders
//     off" — exactly the live symptom. Same structural flaw that killed
//     the Play chase (fixed by going document-level); the drag never
//     got the same treatment.
// (2) The frog's 1.3s ease-in-out left/top transition: every placeFrog()
//     during a drag restarts it, so with pointermove events arriving
//     every few ms the frog creeps instead of tracking the pointer.
//
// Fix: the drag is handled at document level (re-fetching the live pond
// on every move, no pointer capture), and the pond gets a 'dragging'
// class while dragging that switches the transition off. These tests run
// the real bindCritter in a vm with a fake DOM, so the mid-drag
// re-render is reproduced for real — not just asserted from source.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const end = html.indexOf('\n}\n', start);
  assert.ok(end >= 0, marker + ' body never closes');
  return html.slice(start, end + 3);
}
function varText(name) {
  const m = html.match(new RegExp('var ' + name + '=[^;]+;'));
  assert.ok(m, name + ' var not found in index.html');
  return m[0];
}

// --- Fake DOM: just enough for bindCritter + a mid-drag re-render ---
class FakeElement {
  constructor(rect) {
    this._rect = rect || null;
    this.style = {};
    this.textContent = '';
    this._classes = new Set();
    this.classList = {
      add: (c) => { this._classes.add(c); },
      remove: (c) => { this._classes.delete(c); },
      contains: (c) => this._classes.has(c),
    };
    this._listeners = {};
  }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const list = this._listeners[type] || [];
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  fire(type, ev) { for (const fn of (this._listeners[type] || []).slice()) fn(ev || {}); }
  querySelector() { return null; } // the wander tick looks for .frog-bob; none in the fake pond
  getBoundingClientRect() { return this._rect || { left: 0, top: 0, width: 0, height: 0 }; }
  setPointerCapture() { /* the old drag code called this; the fix must not need it */ }
}

const POND_RECT = { left: 100, top: 100, width: 800, height: 400 };

function makeTab() {
  const timers = []; // captured wander-timer callbacks, latest first use
  const docListeners = {};
  const elements = {};
  const document = {
    visibilityState: 'visible',
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
    removeEventListener: (type, fn) => {
      const list = docListeners[type] || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
  };
  document.fire = (type, ev) => { for (const fn of (docListeners[type] || []).slice()) fn(ev || {}); };

  function freshWrap() {
    const w = new FakeElement();
    w.style.left = '50%';
    w.style.top = '56%';
    return w;
  }
  elements.pond = new FakeElement(POND_RECT);
  elements.frogWrap = freshWrap();
  elements.frogBubble = new FakeElement();
  elements.frogBubble.style.display = 'none';

  const explorer = {
    visitedStages: [], discoveredCritters: [], critterName: 'Teddy',
    critterStage: 3, care: {}, careGrewDay: null, stars: 0, critterNameAt: null,
  };
  const sandbox = {
    console, JSON, Object, Array, Math, Date, Promise,
    route: 'critter',
    document,
    __explorer: explorer,
    __swapWrap: null, // set below, once the vm context exists
    setTimeout: () => 0, // never fires: no timer leaks, bubble stays up for the assert
    clearTimeout: () => {},
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    clearInterval: () => {},
    ex: null, save: () => {}, toast: () => {},
    sndPop: () => {}, sndCorrect: () => {}, sndFanfare: () => {},
    shuffle: (a) => a.slice(), // facts cycle in page order in tests (the real shuffle lives in the page),
    awardBadge: () => {}, confettiStars: () => {},
  };
  const ctx = vm.createContext(sandbox);
  // A re-render rebuilds the pond: the wrap is a NEW element (as the
  // real render does), then bindCritter re-binds on it — exactly what
  // happens live when the auto-pull or another tab's save re-renders.
  sandbox.__swapWrap = () => {
    const x = vm.runInContext('frogPos.x', ctx);
    const y = vm.runInContext('frogPos.y', ctx);
    const w = freshWrap();
    w.style.left = x + '%';
    w.style.top = y + '%';
    elements.frogWrap = w;
  };
  sandbox.ex = () => sandbox.__explorer;
  vm.runInContext(varText('frogPos'), ctx);
  vm.runInContext(varText('careMsg'), ctx);
  vm.runInContext(varText('CARE_FX'), ctx);
  vm.runInContext(varText('careFx'), ctx);
  vm.runInContext(varText('FROG_FACTS'), ctx);
  vm.runInContext(varText('frogFactState'), ctx);
  vm.runInContext(fnText('function nextFrogFact(){'), ctx);
  vm.runInContext(varText('critterView'), ctx);
  vm.runInContext(varText('selCritter'), ctx);
  vm.runInContext(fnText('function bindCritter(){'), ctx);
  vm.runInContext('function render(){ __swapWrap(); bindCritter(); }', ctx);
  return {
    run: (code) => vm.runInContext(code, ctx),
    bind: () => vm.runInContext('bindCritter()', ctx),
    doc: document,
    elements,
    wrap: () => elements.frogWrap,
    pond: () => elements.pond,
    frogPos: () => ({ x: vm.runInContext('frogPos.x', ctx), y: vm.runInContext('frogPos.y', ctx) }),
    dragging: () => vm.runInContext('frogDragging', ctx),
    timer: () => timers[timers.length - 1],
  };
}

test('drag follows the pointer with no re-render (baseline)', () => {
  const tab = makeTab();
  tab.bind();
  // Frog starts at (50%, 56%) of the 800x400 pond at (100,100) = pixel (500,324).
  tab.wrap().fire('pointerdown', { clientX: 500, clientY: 324, pointerId: 1 });
  assert.ok(tab.pond().classList.contains('dragging'), 'the pond gets a dragging class while dragging');
  tab.doc.fire('pointermove', { clientX: 700, clientY: 200 });
  assert.deepEqual(tab.frogPos(), { x: 75, y: 25 }, 'the frog moves to the pointer');
  assert.equal(tab.wrap().style.left, '75%', 'placeFrog writes the new position to the live wrap');
  assert.equal(tab.wrap().style.top, '25%', 'placeFrog writes the new position to the live wrap');
  // Pond walls still clamp the frog.
  tab.doc.fire('pointermove', { clientX: 820, clientY: 260 });
  assert.deepEqual(tab.frogPos(), { x: 90, y: 40 }, 'the frog stops at the pond walls');
  tab.doc.fire('pointerup', {});
  assert.equal(tab.dragging(), false, 'releasing ends the drag');
  assert.ok(!tab.pond().classList.contains('dragging'), 'the dragging class is removed on release');
});

test('a re-render mid-drag must not freeze the frog (live regression 2026-11-07)', () => {
  const tab = makeTab();
  tab.bind();
  const oldWrap = tab.wrap();
  tab.wrap().fire('pointerdown', { clientX: 500, clientY: 324, pointerId: 1 });
  // The page re-renders mid-drag (30s auto-pull / another tab's save):
  // the wrap under the pointer is destroyed and rebuilt, bindCritter
  // re-runs. With the old wrap-bound handlers this released pointer
  // capture and the frog froze for the rest of the drag.
  tab.run('render()');
  assert.notEqual(tab.wrap(), oldWrap, 'the re-render really replaced the wrap element');
  tab.doc.fire('pointermove', { clientX: 700, clientY: 200 });
  assert.deepEqual(tab.frogPos(), { x: 75, y: 25 }, 'the frog still follows the pointer after the re-render');
  tab.doc.fire('pointermove', { clientX: 820, clientY: 260 });
  assert.deepEqual(tab.frogPos(), { x: 90, y: 40 }, 'the drag keeps tracking after the re-render');
  tab.doc.fire('pointerup', {});
  assert.equal(tab.dragging(), false, 'releasing after a re-rendered drag still ends it');
});

test('a tap still says hello after the drag rework', () => {
  const tab = makeTab();
  tab.bind();
  tab.wrap().fire('pointerdown', { clientX: 500, clientY: 324, pointerId: 1 });
  tab.doc.fire('pointerup', {});
  assert.equal(tab.elements.frogBubble.style.display, 'block', 'a press without dragging shows the speech bubble');
  assert.ok(tab.elements.frogBubble.textContent.indexOf('💬') === 0, 'the bubble holds a frog fact');
  assert.equal(tab.run('careFx && careFx.a'), 'play', 'the tap replays the happy reaction');
  assert.equal(tab.dragging(), false, 'the tap ends the drag state');
});

test('the drag does not depend on pointer capture, and the transition is off while dragging', () => {
  assert.ok(!html.includes('setPointerCapture'), 'no setPointerCapture anywhere: the drag must not depend on capture surviving a re-render');
  assert.ok(html.includes('.pond.dragging .frog-wrap{transition:none}'), 'the dragging class switches the 1.3s wander transition off while dragging');
  const bind = html.slice(html.indexOf('function bindCritter(){'));
  assert.ok(bind.includes("document.addEventListener('pointermove',frogDragHandler)"), 'the drag move handler is document-level, like the play chase');
  assert.ok(bind.includes("document.addEventListener('pointerup',frogDragUpHandler)"), 'the drag end handler is document-level, so releasing outside the frog still ends the drag');
  assert.ok(bind.includes("document.addEventListener('pointercancel',frogDragUpHandler)"), 'a cancelled drag also ends at document level');
  assert.ok(bind.includes("if(frogDragHandler){ document.removeEventListener('pointermove',frogDragHandler); frogDragHandler=null; }"), 're-binding removes the previous move listener, so there is never more than one');
  const handler = bind.slice(bind.indexOf('frogDragHandler=function(ev){'), bind.indexOf("document.addEventListener('pointermove',frogDragHandler)"));
  assert.ok(handler.includes("document.getElementById('pond')"), 'the move handler re-fetches the live pond on every move');
  assert.ok(handler.includes("placeFrog()"), 'the move handler visibly moves the frog');
});

// Hover pause (seen live 2026-11-07): two frogspawn drags in a row
// left the egg cluster in the centre. The drag code is
// stage-agnostic — same wrap, same handlers for every stage — so
// there is no stage-specific defect to revert. The failure is the
// wander race: the frog glides to a new spot every 3.8s, and a press
// aimed at the smallest stage (frogspawn, 150px) can land on empty
// pond after it glides away. Hovering now pauses the wander, so the
// frog is where the child aimed when they press, and the wrap has a
// 16px invisible grab halo.
test('hovering the frog pauses the wander so an aimed press lands on it', () => {
  const tab = makeTab();
  tab.bind();
  const before = tab.frogPos();
  tab.wrap().fire('pointerenter', {});
  assert.equal(tab.run('frogHover'), true, 'hovering sets the pause flag');
  tab.timer()();
  assert.deepEqual(tab.frogPos(), before, 'the frog holds still while hovered');
  tab.wrap().fire('pointerleave', {});
  assert.equal(tab.run('frogHover'), false, 'leaving clears the pause flag');
  tab.timer()();
  assert.notDeepEqual(tab.frogPos(), before, 'wandering resumes once the pointer leaves');
});

test('the frog wrap has an enlarged invisible grab zone', () => {
  assert.ok(html.includes('.frog-wrap::before'), 'grab-zone rule exists');
  assert.ok(html.includes('inset:-16px'), 'the grab zone extends 16px past the frog');
});
