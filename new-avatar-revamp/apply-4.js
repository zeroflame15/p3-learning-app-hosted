// Apply the round-4 avatar revamp to a copy of the learning-app
// project. Usage: node new-avatar-revamp/apply-4.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-avatar-revamp/design-4.md.
// Round 4 does three things:
//  1. Replaces ONLY the round-3 animal art with the round-4
//     renderer (realistic fur, texture, depth; the frog,
//     butterfly, turtle and panda reworked; a real butterfly
//     flap and a head-tilt nod). Same public API, same data
//     model (e.look={color,accessory}), same 5 tiny accessories,
//     no hair, same big top-left avatar.
//  2. Fixes the editor so Cancel reverts: the editor works on a
//     DRAFT copy of the look and only commits it on "Save my
//     look". Picks never save. (Round-3 bug, found live.)
//  3. Replaces the round-3 idle-life CSS in the page <style> with
//     the round-4 CSS (same source as AVATAR_3D_CSS, so the two
//     can never drift). The round-3 files stay as the fallback.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply-4.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const DRESSUP_TEST = path.join(root, 'tests', 'dressup-greg.test.js');
const NEW_CODE = fs.readFileSync(path.join(__dirname, 'new-avatar-4-code.js'), 'utf8');
const NEW_MODAL = fs.readFileSync(path.join(__dirname, 'look-modal-4.js'), 'utf8');
const NEW_TEST = fs.readFileSync(path.join(__dirname, 'tests-dressup-r4.test.js'), 'utf8');
const NEW_DRESSUP_TEST = fs.readFileSync(path.join(__dirname, 'dressup-4.test.js'), 'utf8');
const NEW_MODAL_TEST = fs.readFileSync(path.join(__dirname, 'look-modal-4.test.js'), 'utf8');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('av-fur') >= 0) throw new Error('already applied: av-fur exists');
if (html.indexOf('avFlutterL') >= 0) throw new Error('already applied: avFlutterL exists');
if (html.indexOf('var draft={face:e.face') >= 0) throw new Error('already applied: draft editor exists');
if (html.indexOf('AVATAR_ANIMALS=') < 0) throw new Error('wrong base: AVATAR_ANIMALS= missing — expected the round-3 avatar block');

// 1. Replace the whole round-3 avatar block (FULL-BODY LOOK round 3
//    through the end of avatarLookHTML + AVATAR_3D_CSS) with the
//    round-4 renderer.
const startMarker = '/* ============================================================\n   FULL-BODY LOOK — ROUND 3 (3D, Pip-style, 2026-11-08): the same';
const start = html.indexOf(startMarker);
if (start < 0) throw new Error('anchor not found: FULL-BODY LOOK round-3 block start');
const endMarker = 'function openLookModal(){';
const end = html.indexOf(endMarker, start);
if (end < 0) throw new Error('anchor not found: openLookModal after avatar block');
const oldBlock = html.slice(start, end);
if (!oldBlock.includes('function avatarLookHTML(')) throw new Error('old block does not contain avatarLookHTML');
if (!oldBlock.includes('var LOOK_COLORS=')) throw new Error('old block does not contain LOOK_COLORS');
if (!oldBlock.includes('AVATAR_ANIMALS=')) throw new Error('old block does not contain AVATAR_ANIMALS');
if (!oldBlock.includes('AVATAR_ACCS=')) throw new Error('old block does not contain AVATAR_ACCS');
if (!oldBlock.includes('var AVATAR_3D_CSS=')) throw new Error('old block does not contain AVATAR_3D_CSS');
html = html.slice(0, start) + NEW_CODE.trimEnd() + '\n\n' + html.slice(end);

// 2. Replace openLookModal with the draft-based editor (Cancel
//    reverts). The modal runs from openLookModal to openModal.
const modalStart = html.indexOf('function openLookModal(){');
if (modalStart < 0) throw new Error('anchor not found: openLookModal');
const modalEndMarker = 'function openModal(html){';
const modalEnd = html.indexOf(modalEndMarker, modalStart);
if (modalEnd < 0) throw new Error('anchor not found: openModal after openLookModal');
const oldModal = html.slice(modalStart, modalEnd);
if (!oldModal.includes('refreshLookPreview')) throw new Error('old modal does not contain refreshLookPreview');
if (!oldModal.includes("document.getElementById('lkSave')")) throw new Error('old modal does not contain lkSave');
if (!oldModal.includes('live.face=f')) throw new Error('old modal is not the round-3 live-save version');
if ((oldModal.match(/save\(\);/g) || []).length < 5) throw new Error('old modal does not save on tap as expected (round-3 base)');
html = html.slice(0, modalStart) + NEW_MODAL.trimEnd() + '\n' + html.slice(modalEnd);

