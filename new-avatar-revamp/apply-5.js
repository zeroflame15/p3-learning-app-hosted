// Apply the round-5 avatar revamp to a copy of the learning-app
// project. Usage: node new-avatar-revamp/apply-5.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-avatar-revamp/design-5.md.
// Round 5 does five things:
//  1. Replaces ONLY the round-4 animal art with the round-5
//     renderer (25 flat kawaii animals from the reference sheet,
//     no colour option, no accessories, custom background —
//     shape × colour × pattern × effect, incl. three animated
//     effects — ground shadow, tap-to-play). Same public API,
//     same data model (e.look, lookAt), same draft editor, same
//     big top-left avatar. The otter and butterfly are gone; a
//     stored otter/butterfly face falls back to the chick.
//  2. Replaces openLookModal with the round-5 editor: the colour
//     row is gone, a "My background" picker (shape × colour ×
//     pattern × effect) joins the draft. Cancel still reverts.
//  3. Replaces the round-4 idle-life CSS in the page <style> with
//     the round-5 CSS (same source as AVATAR_5_CSS, so the two
//     can never drift). The round-4 files stay as the fallback.
//  4. New explorers default to the chick with a plain mint circle
//     background; the Grand Door explorer tile shows the character
//     on its background (56px); the race-lane fallback and the Ask
//     Pip avatar answer follow the chick.
//  5. Replaces the three dress-up test files with the round-5
//     suite (same frog tests, same merge/top-left tests,
//     rewritten avatar tests for the flat art, background tests,
//     pattern / animated-effect / tap-to-play tests, and the
//     draft-editor tests).
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply-5.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const DRESSUP_TEST = path.join(root, 'tests', 'dressup-greg.test.js');
const NEW_CODE = fs.readFileSync(path.join(__dirname, 'new-avatar-5-code.js'), 'utf8');
const NEW_MODAL = fs.readFileSync(path.join(__dirname, 'look-modal-5.js'), 'utf8');
const NEW_TEST = fs.readFileSync(path.join(__dirname, 'tests-dressup-r5.test.js'), 'utf8');
const NEW_DRESSUP_TEST = fs.readFileSync(path.join(__dirname, 'dressup-5.test.js'), 'utf8');
const NEW_MODAL_TEST = fs.readFileSync(path.join(__dirname, 'look-modal-5.test.js'), 'utf8');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('class="av5"') >= 0) throw new Error('already applied: av5 class exists');
if (html.indexOf('LOOK_BG_SHAPES') >= 0) throw new Error('already applied: LOOK_BG_SHAPES exists');
if (html.indexOf('AVATAR_5_CSS') >= 0) throw new Error('already applied: AVATAR_5_CSS exists');
if (html.indexOf('bgShapePick') >= 0) throw new Error('already applied: bgShapePick exists');
if (html.indexOf('FULL-BODY LOOK — ROUND 4') < 0) throw new Error('wrong base: expected the round-4 avatar block');
if (html.indexOf('AVATAR_ANIMALS=') < 0) throw new Error('wrong base: AVATAR_ANIMALS= missing — expected the round-4 avatar block');

// 1. Replace the whole round-4 avatar block (FULL-BODY LOOK round 4
//    through the end of avatarLookHTML + AVATAR_3D_CSS) with the
//    round-5 renderer.
const startMarker = '/* ============================================================\n   FULL-BODY LOOK — ROUND 4 (realistic fur, texture, depth,';
const start = html.indexOf(startMarker);
if (start < 0) throw new Error('anchor not found: FULL-BODY LOOK round-4 block start');
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

// 2. Replace openLookModal with the round-5 editor (no colour row,
//    background picker joins the draft). The modal runs from
//    openLookModal to openModal.
const modalStart = html.indexOf('function openLookModal(){');
if (modalStart < 0) throw new Error('anchor not found: openLookModal');
const modalEndMarker = 'function openModal(html){';
const modalEnd = html.indexOf(modalEndMarker, modalStart);
if (modalEnd < 0) throw new Error('anchor not found: openModal after openLookModal');
const oldModal = html.slice(modalStart, modalEnd);
if (!oldModal.includes('refreshLookPreview')) throw new Error('old modal does not contain refreshLookPreview');
if (!oldModal.includes("document.getElementById('lkSave')")) throw new Error('old modal does not contain lkSave');
if (!oldModal.includes('live.look={color:draft.look.color')) throw new Error('old modal is not the round-4 draft version');
if (!oldModal.includes('Animal colour')) throw new Error('old modal does not contain the Animal colour section to remove');
if ((oldModal.match(/save\(\);/g) || []).length !== 1) throw new Error('old modal does not save exactly once (round-4 base)');
html = html.slice(0, modalStart) + NEW_MODAL.trimEnd() + '\n' + html.slice(modalEnd);

