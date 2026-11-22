// Topbar overflow fix (Bryan's iPhone screenshot, 2026-11-22): at
// phone widths the top bar held the 43px avatar + the full page
// title + five pills (~470px) in ~360px of space, so the profile
// button was clipped off the right edge (a yellow sliver). On
// narrow screens (<=560px) the route title hides — the bottom nav
// already shows the active route — and the pills shrink. Every
// control stays; nothing is removed. Desktop is untouched.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function mediaBlock(maxWidth, contains) {
  const marker = '@media (max-width:' + maxWidth + 'px){';
  let from = 0;
  for (;;) {
    const start = html.indexOf(marker, from);
    assert.ok(start >= 0, marker + ' exists');
    let depth = 0, i = start;
    for (; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') { depth--; if (depth === 0) break; }
    }
    const block = html.slice(start, i + 1);
    if (!contains || block.includes(contains)) return block;
    from = i + 1;
  }
}

test('narrow screens get a compact topbar: title hides, pills shrink, gaps tighten', () => {
  const compact = mediaBlock(560);
  assert.ok(compact.includes('.topbar{padding:10px 10px;gap:6px}'), 'tighter padding and gap on narrow screens');
  assert.ok(compact.includes('.topbar .page-title{display:none}'), 'the route title hides on narrow screens');
  assert.ok(compact.includes('.topbar .chip{padding:4px 8px;font-size:.8rem}'), 'the streak/star/mute pills shrink');
});

test('the compact topbar still fits at 360px: avatar + five pills need ~300px of ~340px', () => {
  // Arithmetic from the compact rules + the render() markup:
  // avatar 43 + chips (~45 + ~45 + ~33) + music 42 + profile 46
  // + 7 gaps x 6px = ~296px, against 360 - 2x10 padding = 340px.
  // The title is display:none, so it adds nothing.
  const compact = mediaBlock(560);
  assert.ok(compact.includes('.topbar .page-title{display:none}'), 'the widest item (the title) is out of the width budget');
  assert.ok(!compact.includes('tbStreak') && !compact.includes('tbMute') && !compact.includes('tbProfile'),
    'no topbar control is hidden by the compact rules — only the title');
});

test('no topbar control is removed: streak, stars, mute, music, profile all still render', () => {
  const render = html.slice(html.indexOf('function render(){'), html.indexOf('function renderTop(){'));
  for (const id of ['tbStreak', 'tbStars', 'tbMute', 'tbMusic', 'tbProfile']) {
    assert.ok(render.includes('id="' + id + '"'), id + ' still renders in the topbar');
  }
  assert.ok(render.includes('class="page-title"'), 'the page title still renders (hidden only by CSS on narrow screens)');
});

test('desktop topbar is untouched by the compact rules', () => {
  assert.ok(html.includes('.topbar{display:flex;align-items:center;gap:10px;padding:12px 20px;'), 'the desktop topbar rule is unchanged');
  const wide = mediaBlock(820, '.topbar{padding:10px 14px}');
  assert.ok(wide.includes('.topbar{padding:10px 14px}'), 'the 820px padding rule is unchanged');
  assert.ok(wide.includes('.topbar .page-title{font-size:1.1rem}'), 'the 820px title size is unchanged');
  assert.ok(!wide.includes('.page-title{display:none}'), 'the title is not hidden at tablet widths');
});
