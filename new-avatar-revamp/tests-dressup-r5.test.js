// Dress-up + frog facts (requested 2026-11-08):
//  1. "Change my name & look" grows a full-body avatar builder —
//     ROUND 5 (flat kawaii, sheet-exact, 2026-11-08): all 25
//     animals from the parent's reference sheet, redrawn to match
//     it exactly as closely as SVG allows — thick dark-brown
//     outlines, flat fills, big glossy black eyes with white
//     highlights, small simple mouths, pink blush cheeks. This is
//     a STYLE RESET from the round-3/4 shaded 3D plush look: no
//     gradients for shading, no fur texture, no grain. The parent
//     asked for it directly: "Change them to these characters.
//     exactly the same. No need change color option."
//       • NO COLOUR OPTION: animals keep their own colours from
//         the sheet. A stored look.color is ignored, like stored
//         hair in round 2. The look is now
//         {background:{shape,color,pattern,effect}}.
//       • NO ACCESSORIES: the parent dropped them (2026-11-08 —
//         per-animal positioning for 25 animals was too fiddly,
//         as the chick proved). A stored look.accessory is
//         ignored, the same way a stored colour is ignored.
//       • CUSTOM BACKGROUND: shape × colour × pattern × effect,
//         part of the look, shown everywhere the avatar appears.
//         Patterns are drawn inside the shape, bold enough to
//         read at 120px (dots 0.45, stars 0.6, stripes 0.3,
//         hearts 0.55 — the first version was too faint); the
//         effects now include three animated ones (twinkle,
//         bubbles, petals) alongside plain / glitter / glow /
//         shine, all respecting reduced motion. The petals are
//         soft pink at 0.6, in the margins, so they read.
//       • TAP TO PLAY: tapping the animal makes it do a happy
//         jump with squash-and-stretch plus a tiny sparkle burst
//         (the frog hops higher, the rabbit wiggles its ears
//         faster). The idle bob/blink keep running underneath.
//       • A soft ground shadow under the feet, so the character
//         lifts off the background and pops.
//     Same data model (e.look, lookAt), same draft editor —
//     Cancel genuinely reverts (round-4 live check), Save commits.
//     The otter and butterfly are gone (not on the sheet); a
//     stored otter/butterfly face falls back to the chick.
//  2. The explorer's avatar shows BIG in the top-left corner:
//     the full-body character ON its background in the sidebar
//     (130px) and in the mobile topbar (43px), refreshed on every
//     save — and now on the Grand Door explorer tile (56px) too.
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
    name: 'MightyOtter', nameAt: null, glow: '#ffb020', badge: '⭐', face: '🐤',
    look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: null,
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [],
    progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads: [], threadsClearedAt: null, deletedThreadIds: [],
    flashcards: [], deletedFlashcards: [], planner: [], deletedPlanner: [],
    critterName: 'Greg Washington', critterNameAt: null, care: {}, careGrewDay: null,
  }, over || {});
}

const modal = fnBody('function openLookModal(){');

test('new explorers start with the sheet default look', () => {
  const creator = fnBody('function newExplorer(name, code, level){');
  assert.ok(creator.includes("face:'🐤'"), 'new explorers start as the chick, the first animal on the sheet');
  assert.ok(creator.includes("look:{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}}"), 'new explorers start with a plain mint circle background, no pattern, no accessory');
  assert.ok(creator.includes('lookAt:null'), 'new explorers start with no look timestamp');
});

