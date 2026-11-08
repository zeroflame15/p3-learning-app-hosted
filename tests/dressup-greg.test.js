// Dress-up + frog facts (requested 2026-11-08):
//  1. "Change my name & look" grows a full-body avatar builder:
//     body colour, hair and accessory pickers + a live preview,
//     stored as e.look and merged later-wins like face/glow/badge.
//  2. Tapping the frog in the Critter Lab tells a fun fact about
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
    look: { color: '', hair: '', accessory: '' }, lookAt: null,
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
  assert.ok(creator.includes("look:{color:'',hair:'',accessory:''}"), 'new explorers start with a natural body, no hair, no accessory');
  assert.ok(creator.includes('lookAt:null'), 'new explorers start with no look timestamp');
});

test('look merge: a later dress-up change wins, whichever side it is on', () => {
  const server = explorer({ look: { color: '', hair: '', accessory: '' }, lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ look: { color: '#ff8fa3', hair: 'curly', accessory: 'hat' }, lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.look, { color: '#ff8fa3', hair: 'curly', accessory: 'hat' }, 'the later look wins whole');
  assert.equal(merged.lookAt, '2026-11-06T08:00:00.000Z', 'the winning look timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.deepEqual(merged2.look, { color: '#ff8fa3', hair: 'curly', accessory: 'hat' }, 'argument order must not matter for look either');
  const older = explorer({ look: { color: '#ff8fa3', hair: 'curly', accessory: 'hat' }, lookAt: '2026-11-06T08:00:00.000Z' });
  const newer = explorer({ look: { color: '', hair: '', accessory: '' }, lookAt: '2026-11-07T08:00:00.000Z' });
  assert.deepEqual(mergeExplorer(older, newer).look, { color: '', hair: '', accessory: '' }, 'a later reset back to natural also wins');
});

test('look merge: a tie goes to the local side, legacy keeps the server look', () => {
  const at = '2026-11-06T08:00:00.000Z';
  const server = explorer({ look: { color: '#2dd4bf', hair: 'spiky', accessory: '' }, lookAt: at });
  const local = explorer({ look: { color: '#c084fc', hair: 'bun', accessory: 'necklace' }, lookAt: at });
  assert.deepEqual(mergeExplorer(server, local).look, { color: '#c084fc', hair: 'bun', accessory: 'necklace' }, 'tie goes to the local side, like name/look');
  const legacyServer = explorer({ look: { color: '#7db4ff', hair: '', accessory: '' }, lookAt: null });
  const legacyLocal = explorer({ look: { color: '', hair: 'long', accessory: 'glasses' }, lookAt: null });
  assert.deepEqual(mergeExplorer(legacyServer, legacyLocal).look, { color: '#7db4ff', hair: '', accessory: '' }, 'with no timestamps the server look stays (legacy)');
});

test('look merge: the merged look is a copy, not an alias of either side', () => {
  const server = explorer({ look: { color: '', hair: '', accessory: '' }, lookAt: '2026-11-01T10:00:00.000Z' });
  const local = explorer({ look: { color: '#ff8fa3', hair: 'curly', accessory: 'hat' }, lookAt: '2026-11-06T08:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  merged.look.color = '#000000';
  assert.equal(local.look.color, '#ff8fa3', 'mutating the merged look must not rewrite the local explorer');
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.includes('JSON.parse(JSON.stringify(b.look))'), 'the winning look must be deep-copied');
});

test('the look modal renders a full-body preview and three picker rows', () => {
  assert.ok(modal.includes('My full-body look'), 'modal must label the preview');
  assert.ok(modal.includes('id="lookPreview"'), 'the preview must have an id so taps can refresh it in place');
  assert.ok(modal.includes('avatarLookHTML(e.face,e.look,e.glow)'), 'the preview must render from the live face, look and glow');
  assert.ok(modal.includes('Body colour'), 'modal must label the colour row');
  assert.ok(modal.includes('class="iconbtn lookColorPick"'), 'colours must be swatch buttons');
  assert.ok(modal.includes('Hair'), 'modal must label the hair row');
  assert.ok(modal.includes('lookHairPick'), 'hair must have its own picker buttons');
  assert.ok(modal.includes('Accessory'), 'modal must label the accessory row');
  assert.ok(modal.includes('class="iconbtn lookAccPick"'), 'accessories must be icon buttons');
  const colors = eval(grabVar('LOOK_COLORS') + '\n;LOOK_COLORS');
  assert.equal(colors.length, 7, 'Natural plus 6 body colours');
  assert.equal(colors[0], '', 'Natural (no colour) comes first');
  const hairs = eval(grabVar('LOOK_HAIRS') + '\n;LOOK_HAIRS');
  assert.deepEqual(hairs, ['', 'spiky', 'curly', 'long', 'bun'], 'four hair styles plus none');
  const accs = eval(grabVar('LOOK_ACCS') + '\n;LOOK_ACCS');
  assert.deepEqual(accs, ['', 'necklace', 'hat', 'glasses', 'bowtie'], 'four accessories plus none');
});

test('avatarLookHTML: full body in the chosen colour, hair and accessory, with a glow fallback', () => {
  const consts = html.slice(html.indexOf('var LOOK_COLORS='), html.indexOf('function avatarLookHTML('));
  const out = eval(consts + '\n' + fnText('function avatarLookHTML(face, look, glow){') + '\n;avatarLookHTML("🦊", {color:"#ff8fa3",hair:"spiky",accessory:"hat"}, "#ffb020")');
  assert.ok(out.includes('🦊'), 'the animal face is the head');
  assert.ok(out.includes('background:#ff8fa3'), 'the body wears the chosen colour');
  assert.ok(out.includes('<svg viewBox="0 0 120 60"'), 'hair renders as an SVG over the head');
  assert.ok(out.includes('🎩'), 'the hat accessory shows');
  const natural = eval(consts + '\n' + fnText('function avatarLookHTML(face, look, glow){') + '\n;avatarLookHTML("🐸", {color:"",hair:"",accessory:""}, "#2dd4bf")');
  assert.ok(natural.includes('background:#2dd4bf'), 'Natural body falls back to the glow colour');
  assert.ok(!natural.includes('<svg'), 'no hair means no hair SVG');
  assert.ok(!natural.includes('🎩') && !natural.includes('📿'), 'no accessory means no accessory emoji');
  const legacy = eval(consts + '\n' + fnText('function avatarLookHTML(face, look, glow){') + '\n;avatarLookHTML("🦦", undefined, "#ffb020")');
  assert.ok(legacy.includes('🦦'), 'a legacy explorer without a look still renders');
  assert.ok(legacy.includes('background:#ffb020'), 'and its body falls back to glow');
  const glasses = eval(consts + '\n' + fnText('function avatarLookHTML(face, look, glow){') + '\n;avatarLookHTML("🐱", {color:"",hair:"curly",accessory:"glasses"}, "#ffb020")');
  assert.ok(glasses.includes('👓'), 'glasses show for the glasses choice');
  assert.ok(glasses.includes('circle'), 'curly hair is circles');
});

test('look taps follow the face/glow/badge pattern: live explorer, lookAt, typed name kept, preview refreshed in place', () => {
  const colorHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookColorPick')"), modal.indexOf("document.querySelectorAll('.lookHairPick')"));
  const hairHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookHairPick')"), modal.indexOf("document.querySelectorAll('.lookAccPick')"));
  const accHandler = modal.slice(modal.indexOf("document.querySelectorAll('.lookAccPick')"), modal.indexOf("document.getElementById('lkSave')"));
  for (const [name, h, field] of [['colour', colorHandler, 'live.look.color='], ['hair', hairHandler, 'live.look.hair='], ['accessory', accHandler, 'live.look.accessory=']]) {
    assert.ok(h.length > 0, name + ' handler found');
    assert.ok(h.includes('var live=ex();'), name + ' tap must resolve the live explorer at click time');
    assert.ok(h.includes(field), name + ' tap must write the look field to the live explorer');
    assert.ok(h.includes('live.lookAt=new Date().toISOString()'), name + ' tap must stamp lookAt');
    assert.ok(h.includes("if(!live.look)live.look={color:'',hair:'',accessory:''};"), name + ' tap must create the look object for legacy explorers');
    assert.ok(h.includes("document.getElementById('lkName')"), name + ' tap must read the name input so the typed name is preserved');
    assert.ok(h.includes('keepEl.value=keep'), name + ' tap must restore the typed name');
    assert.ok(h.includes('refreshLookPreview()'), name + ' tap must refresh the preview in place');
    assert.ok(!h.includes('openLookModal()'), name + ' tap must not rebuild the modal');
    assert.ok(!h.includes('render()'), name + ' tap must not re-render while the modal is open');
  }
  // Face and glow taps refresh the preview too (face is the head;
  // glow is the Natural body colour).
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

test('small spots still show the face emoji only, never a full body', () => {
  const render = fnBody('function render(){');
  assert.ok(render.includes("'+ex().face+'"), 'sidebar brand disc still shows the face emoji');
  const door = fnBody('function doorHTML(){');
  assert.ok(door.includes("<span class=\"face\">'+e.face+'</span>"), 'Grand Door explorer chips still show the face emoji');
  assert.ok(!render.includes('avatarLookHTML'), 'the full-body preview does not leak into the sidebar');
});
