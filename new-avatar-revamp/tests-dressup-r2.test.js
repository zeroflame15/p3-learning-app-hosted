// Dress-up + frog facts (requested 2026-11-08):
//  1. "Change my name & look" grows a full-body avatar builder —
//     ROUND 2 (the parent's corrected brief, his own reference
//     picture): each animal is a COMPLETE full-body character in
//     its own shape (body IS the animal); the colour picker
//     recolours the WHOLE animal; NO hair at all; accessories are
//     tiny touches only (necklace, tiny hat, flower, star, bow).
//     Stored as e.look={color,accessory} and merged later-wins
//     like face/glow/badge. A stored hair value is ignored.
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

test('avatarLookHTML: a complete full-body character per animal, whole-animal colour, tiny accessories, no hair', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const fn = fnText('function avatarLookHTML(face, look, glow, w){');
  const render = (face, look, glow) => eval(consts + '\n' + fn + '\n;avatarLookHTML(' + JSON.stringify(face) + ',' + JSON.stringify(look) + ',' + JSON.stringify(glow || '#ffb020') + ')');
  // Whole-animal colour: pink is the face AND the body, not a blob.
  const pinkFox = render('🦊', { color: '#ff8fa3', accessory: '' });
  assert.ok(pinkFox.includes('data-animal="fox"'), 'the animal is drawn, not pasted: the fox renders');
  assert.ok(pinkFox.includes('<svg viewBox="0 0 200 260"'), 'the whole character is one SVG on the shared grid');
  const pinkFills = (pinkFox.match(/fill="#ff8fa3"/g) || []).length;
  assert.ok(pinkFills >= 6, 'pink is the face, body, ears, arms and tail — got ' + pinkFills + ' pink fills');
  const naturalFox = render('🦊', { color: '', accessory: '' }, '#2dd4bf');
  assert.ok(naturalFox.includes('fill="#e8743c"'), 'Natural fox wears its own orange');
  assert.ok(!naturalFox.includes('fill="#2dd4bf"'), 'Natural ignores the glow — the animal keeps its own colour');
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
  // Every animal is itself at a glance — its own recognition marker.
  const markers = [
    ['🦦', 'rgba(74,44,26,0.5)', 'the otter has whiskers'],
    ['🦦', 'rx="49"', 'the otter face is wider and flatter than a circle, not a bear'],
    ['🐸', 'cy="46" r="15"', 'the frog has eye bumps'],
    ['🦋', 'rotate(-24 50 118)', 'the butterfly has big wings'],
    ['🐱', 'M62,42 L56,10 L86,30 Z', 'the cat has pointed triangle ears'],
    ['🐶', 'fill="#f08ba0"', 'the dog has its tongue out'],
    ['🐰', 'cy="35" rx="9" ry="32"', 'the rabbit has long upright ears (reference ratio: 35px above the head top)'],
    ['🦁', 'r="58"', 'the lion has a mane ring'],
    ['🐼', 'rx="12" ry="15"', 'the panda has eye patches'],
    ['🦊', 'rotate(18 170 118)', 'the fox has a big bushy tail with a pale tip'],
    ['🐢', 'fill="#4e8f4c"', 'the turtle shell is its own dark green'],
    ['🐢', 'M100,104 L100,126', 'the turtle shell has segment lines'],
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
  const pig = render('🐷', { color: '', accessory: '' });
  assert.ok(pig.includes('cy="172" rx="52" ry="50"'), 'the pig body starts at the chin too');
  const turtle = render('🐢', { color: '', accessory: '' });
  assert.ok(turtle.includes('cy="78" r="34"'), 'the turtle head sits down into the shell');
  assert.ok(turtle.includes('M100,100'), 'the shell dome starts under the head');
  const frog = render('🐸', { color: '', accessory: '' });
  assert.ok(frog.includes('cy="178" rx="52" ry="48"'), 'the frog body touches the head');
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

test('look taps follow the face/glow/badge pattern: live explorer, lookAt, typed name kept, preview refreshed in place', () => {
  const colorHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookColorPick')"), modal.indexOf("document.querySelectorAll('.lookAccPick')"));
  const accHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookAccPick')"), modal.indexOf("document.getElementById('lkSave')"));
  for (const [name, h, field] of [['colour', colorHandler, 'live.look.color='], ['accessory', accHandler, 'live.look.accessory=']]) {
    assert.ok(h.length > 0, name + ' handler found');
    assert.ok(h.includes('var live=ex();'), name + ' tap must resolve the live explorer at click time');
    assert.ok(h.includes(field), name + ' tap must write the look field to the live explorer');
    assert.ok(h.includes('live.lookAt=new Date().toISOString()'), name + ' tap must stamp lookAt');
    assert.ok(h.includes("if(!live.look)live.look={color:'',accessory:''};"), name + ' tap must create the look object for legacy explorers');
    assert.ok(h.includes("document.getElementById('lkName')"), name + ' tap must read the name input so the typed name is preserved');
    assert.ok(h.includes('keepEl.value=keep'), name + ' tap must restore the typed name');
    assert.ok(h.includes('refreshLookPreview()'), name + ' tap must refresh the preview in place');
    assert.ok(!h.includes('openLookModal()'), name + ' tap must not rebuild the modal');
    assert.ok(!h.includes('render()'), name + ' tap must not re-render while the modal is open');
  }
  // Face and glow taps refresh the preview too (face is the head).
  const faceHandler = modal.slice(modal.indexOf("document.querySelectorAll('.facePick')"), modal.indexOf("document.querySelectorAll('.glowPick')"));
  assert.ok(faceHandler.includes('refreshLookPreview()'), 'face tap must refresh the preview');
  const glowHandler = modal.slice(modal.indexOf("document.querySelectorAll('.glowPick')"), modal.indexOf("document.querySelectorAll('.badgePick')"));
  assert.ok(glowHandler.includes('refreshLookPreview()'), 'glow tap must refresh the preview');
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
  const refresh = modal.slice(modal.indexOf('function refreshLookPreview()'), modal.indexOf("document.querySelectorAll('.facePick')"));
  assert.ok(refresh.includes("document.getElementById('sideAvatar')"), 'a look tap refreshes the sidebar character in place');
  assert.ok(refresh.includes("document.getElementById('tbChar')"), 'a look tap refreshes the mobile topbar character in place');
  assert.ok(refresh.includes('avatarLookHTML(live.face,live.look,live.glow,130)'), 'the sidebar refresh renders the live look at 130px');
  assert.ok(refresh.includes('avatarLookHTML(live.face,live.look,live.glow,43)'), 'the topbar refresh renders the live look at 43px');
  const door = fnBody('function doorHTML(){');
  assert.ok(door.includes("<span class=\"face\">'+e.face+'</span>"), 'Grand Door explorer chips still show the face emoji');
});