test('look merge: a later dress-up change wins, whichever side it is on', () => {
  const server = explorer({ look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ look: { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.look, { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, 'the later look wins whole, background included — pattern included');
  assert.equal(merged.lookAt, '2026-11-06T08:00:00.000Z', 'the winning look timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.deepEqual(merged2.look, { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, 'argument order must not matter for look either');
  const older = explorer({ look: { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, lookAt: '2026-11-06T08:00:00.000Z' });
  const newer = explorer({ look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: '2026-11-07T08:00:00.000Z' });
  assert.deepEqual(mergeExplorer(older, newer).look, { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, 'a later reset back to the default also wins');
});

test('look merge: a tie goes to the local side, legacy keeps the server look', () => {
  const at = '2026-11-06T08:00:00.000Z';
  const server = explorer({ look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: at });
  const local = explorer({ look: { background: { shape: 'star', color: 'sky', effect: 'shine', pattern: 'stripes' } }, lookAt: at });
  assert.deepEqual(mergeExplorer(server, local).look, { background: { shape: 'star', color: 'sky', effect: 'shine', pattern: 'stripes' } }, 'tie goes to the local side, like name/look');
  const legacyServer = explorer({ look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: null });
  const legacyLocal = explorer({ look: { background: { shape: 'heart', color: 'pink', effect: 'plain', pattern: 'hearts' } }, lookAt: null });
  assert.deepEqual(mergeExplorer(legacyServer, legacyLocal).look, { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, 'with no timestamps the server look stays (legacy)');
});

test('look merge: the merged look is a copy, not an alias of either side', () => {
  const server = explorer({ look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ look: { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  merged.look.background.color = 'lemon';
  assert.equal(local.look.background.color, 'pink', 'mutating the merged background must not rewrite the local explorer');
  merged.look.background.pattern = 'stars';
  assert.equal(local.look.background.pattern, 'dots', 'mutating the merged pattern must not rewrite the local explorer');
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.includes('JSON.parse(JSON.stringify(b.look))'), 'the winning look must be deep-copied');
});

test('the look modal renders a full-body preview, a 25-animal grid and a background picker — no colour, no hair, no accessories', () => {
  assert.ok(modal.includes('My full-body look'), 'modal must label the preview');
  assert.ok(modal.includes('id="lookPreview"'), 'the preview must have an id so taps can refresh it in place');
  assert.ok(modal.includes('avatarLookHTML(e.face,e.look,e.glow)'), 'the preview must render from the live face, look and glow');
  assert.ok(modal.includes('My animal friend'), 'modal must label the animal row');
  assert.ok(modal.includes('LOOK_FACES.map'), 'the animal row renders from the 25-animal list');
  assert.ok(modal.includes('My background'), 'modal must label the background section');
  assert.ok(modal.includes('class="iconbtn bgShapePick"'), 'background shapes must be picker buttons');
  assert.ok(modal.includes('class="iconbtn bgColorPick"'), 'background colours must be swatch buttons');
  assert.ok(modal.includes('class="iconbtn bgPatternPick"'), 'background patterns must be picker buttons');
  assert.ok(modal.includes('Polka dots'), 'the polka dots pattern is offered');
  assert.ok(modal.includes('Stars'), 'the stars pattern is offered');
  assert.ok(modal.includes('Stripes'), 'the stripes pattern is offered');
  assert.ok(modal.includes('Hearts'), 'the hearts pattern is offered');
  assert.ok(modal.includes('class="iconbtn bgEffectPick"'), 'background effects must be picker buttons');
  assert.ok(modal.includes('✨ Glitter'), 'the glitter effect is offered');
  assert.ok(modal.includes('🌟 Glow'), 'the glow effect is offered');
  assert.ok(modal.includes('💫 Shine'), 'the shine effect is offered');
  assert.ok(modal.includes('⭐ Twinkle'), 'the twinkle effect is offered');
  assert.ok(modal.includes('🫧 Bubbles'), 'the bubbles effect is offered');
  assert.ok(modal.includes('🌸 Petals'), 'the petals effect is offered');
  assert.ok(!modal.includes('Animal colour'), 'there is no Animal colour section any more');
  assert.ok(!modal.includes('lookColorPick'), 'there is no colour picker');
  assert.ok(!modal.includes('LOOK_COLORS'), 'the colour list is gone from the modal');
  assert.ok(!html.includes('var LOOK_COLORS='), 'the colour list is gone from the page');
  assert.ok(!modal.includes('Hair'), 'there is no hair row any more');
  assert.ok(!modal.includes('lookHairPick'), 'there is no hair picker');
  assert.ok(!html.includes('var LOOK_HAIRS='), 'the hair list is gone from the page');
  assert.ok(!modal.includes('>Accessory</label>'), 'there is no Accessory section any more');
  assert.ok(!modal.includes('lookAccPick'), 'there is no accessory picker');
  assert.ok(!html.includes('var LOOK_ACCS='), 'the accessory list is gone from the page');
  assert.ok(!html.includes('AVATAR_ACCS'), 'the accessory drawings are gone from the page');
  assert.ok(!html.includes('AV_ACC_OFF'), 'the per-animal accessory offsets are gone from the page');
  const faces = eval(grabVar('LOOK_FACES') + '\n;LOOK_FACES');
  assert.equal(faces.length, 25, '25 animals from the sheet, got ' + faces.length);
  assert.equal(faces[0], '🐤', 'the chick is first — it is the fallback for an otter or butterfly');
  assert.ok(!faces.includes('🦦'), 'the otter is not on the sheet, so it is not in the picker');
  assert.ok(!faces.includes('🦋'), 'the butterfly is not on the sheet, so it is not in the picker');
  const shapes = eval(grabVar('LOOK_BG_SHAPES') + '\n;LOOK_BG_SHAPES');
  assert.deepEqual(shapes, ['circle', 'heart', 'star', 'square', 'cloud', 'flower'], 'six background shapes');
  const colors = eval(grabVar('LOOK_BG_COLOR_NAMES') + '\n;LOOK_BG_COLOR_NAMES');
  assert.deepEqual(colors, ['mint', 'pink', 'sky', 'lilac', 'peach', 'lemon'], 'six pastel background colours');
  const patterns = eval(grabVar('LOOK_BG_PATTERNS') + '\n;LOOK_BG_PATTERNS');
  assert.deepEqual(patterns, ['', 'dots', 'stars', 'stripes', 'hearts'], 'four background patterns plus none');
  const effects = eval(grabVar('LOOK_BG_EFFECTS') + '\n;LOOK_BG_EFFECTS');
  assert.deepEqual(effects, ['plain', 'glitter', 'glow', 'shine', 'twinkle', 'bubbles', 'petals'], 'seven background effects — the three animated ones joined the four static ones');
});

test('avatarLookHTML: 25 flat kawaii characters, no colour, no accessories, backgrounds, ground shadow', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const render = (face, look, glow) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',' + JSON.stringify(look === undefined ? { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } } : look) + ',' + JSON.stringify(glow || '#ffb020') + ')');
  // Flat kawaii structure: one svg, class av5, a defs block with the
  // ground-shadow gradient ONLY — no shading gradients, no grain.
  const chick = render('🐤', { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } });
  assert.ok(chick.includes('data-animal="chick"'), 'the animal is drawn, not pasted: the chick renders');
  assert.ok(chick.includes('<svg class="av5" viewBox="0 0 200 260"'), 'the whole character is one flat svg on the shared grid');
  assert.ok(chick.includes('<defs>'), 'the defs block holds the ground shadow');
  assert.ok(chick.includes('id="gSh'), 'the ground shadow is a radial gradient');
  assert.ok(!chick.includes('url(#gB'), 'no body gradient: the animals are flat, not shaded');
  assert.ok(!chick.includes('feTurbulence'), 'no grain: the flat style has no texture');
  assert.ok(!html.includes('AVATAR_3D_CSS'), 'the 3D CSS variable is gone');
  assert.ok(!html.includes('class="av3d"'), 'the 3D class is gone');
  assert.ok(!html.includes('FULL-BODY LOOK — ROUND 4'), 'the round-4 block is gone');
  // Flat fills: the chick is its own yellow, flat, with a thick
  // dark-brown outline — exactly like the sheet.
  assert.ok(chick.includes('fill="#ffd94a"'), 'the chick is flat yellow');
  assert.ok(chick.includes('stroke="#4a3226"'), 'the outlines are thick dark brown');
  // No colour option: a stored colour value changes nothing and
  // never appears in the render.
  const withColor = render('🐤', { color: '#ff0000' });
  const plain = render('🐤', {});
  assert.ok(!withColor.includes('#ff0000'), 'a stored colour value never appears in the render');
  const norm = function (s) { return s.replace(/a\d+/g, 'aUID').replace(/animation-delay:[-0-9.]+s/g, 'animation-delay:X'); };
  assert.equal(norm(withColor), norm(plain), 'a stored colour changes nothing else either');
  assert.ok(!fn.includes('look.color'), 'the renderer never reads look.color');
  assert.ok(!html.includes('LOOK_HAIR'), 'no hair code remains in the page');
  // No accessories: a stored accessory value changes nothing and
  // never appears in the render — the necklace beads, the bow,
  // the crown and the hat are all gone.
  const withAcc = render('🐤', { accessory: 'necklace', background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } });
  assert.ok(!withAcc.includes('M84,118 Q100,136'), 'a stored necklace never renders its beads');
  assert.equal(norm(withAcc), norm(plain), 'a stored accessory changes nothing else either');
  assert.ok(!fn.includes('look.accessory'), 'the renderer never reads look.accessory');
  assert.ok(!fn.includes('AVATAR_ACCS'), 'the renderer never draws an accessory');
  // Unknown values degrade gracefully.
  assert.ok(render('👽', {}).includes('data-animal="chick"'), 'an unknown face falls back to the chick');
  assert.ok(render('🦦', {}).includes('data-animal="chick"'), 'a stored otter falls back to the chick');
  assert.ok(render('🦋', {}).includes('data-animal="chick"'), 'a stored butterfly falls back to the chick');
  assert.ok(render('🐤', null).includes('<svg'), 'a legacy explorer without a look still renders');
  // Gradient ids are unique per render, so two characters on one
  // page never share a gradient. (Both renders must happen in ONE
  // eval: each eval re-declares avUid at 0, as the consts slice
  // carries it — in the app it is one module-level counter.)
  const two = eval(consts + '\n' + fn + '\n;[avatarLookHTML("🐤",{},"#ffb020"),avatarLookHTML("🐤",{},"#ffb020")]');
  assert.notEqual(two[0].match(/id="gSh([^"]+)"/)[1], two[1].match(/id="gSh([^"]+)"/)[1], 'each render gets its own shadow gradient id');
  // Every animal is itself at a glance — its own recognition marker.
  const markers = [
    ['🐤', 'Q92,82 88,78', 'the chick has a little tuft on its head'],
    ['🐴', 'M58,66 C56,34 78,20 100,20', 'the horse has a brown mane over its head'],
    ['🐧', 'cy="188" rx="32" ry="38"', 'the penguin has a white belly'],
    ['🐻', 'fill="#c98a4b"', 'the bear is brown with a lighter muzzle'],
    ['🐢', 'fill="#a67c52"', 'the turtle has a brown shell'],
    ['🐢', 'M100,124 L124,140 L112,172', 'the turtle shell has a scute pattern'],
    ['🐼', 'rx="11" ry="16"', 'the panda has big black eye patches'],
    ['🦁', 'fill="#e08a2e"', 'the lion has a big orange mane'],
    ['🐱', 'M56,80 L40,76', 'the cat has whiskers'],
    ['🐷', 'cy="90" rx="16" ry="11"', 'the pig has a snout'],
    ['🦊', 'M146,182 C174,172 188,142', 'the fox has a big bushy tail'],
    ['🐸', 'cy="46" r="17"', 'the frog has big eye bumps'],
    ['🐘', 'M92,86 C90,110 88,130', 'the elephant has a trunk'],
    ['🦒', 'M86,80 L86,150 Q86,162', 'the giraffe has a long neck'],
    ['🐰', 'cy="35" rx="9" ry="32"', 'the rabbit has long upright ears'],
    ['🐰', 'y="95" width="5.5" height="9"', 'the rabbit has buck teeth'],
    ['🦉', 'cy="72" r="13"', 'the owl has big white eyes'],
    ['🦝', 'M62,66 Q100,52 138,66', 'the raccoon has a dark eye mask'],
    ['🐵', 'cy="80" rx="34" ry="32"', 'the monkey has a tan face patch'],
    ['🐯', 'M88,44 Q90,50 88,56', 'the tiger has forehead stripes'],
    ['🐊', 'M36,170 L40,170 L38,179 Z', 'the crocodile has a toothy grin'],
    ['🐊', 'cy="192" rx="58" ry="30"', 'the crocodile is long and low — a horizontal body, not a round one'],
    ['🐊', 'M148,178 C168,180 184,192 190,208', 'the crocodile has a tail to the side'],
    ['🐊', 'M110,164 L116,150 L122,164 Z', 'the crocodile has back spikes'],
    ['🐶', 'cy="72" rx="13" ry="15"', 'the dog has a brown patch over one eye'],
    ['🦥', 'M44,212 L42,218', 'the sloth has tiny claws'],
    ['🦆', 'cy="88" rx="14" ry="8"', 'the duck has a flat orange beak'],
    ['🦛', 'cy="96" rx="30" ry="16"', 'the hippo has a big pink snout'],
    ['🐑', 'M148,178 A24,24', 'the sheep has a fluffy scalloped wool body'],
    ['🐨', 'cy="88" rx="10" ry="14"', 'the koala has a big black nose'],
  ];
  for (const [face, marker, msg] of markers) {
    assert.ok(render(face, {}).includes(marker), msg);
  }
  // The ground shadow: a soft ellipse under the feet, drawn between
  // the background and the animal, so the character lifts off.
  const heart = render('🐤', { background: { shape: 'heart', color: 'pink', effect: 'plain', pattern: '' } });
  assert.ok(heart.includes('cy="246"'), 'the ground shadow sits under the feet');
  const iBg = heart.indexOf('M100,246'), iSh = heart.indexOf('cy="246"'), iBob = heart.indexOf('av-bob');
  assert.ok(iBg >= 0 && iSh > iBg && iBob > iSh, 'the shadow is drawn after the background and before the animal');
  // Width param: the same character at the sizes the app uses.
  const big = render('🐤', {});
  assert.ok(big.includes('width="190" height="247"'), 'the modal preview defaults to 190px wide');
  assert.ok(eval(consts + '\n' + fn + '\n;avatarLookHTML("🐤",{},"#ffb020",43)').includes('width="43" height="56"'), 'the mobile topbar character is 43px wide');
  assert.ok(eval(consts + '\n' + fn + '\n;avatarLookHTML("🐤",{},"#ffb020",130)').includes('width="130" height="169"'), 'the sidebar character is 130px wide');
  assert.ok(eval(consts + '\n' + fn + '\n;avatarLookHTML("🐤",{},"#ffb020",56)').includes('width="56" height="73"'), 'the Grand Door tile character is 56px wide');
});

test('backgrounds: every shape, colour and effect renders, and none means none', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const render = (look) => eval(consts + '\n' + fn + '\n;avatarLookHTML("🐤",' + JSON.stringify(look) + ',"#ffb020")');
  const shapeMarkers = {
    circle: 'r="92"', heart: 'M100,246', star: 'M100,40 L125,101',
    square: 'rx="28"', cloud: 'M25,200', flower: 'M135,74 A40,40',
  };
  for (const [shape, marker] of Object.entries(shapeMarkers)) {
    assert.ok(render({ background: { shape, color: 'mint', effect: 'plain', pattern: '' } }).includes(marker), 'the ' + shape + ' background renders');
  }
  const colors = eval(grabVar('LOOK_BG_COLORS') + '\n;LOOK_BG_COLORS');
  for (const [name, hex] of Object.entries(colors)) {
    assert.ok(render({ background: { shape: 'circle', color: name, effect: 'plain', pattern: '' } }).includes('fill="' + hex + '"'), 'the ' + name + ' background is ' + hex);
  }
  const noneBg = render({ background: { shape: 'circle', color: 'none', effect: 'plain', pattern: '' } });
  for (const hex of Object.values(colors)) {
    assert.ok(!noneBg.includes('fill="' + hex + '"'), 'no background means no background colour: ' + hex + ' is absent');
  }
  assert.ok(noneBg.includes('cy="246"'), 'no background still has the ground shadow under the feet');
  const glitter = render({ background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: '' } });
  assert.ok(glitter.includes('av-twinkle'), 'the glitter effect adds twinkling sparkles');
  assert.ok(glitter.includes('class="av-twinkle"'), 'the sparkles are in the twinkle class');
  const glow = render({ background: { shape: 'circle', color: 'mint', effect: 'glow', pattern: '' } });
  assert.ok(glow.includes('feGaussianBlur'), 'the glow effect adds a blurred halo');
  const shine = render({ background: { shape: 'circle', color: 'mint', effect: 'shine', pattern: '' } });
  assert.ok(shine.includes('rotate(18 100 135)'), 'the shine effect adds a diagonal reflective band');
  const plain = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } });
  assert.ok(!plain.includes('av-twinkle'), 'plain has no sparkles');
  assert.ok(!plain.includes('feGaussianBlur'), 'plain has no halo');
  assert.ok(!plain.includes('rotate(18 100 135)'), 'plain has no shine band');
  // Unknown background values degrade to the default.
  assert.ok(render({ background: { shape: 'banana', color: 'mint', effect: 'plain', pattern: '' } }).includes('r="92"'), 'an unknown shape falls back to the circle');
  assert.ok(render({ background: { shape: 'circle', color: 'purple', effect: 'plain', pattern: '' } }).includes('fill="#bfe8d8"'), 'an unknown colour falls back to mint');
  assert.ok(!render({ background: { shape: 'circle', color: 'mint', effect: 'sparkle', pattern: '' } }).includes('av-twinkle'), 'an unknown effect falls back to plain');
});

