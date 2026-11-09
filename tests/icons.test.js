// Custom icon art (requested 2026-11-07 — the flat emoji were
// boring; glow-up 2026-11-07 — bigger, floating 3D art, no square
// frame): glossy 3D objects on TRANSPARENT backgrounds in
// public/icons/, wired into the nav, game cards, quest cards, section
// heroes and game/quiz flowheroes, with an emoji fallback if a file
// ever fails to load.
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

test('every nav item, game and quest has an icon: a custom file, or an emoji fallback', () => {
  const wanted = [];
  NAV.forEach(function (n) { wanted.push(['nav ' + n[0], n[3], n[1]]); });
  GAMES.forEach(function (g) { wanted.push(['game ' + g.id, g.img]); });
  TOPICS.forEach(function (t) { wanted.push(['quest ' + t.id, t.img, t.icon]); });
  assert.equal(wanted.length, 51, '11 nav + 9 games + 31 quests');
  let wired = 0, fallback = 0;
  for (const [label, file, emo] of wanted) {
    if (file) {
      // A wired icon: must be a real transparent webp on disk.
      wired++;
      assert.ok(file.startsWith('icons/') && file.endsWith('.webp'), label + ' points at an icons/ webp file, got ' + file);
      const full = path.join(ROOT, 'public', file);
      assert.ok(fs.existsSync(full), label + ' file exists: ' + file);
      // Transparent single-object art is smaller than the old mint tiles.
      assert.ok(fs.statSync(full).size > 3000, label + ' file is a real image, not an empty stub');
      // The art floats on transparency: an extended WebP (VP8X) with an
      // ALPH chunk. A flat white or mint background would have no ALPH.
      const buf = fs.readFileSync(full);
      assert.ok(buf.includes(Buffer.from('VP8X')), label + ' is an extended WebP: ' + file);
      assert.ok(buf.includes(Buffer.from('ALPH')), label + ' has a real alpha channel (transparent background): ' + file);
    } else {
      // img:'' — ic() falls back to the emoji, which renders fine.
      // Gap-fill (2026-11-09): the 17 gap-fill topics and the Jokes
      // nav item now have custom 3D art; img:'' would only remain
      // if an icon file were ever deleted.
      fallback++;
      assert.ok(emo, label + ' has an emoji fallback icon');
    }
  }
  assert.equal(wired, 51, '51 wired icons: 11 nav + 9 games + 31 quests');
  assert.equal(fallback, 0, '0 emoji-fallback entries — every nav, game and quest has 3D art');
  const onDisk = fs.readdirSync(ICONS_DIR).filter(function (f) { return f.endsWith('.webp'); });
  assert.equal(onDisk.length, 51, 'exactly the 51 wired icons on disk, no strays');
});

test('ic() renders the image with an emoji fallback and the right sizes', () => {
  const start = html.indexOf('function ic(src,emo,cls){');
  assert.ok(start >= 0, 'ic helper exists');
  const fn = eval('(' + html.slice(start, html.indexOf('\n', start)) + ')');
  const out = fn('icons/nav-home.webp', '🏠', 'navic');
  assert.ok(out.includes('<img class="navic" src="icons/nav-home.webp"'), 'the image renders with its size class');
  assert.ok(out.includes("onerror=\"this.outerHTML='🏠'\""), 'a missing file falls back to the emoji');
  assert.equal(fn(null, '🏠', 'navic'), '🏠', 'no file at all: the emoji alone');
  assert.ok(html.includes('.navic{width:40px'), 'nav icons are big');
  assert.ok(html.includes('.bottomnav .navic{width:36px'), 'bottom-nav icons are big');
  assert.ok(html.includes('.gicon{width:110px'), 'game-card icons are big');
  assert.ok(html.includes('.qicon img{width:72px'), 'quest-card icons are big');
  assert.ok(html.includes('.ic-sm{width:2em'), 'inline icons are big');
  assert.ok(html.includes('.heroart{width:120px'), 'hero art is the biggest');
  // Floating art: no square frame anywhere on the icon classes.
  for (const sel of ['.navic{', '.gicon{', '.qicon img{', '.ic-sm{', '.heroart{']) {
    const m = html.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^}]*\\}'));
    assert.ok(m, 'rule exists: ' + sel);
    assert.ok(!m[0].includes('border-radius'), 'no square frame on ' + sel);
    assert.ok(!m[0].includes('background:'), 'no tile background on ' + sel);
  }
  assert.ok(html.includes('filter:drop-shadow'), 'the 3D lift comes from a drop-shadow');
});

