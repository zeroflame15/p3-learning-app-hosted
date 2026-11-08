// Dress-up + frog facts (requested 2026-11-08):
//  1. "Change my name & look" grows a full-body avatar builder —
//     ROUND 4 (realistic fur, texture, depth, 2026-11-08): the
//     round-3 plush animals are pushed toward realistic, like
//     Mira — fur strands and tufts, a faint grain, rim light,
//     deeper shading, lifelike eyes; the frog, butterfly, turtle
//     and panda are reworked to be cuter and more realistic.
//     Same data model (e.look={color,accessory}), same 5 tiny
//     accessories, NO hair. The editor works on a DRAFT copy of
//     the look and only commits it on "Save my look" — Cancel
//     discards the draft and changes nothing (round-3 bug, found
//     live). A stored hair value is ignored.
//  2. The explorer's avatar shows BIG in the top-left corner:
//     the full-body character itself in the sidebar (130px) and
//     in the mobile topbar (43px), refreshed on every save.
//  3. Tapping the frog in the Critter Lab tells a fun fact about
//     frogs (shuffled, no repeats until all 12 are told), in a
//     speech bubble that names the frog by its own name.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}

// Same eval chain as tests/create-planner-look.test.js — mergeExplorer
// must stay eval-able with only these helpers (no new top-level
// helpers). The look merge adds no helper calls (JSON is builtin).
const mergeExplorer = eval(
  fnText('function unionArr(a,b){') + '\n' +
  fnText('function unionObjMax(a,b){') + '\n' +
  fnText('function unionObjLatest(a,b){') + '\n' +
  fnText('function isThinkingMsg(m){') + '\n' +
  fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
  fnText('function pickCritterName(a,b){') + '\n' +
  fnText('function mergeCare(a,b){') + '\n' +
  '(' + fnText('function mergeExplorer(a,b){') + ')'
);

function explorer(over) {
  return Object.assign({
    name: 'MightyOtter', nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦',
    look: { color: '', accessory: '' }, lookAt: null,
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [],
    progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads: [], threadsClearedAt: null, deletedThreadIds: [],
    flashcards: [], deletedFlashcards: [], planner: [], deletedPlanner: [],
    critterName: 'Greg Washington', critterNameAt: null, care: {}, careGrewDay: null,
  }, over || {});
}

const modal = fnBody('function openLookModal(){');

test('new explorers start with an empty look', () => {
  const creator = fnBody('function newExplorer(name, code, level){');
  assert.ok(creator.includes("look:{color:'',accessory:''}"), 'new explorers start with a natural animal, no accessory');
  assert.ok(creator.includes('lookAt:null'), 'new explorers start with no look timestamp');
});