test('background patterns: each one renders inside the shape, visible at 120px, and none means none', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const render = (look) => eval(consts + '\n' + fn + '\n;avatarLookHTML("🐤",' + JSON.stringify(look) + ',"#ffb020")');
  // The chick has no element of its own at these opacities, so any
  // hit is the pattern. The first version was too faint at 120px
  // (dots 0.32, stars 0.4, stripes 0.16, hearts 0.35) — the
  // screen found the stars, hearts and stripes invisible — so
  // they were bumped and the stars and hearts made bigger.
  const dots = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: 'dots' } });
  assert.ok(dots.includes('clip-path="url(#bgClip'), 'the dots are clipped to the background shape');
  assert.ok(dots.includes('opacity="0.45"'), 'the dots read at 120px, and the animal still pops');
  const stars = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: 'stars' } });
  assert.ok(stars.includes('clip-path="url(#bgClip'), 'the stars are clipped to the background shape');
  assert.ok(stars.includes('opacity="0.6"'), 'the stars are brighter, so they read at 120px');
  assert.ok(stars.includes('M45,67'), 'the stars are bigger now (s=8), so they read at 120px');
  const stripes = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: 'stripes' } });
  assert.ok(stripes.includes('clip-path="url(#bgClip'), 'the stripes are clipped to the background shape');
  assert.ok(stripes.includes('opacity="0.3"'), 'the stripes read at 120px');
  const hearts = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: 'hearts' } });
  assert.ok(hearts.includes('clip-path="url(#bgClip'), 'the hearts are clipped to the background shape');
  assert.ok(hearts.includes('opacity="0.55"'), 'the hearts are brighter, so they read at 120px');
  assert.ok(hearts.includes('scale(1.3)'), 'the hearts are bigger now, so they read as hearts at 120px');
  // The pattern follows the shape, not just the circle.
  const heartStripes = render({ background: { shape: 'heart', color: 'pink', effect: 'plain', pattern: 'stripes' } });
  assert.ok(heartStripes.includes('opacity="0.3"'), 'stripes render on a heart background too');
  assert.ok(heartStripes.includes('M100,246'), 'the heart shape is still the heart');
  // None, missing and unknown all mean no pattern.
  const none = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } });
  assert.ok(!none.includes('opacity="0.45"') && !none.includes('opacity="0.6"') && !none.includes('opacity="0.3"') && !none.includes('opacity="0.55"'), 'no pattern means no pattern marks');
  const missing = render({ background: { shape: 'circle', color: 'mint', effect: 'plain' } });
  assert.ok(!missing.includes('opacity="0.45"') && !missing.includes('opacity="0.6"') && !missing.includes('opacity="0.3"') && !missing.includes('opacity="0.55"'), 'a stored background without a pattern falls back to none');
  const unknown = render({ background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: 'zigzag' } });
  assert.ok(!unknown.includes('opacity="0.45"') && !unknown.includes('opacity="0.6"') && !unknown.includes('opacity="0.3"') && !unknown.includes('opacity="0.55"'), 'an unknown pattern falls back to none');
  // No background shape, no pattern to draw inside.
  const noBg = render({ background: { shape: 'circle', color: 'none', effect: 'plain', pattern: 'dots' } });
  assert.ok(!noBg.includes('opacity="0.45"'), 'no background colour means no pattern either');
});