// 3. Replace the round-3 idle-life CSS in the page's <style> with
//    the round-4 CSS, extracted from the AVATAR_3D_CSS template
//    literal in the new code (same source, so they never drift).
const cssVarStart = NEW_CODE.indexOf('var AVATAR_3D_CSS=`');
if (cssVarStart < 0) throw new Error('AVATAR_3D_CSS not found in new code');
const cssOpen = NEW_CODE.indexOf('`', cssVarStart);
const cssClose = NEW_CODE.indexOf('`', cssOpen + 1);
if (cssOpen < 0 || cssClose < 0) throw new Error('AVATAR_3D_CSS template literal not closed');
const cssText = NEW_CODE.slice(cssOpen + 1, cssClose);
if (!cssText.includes('@keyframes avFlutterL') || !cssText.includes('@keyframes avFlutterR') || !cssText.includes('@keyframes avNod')) throw new Error('AVATAR_3D_CSS does not contain the round-4 keyframes');
const cssStartMarker = '/* Avatar characters (round 3, 3D + idle life) — same source as AVATAR_3D_CSS in the avatar block below. */';
const cssStart = html.indexOf(cssStartMarker);
if (cssStart < 0) throw new Error('anchor not found: round-3 CSS comment in <style>');
const cssEndMarker = '@media (prefers-reduced-motion: reduce){.av3d .av-bob,.av3d .av-blink,.av3d .av-earwig,.av3d .av-sway,.av3d .av-flutter-l,.av3d .av-flutter-r,.av3d .av-hop,.av3d .av-nod,.av3d .av-tongue,.av3d .av-flop{animation:none}}';
const cssEnd = html.indexOf(cssEndMarker, cssStart);
if (cssEnd < 0) throw new Error('anchor not found: round-3 CSS reduced-motion rule in <style>');
const cssEndPos = cssEnd + cssEndMarker.length;
html = html.slice(0, cssStart)
  + '/* Avatar characters (round 4, realistic fur + idle life) — same source as AVATAR_3D_CSS in the avatar block below. */\n'
  + cssText
  + html.slice(cssEndPos);

// Sanity: the round-4 markers are in, the round-3-only markers are out.
if (!html.includes('class="av3d"')) throw new Error('sanity: av3d class missing after apply');
if (!html.includes('@keyframes avFlutterL')) throw new Error('sanity: avFlutterL keyframes missing after apply');
if (!html.includes('@keyframes avFlutterR')) throw new Error('sanity: avFlutterR keyframes missing after apply');
if (!html.includes('@keyframes avBob')) throw new Error('sanity: avBob keyframes missing after apply');
if (!html.includes('AVATAR_3D_CSS')) throw new Error('sanity: AVATAR_3D_CSS missing after apply');
if (!html.includes('var draft={face:e.face')) throw new Error('sanity: draft editor missing after apply');
if (html.includes('@keyframes avFlutter{')) throw new Error('sanity: old avFlutter keyframes still present after apply');
if (html.includes('animation:avFlutter 1.6s')) throw new Error('sanity: old flutter rule still present after apply');
if (html.includes('FULL-BODY LOOK — ROUND 3')) throw new Error('sanity: round-3 avatar block still present after apply');
if (html.includes('Avatar characters (round 3,')) throw new Error('sanity: round-3 CSS comment still present after apply');
if (html.includes('LOOK_HAIR') || html.includes('lookHairPick') || html.includes("look.hair")) throw new Error('sanity: hair references present after apply');
const newModal = html.slice(html.indexOf('function openLookModal(){'), html.indexOf('function openModal(html){'));
if ((newModal.match(/save\(\);/g) || []).length !== 1) throw new Error('sanity: the new editor must save exactly once (Save my look)');

fs.writeFileSync(PAGE, html);

// 4. Replace the dress-up tests with the round-4 suite (same frog
//    tests, same merge/top-left tests, rewritten avatar tests for
//    the round-4 art, draft-editor tests, and the focus-four +
//    fur/texture tests). Refuse unless the file is the round-3
//    base we expect.
let test = fs.readFileSync(DRESSUP_TEST, 'utf8');
if (!test.includes('ROUND 3 (3D, Pip-style')) throw new Error('wrong test base: expected round-3 dressup-greg.test.js');
if (test.includes('ROUND 4 (realistic fur')) throw new Error('already applied: tests already round-4');
fs.writeFileSync(DRESSUP_TEST, NEW_TEST);

// 5. Replace the two other test files that lock in the round-3
//    live-save modal behaviour (dressup.test.js, look-modal.test.js)
//    with their round-4 draft versions. Same test counts, same
//    unaffected tests; only the pick-handler expectations change.
const DRESSUP2_TEST = path.join(root, 'tests', 'dressup.test.js');
const MODAL_TEST = path.join(root, 'tests', 'look-modal.test.js');
let test2 = fs.readFileSync(DRESSUP2_TEST, 'utf8');
if (!test2.includes('animal tap sets face + lookAt on the live explorer')) throw new Error('wrong test base: expected round-3 dressup.test.js');
if (test2.includes('draft.face=')) throw new Error('already applied: dressup.test.js already round-4');
fs.writeFileSync(DRESSUP2_TEST, NEW_DRESSUP_TEST);
let test3 = fs.readFileSync(MODAL_TEST, 'utf8');
if (!test3.includes('glow/badge taps and Save resolve the live explorer fresh')) throw new Error('wrong test base: expected round-3 look-modal.test.js');
if (test3.includes('draft.glow=')) throw new Error('already applied: look-modal.test.js already round-4');
fs.writeFileSync(MODAL_TEST, NEW_MODAL_TEST);

console.log('applied round-4 avatar revamp to ' + root);