// 3. Replace the round-4 idle-life CSS in the page's <style> with
//    the round-5 CSS, extracted from the AVATAR_5_CSS array in the
//    new code (same source, so they never drift).
const cssArrStart = NEW_CODE.indexOf('var AVATAR_5_CSS=[');
if (cssArrStart < 0) throw new Error('AVATAR_5_CSS not found in new code');
const cssArrEnd = NEW_CODE.indexOf('].join', cssArrStart);
if (cssArrEnd < 0) throw new Error('AVATAR_5_CSS array not closed');
const cssText = eval(NEW_CODE.slice(cssArrStart + 'var AVATAR_5_CSS='.length, cssArrEnd + 1)).join('\n');
if (!cssText.includes('@keyframes av5Bob') || !cssText.includes('@keyframes av5Blink') || !cssText.includes('@keyframes av5Twinkle') || !cssText.includes('@keyframes av5Play') || !cssText.includes('@keyframes av5Bub') || !cssText.includes('@keyframes av5Pet')) throw new Error('AVATAR_5_CSS does not contain the round-5 keyframes');
const cssStartMarker = '/* Avatar characters (round 4, realistic fur + idle life) — same source as AVATAR_3D_CSS in the avatar block below. */';
const cssStart = html.indexOf(cssStartMarker);
if (cssStart < 0) throw new Error('anchor not found: round-4 CSS comment in <style>');
const cssEndMarker = '@media (prefers-reduced-motion: reduce){.av3d .av-bob,.av3d .av-blink,.av3d .av-earwig,.av3d .av-sway,.av3d .av-flutter-l,.av3d .av-flutter-r,.av3d .av-hop,.av3d .av-nod,.av3d .av-tongue,.av3d .av-flop{animation:none}}';
const cssEnd = html.indexOf(cssEndMarker, cssStart);
if (cssEnd < 0) throw new Error('anchor not found: round-4 CSS reduced-motion rule in <style>');
const cssEndPos = cssEnd + cssEndMarker.length;
html = html.slice(0, cssStart)
  + '/* Avatar characters (round 5, flat kawaii + idle life) — same source as AVATAR_5_CSS in the avatar block below. */\n'
  + cssText
  + html.slice(cssEndPos);

// 4. New explorers default to the chick with a plain mint circle
//    background (the otter is gone — it is not on the sheet).
html = replaceOnce(html, "face:'🦦', glow:'#ffb020', badge:'⭐', look:{color:'',accessory:''}", "face:'🐤', glow:'#ffb020', badge:'⭐', look:{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}}", 'newExplorer default look');
// 5. The Grand Door explorer tile shows the character on its
//    background, not the bare face emoji.
html = replaceOnce(html, '<span class="face">\'+e.face+\'</span>', '<span class="face" style="line-height:0">\'+avatarLookHTML(e.face,e.look,e.glow,56)+\'</span>', 'Grand Door explorer chip');
// 6. The Ask Pip avatar answer: pick a background (shape,
//    colour, pattern, effect), not a body colour or accessory —
//    and tap the animal to see it play; the leading emoji is the
//    chick now.
html = replaceOnce(html, 'pick a body colour and pick an accessory — watch the preview change!', 'pick a background — shape, colour, pattern and effect — watch the preview change! Tap your animal and it jumps for joy! 🎉', 'pipHelp avatar answer');
html = replaceOnce(html, 'Changing your look is fun! 🦦', 'Changing your look is fun! 🐤', 'pipHelp avatar emoji');
// 7. The race-lane fallback emoji is the chick now.
html = replaceOnce(html, "(e&&e.face?e.face:'🦦')", "(e&&e.face?e.face:'🐤')", 'race-lane fallback');