test('look merge: a later dress-up change wins, whichever side it is on', () => {
  const server = explorer({ look: { color: '', accessory: '' }, lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ look: { color: '#ff8fa3', accessory: 'tinyhat' }, lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.look, { color: '#ff8fa3', accessory: 'tinyhat' }, 'the later look wins whole');
  assert.equal(merged.lookAt, '2026-11-06T08:00:00.000Z', 'the winning look timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.deepEqual(merged2.look, { color: '#ff8fa3', accessory: 'tinyhat' }, 'argument order must not matter for look either');
  const older = explorer({ look: { color: '#ff8fa3', accessory: 'tinyhat' }, lookAt: '2026-11-06T08:00:00.000Z' });
  const newer = explorer({ look: { color: '', accessory: '' }, lookAt: '2026-11-07T08:00:00.000Z' });
  assert.deepEqual(mergeExplorer(older, newer).look, { color: '', accessory: '' }, 'a later reset back to natural also wins');
});

test('look merge: a tie goes to the local side, legacy keeps the server look', () => {
  const at = '2026-11-06T08:00:00.000Z';
  const server = explorer({ look: { color: '#2dd4bf', accessory: '' }, lookAt: at });
  const local = explorer({ look: { color: '#c084fc', accessory: 'necklace' }, lookAt: at });
  assert.deepEqual(mergeExplorer(server, local).look, { color: '#c084fc', accessory: 'necklace' }, 'tie goes to the local side, like name/look');
  const legacyServer = explorer({ look: { color: '#7db4ff', accessory: '' }, lookAt: null });
  const legacyLocal = explorer({ look: { color: '', accessory: 'flower' }, lookAt: null });
  assert.deepEqual(mergeExplorer(legacyServer, legacyLocal).look, { color: '#7db4ff', accessory: '' }, 'with no timestamps the server look stays (legacy)');
});

test('look merge: the merged look is a copy, not an alias of either side', () => {
  const server = explorer({ look: { color: '', accessory: '' }, lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ look: { color: '#ff8fa3', accessory: 'tinyhat' }, lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  merged.look.color = '#000000';
  assert.equal(local.look.color, '#ff8fa3', 'mutating the merged look must not rewrite the local explorer');
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.includes('JSON.parse(JSON.stringify(b.look))'), 'the winning look must be deep-copied');
});

test('the look modal renders a full-body preview and two picker rows — colour and accessory, no hair', () => {
  assert.ok(modal.includes('My full-body look'), 'modal must label the preview');
  assert.ok(modal.includes('id="lookPreview"'), 'the preview must have an id so taps can refresh it in place');
  assert.ok(modal.includes('avatarLookHTML(e.face,e.look,e.glow)'), 'the preview must render from the live face, look and glow');
  assert.ok(modal.includes('Animal colour'), 'modal must label the colour row as the whole animal');
  assert.ok(!modal.includes('Body colour'), 'the old body-only label is gone');
  assert.ok(modal.includes('class="iconbtn lookColorPick"'), 'colours must be swatch buttons');
  assert.ok(!modal.includes('Hair'), 'there is no hair row any more');
  assert.ok(!modal.includes('lookHairPick'), 'there is no hair picker');
  assert.ok(!html.includes('var LOOK_HAIRS='), 'the hair list is gone from the page');
  assert.ok(modal.includes('Accessory'), 'modal must label the accessory row');
  assert.ok(modal.includes('class="iconbtn lookAccPick"'), 'accessories must be icon buttons');
  const colors = eval(grabVar('LOOK_COLORS') + '\n;LOOK_COLORS');
  assert.equal(colors.length, 7, 'Natural plus 6 colours');
  assert.equal(colors[0], '', 'Natural (no colour) comes first');
  const accs = eval(grabVar('LOOK_ACCS') + '\n;LOOK_ACCS');
  assert.deepEqual(accs, ['', 'necklace', 'tinyhat', 'flower', 'star', 'bow'], 'five tiny accessories plus none');
});

test('avatarLookHTML: a 3D-shaded full-body character per animal, whole-animal colour, tiny accessories, no hair', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face, look, glow, w){');
  const render = (face, look, glow) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',' + JSON.stringify(look) + ',' + JSON.stringify(glow || '#ffb020') + ')');
  // 3D structure: one svg, class av3d, a defs block with the six
  // gradients, and the body/head filled by gradient, not flat colour.
  const pinkFox = render('🦊', { color: '#ff8fa3', accessory: '' });
  assert.ok(pinkFox.includes('data-animal="fox"'), 'the animal is drawn, not pasted: the fox renders');
  assert.ok(pinkFox.includes('<svg class="av3d" viewBox="0 0 200 260"'), 'the whole character is one 3D svg on the shared grid');
  assert.ok(pinkFox.includes('<defs>'), 'the gradients live in a defs block');
  for (const g of ['gB', 'gH', 'gBel', 'gD', 'gSh', 'gGl']) {
    assert.ok(pinkFox.includes('id="' + g), 'the ' + g + ' gradient is defined');
  }
  assert.ok(pinkFox.includes('fill="url(#gB'), 'the body is filled by the body gradient');
  assert.ok(pinkFox.includes('fill="url(#gH'), 'the head is filled by the head gradient');
  assert.ok(pinkFox.includes('fill="url(#gSh'), 'the ground shadow is a radial gradient, not a flat ellipse');
  // Whole-animal colour now lives in the gradients: pink is the
  // mid-stop of the body and head gradients, never a flat fill.
  const pinkStops = (pinkFox.match(/stop-color="#ff8fa3"/g) || []).length;
  assert.equal(pinkStops, 2, 'pink is the body and head gradient mid-stop — got ' + pinkStops);
  assert.ok(!pinkFox.includes('fill="#ff8fa3"'), 'no flat pink fill anywhere: the colour is shaded, not stickered');
  const naturalFox = render('🦊', { color: '', accessory: '' }, '#2dd4bf');
  const natStops = (naturalFox.match(/stop-color="#e8743c"/g) || []).length;
  assert.equal(natStops, 2, 'Natural fox wears its own orange in the gradients — got ' + natStops);
  assert.ok(naturalFox.includes('stop-color="#c25a2e"'), 'the fox tail keeps its own dark accent gradient');
  assert.ok(!naturalFox.includes('fill="#2dd4bf"'), 'Natural ignores the glow — the animal keeps its own colour');
  // The dark edge is always a shade of the main colour, never the
  // dark accent — so a pale animal never goes black at the edges.
  // (The panda's dark accent IS black — its patches, ears and arms
  // use it in the gD gradient — but its BODY gradient must not.)
  const panda = render('🐼', { color: '', accessory: '' });
  const pandaGB = panda.match(/<radialGradient id="gB\d+"[^]*?<\/radialGradient>/)[0];
  assert.ok(pandaGB.includes('stop-color="#aca9a4"'), 'the panda body edge is a soft grey shade of its own white, not black');
  assert.ok(!pandaGB.includes('stop-color="#26221f"'), 'the panda body gradient never goes black');
  assert.ok(panda.includes('stop-color="#26221f"'), 'the panda dark accent (patches, ears, arms) is still black in its own gradient');
  // No hair: a stored hair value changes nothing and renders nothing.
  const withHair = render('🦦', { color: '', accessory: '', hair: 'long' });
  const noHair = render('🦦', { color: '', accessory: '' });
  assert.equal(withHair, noHair, 'a saved hair value is ignored, never rendered');
  assert.ok(!withHair.includes('avatar-hair'), 'no hair group is ever drawn');
  assert.ok(!html.includes('LOOK_HAIR'), 'no hair code remains in the page');
  // Unknown values degrade gracefully.
  assert.ok(!render('🦦', { accessory: 'hat' }).includes('id="avatar-acc"'), 'an unknown accessory renders as no accessory');
  assert.ok(render('👽', {}).includes('data-animal="otter"'), 'an unknown face falls back to the otter');
  assert.ok(render('🦦', null).includes('<svg'), 'a legacy explorer without a look still renders');
  // Gradient ids are unique per render, so two characters on one
  // page never share a gradient. (Both renders must happen in ONE
  // eval: each eval re-declares avUid at 0, as the consts slice
  // carries it — in the app it is one module-level counter.)
  const two = eval(consts + '\n' + fn + '\n;[avatarLookHTML("🦦",{color:"",accessory:""},"#ffb020"),avatarLookHTML("🦦",{color:"",accessory:""},"#ffb020")]');
  assert.notEqual(two[0].match(/id="gB(\d+)"/)[1], two[1].match(/id="gB(\d+)"/)[1], 'each render gets its own gradient ids');
  // Every animal is itself at a glance — its own recognition marker.
  const markers = [
    ['🦦', 'rgba(74,44,26,0.5)', 'the otter has whiskers'],
    ['🦦', 'rx="49"', 'the otter face is wider and flatter than a circle, not a bear'],
    ['🐸', 'cy="46" r="17"', 'the frog has bigger eye bumps (round 4: r 17, not 15)'],
    ['🦋', 'M90,102 C74,90 54,92 44,106', 'the butterfly has a scalloped upper wing, not a plain ellipse'],
    ['🐱', 'M62,42 L56,10 L86,30 Z', 'the cat has pointed triangle ears'],
    ['🐶', 'fill="#f08ba0"', 'the dog has its tongue out'],
    ['🐰', 'cy="35" rx="9" ry="32"', 'the rabbit has long upright ears (reference ratio: 35px above the head top)'],
    ['🦁', 'r="58"', 'the lion has a mane ring'],
    ['🐼', 'rx="13.5" ry="17"', 'the panda has bigger, softer eye patches (round 4)'],
    ['🦊', 'rotate(18 170 118)', 'the fox has a big bushy tail with a pale tip'],
    ['🐢', 'stop-color="#4e8f4c"', 'the turtle shell is its own dark green gradient'],
    ['🐢', 'M100,106 L118,116 L112,138 L100,146 L88,138 L82,116 Z', 'the turtle shell has a real scute pattern, not just segment lines'],
    ['🐷', 'rx="16" ry="12"', 'the pig has a snout'],
    ['🐵', 'cy="82" rx="34" ry="36"', 'the monkey has a light face patch'],
  ];
  for (const [face, marker, msg] of markers) {
    assert.ok(render(face, { color: '', accessory: '' }).includes(marker), msg);
  }
  // Geometry guards: heads never float above bodies (round-2 fixes).
  const rabbit = render('🐰', { color: '', accessory: '' });
  assert.ok(rabbit.includes('cy="174" rx="50" ry="50"'), 'the rabbit body starts above the chin, overlapping the head by 6px, so the head merges into the body with no seam');
  assert.ok(rabbit.includes('cy="84" r="46"'), 'the rabbit head sits 8px lower so the long ears fit the grid');
  assert.ok(rabbit.includes('cy="35" rx="9" ry="32"'), 'the rabbit ears are long and slim, tips 35px above the head top');
  // Round 4: the head–body join is seamless because the head and
  // the body share ONE userSpaceOnUse gradient (gR) — the per-shape
  // gB gradient left a faint circular edge where the head's dark
  // bottom met the body's light top (found live in round 3).
  assert.ok(rabbit.includes('gradientUnits="userSpaceOnUse"'), 'the rabbit gets a shared userSpaceOnUse gradient');
  assert.ok(rabbit.includes('id="gR'), 'the shared rabbit gradient is gR');
  assert.ok(rabbit.includes('cy="174" rx="50" ry="50" fill="url(#gR'), 'the rabbit body is filled by the shared gradient');
  assert.ok(rabbit.includes('cy="84" r="46" fill="url(#gR'), 'the rabbit head is filled by the shared gradient');
  assert.ok(!rabbit.includes('cy="84" r="46" fill="url(#gB'), 'the rabbit head must not use the per-shape gradient');
  assert.ok(!render('🦦', { color: '', accessory: '' }).includes('id="gR'), 'gR is rabbit-only — other animals keep gB');
  const pig = render('🐷', { color: '', accessory: '' });
  assert.ok(pig.includes('cy="172" rx="52" ry="50"'), 'the pig body starts at the chin too');
  const turtle = render('🐢', { color: '', accessory: '' });
  assert.ok(turtle.includes('cy="78" r="34"'), 'the turtle head sits down into the shell');
  assert.ok(turtle.includes('M100,100'), 'the shell dome starts under the head');
  const frog = render('🐸', { color: '', accessory: '' });
  assert.ok(frog.includes('cy="178" rx="52" ry="48"'), 'the frog body touches the head');
  // The chin crease: a soft dark ellipse under the head, so the
  // head sits INTO the body on the animals that have the junction.
  assert.ok(render('🦦', { color: '', accessory: '' }).includes('fill="#000000" opacity="0.10"'), 'the otter has a crease under the chin');
  assert.ok(render('🐰', { color: '', accessory: '' }).includes('fill="#000000" opacity="0.10"'), 'the rabbit has a crease under the chin');
  assert.ok(!render('🦋', { color: '', accessory: '' }).includes('fill="#000000" opacity="0.10"'), 'the butterfly has no head-body junction, so no crease');
  assert.ok(!render('🐢', { color: '', accessory: '' }).includes('fill="#000000" opacity="0.10"'), 'the turtle head sits in the shell, so no crease');
  // Tiny accessories: small touches, never covering the face.
  const necklace = render('🦦', { color: '', accessory: 'necklace' });
  assert.ok(necklace.includes('id="avatar-acc"'), 'the necklace renders as a group on top');
  assert.ok(necklace.includes('M84,122 Q100,136 116,122'), 'the necklace is a small arc hugging the neck');
  const hat = render('🦦', { color: '', accessory: 'tinyhat' });
  assert.ok(hat.includes('fill="#8b5cf6"'), 'the tiny hat is the little purple top hat');
  const flower = render('🦦', { color: '', accessory: 'flower' });
  assert.ok(flower.includes('stroke="#e88aa0"'), 'the flower is a small daisy at the side of the head');
  const star = render('🦦', { color: '', accessory: 'star' });
  assert.ok(star.includes('stroke="#e8a100"'), 'the star is a small clip at the side of the head');
  const bow = render('🦦', { color: '', accessory: 'bow' });
  assert.ok(bow.includes('fill="#ef4444"'), 'the little bow sits at the neck');
  const none = render('🦦', { color: '', accessory: '' });
  assert.ok(!none.includes('id="avatar-acc"'), 'no accessory means no accessory group');
  // Width param: the same character at the sizes the app uses.
  const big = render('🦦', { color: '', accessory: '' });
  assert.ok(big.includes('width:190px;height:247px'), 'the modal preview defaults to 190px wide');
  assert.ok(eval(consts + '\n' + fn + '\n;avatarLookHTML("🦦",{color:"",accessory:""},"#ffb020",43)').includes('width:43px;height:56px'), 'the mobile topbar character is 43px wide');
  assert.ok(eval(consts + '\n' + fn + '\n;avatarLookHTML("🦦",{color:"",accessory:""},"#ffb020",130)').includes('width:130px;height:169px'), 'the sidebar character is 130px wide');
});

test('idle life: every animal bobs and blinks, each with its own signature motion', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face, look, glow, w){');
  const render = (face) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',{color:"",accessory:""},"#ffb020")');
  const sig = {
    '🦦': 'av-sway', '🐸': 'av-hop', '🦋': 'av-flutter-l', '🐱': 'av-sway',
    '🐶': 'av-earwig', '🐰': 'av-earwig', '🦁': 'av-nod', '🐼': 'av-earwig',
    '🦊': 'av-sway', '🐢': 'av-nod', '🐷': 'av-flop', '🐵': 'av-sway',
  };
  for (const [face, motion] of Object.entries(sig)) {
    const s = render(face);
    assert.ok(s.includes('class="av-blink"'), face + ' blinks');
    assert.ok(s.includes('av-bob') || s.includes('av-hop'), face + ' bobs (or hops)');
    assert.ok(s.includes(motion), face + ' has its signature motion ' + motion);
    assert.ok(s.includes('animation-delay:'), face + ' staggers its motion so a page of animals never moves in lockstep');
  }
  // The dog's tongue wags and the frog's eyes are green, like the
  // live frog's.
  assert.ok(render('🐶').includes('av-tongue'), 'the dog tongue wags');
  assert.ok(render('🐸').includes('fill="#3a7d2c"'), 'the frog keeps its green iris');
  // The CSS itself is in the page's <style>, next to Pip's own
  // animation rules — not only in the AVATAR_3D_CSS variable.
  for (const k of ['@keyframes avBob', '@keyframes avBlink', '@keyframes avHop', '@keyframes avFlutterL', '@keyframes avFlutterR', '@keyframes avEarWig', '@keyframes avNod', '@keyframes avFlop', '@keyframes avSway', '@keyframes avTongue']) {
    assert.ok(html.includes(k), 'the page style contains ' + k);
  }
  assert.ok(html.includes('.av3d .av-bob'), 'the bob rule is scoped to avatar svgs');
  assert.ok(html.includes('@media (prefers-reduced-motion: reduce){.av3d .av-bob'), 'the reduced-motion rule switches the avatar motion off');
  assert.ok(html.includes('var AVATAR_3D_CSS='), 'the CSS also lives in the AVATAR_3D_CSS variable (single source for the preview)');
});

