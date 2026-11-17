// Sidebar critter card jumps to Critter Lab (2026-11-17, Bryan:
// "make the critter card clickable"). The card is a plain div today
// with no click handler; it becomes a button carrying data-go2.
// The [data-go2] binding lives in bindHome, which only runs on the
// Home route — so the sidebar button is bound explicitly in render(),
// which runs on every route.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnSlice(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  assert.ok(start >= 0, startMarker + ' not found');
  const end = html.indexOf(endMarker, start);
  assert.ok(end > start, endMarker + ' not found after ' + startMarker);
  return html.slice(start, end);
}

test('sidebar critter card is a button carrying data-go2="critter"', () => {
  assert.ok(html.includes('<button type="button" class="sidecritter" id="sideCritterBtn" data-go2="critter"'), 'the card must be a button with data-go2="critter"');
  assert.ok(!html.includes('<div class="sidecritter">'), 'no plain-div sidecritter must remain');
});

test('sidebar critter card keeps its existing text and adds a tap hint', () => {
  const renderSrc = fnSlice('function render(){', 'function renderTop()');
  assert.ok(renderSrc.includes('Critter stage'), 'the card still says Critter stage');
  assert.ok(renderSrc.includes("Stage '+(ex().critterStage+1)+' of 4"), 'the card still shows Stage N of 4');
  assert.ok(renderSrc.includes('Tap to visit Critter Lab'), 'the card hints that it is tappable');
  assert.ok(renderSrc.includes('aria-label="Visit Critter Lab"'), 'the button has an accessible label');
});

test('the sidebar button is bound in render(), so it works on every route — not only Home', () => {
  const renderSrc = fnSlice('function render(){', 'function renderTop()');
  assert.ok(renderSrc.includes("document.getElementById('sideCritterBtn')"), 'render() binds the sidebar button');
  assert.ok(renderSrc.includes("go('critter')"), 'the sidebar binding navigates to Critter Lab');
  const bindHomeSrc = fnSlice('function bindHome(){', '/* ============================================================ LEARN + WARM-UP + QUIZ */');
  assert.ok(!bindHomeSrc.includes('sideCritterBtn'), 'the sidebar button must not depend on bindHome, which only runs on Home');
  assert.ok(bindHomeSrc.includes('[data-go2]'), 'bindHome still binds the Home-only data-go2 buttons');
});

test('the button resets keep the card looking identical', () => {
  const m = html.match(/\.sidecritter\{([^}]+)\}/);
  assert.ok(m, '.sidecritter CSS must exist');
  const css = m[1];
  assert.ok(css.includes('background:var(--panel)'), 'same background');
  assert.ok(css.includes('border-radius:var(--radius)'), 'same radius');
  assert.ok(css.includes('padding:14px'), 'same padding');
  assert.ok(css.includes('border:0'), 'button default border removed');
  assert.ok(css.includes('text-align:left'), 'button text stays left-aligned');
  assert.ok(css.includes('cursor:pointer'), 'the card shows it is clickable');
  assert.ok(css.includes('font:inherit'), 'button font does not change the text');
  assert.ok(css.includes('color:inherit'), 'button colour does not change the text');
});
