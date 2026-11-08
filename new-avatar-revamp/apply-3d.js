// Apply the round-3 3D avatar revamp to a copy of the learning-app
// project. Usage: node new-avatar-revamp/apply-3d.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-avatar-revamp/design-3d.md.
// Round 3 replaces ONLY the flat round-2 animal art with 3D-shaded
// art + idle animation (bob, blink, one signature motion per
// animal). Same public API, same geometry, same data model
// (e.look={color,accessory}), same 5 tiny accessories, no hair,
// same big top-left avatar. The round-2 files stay as the fallback.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply-3d.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const DRESSUP_TEST = path.join(root, 'tests', 'dressup-greg.test.js');
const NEW_CODE = fs.readFileSync(path.join(__dirname, 'new-avatar-3d-code.js'), 'utf8');
const NEW_TEST = fs.readFileSync(path.join(__dirname, 'tests-dressup-r3.test.js'), 'utf8');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('av-bob') >= 0) throw new Error('already applied: av-bob exists');
if (html.indexOf('AVATAR_3D_CSS') >= 0) throw new Error('already applied: AVATAR_3D_CSS exists');
if (html.indexOf('AVATAR_ANIMALS=') < 0) throw new Error('wrong base: AVATAR_ANIMALS= missing — expected the round-2 avatar block');

// 1. Replace the whole round-2 avatar block (FULL-BODY LOOK round 2
//    through the end of avatarLookHTML) with the round-3 renderer
//    (same API, 3D-shaded art + AVATAR_3D_CSS at the end).
const startMarker = '/* ============================================================\n   FULL-BODY LOOK (round 2, 2026-11-08 — the parent\'s own brief,';
const start = html.indexOf(startMarker);
if (start < 0) throw new Error('anchor not found: FULL-BODY LOOK round-2 block start');
const endMarker = 'function openLookModal(){';
const end = html.indexOf(endMarker, start);
if (end < 0) throw new Error('anchor not found: openLookModal after avatar block');
const oldBlock = html.slice(start, end);
if (!oldBlock.includes('function avatarLookHTML(')) throw new Error('old block does not contain avatarLookHTML');
if (!oldBlock.includes('var LOOK_COLORS=')) throw new Error('old block does not contain LOOK_COLORS');
if (!oldBlock.includes('AVATAR_ANIMALS=')) throw new Error('old block does not contain AVATAR_ANIMALS');
if (!oldBlock.includes('AVATAR_ACCS=')) throw new Error('old block does not contain AVATAR_ACCS');
html = html.slice(0, start) + NEW_CODE.trimEnd() + '\n\n' + html.slice(end);

// 2. Insert the idle-life CSS into the page's <style>, right after
//    Pip's own reduced-motion rule (same language, same off-switch).
//    The CSS text is extracted from the AVATAR_3D_CSS template
//    literal in the new code, so the <style> and the variable can
//    never drift — the apply derives one from the other.
const cssVarStart = NEW_CODE.indexOf('var AVATAR_3D_CSS=`');
if (cssVarStart < 0) throw new Error('AVATAR_3D_CSS not found in new code');
const cssOpen = NEW_CODE.indexOf('`', cssVarStart);
const cssClose = NEW_CODE.indexOf('`', cssOpen + 1);
if (cssOpen < 0 || cssClose < 0) throw new Error('AVATAR_3D_CSS template literal not closed');
const cssText = NEW_CODE.slice(cssOpen + 1, cssClose);
if (!cssText.includes('@keyframes avBob') || !cssText.includes('@keyframes avBlink')) throw new Error('AVATAR_3D_CSS does not contain the idle-life keyframes');
const cssAnchor = '@media (prefers-reduced-motion: reduce){.otter3d,.otter3d .eye,.otter3d .pawwave,.otter3d .leafsway,.otter3d .earl,.otter3d .earr,.otter3d .tongue{animation:none}}';
html = replaceOnce(html, cssAnchor,
  cssAnchor + '\n/* Avatar characters (round 3, 3D + idle life) — same source as AVATAR_3D_CSS in the avatar block below. */\n' + cssText,
  'otter reduced-motion rule (CSS insertion point)');

// Sanity: the 3D markers are in, the flat round-2 markers are out.
if (!html.includes('class="av3d"')) throw new Error('sanity: av3d class missing after apply');
if (!html.includes('@keyframes avBob')) throw new Error('sanity: avBob keyframes missing after apply');
if (!html.includes('AVATAR_3D_CSS')) throw new Error('sanity: AVATAR_3D_CSS missing after apply');
if (html.includes('LOOK_HAIR') || html.includes('lookHairPick') || html.includes("look.hair")) throw new Error('sanity: hair references present after apply');

fs.writeFileSync(PAGE, html);

// 3. Replace the dress-up tests with the round-3 suite (same frog
//    tests, same merge/modal/top-left tests, rewritten avatar tests
//    for the 3D structure). Refuse unless the file is the round-2
//    base we expect.
let test = fs.readFileSync(DRESSUP_TEST, 'utf8');
if (!test.includes("pinkFills >= 6")) throw new Error('wrong test base: expected round-2 dressup-greg.test.js');
if (test.includes('AVATAR_3D_CSS')) throw new Error('already applied: tests already round-3');
fs.writeFileSync(DRESSUP_TEST, NEW_TEST);

console.log('applied round-3 3D avatar revamp to ' + root);