test('all 504 combinations render a 3D character', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face, look, glow, w){');
  const faces = ['🦦', '🐸', '🦋', '🐱', '🐶', '🐰', '🦁', '🐼', '🦊', '🐢', '🐷', '🐵'];
  assert.equal(faces.length, 12, '12 animals');
  const colors = eval(grabVar('LOOK_COLORS') + '\n;LOOK_COLORS');
  const accs = eval(grabVar('LOOK_ACCS') + '\n;LOOK_ACCS');
  let n = 0;
  for (const f of faces) {
    for (const c of colors) {
      for (const a of accs) {
        const s = eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(f) + ',{color:' + JSON.stringify(c) + ',accessory:' + JSON.stringify(a) + '},"#ffb020")');
        assert.ok(s.includes('class="av3d"'), 'every combination renders a 3D svg: ' + f + ' ' + c + ' ' + a);
        assert.ok(s.includes('<defs>'), 'every combination has its gradients: ' + f + ' ' + c + ' ' + a);
        n++;
      }
    }
  }
  assert.equal(n, 504, '12 animals x 7 colours x 6 accessories');
});

test('look taps write to the draft only: no live write, no save, typed name kept, preview refreshed in place', () => {
  const colorHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookColorPick')"), modal.indexOf("document.querySelectorAll('.lookAccPick')"));
  const accHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookAccPick')"), modal.indexOf("document.getElementById('lkSave')"));
  for (const [name, h, field] of [['colour', colorHandler, 'draft.look.color='], ['accessory', accHandler, 'draft.look.accessory=']]) {
    assert.ok(h.length > 0, name + ' handler found');
    assert.ok(h.includes(field), name + ' tap must write the look field to the draft');
    assert.ok(!h.includes('live.look'), name + ' tap must not touch the live look');
    assert.ok(!h.includes('live.lookAt'), name + ' tap must not stamp lookAt');
    assert.ok(!h.includes('save()'), name + ' tap must not save');
    assert.ok(h.includes("document.getElementById('lkName')"), name + ' tap must read the name input so the typed name is preserved');
    assert.ok(h.includes('keepEl.value=keep'), name + ' tap must restore the typed name');
    assert.ok(h.includes('refreshLookPreview()'), name + ' tap must refresh the preview in place');
    assert.ok(!h.includes('openLookModal()'), name + ' tap must not rebuild the modal');
    assert.ok(!h.includes('render()'), name + ' tap must not re-render while the modal is open');
  }
  // Face and glow taps write to the draft and refresh the preview too (face is the head).
  const faceHandler = modal.slice(modal.indexOf("document.querySelectorAll('.facePick')"), modal.indexOf("document.querySelectorAll('.glowPick')"));
  assert.ok(faceHandler.includes('draft.face='), 'face tap must write the draft face');
  assert.ok(!faceHandler.includes('live.face='), 'face tap must not touch the live face');
  assert.ok(!faceHandler.includes('save()'), 'face tap must not save');
  assert.ok(faceHandler.includes('refreshLookPreview()'), 'face tap must refresh the preview');
  const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
  assert.ok(glowHandler.includes('draft.glow='), 'glow tap must write the draft glow');
  assert.ok(!glowHandler.includes('save()'), 'glow tap must not save');
  assert.ok(glowHandler.includes('refreshLookPreview()'), 'glow tap must refresh the preview');
  const badgeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.badgePick')"), modal.indexOf("document.querySelectorAll('.lookColorPick')"));
  assert.ok(badgeHandler.includes('draft.badge='), 'badge tap must write the draft badge');
  assert.ok(!badgeHandler.includes('save()'), 'badge tap must not save');
});

