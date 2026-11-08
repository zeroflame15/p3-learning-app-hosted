// Apply the round-2 avatar revamp to a copy of the learning-app
// project. Usage: node new-avatar-revamp/apply.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-avatar-revamp/design.md.
// Round 2 replaces the round-1 avatar block (shared torso + faces +
// hair) with per-animal full-body characters, whole-animal colour,
// tiny accessories and NO hair — plus the top-left avatar becomes
// the character itself, big, in the sidebar and mobile topbar.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const DRESSUP_TEST = path.join(root, 'tests', 'dressup-greg.test.js');
const NEW_CODE = fs.readFileSync(path.join(__dirname, 'new-avatar-code.js'), 'utf8');
const NEW_TEST = fs.readFileSync(path.join(__dirname, 'tests-dressup-r2.test.js'), 'utf8');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}
function replaceAllCount(src, anchor, replacement, label, expected) {
  let count = 0, out = src, i;
  while ((i = out.indexOf(anchor)) >= 0) { out = out.slice(0, i) + replacement + out.slice(i + anchor.length); count++; }
  if (count !== expected) throw new Error('anchor count ' + count + ' (expected ' + expected + '): ' + label);
  return out;
}
function removeBetween(src, startMarker, endMarker, label) {
  const start = src.indexOf(startMarker);
  if (start < 0) throw new Error('anchor not found: ' + label + ' (start)');
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error('anchor not found: ' + label + ' (end)');
  return src.slice(0, start) + src.slice(end);
}

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('AVATAR_ANIMALS=') >= 0) throw new Error('already applied: AVATAR_ANIMALS= exists');
if (html.indexOf('AVATAR_FACES=') < 0) throw new Error('wrong base: AVATAR_FACES= missing — expected the round-1 avatar block');

// 1. Replace the whole round-1 avatar block (FULL-BODY LOOK comment
//    through the end of avatarLookHTML) with the round-2 renderer.
const startMarker = '/* ============================================================\n   FULL-BODY LOOK (revamped 2026-11-08, top standard): the';
const start = html.indexOf(startMarker);
if (start < 0) throw new Error('anchor not found: FULL-BODY LOOK block start');
const endMarker = 'function openLookModal(){';
const end = html.indexOf(endMarker, start);
if (end < 0) throw new Error('anchor not found: openLookModal after avatar block');
const oldBlock = html.slice(start, end);
if (!oldBlock.includes('function avatarLookHTML(')) throw new Error('old block does not contain avatarLookHTML');
if (!oldBlock.includes('var LOOK_COLORS=')) throw new Error('old block does not contain LOOK_COLORS');
if (!oldBlock.includes('AVATAR_FACES=')) throw new Error('old block does not contain AVATAR_FACES');
html = html.slice(0, start) + NEW_CODE.trimEnd() + '\n\n' + html.slice(end);

// 2. Sidebar brand: the small emoji disc becomes the full-body
//    character itself, 130px wide, with the name below it.
html = replaceOnce(html,
  "'<aside class=\"sidebar\"><div class=\"brand\"><div class=\"disc\" style=\"width:44px;height:44px;background:'+ex().glow+';font-size:1.35rem\">'+ex().face+'</div><div><div class=\"bname\">My Terrarium</div><div class=\"bsub\">Primary 3 · '+esc(ex().name)+' '+(ex().badge||'⭐')+'</div></div></div>'",
  "'<aside class=\"sidebar\"><div class=\"brand\" style=\"flex-direction:column;align-items:center;text-align:center;padding:6px 4px 14px;gap:6px\"><div id=\"sideAvatar\" style=\"width:130px;line-height:0\">'+avatarLookHTML(ex().face,ex().look,ex().glow,130)+'</div><div><div class=\"bname\">My Terrarium</div><div class=\"bsub\">Primary 3 · '+esc(ex().name)+' '+(ex().badge||'⭐')+'</div></div></div>'",
  'sidebar brand disc');

// 3. Mobile topbar: the character (43px) replaces the Pip icon on
//    small screens only — Pip stays on desktop.
html = replaceOnce(html,
  "<div style=\"display:flex;align-items:center;gap:8px\">'+pipSVG(34,ex().glow)+'<span class=\"page-title\">",
  "<div style=\"display:flex;align-items:center;gap:8px\"><span class=\"tbPip\" style=\"line-height:0\">'+pipSVG(34,ex().glow)+'</span><span class=\"tbChar\" id=\"tbChar\" style=\"display:none;line-height:0\">'+avatarLookHTML(ex().face,ex().look,ex().glow,43)+'</span><span class=\"page-title\">",
  'topbar Pip icon');

// 4. CSS: hide the topbar character on desktop; on small screens
//    hide Pip and show the character instead.
html = replaceOnce(html,
  '.avatarbtn{width:46px;height:46px;border-radius:50%;border:3px solid var(--amber);background:var(--panel);padding:0;overflow:hidden;display:inline-flex}',
  '.avatarbtn{width:46px;height:46px;border-radius:50%;border:3px solid var(--amber);background:var(--panel);padding:0;overflow:hidden;display:inline-flex}\n.tbChar{display:none}',
  'tbChar desktop rule');
