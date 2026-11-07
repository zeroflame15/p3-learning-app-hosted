// Colour palette + quest framing (myKx review 2026-11-05): one calm mint
// world — pale sage background, white cards, dark forest-green text,
// golden-yellow primary buttons, lavender/purple mascot accents.
// Reads the page from PAGE_PATH so the patch can be verified on a temp
// copy before it lands in public/index.html:
//   PAGE_PATH=/tmp/palette-index.html node --test tests/palette.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(pagePath, 'utf8');

function rootBlock() {
  const m = html.match(/:root\{([\s\S]*?)\n\}/);
  assert.ok(m, ':root block must exist');
  return m[1];
}
function rootVar(name) {
  const m = rootBlock().match(new RegExp('--' + name + ':([^;]+);'));
  assert.ok(m, '--' + name + ' must be defined in :root');
  return m[1].trim();
}
// Relative luminance + contrast ratio (WCAG), for the readability checks.
function lum(hex) {
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

test('page is light colour-scheme, not the old dark night-terrarium', () => {
  assert.ok(html.includes('<meta name="color-scheme" content="light" />'), 'meta colour-scheme is light');
  assert.ok(!html.includes('color-scheme:dark'), 'no dark colour-scheme left');
  assert.ok(rootBlock().includes('color-scheme:light'), ':root colour-scheme is light');
});

test(':root is the calm mint world', () => {
  assert.equal(rootVar('bg'), '#eaf5e6', 'pale sage/mint page background');
  assert.equal(rootVar('panel'), '#ffffff', 'white cards');
  assert.equal(rootVar('panel2'), '#f0f7ec', 'very light mint secondary panels');
  assert.equal(rootVar('ink'), '#1e3a24', 'dark forest-green text');
  assert.equal(rootVar('amber'), '#ffc94d', 'golden-yellow primary buttons kept');
  assert.equal(rootVar('gold'), '#ffc94d', 'gold sparkles kept');
  assert.equal(rootVar('nav'), '#1f4a2e', 'deep forest-green sidebar');
  assert.equal(rootVar('nav-ink'), '#f5f1e6', 'cream sidebar text kept');
  for (const gone of ['#17163a', '#1d1b47', '#232154', '#2c2966', '#100f2c', '#b9b4d9', '#3a3677']) {
    assert.ok(!rootBlock().includes(gone), 'old dark var ' + gone + ' is gone from :root');
  }
});

test('text stays readable: key ink-on-panel pairs meet WCAG AA', () => {
  assert.ok(ratio(rootVar('ink'), rootVar('panel')) >= 7, 'ink on white card, ratio ' + ratio(rootVar('ink'), rootVar('panel')).toFixed(2));
  assert.ok(ratio(rootVar('ink-soft'), rootVar('panel')) >= 4.5, 'muted ink on white card, ratio ' + ratio(rootVar('ink-soft'), rootVar('panel')).toFixed(2));
  assert.ok(ratio(rootVar('ink-soft'), rootVar('panel2')) >= 4.5, 'muted ink on light mint panel');
  assert.ok(ratio(rootVar('amber-d'), rootVar('panel2')) >= 4.5, 'dark gold pill text on light mint');
  assert.ok(ratio(rootVar('green'), rootVar('green-soft')) >= 4, 'green pill text on light green tint');
  assert.ok(ratio(rootVar('sky'), rootVar('sky-soft')) >= 4, 'blue pill text on light blue tint');
  assert.ok(ratio(rootVar('coral'), rootVar('coral-soft')) >= 4, 'coral pill text on light pink tint');
  assert.ok(ratio('#ffffff', rootVar('teal')) >= 3, 'white button text on teal');
  assert.ok(ratio('#ffffff', rootVar('sky')) >= 4.5, 'white chat text on sky blue');
});

test('every theme has a 3-dot palette preview', () => {
  const themes = html.slice(html.indexOf('var THEMES={'), html.indexOf('};', html.indexOf('var THEMES={')));
  for (const name of ['Frog Pond', 'Magnet Lab', 'Star Garden', 'Ocean Deep', 'Sky Castle']) {
    const m = themes.match(new RegExp("'" + name + "':\\{[^}]*dots:\\[([^\\]]+)\\]"));
    assert.ok(m, name + ' has a dots field');
    const dots = m[1].split(',').map(d => d.trim().replace(/['"]/g, ''));
    assert.equal(dots.length, 3, name + ' has exactly 3 dots');
    for (const d of dots) assert.match(d, /^#[0-9a-f]{6}$/i, name + ' dot ' + d + ' is a hex colour');
  }
});

test('theme chips render the 3-dot preview', () => {
  assert.ok(html.includes('.themedots{display:inline-flex'), '.themedots CSS rule exists');
  assert.ok(html.includes('.themedots i{'), '.themedots dot CSS exists');
  assert.ok(html.includes('class="themedots"'), 'themechip markup includes the dots span');
  assert.ok(html.includes("(th.dots||[]).map(function(c)"), 'chips map over the theme dots');
});

test('Home quest card frames today as part of Frog Quest', () => {
  const home = html.slice(html.indexOf('function homeHTML()'), html.indexOf('function bindHome()'));
  assert.ok(home.includes('Frog Quest'), 'quest card mentions Frog Quest');
  assert.ok(home.includes("quest '+(doneCount+1)+' of 14"), 'quest number comes from the completed count');
});

test('Learn hero ties the quests to the same frog story', () => {
  const learn = html.slice(html.indexOf('function learnHTML()'), html.indexOf('function bindLearn()'));
  assert.ok(learn.includes('Frog Quest'), 'Learn hero mentions Frog Quest');
  assert.ok(learn.includes('one more hop on our Frog Quest'), 'Learn hero frog-story line present');
});

test('departures kept: Play Arcade bands stay dark navy/neon', () => {
  const play = html.slice(html.indexOf('function playHTML()'), html.indexOf('function bindPlay()'));
  assert.ok(play.includes("BAND={word:'#1e4034',number:'#4c2a33',memory:'#1e3a5f',sort:'#4a3a10'}"), 'dark gameband colours untouched');
});

test('departures kept: Grand Door terrarium photo background untouched', () => {
  assert.ok(html.includes('.doorwrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:\n  linear-gradient(rgba(16,15,44,.62),rgba(16,15,44,.62)), url(assets/terrarium.webp) center/cover no-repeat, var(--bg)}'),
    'doorwrap keeps its dark terrarium photo overlay');
  assert.ok(!html.includes('doorwrap') || html.indexOf('terrarium.webp') > 0, 'terrarium asset still referenced');
});

test('departures kept: Treasure Realm HTML untouched by the palette pass', () => {
  const treasure = html.slice(html.indexOf('function treasureHTML()'), html.indexOf('function bindTreasure()'));
  assert.ok(treasure.includes('Every treasure DOES something'), 'treasure purpose line intact');
  assert.ok(!treasure.includes('#eaf5e6') && !treasure.includes('themedots'), 'no palette edits inside treasureHTML');
});