test('FROG_FACTS: 12 short true facts, one sentence each, no repeats', () => {
  const start = html.indexOf('var FROG_FACTS=');
  assert.ok(start >= 0, 'FROG_FACTS found');
  const facts = eval(grabVar('FROG_FACTS') + '\n;FROG_FACTS');
  assert.equal(facts.length, 12, '12 facts, got ' + facts.length);
  const seen = new Set();
  for (const f of facts) {
    assert.ok(typeof f === 'string' && f.length > 10 && f.length < 110, 'a short fact a Primary 3 child can read: ' + f);
    assert.ok(!f.includes('.'), 'one sentence only, no full stops: ' + f);
    assert.ok(f.endsWith('!'), 'each fact ends with a bang: ' + f);
    seen.add(f);
  }
  assert.equal(seen.size, facts.length, 'no duplicated facts');
  assert.ok(!html.includes('FROG_LINES'), 'the old greeting lines are gone');
});

test('nextFrogFact cycles all 12 facts with no repeats, then reshuffles', () => {
  const facts = eval(grabVar('FROG_FACTS') + '\n;FROG_FACTS');
  const orderFn = fnText('function nextFrogFact(){');
  const stub = 'var shuffle=function(a){ return a.slice(); }; var frogFactState=null;';
  const told = eval(stub + '\nvar FROG_FACTS=' + JSON.stringify(facts) + ';\n' + orderFn + '\nvar out=[]; for(var i=0;i<12;i++)out.push(nextFrogFact()); out');
  assert.deepEqual(told.sort(), facts.slice().sort(), 'all 12 facts are told exactly once before any repeat');
  const thirteenth = eval(stub + '\nvar FROG_FACTS=' + JSON.stringify(facts) + ';\n' + orderFn + '\nvar out=[]; for(var i=0;i<13;i++)out.push(nextFrogFact()); out[12]');
  assert.equal(thirteenth, facts[0], 'after the 12th fact the order reshuffles and starts again');
});