html = replaceOnce(html,
  '  .topbar{padding:10px 14px}\n  .topbar .page-title{font-size:1.1rem}',
  '  .topbar{padding:10px 14px}\n  .tbPip{display:none}\n  .tbChar{display:inline-flex!important}\n  .topbar .page-title{font-size:1.1rem}',
  'mobile topbar character rule');

// 5. New explorers start with a look that has no hair field.
html = replaceOnce(html,
  "look:{color:'',hair:'',accessory:''}",
  "look:{color:'',accessory:''}",
  'newExplorer default look');

// 6. Modal: "Body colour" becomes "Animal colour" (the whole animal
//    is recoloured, not just the torso).
html = replaceOnce(html,
  '<label class="flabel">Body colour</label>',
  '<label class="flabel">Animal colour</label>',
  'Animal colour label');
html = replaceOnce(html,
  'aria-label="Body colour ',
  'aria-label="Animal colour ',
  'Animal colour aria-label');

// 7. Remove the Hair picker row entirely.
html = removeBetween(html,
  "   +'<label class=\"flabel\">Hair</label>",
  "   +'<label class=\"flabel\">Accessory</label>",
  'Hair picker row');

// 8. Remove the hair tap handler entirely.
html = removeBetween(html,
  "  document.querySelectorAll('.lookHairPick')",
  "  document.querySelectorAll('.lookAccPick')",
  'hair tap handler');

// 9. The two remaining look handlers (colour, accessory) create a
//    look without a hair field for legacy explorers.
html = replaceAllCount(html,
  "live.look={color:'',hair:'',accessory:''}",
  "live.look={color:'',accessory:''}",
  'look init in tap handlers', 2);

// 10. A look tap refreshes the top-left avatar in place too, so the
//     sidebar and mobile topbar characters change the moment a
//     colour or accessory is tapped — not only on Save.
html = replaceOnce(html,
  "function refreshLookPreview(){ var live=ex(); var pv=document.getElementById('lookPreview'); if(live&&pv)pv.innerHTML=avatarLookHTML(live.face,live.look,live.glow); }",
  "function refreshLookPreview(){ var live=ex(); var pv=document.getElementById('lookPreview'); if(live&&pv)pv.innerHTML=avatarLookHTML(live.face,live.look,live.glow); var sa=document.getElementById('sideAvatar'); if(live&&sa)sa.innerHTML=avatarLookHTML(live.face,live.look,live.glow,130); var tc=document.getElementById('tbChar'); if(live&&tc)tc.innerHTML=avatarLookHTML(live.face,live.look,live.glow,43); }",
  'refreshLookPreview also refreshes the top-left avatar');

// Sanity: no hair code may survive anywhere in the page.
if (html.includes('LOOK_HAIR') || html.includes('lookHairPick') || html.includes("look.hair") || html.includes('.hair')) throw new Error('hair references remain in the page');

fs.writeFileSync(PAGE, html);

// 11. Replace the dress-up tests with the round-2 suite (same frog
//     tests, rewritten avatar tests). Refuse unless the file is the
//     round-1 base we expect.
let test = fs.readFileSync(DRESSUP_TEST, 'utf8');
if (!test.includes("look:{color:'',hair:'',accessory:''}")) throw new Error('wrong test base: expected round-1 dressup-greg.test.js');
if (test.includes("look:{color:'',accessory:''}")) throw new Error('already applied: tests already round-2');
fs.writeFileSync(DRESSUP_TEST, NEW_TEST);

// 12. The older dress-up suite (tests/dressup.test.js) asserts the
//     sidebar brand disc shows the face emoji — round 2 replaces
//     that disc with the full-body character, so the assertion
//     follows. The door chips and the default otter are unchanged.
const DRESSUP_OLD_TEST = path.join(root, 'tests', 'dressup.test.js');
let oldTest = fs.readFileSync(DRESSUP_OLD_TEST, 'utf8');
if (!oldTest.includes("assert.ok(render.includes(\"'+ex().face+'\"), 'sidebar brand disc must show the chosen animal');")) throw new Error('wrong dressup.test.js base: brand-disc assertion not found');
if (oldTest.includes('avatarLookHTML(ex().face,ex().look,ex().glow,130)')) throw new Error('already applied: dressup.test.js already round-2');
oldTest = replaceOnce(oldTest,
  "assert.ok(render.includes(\"'+ex().face+'\"), 'sidebar brand disc must show the chosen animal');",
  "assert.ok(render.includes('avatarLookHTML(ex().face,ex().look,ex().glow,130)'), 'sidebar brand must show the chosen animal as its full-body character, big');",
  'brand-disc assertion in dressup.test.js');
fs.writeFileSync(DRESSUP_OLD_TEST, oldTest);

console.log('applied round-2 avatar revamp to ' + root);