// Sanity: the round-5 markers are in, the round-4-only markers are out.
if (!html.includes('class="av5"')) throw new Error('sanity: av5 class missing after apply');
if (!html.includes('@keyframes av5Bob')) throw new Error('sanity: av5Bob keyframes missing after apply');
if (!html.includes('@keyframes av5Blink')) throw new Error('sanity: av5Blink keyframes missing after apply');
if (!html.includes('@keyframes av5Twinkle')) throw new Error('sanity: av5Twinkle keyframes missing after apply');
if (!html.includes('@keyframes av5Play')) throw new Error('sanity: av5Play keyframes missing after apply');
if (!html.includes('@keyframes av5Bub')) throw new Error('sanity: av5Bub keyframes missing after apply');
if (!html.includes('@keyframes av5Pet')) throw new Error('sanity: av5Pet keyframes missing after apply');
if (!html.includes('function avatarPlay(')) throw new Error('sanity: avatarPlay missing after apply');
if (!html.includes('onclick="avatarPlay(this)"')) throw new Error('sanity: tap-to-play handler missing after apply');
if (!html.includes('LOOK_BG_PATTERNS')) throw new Error('sanity: LOOK_BG_PATTERNS missing after apply');
if (!html.includes('bgPatternPick')) throw new Error('sanity: bgPatternPick missing after apply');
if (!html.includes('av-twinklebg')) throw new Error('sanity: twinkle effect missing after apply');
if (!html.includes('av-bub')) throw new Error('sanity: bubbles effect missing after apply');
if (!html.includes('av-pet')) throw new Error('sanity: petals effect missing after apply');
if (html.includes('LOOK_ACCS')) throw new Error('sanity: LOOK_ACCS still present after apply');
if (html.includes('AVATAR_ACCS')) throw new Error('sanity: AVATAR_ACCS still present after apply');
if (html.includes('AV_ACC_OFF')) throw new Error('sanity: AV_ACC_OFF still present after apply');
if (html.includes('lookAccPick')) throw new Error('sanity: lookAccPick still present after apply');
if (!html.includes('AVATAR_5_CSS')) throw new Error('sanity: AVATAR_5_CSS missing after apply');
if (!html.includes('LOOK_BG_SHAPES')) throw new Error('sanity: LOOK_BG_SHAPES missing after apply');
if (!html.includes('My background')) throw new Error('sanity: My background section missing after apply');
if (!html.includes("face:'🐤'")) throw new Error('sanity: chick default missing after apply');
if (!html.includes('avatarLookHTML(e.face,e.look,e.glow,56)')) throw new Error('sanity: Grand Door tile avatar missing after apply');
if (html.includes('FULL-BODY LOOK — ROUND 4')) throw new Error('sanity: round-4 avatar block still present after apply');
if (html.includes('Avatar characters (round 4,')) throw new Error('sanity: round-4 CSS comment still present after apply');
if (html.includes('var LOOK_COLORS=')) throw new Error('sanity: LOOK_COLORS still present after apply');
if (html.includes('live.look={color:')) throw new Error('sanity: old colour look save still present after apply');
if (html.includes('look:{color:')) throw new Error('sanity: old colour look default still present after apply');
if (html.includes('lookPal(')) throw new Error('sanity: lookPal still present after apply');
if (html.includes('class="av3d"')) throw new Error('sanity: av3d class still present after apply');
if (html.includes('AVATAR_3D_CSS')) throw new Error('sanity: AVATAR_3D_CSS still present after apply');
if (html.includes('Animal colour')) throw new Error('sanity: Animal colour section still present after apply');
if (html.includes('lookColorPick')) throw new Error('sanity: lookColorPick still present after apply');
if (html.includes('av-fur')) throw new Error('sanity: fur references still present after apply');
if (html.includes('feTurbulence')) throw new Error('sanity: grain filter still present after apply');
if (html.includes('LOOK_HAIR') || html.includes('lookHairPick') || html.includes("look.hair")) throw new Error('sanity: hair references present after apply');
const newModal = html.slice(html.indexOf('function openLookModal(){'), html.indexOf('function openModal(html){'));
if ((newModal.match(/save\(\);/g) || []).length !== 1) throw new Error('sanity: the new editor must save exactly once (Save my look)');

fs.writeFileSync(PAGE, html);

// 8. Replace the dress-up tests with the round-5 suite (same frog
//    tests, same merge/top-left tests, rewritten avatar tests for
//    the flat art, background tests, and the draft-editor tests).
//    Refuse unless the file is the round-4 base we expect.
let test = fs.readFileSync(DRESSUP_TEST, 'utf8');
if (!test.includes('ROUND 4 (realistic fur')) throw new Error('wrong test base: expected round-4 dressup-greg.test.js');
if (test.includes('ROUND 5 (flat kawaii')) throw new Error('already applied: tests already round-5');
fs.writeFileSync(DRESSUP_TEST, NEW_TEST);

// 9. Replace the two other test files that lock in the round-4
//    modal behaviour (dressup.test.js, look-modal.test.js) with
//    their round-5 versions. Same unaffected tests; only the
//    animal count, the background picker and the Save shape change.
const DRESSUP2_TEST = path.join(root, 'tests', 'dressup.test.js');
const MODAL_TEST = path.join(root, 'tests', 'look-modal.test.js');
let test2 = fs.readFileSync(DRESSUP2_TEST, 'utf8');
if (!test2.includes('12 animals render in the "My animal friend" row')) throw new Error('wrong test base: expected round-4 dressup.test.js');
if (test2.includes('25 animals render')) throw new Error('already applied: dressup.test.js already round-5');
fs.writeFileSync(DRESSUP2_TEST, NEW_DRESSUP_TEST);
let test3 = fs.readFileSync(MODAL_TEST, 'utf8');
if (!test3.includes('glow/badge taps write to the draft; Save resolves the live explorer fresh')) throw new Error('wrong test base: expected round-4 look-modal.test.js');
if (test3.includes('background taps never rebuild')) throw new Error('already applied: look-modal.test.js already round-5');
fs.writeFileSync(MODAL_TEST, NEW_MODAL_TEST);

console.log('applied round-5 avatar revamp to ' + root);