test('frogTap tells the next fact, named by the frog itself', () => {
  const bind = fnBody('function bindCritter(){');
  assert.ok(bind.includes('var line=nextFrogFact();'), 'a tap must ask for the next fact');
  assert.ok(bind.includes("b.textContent='💬 '+(eNow.critterName||'Frog')+': '+line;"), 'the bubble must name the frog by its own name');
  assert.ok(!bind.includes('FROG_LINES'), 'frogTap no longer reads the greeting lines');
  assert.ok(bind.includes('frogBubbleTimer'), 'the ~2.6s bubble timer is unchanged');
  const rule = html.match(/\.frog-bubble\{[^}]*\}/);
  assert.ok(rule, 'frog-bubble rule exists');
  assert.ok(!rule[0].includes('white-space:nowrap'), 'the bubble must wrap so a full fact sentence shows');
  assert.ok(rule[0].includes('text-align:center'), 'wrapped facts stay centred in the bubble');
});

test('the top-left avatar IS the full-body character, big, and it updates on every save', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes('id="sideAvatar"'), 'the sidebar has a sideAvatar slot for the character');
  assert.ok(render.includes('avatarLookHTML(ex().face,ex().look,ex().glow,130)'), 'the sidebar character is the saved look, 130px wide');
  assert.ok(render.includes('id="tbChar"'), 'the mobile topbar has a tbChar slot for the character');
  assert.ok(render.includes('avatarLookHTML(ex().face,ex().look,ex().glow,43)'), 'the mobile topbar character is the saved look, 43px wide');
  assert.ok(!render.includes('class="disc"'), 'the small emoji disc is gone from the sidebar brand');
  assert.ok(html.includes('.tbChar{display:none}'), 'the topbar character is hidden on desktop, where the sidebar shows it');
  assert.ok(html.includes('.tbPip{display:none}'), 'the Pip icon is hidden on mobile, where the character shows');
  assert.ok(html.includes('.tbChar{display:inline-flex!important}'), 'the topbar character shows on mobile');
  // A look tap refreshes ONLY the modal preview, from the draft — the
  // sidebar/topbar characters show the saved look until Save.
  const refresh = modal.slice(modal.indexOf('function refreshLookPreview()'), modal.indexOf("document.querySelectorAll('.facePick')"));
  assert.ok(refresh.includes('avatarLookHTML(draft.face,draft.look,draft.glow)'), 'a look tap refreshes the modal preview from the draft');
  assert.ok(!refresh.includes("document.getElementById('sideAvatar')"), 'a look tap must NOT touch the sidebar character');
  assert.ok(!refresh.includes("document.getElementById('tbChar')"), 'a look tap must NOT touch the mobile topbar character');
  const door = fnBody('function doorHTML(){');
  assert.ok(door.includes("<span class=\"face\">'+e.face+'</span>"), 'Grand Door explorer chips still show the face emoji');
});