test('animated background effects: twinkle, bubbles and petals render, clipped, and are CSS-animated', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const render = (look) => eval(consts + '\n' + fn + '\n;avatarLookHTML("🐤",' + JSON.stringify(look) + ',"#ffb020")');
  const twinkle = render({ background: { shape: 'circle', color: 'sky', effect: 'twinkle', pattern: '' } });
  assert.ok(twinkle.includes('class="av-twinklebg"'), 'the twinkle effect draws fading star sparkles');
  assert.ok(twinkle.includes('clip-path="url(#bgClip'), 'the twinkle stars are clipped to the shape');
  const bubbles = render({ background: { shape: 'circle', color: 'sky', effect: 'bubbles', pattern: '' } });
  assert.ok(bubbles.includes('class="av-bub"'), 'the bubbles effect draws drifting circles');
  assert.ok(bubbles.includes('clip-path="url(#bgClip'), 'the bubbles are clipped to the shape');
  const petals = render({ background: { shape: 'circle', color: 'sky', effect: 'petals', pattern: '' } });
  assert.ok(petals.includes('class="av-pet"'), 'the petals effect draws drifting petals');
  assert.ok(petals.includes('clip-path="url(#bgClip'), 'the petals are clipped to the shape');
  // The petals are soft pink, not white — white petals on pale
  // sky blue were invisible at 120px, and at 0.55 they barely
  // read even at 3x zoom. The chick's own blush is the same
  // pink, so count the difference against a plain render:
  // seven petals, no more, no fewer. They are bigger than
  // before, hold at 0.6 while they fall, and start in the
  // margins and the top crescent, so they stay visible while
  // they fall instead of hiding behind the animal.
  const plainSky = render({ background: { shape: 'circle', color: 'sky', effect: 'plain', pattern: '' } });
  const pinkIn = (s) => (s.match(/fill="#f7a8b8"/g) || []).length;
  assert.equal(pinkIn(petals) - pinkIn(plainSky), 7, 'all seven petals are soft pink (the blush pink)');
  assert.ok(petals.includes('M0,-9 C5,-3 5,5 0,9'), 'the petals are bigger than before');
  assert.ok(petals.includes('translate(28 60)') && petals.includes('translate(172 50)'), 'the petals start in the margins, so they stay visible while they fall');
  assert.ok(html.includes('15%{opacity:.6}85%{opacity:.6}'), 'the petals hold at 0.6 while they fall');
  // The CSS animates them — slow and gentle, staggered by the
  // inline delays, so they never move in lockstep.
  for (const k of ['@keyframes av5TwinkleBg', '@keyframes av5Bub', '@keyframes av5Pet']) {
    assert.ok(html.includes(k), 'the page style contains ' + k);
  }
  assert.ok(bubbles.includes('animation-delay:-'), 'the bubbles are staggered with negative delays');
  assert.ok(petals.includes('animation-delay:-'), 'the petals are staggered with negative delays');
  // The static glitter is unchanged — and it is not the twinkle
  // effect (different class, different keyframes).
  const glitter = render({ background: { shape: 'circle', color: 'sky', effect: 'glitter', pattern: '' } });
  assert.ok(glitter.includes('class="av-twinkle"'), 'glitter still twinkles');
  assert.ok(!glitter.includes('av-twinklebg'), 'glitter is not the twinkle effect');
  // Reduced motion switches the animated backgrounds off, exactly
  // like the bob and the blink.
  assert.ok(html.includes('@media (prefers-reduced-motion: reduce){.av5 .av-bob,.av5 .av-blink,.av5 .av-earwig,.av5 .av-sway,.av5 .av-hop,.av5 .av-nod,.av5 .av-twinkle,.av5 .av-twinklebg,.av5 .av-bub,.av5 .av-pet{animation:none}'), 'the reduced-motion rule switches the animated backgrounds off');
});

