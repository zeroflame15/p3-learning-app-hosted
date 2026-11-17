// Weekly theme reskin (2026-11-17): picking a theme re-skins the
// whole app — sidebar, page background, buttons, panels, borders
// and text — not just the Home terrarium tint. Semantic colours
// stay fixed (green = right, coral = wrong, sky = links); Play
// keeps its soft aqua and Treasure its soft lavender.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' not found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
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
// Relative luminance + contrast ratio (WCAG), as in palette.test.js.
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

const THEMES_START = html.indexOf('var THEMES={');
assert.ok(THEMES_START >= 0, 'THEMES not found');
const THEMES_END = html.indexOf('\n};', THEMES_START);
const THEMES = eval(html.slice(THEMES_START, THEMES_END + 3) + '\nTHEMES;');
// themeName() reads THEME_ALIAS, so the evals below bring it along
// too — without it they fail with "THEME_ALIAS is not defined".
const THEME_ALIAS_START = html.indexOf('var THEME_ALIAS={');
assert.ok(THEME_ALIAS_START >= 0, 'THEME_ALIAS not found');
const THEME_ALIAS_END = html.indexOf('};', THEME_ALIAS_START);
const THEME_ALIAS_SRC = html.slice(THEME_ALIAS_START, THEME_ALIAS_END + 2);
const THEME_NAMES = ['Frog Pond', 'Magnet Lab', 'Star Garden', 'Ocean Deep', 'Sky Castle'];
const PALETTE_KEYS = ['nav', 'bg', 'panel2', 'border', 'amber', 'amber-d', 'teal', 'teal-soft', 'teal-d', 'ink', 'ink-soft', 'card'];