test('the nav, game cards and quest cards show the custom icons, not bare emoji', () => {
  const render = html.slice(html.indexOf('var navBtns='), html.indexOf('var btm=') + 400);
  assert.ok(render.includes("ic(n[3],n[1],'navic')"), 'both navs render the custom icon');
  assert.ok(!render.includes("'<span class=\"nic\">'+n[1]+'</span>'"), 'no bare emoji left in the nav');
  const gameCard = html.slice(html.indexOf('function playHTML(){'));
  assert.ok(gameCard.includes("ic(g.img,g.e,'gicon')"), 'the game-card band shows the custom icon');
  const questCard = html.slice(html.indexOf('function learnHTML(){'), html.indexOf('function learnHTML(){') + 2500);
  assert.ok(questCard.includes("ic(t.img,t.icon,'qic')"), 'the quest card shows the custom icon');
  assert.ok(html.includes("ic(g.img,g.e,'ic-sm')"), 'game pills and leaderboard headers use the custom icon');
  assert.ok(html.includes("ic(t.img,t.icon,'ic-sm')"), 'quest pills and leaderboard headers use the custom icon');
});

test('every section top shows the same big artwork, not the old flat emoji', () => {
  const sections = [
    ['Learn', 'icons/nav-learn.webp', '📚'],
    ['Play', 'icons/nav-play.webp', '✨'],
    ['Trivia', 'icons/nav-trivia.webp', '🎲'],
    ['Friends', 'icons/nav-friends.webp', '👥'],
    ['Ask Pip', 'icons/nav-ask.webp', '💬'],
    ['Critter Lab', 'icons/nav-critter.webp', '🐸'],
    ['Treasure', 'icons/nav-treasure.webp', '💎'],
    ['Vibe', 'icons/nav-vibe.webp', '🎵'],
    ['Jokes', 'icons/nav-jokes.webp', '😂'],
    ['Create', 'icons/nav-create.webp', '🎨'],
  ];
  for (const [name, art, emo] of sections) {
    assert.ok(html.includes("pageHero('" + art + "','" + emo + "'"), name + ' section top shows its artwork');
    assert.ok(!html.includes("pageHero('" + emo + "'"), name + ' section top no longer starts with the flat emoji');
  }
  assert.ok(html.includes("function pageHero(art, emo, title, sub, stat)"), 'pageHero takes artwork plus an emoji fallback');
  assert.ok(html.includes("ic(art,emo,'heroart')"), 'pageHero renders the artwork big');
  // The hero icon tile is gone too: no dark square behind the art.
  const hero = html.match(/\.pagehero \.heroicon\{[^}]*\}/);
  assert.ok(hero, 'heroicon rule exists');
  assert.ok(hero[0].includes('background:transparent'), 'the section-top art sits on transparency, not a tile');
  assert.ok(!hero[0].includes('background:rgba'), 'no dark tile behind the section-top art');
  assert.ok(!hero[0].includes('border-radius'), 'no rounded square behind the section-top art');
});

test('game, quiz and warm-up flowheroes show the big artwork, not Pip or flat emoji', () => {
  assert.ok(html.includes("ic(g.img,g.e,'heroart')"), 'game flowheroes show the game artwork big');
  assert.ok(html.includes("ic(t.img,t.icon,'heroart')"), 'quiz and warm-up flowheroes show the topic artwork big');
  assert.ok(!html.includes('🃏 Memory Match</b>'), 'no flat 🃏 in the Memory flowhero title');
  assert.ok(!html.includes('🧩 Crossword Quest</b>'), 'no flat 🧩 in the Crossword flowhero title');
  assert.ok(!html.includes('🚗 Exit Parking</b>'), 'no flat 🚗 in the Parking flowhero title');
  assert.ok(!html.includes('🔥 Brain warm-up</b>'), 'no flat 🔥 in the warm-up flowhero title');
});