test('tap to play: tapping the animal adds the play class, jumps it and bursts sparkles', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const render = (face, look) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',' + JSON.stringify(look || {}) + ',"#ffb020")');
  const chick = render('🐤');
  assert.ok(chick.includes('onclick="avatarPlay(this)"'), 'the svg is the tap target — every avatar renders through here, so the sidebar, the preview and the Grand Door tile all play');
  assert.ok(chick.includes('class="av-jump"'), 'the animal sits in a jump group, so the trick moves the animal only — the background and ground shadow stay put');
  assert.ok(chick.includes('class="av-sparkles"'), 'the sparkle burst group is in every render');
  assert.ok(chick.includes('class="av-bob"'), 'the idle bob is still there underneath the trick');
  // The CSS: the play animation, the frog's higher hop, the
  // rabbit's faster ear wiggle, and the sparkle burst.
  assert.ok(html.includes('.av5.av-play .av-jump{animation:av5Play .8s'), 'tapping adds the play jump');
  assert.ok(html.includes('.av5[data-animal="frog"].av-play .av-jump{animation:av5PlayHop .8s'), 'the frog hops higher than the rest');
  assert.ok(html.includes('.av5[data-animal="rabbit"].av-play .av-earwig{animation:av5EarWig .8s'), 'the rabbit wiggles its ears faster while it plays');
  assert.ok(html.includes('.av5.av-play .av-sparkles{animation:av5Spark .8s'), 'tapping bursts the sparkles');
  for (const k of ['@keyframes av5Play', '@keyframes av5PlayHop', '@keyframes av5Spark']) {
    assert.ok(html.includes(k), 'the page style contains ' + k);
  }
  // Reduced motion switches the trick off — tapping does nothing
  // visible, like the bob and the blink.
  assert.ok(html.includes('.av5.av-play .av-jump,.av5.av-play .av-sparkles{animation:none!important}'), 'the reduced-motion rule switches the tap trick off');
  // Functional: avatarPlay adds the class, ignores a second tap
  // while it is playing, and takes the class off when the jump
  // ends — but not when the sparkles finish on their own.
  const playStart = html.indexOf('function avatarPlay(svg){');
  assert.ok(playStart >= 0, 'avatarPlay found');
  const playEnd = html.indexOf('\n}', playStart);
  assert.ok(playEnd > playStart, 'avatarPlay ends');
  const avatarPlay = eval(html.slice(playStart, playEnd + 2) + '\n;avatarPlay');
  function fakeSvg() {
    const classes = new Set();
    const listeners = {};
    return {
      classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
      addEventListener: (t, f) => { listeners[t] = f; },
      removeEventListener: (t) => { delete listeners[t]; },
      fire: (t, e) => { if (listeners[t]) listeners[t](e); },
      _classes: classes, _listeners: listeners,
    };
  }
  const svg = fakeSvg();
  avatarPlay(svg);
  assert.ok(svg._classes.has('av-play'), 'a tap adds the play class');
  assert.ok(svg._listeners.animationend, 'a tap listens for the end of the jump');
  avatarPlay(svg);
  assert.equal(Object.keys(svg._listeners).length, 1, 'a second tap while it is playing does nothing — no duplicate listener');
  svg.fire('animationend', { animationName: 'av5Spark' });
  assert.ok(svg._classes.has('av-play'), 'the sparkles finishing on their own must not end the trick early');
  svg.fire('animationend', { animationName: 'av5Play' });
  assert.ok(!svg._classes.has('av-play'), 'the jump ending takes the class off, so the idle life resumes');
  assert.ok(!svg._listeners.animationend, 'the listener is removed when the trick ends');
  const frog = fakeSvg();
  avatarPlay(frog);
  frog.fire('animationend', { animationName: 'av5PlayHop' });
  assert.ok(!frog._classes.has('av-play'), 'the frog\'s higher hop ends the trick the same way');
});

