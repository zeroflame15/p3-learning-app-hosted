// 3D icons for the gap-fill topics + the Jokes nav item (2026-11-09).
// The 17 gap-fill topics (2026-11-08) and the Jokes nav item used to
// fall back to emoji (img:''); they now have glossy 3D art in
// public/icons/, wired the same way as the 14 original topics. The
// emoji stays as the fallback if a file ever fails to load.
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
const TOPICS = eval('(' + extractVar(html, 'TOPICS') + ')');

// The 17 gap-fill topics: every Learn topic that is not one of the
// original 14. Each maps to its 3D icon file in public/icons/.
const GAP_FILL = [
  'math-length', 'math-time', 'math-area', 'math-angles', 'math-bargraphs',
  'eng-spelling', 'eng-visual',
  'sci-classification', 'sci-materials',
  'chi-char', 'chi-picword', 'chi-collocation', 'chi-sequencing',
  'chi-sentence', 'chi-reading', 'chi-composition', 'chi-oral',
];

function assertRealTransparentWebp(label, rel) {
  assert.ok(rel.startsWith('icons/') && rel.endsWith('.webp'), label + ' points at an icons/ webp file, got ' + rel);
  const full = path.join(ROOT, 'public', rel);
  assert.ok(fs.existsSync(full), label + ' file exists: ' + rel);
  assert.ok(fs.statSync(full).size > 3000, label + ' file is a real image, not an empty stub');
  const buf = fs.readFileSync(full);
  assert.ok(buf.includes(Buffer.from('VP8X')), label + ' is an extended WebP: ' + rel);
  assert.ok(buf.includes(Buffer.from('ALPH')), label + ' has a real alpha channel (transparent background): ' + rel);
}

test('every gap-fill topic resolves to its 3D icon', () => {
  assert.equal(GAP_FILL.length, 17, 'expected 17 gap-fill topics');
  for (const id of GAP_FILL) {
    const t = TOPICS.find((x) => x.id === id);
    assert.ok(t, 'topic exists in TOPICS: ' + id);
    assert.equal(t.img, 'icons/topic-' + id + '.webp', id + ' wires its 3D icon');
    assertRealTransparentWebp('quest ' + id, t.img);
    // The emoji stays on the topic as the fallback if the file fails.
    assert.ok(t.icon, id + ' keeps its emoji fallback');
  }
});

test('the Jokes nav item resolves to its 3D icon, and its hero too', () => {
  const jokes = NAV.find((n) => n[0] === 'jokes');
  assert.ok(jokes, 'Jokes is in NAV');
  assert.equal(jokes[3], 'icons/nav-jokes.webp', 'Jokes wires its 3D icon');
  assertRealTransparentWebp('nav jokes', jokes[3]);
  assert.ok(jokes[1], 'Jokes keeps its emoji fallback');
  assert.ok(html.includes("pageHero('icons/nav-jokes.webp','😂','Classroom Jokes'"),
    'the Jokes section top shows the 3D art, not the flat emoji');
});

test('the emoji fallback still works when an icon is missing', () => {
  const start = html.indexOf('function ic(src,emo,cls){');
  assert.ok(start >= 0, 'ic helper exists');
  const ic = eval('(' + html.slice(start, html.indexOf('\n', start)) + ')');
  // A file that fails to load falls back to the emoji at render time.
  const out = ic('icons/topic-math-length.webp', '📏', 'qic');
  assert.ok(out.includes("onerror=\"this.outerHTML='📏'\""), 'a missing file falls back to the emoji');
  // No file at all: the emoji alone.
  assert.equal(ic(null, '📏', 'qic'), '📏', 'no file: the emoji alone');
  assert.equal(ic('', '😂', 'navic'), '😂', 'empty file: the emoji alone');
});