test('every theme carries the full palette, all hex colours', () => {
  for (const name of THEME_NAMES) {
    const t = THEMES[name];
    assert.ok(t, name + ' exists');
    for (const k of PALETTE_KEYS) {
      assert.ok(t[k], name + ' has ' + k);
      assert.match(t[k], /^#[0-9a-f]{6}$/i, name + ' ' + k + ' ' + t[k] + ' is a hex colour');
    }
    assert.ok(t.tint, name + ' keeps its terrarium tint');
    assert.match(t.glow, /^#[0-9a-f]{6}$/i, name + ' glow is a hex colour');
    assert.ok(typeof t.line === 'string' && t.line.length > 0, name + ' keeps its tagline');
    assert.equal((t.dots || []).length, 3, name + ' keeps its 3-dot preview');
  }
});

test('Frog Pond palette equals the :root defaults (first paint is Frog Pond)', () => {
  const t = THEMES['Frog Pond'];
  assert.equal(t.nav, rootVar('nav'), 'sidebar default');
  assert.equal(t.bg, rootVar('bg'), 'page background default');
  assert.equal(t.panel2, rootVar('panel2'), 'soft panel default');
  assert.equal(t.border, rootVar('line'), 'border default');
  assert.equal(t.amber, rootVar('amber'), 'primary button default');
  assert.equal(t['amber-d'], rootVar('amber-d'), 'button shadow default');
  assert.equal(t.amber, rootVar('gold'), 'gold sparkles match the primary button');
  assert.equal(t.teal, rootVar('teal'), 'secondary button default');
  assert.equal(t['teal-soft'], rootVar('teal-soft'), 'soft teal default');
  assert.equal(t['teal-d'], rootVar('teal-d'), 'teal shadow default');
  assert.equal(t.ink, rootVar('ink'), 'text default');
  assert.equal(t['ink-soft'], rootVar('ink-soft'), 'muted text default');
  assert.equal(t.card, rootVar('card'), 'quest card default');
});

test('every theme stays readable: text, buttons and sidebar meet WCAG AA', () => {
  for (const name of THEME_NAMES) {
    const t = THEMES[name];
    assert.ok(ratio(t.ink, t.bg) >= 4.5, name + ': text on background, ratio ' + ratio(t.ink, t.bg).toFixed(2));
    assert.ok(ratio(t['ink-soft'], t.bg) >= 4.5, name + ': muted text on background');
    assert.ok(ratio(t.ink, t.panel2) >= 4.5, name + ': text on soft panel');
    assert.ok(ratio('#231a02', t.amber) >= 4.5, name + ': dark button text on the primary button');
    assert.ok(ratio('#ffffff', t.teal) >= 3, name + ': white text on the teal button, ratio ' + ratio('#ffffff', t.teal).toFixed(2));
    assert.ok(ratio('#f5f1e6', t.nav) >= 4.5, name + ': cream sidebar text on the dark sidebar');
    assert.ok(ratio(t['amber-d'], t.panel2) >= 4.5, name + ': dark pill text on the soft panel, ratio ' + ratio(t['amber-d'], t.panel2).toFixed(2));
  }
});

test('applyTheme sets every palette variable from the picked theme', () => {
  var setProps = {};
  var document = { documentElement: { style: { setProperty: function (k, v) { setProps[k] = v; } } } }; // eslint-disable-line no-unused-vars
  function ex() { return { theme: 'Ocean Deep' }; } // eslint-disable-line no-unused-vars
  eval([THEME_ALIAS_SRC, grabFn('themeName'), grabFn('themeOf'), grabFn('applyTheme')].join('\n') + '\n; applyTheme();');
  const t = THEMES['Ocean Deep'];
  assert.equal(setProps['--nav'], t.nav, 'sidebar follows Ocean Deep');
  assert.equal(setProps['--bg'], t.bg, 'background follows Ocean Deep');
  assert.equal(setProps['--amber'], t.amber, 'primary buttons follow Ocean Deep');
  assert.equal(setProps['--gold'], t.amber, 'gold sparkles match the primary button');
  assert.equal(setProps['--teal'], t.teal, 'teal buttons follow Ocean Deep');
  assert.equal(setProps['--panel2'], t.panel2, 'soft panels follow Ocean Deep');
  assert.equal(setProps['--line'], t.border, 'borders follow Ocean Deep');
  assert.equal(setProps['--ink'], t.ink, 'text follows Ocean Deep');
  assert.equal(setProps['--card'], t.card, 'quest cards follow Ocean Deep');
  assert.equal(setProps['--tint'], t.tint, 'terrarium tint still set');
  assert.equal(setProps['--glow'], t.glow, 'glow still set');
});

test('themeName resolves old saved names and defaults to Frog Pond', () => {
  const fns = eval([THEME_ALIAS_SRC, grabFn('themeName'), grabFn('themeOf')].join('\n') + '\n; ({ themeName, themeOf });');
  assert.equal(fns.themeName({ theme: 'Ocean Dive' }), 'Ocean Deep', 'old Ocean Dive still works');
  assert.equal(fns.themeName({ theme: 'Garden Party' }), 'Star Garden', 'old Garden Party still works');
  assert.equal(fns.themeName({ theme: 'No Such Theme' }), 'Frog Pond', 'an unknown saved theme falls back to Frog Pond');
  assert.equal(fns.themeName({}), 'Frog Pond', 'no saved theme falls back to Frog Pond');
  assert.equal(fns.themeOf({ theme: 'Sky Castle' }).nav, '#3d2b63', 'Sky Castle sidebar is deep purple');
});

test('button colours come from theme variables, not hardcoded green', () => {
  assert.ok(rootVar('teal-d') === '#2f6b3a', ':root defines the teal shadow for first paint');
  assert.ok(html.includes('.btn.teal{background:var(--teal);color:#fff;box-shadow:0 4px 0 var(--teal-d)}'), 'teal buttons and their shadow follow the theme');
  assert.ok(html.includes('.questcard .btn{background:var(--teal);color:#fff;box-shadow:0 4px 0 var(--teal-d);'), 'quest board buttons follow the theme');
  assert.ok(html.includes('.questcard .progressbar>div{background:var(--teal)}'), 'quest progress bars follow the theme');
  assert.ok(!html.includes('.questcard .btn{background:#3e8e52'), 'no hardcoded green quest button left');
});

test('semantic colours stay fixed — a theme never repaints right/wrong', () => {
  assert.equal(rootVar('green'), '#2f7a3d', 'correct-answer green untouched');
  assert.equal(rootVar('coral'), '#c0392b', 'wrong-answer coral untouched');
  assert.equal(rootVar('sky'), '#1d4ed8', 'link blue untouched');
  assert.equal(rootVar('panel'), '#ffffff', 'cards stay white for readability');
  assert.equal(rootVar('nav-ink'), '#f5f1e6', 'cream sidebar text untouched');
});

test('sidebar and bottom nav read the theme variables', () => {
  assert.ok(html.includes('.sidebar{width:228px;flex:0 0 228px;background:var(--nav);'), 'sidebar background is the theme nav colour');
  assert.ok(html.includes('.bottomnav{display:flex;position:fixed;bottom:0;left:0;right:0;background:var(--nav);'), 'mobile bottom nav is the theme nav colour');
  assert.ok(html.includes('.navbtn.active{background:var(--amber);color:#231a02}'), 'active nav item is the theme button colour');
  assert.ok(html.includes('body{font-family:"Nunito",system-ui,sans-serif;background:var(--bg);'), 'page background is the theme background');
  assert.ok(html.includes('.topbar{display:flex;align-items:center;gap:10px;padding:12px 20px;position:sticky;top:0;background:var(--bg);'), 'top bar is the theme background');
});

test('theme follows the active explorer on sign-in and on creation (2026-11-17)', () => {
  assert.ok(html.includes('DB.activeId=target.id; save(); applyTheme();'), 'door-code sign-in applies the new explorer theme');
  assert.ok(html.includes("DB.activeId=e.id; doorMode='pick'; doorCode=[]; doorLevel='P3'; save(); applyTheme();"), 'new-explorer creation applies the new explorer theme');
  const renderStart = html.indexOf('function render(){');
  const renderEnd = html.indexOf('function renderTop()', renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart, 'render() must exist');
  const renderSrc = html.slice(renderStart, renderEnd);
  assert.ok(renderSrc.includes("if(typeof applyTheme==='function')applyTheme();"), 'render() re-applies the theme on every render, so it can never go stale');
});

test('switching the active explorer changes the applied theme variables', () => {
  var setProps = {};
  var document = { documentElement: { style: { setProperty: function (k, v) { setProps[k] = v; } } } }; // eslint-disable-line no-unused-vars
  var active = { theme: 'Frog Pond' };
  function ex() { return active; } // eslint-disable-line no-unused-vars
  var src = [THEME_ALIAS_SRC, grabFn('themeName'), grabFn('themeOf'), grabFn('applyTheme')].join('\n');
  eval(src + '\n; applyTheme();');
  assert.equal(setProps['--nav'], THEMES['Frog Pond'].nav, 'first explorer gets Frog Pond');
  assert.equal(setProps['--bg'], THEMES['Frog Pond'].bg, 'first explorer background is Frog Pond');
  active = { theme: 'Ocean Deep' };
  setProps = {};
  eval(src + '\n; applyTheme();');
  assert.equal(setProps['--nav'], THEMES['Ocean Deep'].nav, 'switching explorer re-applies to Ocean Deep');
  assert.equal(setProps['--bg'], THEMES['Ocean Deep'].bg, 'switching explorer background is Ocean Deep');
  assert.notEqual(setProps['--nav'], THEMES['Frog Pond'].nav, 'the old theme does not stick');
});
