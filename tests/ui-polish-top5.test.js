// UI polish top 5 (Bryan, 2026-11-22 — "Build the top 5 first"):
//  1. Route transition (only on navigation) + shared press states.
//  2. Silent quest-flow taps get sounds (quest start, Next/Skip/
//     Start/Quit, difficulty buttons).
//  3. One nav sound from go() + modal/toast/More-sheet transitions.
//  4. Ask Pip sounds (send blip + reply chime).
//  5. Small stuff: door-tap note, dressup/Vibe/delete/cancel/mute
//     blips, 44px touch targets, bigger bottom-nav labels, and a
//     friendly Friends loading state.
// Structure and mechanism are unchanged — visuals, sound and
// motion only. The sound/motion details that changed are pinned
// in tests/sounds.test.js (nav + door sounds).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

function cssRule(selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}');
  const m = html.match(re);
  assert.ok(m, selector + ' rule exists');
  return m[0];
}

// ---------- 1. Shared press states ----------
test('press: every tappable gets a smooth press state, and the grey mobile tap flash is gone', () => {
  assert.ok(html.includes('button{-webkit-tap-highlight-color:transparent}'), 'no default grey tap flash on buttons');
  const base = html.match(/[^{]*\{transition:transform \.08s ease\}/);
  assert.ok(base, 'a shared press/release transition exists');
  for (const sel of ['.navbtn', '.bottomnav button', '.tilebtn', '.optbtn', '.themechip', '.picbtn', '.lvlbtn', '.explorerchip', '.flashcard', '.threadrow', '.learn-topic-row', '.stage', '.sorttile', '.scrtile', '.sbtile', '.memcard', '.iconbtn', '.keypad button', '.tickbtn', '.delbtn', '.sidecritter', '.avatarbtn', '.chip', '.xwclue', '.scrslot', '.sbslot', '.balloon']) {
    assert.ok(base[0].includes(sel), 'press transition covers ' + sel);
  }
  assert.ok(!base[0].includes('.parkcar'), 'parkcar keeps its own left/top slide transition — it is not in the press-transition list');
  const active = html.match(/[^{]*:active\{transform:scale\(\.97\);filter:brightness\(\.96\)\}/);
  assert.ok(active, 'a shared :active rule exists');
  for (const sel of ['.navbtn:active', '.optbtn:active', '.tilebtn:active', '.threadrow:active', '.learn-topic-row:active', '.memcard:active', '.tickbtn:active', '.delbtn:active', '.parkcar:active']) {
    assert.ok(active[0].includes(sel), 'press state covers ' + sel);
  }
  const btn = cssRule('.btn:active');
  assert.ok(btn.includes('translateY(2px)'), '.btn keeps its own translateY press — it is not overridden by the shared scale');
});

// ---------- 1. Route transition (navigation only) ----------
test('route transition: go() stamps .route-in only when the route changes; plain render() never replays it', () => {
  assert.ok(html.includes('.content.route-in{animation:fadein .22s ease}'), 'the dead fadein keyframe is finally used, on #content');
  const go = fnBody('function go(');
  assert.ok(go.includes('function go(r, silent)'), 'go() takes an optional silent flag');
  assert.ok(go.includes('if(_prevRoute!==r){ navAnim=true;'), 'the animation flag is set only on a real route change');
  assert.ok(go.includes('sndNav()'), 'the same route change plays the nav sound');
  const render = fnBody('function render(){');
  assert.ok(render.includes('var _anim=navAnim; navAnim=false;'), 'render() consumes the flag exactly once');
  assert.ok(render.includes("(_anim?' route-in':'')"), 'the flag stamps .route-in on #content');
  assert.ok(!render.includes('navAnim=true'), 'render() itself never sets the flag — background re-renders stay still');
});

// ---------- 2. Silent quest-flow taps ----------
test('quest start plays a short rising cue', () => {
  const cue = fnBody('function sndQuestStart(){');
  assert.ok(cue.includes('523') && cue.includes('784') && cue.includes('1046'), 'three rising notes');
  const flow = fnBody('function startQuestFlow(');
  assert.ok(flow.includes('sndQuestStart();'), 'starting a quest plays the cue');
  assert.ok(flow.indexOf('sndQuestStart();') > flow.indexOf('moeInSeason'), 'an out-of-season quest still stays silent — the cue is after the early return');
});

test('warm-up / quiz in-between taps share one soft advance blip', () => {
  assert.ok(html.includes('function sndAdvance(){'), 'sndAdvance exists');
  const warm = fnBody('function bindWarmup(){');
  assert.ok((warm.match(/sndAdvance\(\);/g) || []).length >= 3, 'warm-up Next, Skip and Start all blip');
  const quiz = fnBody('function bindQuiz(){');
  assert.ok((quiz.match(/sndAdvance\(\);/g) || []).length >= 3, 'boost Start, quiz Next and quiz Quit all blip');
});

test('difficulty buttons play a distinct soft tone per choice', () => {
  const diff = fnBody('function sndDiff(');
  assert.ok(diff.includes("felt==='easy'") && diff.includes("felt==='hard'"), 'one tone per choice');
  const apply = fnBody('function applyDifficultyChoice(');
  assert.ok(apply.includes('sndDiff(felt);'), 'the choice plays its tone');
});

// ---------- 3. One nav sound + modal/toast/sheet transitions ----------
test('nav sound: go() plays it once, and no per-binding nav sound survives', () => {
  const sndNav = fnBody('function sndNav(){');
  assert.ok(sndNav.includes('celesta(1318.5'), 'one short celesta note');
  assert.ok(sndNav.includes('<150'), 'a ~150ms gate stops rapid taps stacking notes');
  assert.ok(!html.includes("sndPop(); go("), 'no binding pops before navigating any more');
  assert.ok(!html.includes("sndMystery(); go("), 'no binding plays the mystery phrase before navigating any more');
  const go = fnBody('function go(');
  assert.ok(go.includes("if(!silent&&typeof sndNav==='function')sndNav()"), 'go() plays the nav sound unless silenced (guarded like applyTheme, so test harnesses that extract go() alone keep working)');
  // The Grand Door opening already plays the 2.3s entrance phrase —
  // the nav blip must not double it.
  assert.ok((html.match(/go\('home', true\)/g) || []).length === 2, 'both door-open paths (new explorer + returning explorer) silence the nav blip');
});

test('modals fade the backdrop and pop the card in', () => {
  assert.ok(html.includes('.overlay.open{animation:overlayFade .18s ease}'), 'the overlay fades in');
  assert.ok(html.includes('.overlay.open .modal{animation:modalPop .18s ease}'), 'the card pops/slides in');
  assert.ok(html.includes('@keyframes overlayFade{from{opacity:0}to{opacity:1}}'), 'overlay fade keyframes exist');
  assert.ok(html.includes('@keyframes modalPop{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}'), 'modal pop keyframes exist');
  const open = fnBody('function openModal(');
  assert.ok(open.includes("void o.offsetWidth"), 're-opening a modal restarts its entrance animation');
});

test('toasts slide up and fade in, then fade out before hiding', () => {
  assert.ok(html.includes('.toast.show{animation:toastIn .25s ease}'), 'toast slides up + fades in');
  assert.ok(html.includes('.toast.hide{animation:toastOut .2s ease forwards}'), 'toast fades out');
  const toast = fnBody('function toast(');
  assert.ok(toast.includes("classList.add('show')"), 'showing drives the .show class');
  assert.ok(toast.includes("classList.add('hide')"), 'hiding drives the .hide class');
  assert.ok(toast.includes('2600'), 'the toast still lives 2.6s before fading out');
});

test('mobile More sheet slides up from the bottom bar', () => {
  const rule = cssRule('.btmmore');
  assert.ok(rule.includes('animation:sheetUp .18s ease'), 'the sheet slides up');
  assert.ok(html.includes('@keyframes sheetUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}'), 'sheet keyframes exist');
});

// ---------- 4. Ask Pip sounds ----------
test('Ask Pip: a soft send blip, a gentle two-note reply chime, and a pop on thread switch', () => {
  assert.ok(html.includes('function sndSend(){'), 'sndSend exists');
  const reply = fnBody('function sndReply(){');
  assert.ok(reply.includes('celesta(880') && reply.includes('celesta(1174.66'), 'two gentle celesta notes');
  const ask = fnBody('function bindAsk(){');
  assert.ok(ask.includes('sndSend();'), 'sending a message blips');
  assert.ok((ask.match(/sndReply\(\);/g) || []).length >= 3, 'the reply chimes on every reply path (instant help, live reply, offline fallback)');
  assert.ok(ask.includes("sndPop(); activeThread=b.getAttribute('data-thread');"), 'switching threads pops');
});

// ---------- 5. The small stuff ----------
test('small stuff: door tap, dressup, Vibe, delete, cancel and mute blips', () => {
  assert.ok(html.includes('function sndDoorTap(){'), 'sndDoorTap exists');
  const doorTap = fnBody('function sndDoorTap(){');
  assert.ok(doorTap.includes('celesta(1174.66'), 'one short celesta note per picture tap');
  assert.ok(html.includes('sndPop(); openLookModal();'), 'opening Change my name & look pops, like the About modal');
  const save = fnBody('function openLookModal(){');
  assert.ok(save.includes('save(); sndPop(); closeModal();'), 'saving a look pops too');
  const render = fnBody('function render(){');
  assert.ok(render.includes("sndPop(); var e=ex(); if(vibeId)"), 'the Vibe track toggle pops');
  assert.ok(render.includes('var _m=toggleMute(); if(!_m)sndPop();'), 'unmuting blips so a child hears sound is back on — muting stays silent');
  const critter = fnBody('function bindCritter(){');
  assert.ok(critter.includes('sndPop(); pondMode=null;'), 'cancelling care pops');
  const create = fnBody('function bindCreate(){');
  assert.ok(create.includes('sndDel();'), 'deleting a flashcard plays the soft low blip');
  assert.ok(html.includes('function sndDel(){'), 'sndDel exists');
});

test('small stuff: 44px touch targets, bigger bottom-nav labels, friendly Friends loading', () => {
  const tick = cssRule('.tickbtn');
  assert.ok(tick.includes('width:44px') && tick.includes('height:44px'), 'planner tick is 44px');
  const del = cssRule('.delbtn');
  assert.ok(del.includes('min-width:44px') && del.includes('min-height:44px'), 'delete buttons are 44px');
  assert.ok(html.includes('font-size:.72rem'), 'bottom-nav labels grew from .66rem');
  assert.ok(!html.includes('font-size:.66rem'), 'the old .66rem labels are gone');
  assert.ok(html.includes('aria-label="Delete this flashcard">🗑</button>'), 'flashcard delete is an icon button (the label lives in aria-label)');
  assert.ok(!html.includes('🗑 Delete card'), 'the old 20px text delete button is gone');
  assert.ok(!html.includes('Loading…'), 'no bare Loading… text is left anywhere');
  const friends = fnBody('function friendRequestsCardHTML(');
  assert.ok((friends.match(/Finding your friends…/g) || []).length === 2, 'both Friends panels show Pip + Finding your friends… while loading');
});
