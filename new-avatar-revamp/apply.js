// Apply the avatar revamp to a copy of the learning-app project.
// Usage: node new-avatar-revamp/apply.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-avatar-revamp/design.md.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const DRESSUP_TEST = path.join(root, 'tests', 'dressup-greg.test.js');
const NEW_CODE = fs.readFileSync(path.join(__dirname, 'new-avatar-code.js'), 'utf8');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('AVATAR_FACES=') >= 0) throw new Error('already applied: AVATAR_FACES= exists');

// 1. Replace the whole old avatar block (FULL-BODY LOOK comment through
//    the end of avatarLookHTML) with the new illustrated renderer.
const startMarker = '/* ============================================================\n   FULL-BODY LOOK (2026-11-08, Bryan):';
const start = html.indexOf(startMarker);
if (start < 0) throw new Error('anchor not found: FULL-BODY LOOK block start');
const endMarker = 'function openLookModal(){';
const end = html.indexOf(endMarker, start);
if (end < 0) throw new Error('anchor not found: openLookModal after avatar block');
const oldBlock = html.slice(start, end);
if (!oldBlock.includes('function avatarLookHTML(')) throw new Error('old block does not contain avatarLookHTML');
if (!oldBlock.includes('var LOOK_COLORS=')) throw new Error('old block does not contain LOOK_COLORS');
html = html.slice(0, start) + NEW_CODE.trimEnd() + '\n\n' + html.slice(end);

// 2. Hair picker mini-previews use the new hair shapes, which live in
//    the avatar's 200-wide coordinates (fringe y=8..58, but the "long"
//    bob's side panels run down to y=106, so the preview window is
//    200x110 or the bob would be clipped).
html = replaceOnce(html,
  '<svg viewBox="0 0 120 60" style="width:24px;height:12px;display:block">',
  '<svg viewBox="0 0 200 110" style="width:24px;height:13px;display:block">',
  'hair picker mini-preview viewBox');

fs.writeFileSync(PAGE, html);

// 3. Update the avatarLookHTML test: the old assertions checked for an
//    emoji face, a CSS background: colour and emoji accessories, none
//    of which exist any more. The new assertions check the drawn
//    character's markers instead.
let test = fs.readFileSync(DRESSUP_TEST, 'utf8');
const testStartMarker = "test('avatarLookHTML: full body in the chosen colour, hair and accessory, with a glow fallback', () => {";
const testStart = test.indexOf(testStartMarker);
if (testStart < 0) throw new Error('anchor not found: avatarLookHTML test start');
const testEndMarker = "  assert.ok(glasses.includes('circle'), 'curly hair is circles');\n});";
const testEnd = test.indexOf(testEndMarker, testStart);
if (testEnd < 0) throw new Error('anchor not found: avatarLookHTML test end');
const testEndIdx = testEnd + testEndMarker.length;
const NEW_TEST = `test('avatarLookHTML: one illustrated character — drawn face, body in the chosen colour, fitted hair and accessory', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const out = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🦊", {color:"#ff8fa3",hair:"spiky",accessory:"hat"}, "#ffb020")');
  assert.ok(out.includes('data-animal="fox"'), 'the animal is drawn, not pasted: the fox face renders');
  assert.ok(out.includes('fill="#e8743c"'), 'the fox face wears its own colour');
  assert.ok(out.includes('fill="#ff8fa3"'), 'the body wears the chosen colour');
  assert.ok(out.includes('<svg viewBox="0 0 200 260"'), 'the whole character is one SVG on the shared grid');
  assert.ok(out.includes('id="avatar-hair"'), 'hair renders as a group over the head');
  assert.ok(out.includes('id="avatar-acc"'), 'the accessory renders as a group on top');
  assert.ok(out.includes('fill="#8b5cf6"'), 'the hat is the purple top hat');
  const natural = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🐸", {color:"",hair:"",accessory:""}, "#2dd4bf")');
  assert.ok(natural.includes('fill="#2dd4bf"'), 'Natural body falls back to the glow colour');
  assert.ok(!natural.includes('id="avatar-hair"'), 'no hair means no hair group');
  assert.ok(!natural.includes('id="avatar-acc"'), 'no accessory means no accessory group');
  const legacy = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🦦", undefined, "#ffb020")');
  assert.ok(legacy.includes('data-animal="otter"'), 'a legacy explorer without a look still renders');
  assert.ok(legacy.includes('fill="#ffb020"'), 'and its body falls back to glow');
  const glasses = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🐱", {color:"",hair:"curly",accessory:"glasses"}, "#ffb020")');
  assert.ok(glasses.includes('id="avatar-acc"'), 'glasses show for the glasses choice');
  assert.ok(glasses.includes('stroke="#4a2c1a"'), 'the glasses ring the fixed eye positions');
  assert.ok(glasses.includes('circle'), 'curly hair is circles');
  // Geometry guards: the torso starts high enough to tuck under the
  // chin, and the face circle sits where the eyes are fixed.
  assert.ok(out.includes('M100,112'), 'the torso starts under the chin, so the head can never float above the body');
  assert.ok(out.includes('cy="76" r="46"'), 'the face circle is centred where the eyes are fixed');
  // Revision 2 — the child-behaviour review's three required fixes.
  const turtle = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🐢", {color:"",hair:"",accessory:""}, "#ffb020")');
  assert.ok(turtle.includes('fill="#93cf6b"'), 'the turtle face is a yellower green than the frog');
  assert.ok(turtle.includes('M56,62 A46,46'), 'the turtle wears a real shell cap on its forehead');
  assert.ok(turtle.includes('fill="#5da85a"'), 'the shell cap is a filled dome, not a thin arc');
  assert.ok(natural.includes('fill="#58b368"'), 'the frog keeps its own deeper green face');
  assert.ok(!natural.includes('M56,62 A46,46'), 'the frog has no shell cap');
  const otter = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🦦", {color:"",hair:"",accessory:""}, "#ffb020")');
  assert.ok(otter.includes('rx="49"'), 'the otter face is wider and flatter than a circle');
  assert.ok(otter.includes('rgba(74,44,26,0.5)'), 'the otter has whiskers');
  assert.ok(otter.includes('fill="#f2d9b8"'), 'the otter muzzle is light and wide');
  const longHair = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🦊", {color:"",hair:"long",accessory:""}, "#ffb020")');
  assert.ok(longHair.includes('M58,106'), 'long hair is a one-piece bob framing the face, not two bars');
  assert.ok(!longHair.includes('<rect x="48"'), 'the old earmuff bars are gone');
  assert.ok(longHair.includes('id="avatar-ears-top"'), 'ears are re-drawn over the hair, so hair tucks behind them');
  const rabbitLong = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🐰", {color:"",hair:"long",accessory:""}, "#ffb020")');
  assert.ok(rabbitLong.includes('id="avatar-ears-top"'), 'the rabbit keeps its own ears in front of the long hair');
  const lionHair = eval(consts + '\\n' + fnText('function avatarLookHTML(face, look, glow){') + '\\n;avatarLookHTML("🦁", {color:"",hair:"curly",accessory:""}, "#ffb020")');
  assert.ok(!lionHair.includes('id="avatar-ears-top"'), 'the lion mane is not re-drawn over the hair');
});`;
test = test.slice(0, testStart) + NEW_TEST + test.slice(testEndIdx);
fs.writeFileSync(DRESSUP_TEST, test);

console.log('applied avatar revamp to ' + root);