test('focus four: the frog, butterfly, turtle and panda are reworked — cuter and more realistic', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face, look, glow, w){');
  const render = (face, look) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',' + JSON.stringify(look || { color: '', accessory: '' }) + ',"#ffb020")');
  // Frog: bigger eyes, skin bumps, wider smile, toe pads.
  const frog = render('🐸');
  assert.ok(frog.includes('class="av-skin"'), 'the frog has skin bumps');
  assert.ok(frog.includes('cy="46" r="17"'), 'the frog eye bumps are bigger (r 17)');
  assert.ok(frog.includes('r="11.5"'), 'the frog eye whites are bigger');
  assert.ok(frog.includes('M70,96 Q100,114 130,96'), 'the frog smile is wider');
  assert.ok(frog.includes('M60,226 l2,4'), 'the frog feet have toe pads');
  assert.ok(frog.includes('fill="#3a7d2c"'), 'the frog keeps its green iris, like the live frog');
  // Butterfly: scalloped patterned wings with veins, slimmer body, longer antennae.
  const fly = render('🦋');
  assert.ok(fly.includes('M90,102 C74,90 54,92 44,106'), 'the butterfly upper wing is scalloped');
  assert.ok(fly.includes('M88,128 Q64,116 48,112'), 'the butterfly wings have veins');
  assert.ok(fly.includes('cx="58" cy="112" r="5"'), 'the butterfly wings have spots');
  assert.ok(fly.includes('rx="14" ry="36"'), 'the butterfly body is slimmer');
  assert.ok(fly.includes('M88,40 Q78,18 68,8'), 'the butterfly antennae are longer and curved');
  assert.ok(fly.includes('class="av-flutter-l"') && fly.includes('class="av-flutter-r"'), 'the wings still flutter');
  // Turtle: real scute pattern, bigger eyes, blush.
  const turtle = render('🐢');
  assert.ok(turtle.includes('class="av-scute"'), 'the turtle shell has scutes');
  assert.ok(turtle.includes('M100,106 L118,116 L112,138 L100,146 L88,138 L82,116 Z'), 'the central scute is a hexagon');
  assert.ok(turtle.includes('rx="9" ry="11"'), 'the turtle eyes are bigger');
  assert.ok(turtle.includes('cx="80" cy="82" r="3.5"'), 'the turtle has blush cheeks');
  // Panda: fur tufts on the black patches, bigger warmer eyes.
  const panda = render('🐼');
  assert.ok(panda.includes('rx="13.5" ry="17"'), 'the panda eye patches are bigger and softer');
  assert.ok(panda.includes('rx="7.5" ry="9"'), 'the panda eyes are bigger');
  assert.ok(panda.includes('fill="#7a4a21"'), 'the panda eyes are warm brown, not black dots');
  assert.ok((panda.match(/class="av-fur"/g) || []).length >= 3, 'the panda has fur tufts on its patches, ears and arms');
});

