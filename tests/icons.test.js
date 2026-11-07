// Custom icon art (requested 2026-11-07 — the flat emoji were
// boring): glossy 3D icons in public/icons/, wired into the nav,
// game cards and quest cards, with an emoji fallback if a file ever
// fails to load.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PAGE_PATH = path.join(ROOT, 'public', 'index.html');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function extractVar(src, name) {
  const s = src.indexOf('var ' + name + '=');
  let i = src.indexOf('=', s) + 1, depth = 0, inStr = false, strCh = '', esc = false, start = i;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('no end ' + name);
}
function Q(q, o, a, c, j) { return { q: q, o: o, a: a, c: c, j: j }; }
const NAV = eval('(' + extractVar(html, 'NAV') + ')');
const GAMES = eval('(' + extractVar(html, 'GAMES') + ')');
const TOPICS = eval('(' + extractVar(html, 'TOPICS') + ')');

test('every nav item, game and quest has a custom icon file that exists', () => {
  const wanted = [];
  NAV.forEach(function (n) { wanted.push(['nav ' + n[0], n[3]]); });
  GAMES.forEach(function (g) { wanted.push(['game ' + g.id, g.img]); });
  TOPICS.forEach(function (t) { wanted.push(['quest ' + t.id, t.img]); });
  assert.equal(wanted.length, 33, '10 nav + 9 games + 14 quests');
  for (const [label, file] of wanted) {
    assert.ok(file && file.startsWith('icons/') && file.endsWith('.webp'), label + ' points at an icons/ webp file, got ' + file);
    const full = path.join(ROOT, 'public', file);
    assert.ok(fs.existsSync(full), label + ' file exists: ' + file);
    assert.ok(fs.statSync(full).size > 10000, label + ' file is a real image, not an empty stub');
  }
  const onDisk = fs.readdirSync(ICONS_DIR).filter(function (f) { return f.endsWith('.webp'); });
  assert.equal(onDisk.length, 33, 'exactly the 33 wired icons on disk, no strays');
});

test('ic() renders the image with an emoji fallback and the right sizes', () => {
  const start = html.indexOf('function ic(src,emo,cls){');
  assert.ok(start >= 0, 'ic helper exists');
  const fn = eval('(' + html.slice(start, html.indexOf('\n', start)) + ')');
  const out = fn('icons/nav-home.webp', '🏠', 'navic');
  assert.ok(out.includes('<img class="navic" src="icons/nav-home.webp"'), 'the image renders with its size class');
  assert.ok(out.includes("onerror=\"this.outerHTML='🏠'\""), 'a missing file falls back to the emoji');
  assert.equal(fn(null, '🏠', 'navic'), '🏠', 'no file at all: the emoji alone');
  assert.ok(html.includes('.navic{width:28px'), 'nav tiles are sized');
  assert.ok(html.includes('.gicon{width:72px'), 'game-card icons are sized');
  assert.ok(html.includes('.qicon img{width:46px'), 'quest-card tiles are sized');
  assert.ok(html.includes('.ic-sm{width:1.35em'), 'inline icons are sized');
});

test('the nav, game cards and quest cards show the custom icons, not bare emoji', () => {
  const render = html.slice(html.indexOf('var navBtns='), html.indexOf('var btm=') + 400);
  assert.ok(render.includes("ic(n[3],n[1],'navic')"), 'both navs render the custom icon');
  assert.ok(!render.includes("'<span class=\"nic\">'+n[1]+'</span>'"), 'no bare emoji left in the nav');
  const gameCard = html.slice(html.indexOf('function playHTML(){'));
  assert.ok(gameCard.includes("ic(g.img,g.e,'gicon')"), 'the game-card band shows the custom icon');
  const questCard = html.slice(html.indexOf('function learnHTML(){'), html.indexOf('function learnHTML(){') + 2500);
  assert.ok(questCard.includes("ic(t.img,t.icon,'qic')"), 'the quest card shows the custom icon');
  assert.ok(html.includes("ic(g.img,g.e,'ic-sm')"), 'game heroes and leaderboard headers use the custom icon');
  assert.ok(html.includes("ic(t.img,t.icon,'ic-sm')"), 'quest heroes and leaderboard headers use the custom icon');
});