test('idle life: every animal bobs and blinks, each with its own signature motion', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const render = (face) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',{},"#ffb020")');
  const faces = eval(grabVar('LOOK_FACES') + '\n;LOOK_FACES');
  assert.equal(faces.length, 25, '25 animals');
  for (const face of faces) {
    const s = render(face);
    assert.ok(s.includes('class="av-blink"'), face + ' blinks');
    assert.ok(s.includes('av-bob'), face + ' bobs');
    assert.ok(s.includes('animation-delay:'), face + ' staggers its motion so a page of animals never moves in lockstep');
  }
  const sig = { '🐸': 'av-hop', '🐘': 'av-sway', '🦒': 'av-nod', '🐰': 'av-earwig', '🐶': 'av-earwig' };
  for (const [face, motion] of Object.entries(sig)) {
    assert.ok(render(face).includes(motion), face + ' has its signature motion ' + motion);
  }
  // The frog's eyes are green, like the live frog's.
  assert.ok(render('🐸').includes('fill="#3a7d2c"') || render('🐸').includes('fill="#2f7a3d"'), 'the frog keeps a green eye area, like the live frog');
  // The CSS itself is in the page's <style>, next to Pip's own
  // animation rules — not only in the AVATAR_5_CSS variable.
  for (const k of ['@keyframes av5Bob', '@keyframes av5Blink', '@keyframes av5Hop', '@keyframes av5EarWig', '@keyframes av5Nod', '@keyframes av5Sway', '@keyframes av5Twinkle']) {
    assert.ok(html.includes(k), 'the page style contains ' + k);
  }
  assert.ok(html.includes('.av5 .av-bob'), 'the bob rule is scoped to avatar svgs');
  assert.ok(html.includes('@media (prefers-reduced-motion: reduce){.av5 .av-bob'), 'the reduced-motion rule switches the avatar motion off');
  assert.ok(html.includes('var AVATAR_5_CSS='), 'the CSS also lives in the AVATAR_5_CSS variable (single source for the preview)');
});