test('fur, texture and depth: furry animals have fur tufts, strands and grain; arms read as arms; the pig tail curls', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face, look, glow, w){');
  const render = (face, look) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',' + JSON.stringify(look || { color: '', accessory: '' }) + ',"#ffb020")');
  const furry = ['🦦', '🐱', '🐶', '🐰', '🦁', '🐼', '🦊', '🐷', '🐵'];
  for (const f of furry) {
    const s = render(f);
    assert.ok(s.includes('class="av-fur"'), f + ' has fur tufts and strands');
    assert.ok(s.includes('filter="url(#fGr'), f + ' has the grain filter on its body and head');
    assert.ok(s.includes('id="fGr'), f + ' defines the grain filter');
  }
  // Smooth-skinned animals get their own textures, not fur or grain.
  assert.ok(!render('🐸').includes('class="av-fur"'), 'the frog has skin bumps, not fur');
  assert.ok(!render('🐸').includes('filter="url(#fGr'), 'the frog has no grain');
  assert.ok(!render('🦋').includes('class="av-fur"'), 'the butterfly has wing pattern, not fur');
  assert.ok(!render('🐢').includes('class="av-fur"'), 'the turtle has scutes, not fur');
  assert.ok(!render('🐢').includes('filter="url(#fGr'), 'the turtle has no grain');
  // The otter's arms are narrow now, with toe lines — they read as arms, not wings.
  const otter = render('🦦');
  assert.ok(otter.includes('rx="7.5" ry="20"'), 'the otter arms are narrow');
  assert.ok(otter.includes('M44,182 l5,4'), 'the otter paws have toe lines');
  // The pig tail is a proper visible curl.
  const pig = render('🐷');
  assert.ok(pig.includes('M150,172 C162,166 172,170 170,180'), 'the pig tail curls');
  assert.ok(!pig.includes('q14,-6 12,4'), 'the old tiny tail squiggle is gone');
  // The flower has a stem, so it reads as attached (round-2 polish note).
  const flower = render('🦦', { color: '', accessory: 'flower' });
  assert.ok(flower.includes('M58,54 L56,63'), 'the flower has a stem down to the head');
  // Rim light and dimensional noses.
  assert.ok(otter.includes('M62,54 Q70,40 86,36'), 'the otter head has a rim-light arc');
  assert.ok(otter.includes('r="1.5" fill="#ffffff" opacity="0.7"'), 'the otter nose has a highlight');
  // Whole-animal colour still lives in the gradients: pink is the
  // mid-stop of the body and head gradients, never a flat fill —
  // even with fur strokes (they use a shade, not the main colour).
  const pinkFox = render('🦊', { color: '#ff8fa3', accessory: '' });
  assert.ok(!pinkFox.includes('fill="#ff8fa3"'), 'no flat pink fill anywhere, even with fur');
  assert.ok(!pinkFox.includes('stroke="#ff8fa3"'), 'no flat pink fur stroke either');
});