test('all 25 animals render a flat character with the tap-to-play groups', () => {
  const consts = html.slice(html.indexOf('var AV_INK='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face,look,glow,w){');
  const faces = eval(grabVar('LOOK_FACES') + '\n;LOOK_FACES');
  let n = 0;
  for (const f of faces) {
    const s = eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(f) + ',{},"#ffb020")');
    assert.ok(s.includes('class="av5"'), 'every animal renders a flat svg: ' + f);
    assert.ok(s.includes('data-animal="'), 'every animal names itself: ' + f);
    assert.ok(s.includes('cy="246"'), 'every animal has the ground shadow: ' + f);
    assert.ok(s.includes('class="av-jump"'), 'every animal has the tap-to-play jump group: ' + f);
    assert.ok(s.includes('class="av-sparkles"'), 'every animal has the tap-to-play sparkles: ' + f);
    assert.ok(s.includes('onclick="avatarPlay(this)"'), 'every animal is tappable: ' + f);
    n++;
  }
  assert.equal(n, 25, '25 animals');
});

test('look taps write to the draft only: no live write, no save, typed name kept, preview refreshed in place', () => {
  const shapeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgShapePick')"), modal.indexOf("document.querySelectorAll('.bgColorPick')"));
  const colorHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgColorPick')"), modal.indexOf("document.querySelectorAll('.bgPatternPick')"));
  const patternHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgPatternPick')"), modal.indexOf("document.querySelectorAll('.bgEffectPick')"));
  const effectHandler = modal.slice(modal.indexOf("document.querySelectorAll('.bgEffectPick')"), modal.indexOf("document.querySelectorAll('.glowPick')"));
  for (const [name, h, field] of [
    ['background shape', shapeHandler, 'draft.look.background.shape='],
    ['background colour', colorHandler, 'draft.look.background.color='],
    ['background pattern', patternHandler, 'draft.look.background.pattern='],
    ['background effect', effectHandler, 'draft.look.background.effect='],
  ]) {
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
  const faceHandler = modal.slice(modal.indexOf("document.querySelectorAll('.facePick')"), modal.indexOf("document.querySelectorAll('.bgShapePick')"));
  assert.ok(faceHandler.includes('draft.face='), 'face tap must write the draft face');
  assert.ok(!faceHandler.includes('live.face='), 'face tap must not touch the live face');
  assert.ok(!faceHandler.includes('save()'), 'face tap must not save');
  assert.ok(faceHandler.includes('refreshLookPreview()'), 'face tap must refresh the preview');
  const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
  assert.ok(glowHandler.includes('draft.glow='), 'glow tap must write the draft glow');
  assert.ok(!glowHandler.includes('save()'), 'glow tap must not save');
  assert.ok(glowHandler.includes('refreshLookPreview()'), 'glow tap must refresh the preview');
  const badgeHandler = modal.slice(modal.indexOf("document.querySelectorAll('.badgePick')"), modal.indexOf("document.getElementById('lkSave')"));
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

test('the top-left avatar IS the full-body character on its background, big, and it updates on every save', () => {
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
  assert.ok(door.includes('avatarLookHTML(e.face,e.look,e.glow,56)'), 'Grand Door explorer chips show the character on its background, 56px');
  assert.ok(!door.includes("<span class=\"face\">'+e.face+'</span>"), 'the bare face emoji chip is gone from the Grand Door');
});

test('draft editor: picks never save, Save commits the draft, Cancel changes nothing', () => {
  // The editor works on a draft copy of the look (round-3 bug: every
  // pick saved live, so Cancel could not revert it).
  assert.ok(modal.includes('var draft={face:e.face'), 'the editor opens a draft copy of the look');
  assert.ok(modal.includes('pattern:((e.look||{}).background||{}).pattern'), 'the draft copies the saved background pattern, it does not alias it');
  assert.ok(modal.includes('background:{shape:((e.look||{}).background||{}).shape'), 'the draft copies the saved background too');
  assert.ok(modal.includes('avatarLookHTML(draft.face,draft.look,draft.glow)'), 'the preview renders from the draft');
  assert.equal((modal.match(/save\(\);/g) || []).length, 1, 'the whole editor saves exactly once — on Save my look');
  assert.ok(modal.includes('onclick="closeModal()">Cancel'), 'Cancel just closes the modal');
  const closer = fnBody('function closeModal(){');
  assert.ok(!closer.includes('save('), 'closeModal never saves');
  // Functional: run the Save handler with a draft and a fresh live
  // explorer, and prove it commits the draft and saves exactly once.
  const saveSrc = modal.slice(modal.indexOf("document.getElementById('lkSave').onclick"));
  const saveFn = saveSrc.slice(0, saveSrc.lastIndexOf('};') + 2);
  var draft = { face: '🐸', glow: '#2dd4bf', badge: '🚀', look: { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } } };
  var live = { name: 'MightyOtter', face: '🐤', glow: '#ffb020', badge: '⭐', look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, lookAt: null, nameAt: null };
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
  assert.deepEqual(live.look, { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, 'Save commits the draft look, background included — pattern included');
  assert.notEqual(live.look, draft.look, 'the committed look is a copy, not the draft object');
  assert.notEqual(live.look.background, draft.look.background, 'the committed background is a copy too, not the draft object');
  assert.deepEqual(draft.look, { background: { shape: 'heart', color: 'pink', effect: 'glitter', pattern: 'dots' } }, 'Save must not mutate the draft');
  assert.ok(typeof live.lookAt === 'string' && live.lookAt.length > 0, 'Save stamps lookAt');
  assert.equal(live.name, 'NewName', 'Save commits the typed name, trimmed');
  assert.equal(saved, 1, 'Save saves exactly once');
  assert.equal(closed, 1, 'Save closes the modal');
  assert.equal(rendered, 1, 'Save re-renders, so the sidebar character updates');
  assert.ok(toasted.includes('NewName'), 'Save toasts the new name');
});