test('draft editor: picks never save, Save commits the draft, Cancel changes nothing', () => {
  // The editor works on a draft copy of the look (round-3 bug: every
  // pick saved live, so Cancel could not revert it).
  assert.ok(modal.includes('var draft={face:e.face'), 'the editor opens a draft copy of the look');
  assert.ok(modal.includes("look:{color:(e.look||{}).color"), 'the draft copies the saved look, it does not alias it');
  assert.ok(modal.includes('avatarLookHTML(draft.face,draft.look,draft.glow)'), 'the preview renders from the draft');
  assert.equal((modal.match(/save\(\);/g) || []).length, 1, 'the whole editor saves exactly once — on Save my look');
  assert.ok(modal.includes('onclick="closeModal()">Cancel'), 'Cancel just closes the modal');
  const closer = fnBody('function closeModal(){');
  assert.ok(!closer.includes('save('), 'closeModal never saves');
  // Functional: run the Save handler with a draft and a fresh live
  // explorer, and prove it commits the draft and saves exactly once.
  const saveSrc = modal.slice(modal.indexOf("document.getElementById('lkSave').onclick"));
  const saveFn = saveSrc.slice(0, saveSrc.lastIndexOf('};') + 2);
  var draft = { face: '🐸', glow: '#2dd4bf', badge: '🚀', look: { color: '#ff8fa3', accessory: 'tinyhat' } };
  var live = { name: 'MightyOtter', face: '🦦', glow: '#ffb020', badge: '⭐', look: { color: '', accessory: '' }, lookAt: null, nameAt: null };
  var saved = 0, closed = 0, rendered = 0, toasted = '';
  var ex = function () { return live; };
  var save = function () { saved++; };
  var closeModal = function () { closed++; };
  var render = function () { rendered++; };
  var toast = function (m) { toasted = m; };
  var lkSaveBtn = {};
  var document = { getElementById: function (id) { if (id === 'lkName') return { value: '  NewName  ' }; if (id === 'lkSave') return lkSaveBtn; return {}; } };
  eval(saveFn);
  lkSaveBtn.onclick();
  assert.equal(live.face, '🐸', 'Save commits the draft animal');
  assert.equal(live.glow, '#2dd4bf', 'Save commits the draft glow');
  assert.equal(live.badge, '🚀', 'Save commits the draft badge');
  assert.deepEqual(live.look, { color: '#ff8fa3', accessory: 'tinyhat' }, 'Save commits the draft look');
  assert.notEqual(live.look, draft.look, 'the committed look is a copy, not the draft object');
  assert.deepEqual(draft.look, { color: '#ff8fa3', accessory: 'tinyhat' }, 'Save must not mutate the draft');
  assert.ok(typeof live.lookAt === 'string' && live.lookAt.length > 0, 'Save stamps lookAt');
  assert.equal(live.name, 'NewName', 'Save commits the typed name, trimmed');
  assert.equal(saved, 1, 'Save saves exactly once');
  assert.equal(closed, 1, 'Save closes the modal');
  assert.equal(rendered, 1, 'Save re-renders, so the sidebar character updates');
  assert.ok(toasted.includes('NewName'), 'Save toasts the new name');
});
