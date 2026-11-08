// Critter Lab regressions (reported by Bryan with a video, 2026-11-05):
// (1) renaming the critter to a shorter name reverted to the old name
//     on the next sync ("Teddy" lost to "Splash"); (2) tapping a
//     life-cycle stage to look at it kept snapping back to Adult Frog.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grab(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('\n}\n', start);
  return html.slice(start, end + 3);
}

const pickCritterName = eval(grab('pickCritterName') + '\n;pickCritterName');

test('a later rename wins even when the new name is shorter (Teddy beats Splash)', () => {
  const server = { critterName: 'Splash', critterNameAt: '2026-11-01T10:00:00.000Z' };
  const local = { critterName: 'Teddy', critterNameAt: '2026-11-05T22:30:00.000Z' };
  assert.equal(pickCritterName(server, local).name, 'Teddy', 'the later rename wins');
  assert.equal(pickCritterName(local, server).name, 'Teddy', 'argument order must not matter');
  assert.equal(pickCritterName(server, local).at, '2026-11-05T22:30:00.000Z', 'the winning timestamp is kept');
});

test('an older rename loses to a newer one, whichever side it is on', () => {
  const old = { critterName: 'Teddy', critterNameAt: '2026-11-05T10:00:00.000Z' };
  const newer = { critterName: 'Splash', critterNameAt: '2026-11-05T22:00:00.000Z' };
  assert.equal(pickCritterName(old, newer).name, 'Splash', 'the newer rename wins');
});

test('names never renamed fall back to the old longer-name rule', () => {
  assert.equal(pickCritterName({ critterName: 'Splash' }, { critterName: 'Teddy' }).name, 'Splash', 'no timestamps: longer name wins as before');
  assert.equal(pickCritterName({ critterName: 'Bo' }, { critterName: 'Splash' }).name, 'Splash', 'no timestamps: longer name wins as before');
  assert.equal(pickCritterName({ critterName: 'Teddy', critterNameAt: '2026-11-05T22:00:00.000Z' }, { critterName: 'Splash' }).name, 'Teddy', 'one renamed side beats an unrenamed longer name');
});

test('the merge uses the rename rule, and renaming stamps the time', () => {
  const merge = grab('mergeExplorer');
  assert.ok(merge.includes('pickCritterName(a,b)'), 'mergeExplorer picks the name by rename time');
  assert.ok(!merge.includes('critterName.length>='), 'the old longer-name rule is gone from the merge');
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function bindCritter(){') + 2000);
  assert.ok(bind.includes('e.critterNameAt=new Date().toISOString()'), 'saving a name stamps when it was renamed');
  assert.ok(html.includes("critterNameAt:null"), 'new explorers start with no rename timestamp');
});

test('the stage viewer is separate from the growth stage', () => {
  assert.ok(html.includes('var critterView=null;'), 'a view-only stage variable exists');
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes('var view=(critterView==null?e.critterStage:critterView)'), 'the page shows the viewed stage, defaulting to the growth stage');
  assert.ok(page.includes("frogSVG(view)"), 'the big picture follows the viewed stage (layered SVG art per stage)');
  assert.ok(page.includes("(view===i?'sel':'')"), 'the selected thumbnail follows the viewed stage');
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function bindCritter(){') + 2000);
  assert.ok(bind.includes('critterView=i'), 'tapping a stage sets the view');
  // The only write to the growth stage in the handler is the guarded
  // forward-only one — never a plain "e.critterStage=i".
  const withoutGuard = bind.replace('if(i>e.critterStage)e.critterStage=i;', '');
  assert.ok(!withoutGuard.includes('e.critterStage=i'), 'tapping a stage must never overwrite the growth stage outright');
  assert.ok(bind.includes('if(i>e.critterStage)e.critterStage=i'), 'exploring a later stage still grows the frog forward, never backwards');
});

/* --- Simple care: feed, clean, play (no hunger) --- */
function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  return html.slice(start, end + 2);
}
const CARE_ACTIONS = eval(grabVar('CARE_ACTIONS') + '\n;CARE_ACTIONS');
const COOLDOWN_SRC = html.match(/var CARE_COOLDOWN_MS=[^;]+;/)[0];
assert.ok(COOLDOWN_SRC.includes('4*60*60*1000'), 'cooldown is 4 hours in the page source');
const careReady = eval(COOLDOWN_SRC + '\n' + grab('careReady') + '\n;careReady');
const careReadyInHrs = eval(COOLDOWN_SRC + '\n' + grab('careReadyInHrs') + '\n;careReadyInHrs');
const careAllToday = eval('var CARE_ACTIONS=' + JSON.stringify(CARE_ACTIONS) + ';\n' + grab('careAllToday') + '\n;careAllToday');
const mergeCare = eval(grab('mergeCare') + '\n;mergeCare');

test('care has exactly feed, clean and play — no hunger mechanic', () => {
  assert.deepEqual(CARE_ACTIONS.map(function(a){ return a.id; }), ['feed', 'clean', 'play']);
  // No hunger mechanic: no hunger state, no hunger-driven behaviour.
  // (The word "hungry" itself appears in English vocab questions —
  // that is content, not a mechanic.)
  assert.ok(!html.includes('hunger:'), 'no hunger state in the explorer record');
  assert.ok(!html.includes('e.hunger'), 'no hunger read anywhere');
});

test('care cooldown is 4 hours: fresh is ready, just-cared is not, old care is ready again', () => {
  const now = Date.parse('2026-11-05T12:00:00.000Z');
  assert.ok(careReady({}, 'feed', now), 'never cared: ready');
  const just = { feed: { at: '2026-11-05T11:00:00.000Z', day: '2026-11-05' } };
  assert.ok(!careReady(just, 'feed', now), 'cared 1h ago: not ready');
  assert.equal(careReadyInHrs(just, 'feed', now), 3, 'ready again in 3h');
  const old = { feed: { at: '2026-11-05T07:00:00.000Z', day: '2026-11-05' } };
  assert.ok(careReady(old, 'feed', now), 'cared 5h ago: ready again');
  assert.ok(careReady(old, 'clean', now), 'another action is independent: clean is ready');
});

test('all three cares today is true only when every action was done today', () => {
  const day = '2026-11-05';
  const all = { feed: { at: '2026-11-05T08:00:00.000Z', day }, clean: { at: '2026-11-05T09:00:00.000Z', day }, play: { at: '2026-11-05T10:00:00.000Z', day } };
  assert.ok(careAllToday(all, day), 'all three today');
  const missing = { feed: { at: '2026-11-05T08:00:00.000Z', day }, clean: { at: '2026-11-05T09:00:00.000Z', day } };
  assert.ok(!careAllToday(missing, day), 'play missing');
  const stale = { feed: { at: '2026-11-04T08:00:00.000Z', day: '2026-11-04' }, clean: { at: '2026-11-05T09:00:00.000Z', day }, play: { at: '2026-11-05T10:00:00.000Z', day } };
  assert.ok(!careAllToday(stale, day), 'feed was yesterday');
});

test('care merges by latest time per action, independently', () => {
  const a = { feed: { at: '2026-11-05T08:00:00.000Z', day: '2026-11-05' }, clean: { at: '2026-11-05T09:00:00.000Z', day: '2026-11-05' } };
  const b = { feed: { at: '2026-11-05T10:00:00.000Z', day: '2026-11-05' }, play: { at: '2026-11-05T10:30:00.000Z', day: '2026-11-05' } };
  const merged = mergeCare(a, b);
  assert.equal(merged.feed.at, '2026-11-05T10:00:00.000Z', 'later feed wins');
  assert.equal(merged.clean.at, '2026-11-05T09:00:00.000Z', 'clean only on one side is kept');
  assert.equal(merged.play.at, '2026-11-05T10:30:00.000Z', 'play only on one side is kept');
});

test('care UI: three buttons, 1 star each, a care day logs one growth day', () => {
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes('data-care'), 'care buttons render in Critter Lab');
  assert.ok(page.includes('each care earns ⭐ 1 star'), 'the star reward is shown');
  assert.ok(page.includes('again in'), 'cooldown countdown is shown');
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function bindCritter(){') + 4000);
  assert.ok(bind.includes('earnStars(eNow,1)'), 'each care earns exactly 1 star');
  assert.ok(bind.includes('applyCareDay(eNow,todayKey())'), 'a finished care logs a care day through the growth helper');
  assert.ok(bind.includes("grew into a '+STAGES[eNow.critterStage][1]+'"), 'growing a stage names the new stage');
  assert.ok(!bind.includes("careAllToday(eNow.care,todayKey())&&eNow.careGrewDay!==todayKey()&&eNow.critterStage<3"), 'the old one-care-day-one-stage trigger is gone');
  assert.ok(html.includes('care:{}, careGrewDay:null'), 'new explorers start with empty care');
  assert.ok(html.includes('critterStageDays:0'), 'new explorers start with 0 days in the egg stage');
  const merge = grab('mergeExplorer');
  assert.ok(merge.includes('mergeCare(a.care,b.care)'), 'care merges across devices');
  assert.ok(merge.includes('careGrewDay'), 'the once-a-day care-day marker merges too');
  assert.ok(merge.includes('critterStageDays'), 'the days-in-stage count merges too');
});

/* --- Rename timestamp must never detach from its name (live bug 2026-11-05) --- */
/* pickCritterName is already extracted near the top of this file. */

test('rename tie: same timestamp on both sides, the local rename wins — never the old longer name', () => {
  // Seen live: the server held {name:'Splash', at:'2026-11-05T14:43:02.191Z'}
  // — the old name wearing the rename-to-'Ted' timestamp — so 'Ted'
  // could never win again. A tie must go to the device in hand.
  const out = pickCritterName(
    { critterName: 'Splash', critterNameAt: '2026-11-05T14:43:02.191Z' },
    { critterName: 'Ted', critterNameAt: '2026-11-05T14:43:02.191Z' }
  );
  assert.equal(out.name, 'Ted', 'local rename wins the tie');
  assert.equal(out.at, '2026-11-05T14:43:02.191Z', 'the timestamp stays with Ted');
});

test('a later rename always beats a poisoned old name carrying an old timestamp', () => {
  const out = pickCritterName(
    { critterName: 'Splash', critterNameAt: '2026-11-05T14:43:02.191Z' },
    { critterName: 'Ted', critterNameAt: '2026-11-05T14:50:00.000Z' }
  );
  assert.equal(out.name, 'Ted', 'later rename wins even over a stamped old name');
});

test('no timestamps: longer name wins but borrows no timestamp from the other side', () => {
  const out = pickCritterName(
    { critterName: 'Splash', critterNameAt: null },
    { critterName: 'Ted', critterNameAt: null }
  );
  assert.equal(out.name, 'Splash', 'longer legacy name still wins');
  assert.equal(out.at, null, 'no timestamp is invented for the winner');
});

/* --- Care must be VISIBLE: the frog reacts, grows bigger, progress shows --- */
test('care reaction is visual, not just text: frog hops/wiggles and emoji float up', () => {
  assert.ok(html.includes('@keyframes fxHop'), 'hop keyframes exist');
  assert.ok(html.includes('@keyframes fxWiggle'), 'wiggle keyframes exist');
  assert.ok(html.includes('@keyframes fxFloatUp'), 'float-up keyframes exist');
  assert.ok(html.includes('CARE_FX={feed:'), 'each action has its own floating emoji');
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes('fx-wiggle'), 'clean makes the frog wiggle');
  assert.ok(page.includes('fx-hop'), 'feed/play make the frog hop');
  assert.ok(page.includes('fx-float'), 'emoji float up from the frog');
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function bindCritter(){') + 3200);
  assert.ok(bind.includes('careFx={a:id'), 'caring sets the visual reaction');
  assert.ok(bind.includes('setTimeout(function(){ careFx=null; }, 1700)'), 'the reaction clears after ~1.7s so it never replays on a later re-render');
});

test('growth is visible: the frog picture gets taller each stage, and a bar shows days in the stage', () => {
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes("150+view*30"), 'the frog picture grows taller with the stage — Frogspawn small, Adult Frog big');
  assert.ok(page.includes('Growing up — Stage'), 'the growth stage is labelled');
  assert.ok(page.includes("STAGES[e.critterStage][1]+' — '+stageDays+' of '+stageLen+' days"), 'the bar shows the stage name and the days within it');
  assert.ok(page.includes('stageDays/stageLen*100'), 'a progress bar fills with the days in the stage');
  assert.ok(page.includes('Grew today!'), 'a growth today is celebrated');
  assert.ok(page.includes('more care days to grow'), 'the days left to grow are shown');
  assert.ok(!page.includes('/3 cares today'), 'the old today-only N/3 bar is gone');
  assert.ok(!page.includes('careTodayCount(e.care)/3*100'), 'the old today-only bar fill is gone');
  assert.ok(!page.includes('Today: '), 'the old text-only today line is gone');
});

/* --- Play ball-chase (seen live 2026-11-07): the ball appeared and
   the 10s session ran, but the frog never chased the pointer — it
   stayed within ~10px, and the ball stayed top-right then vanished
   within ~3s. The chase was a single pond.onpointermove property
   handler on a pond element that every render() rebuilds, so the
   handler died whenever the page re-rendered mid-game (and the toy
   was hardcoded display:none in the markup, so a re-render hid it
   again). The chase is now a document-level listener that re-fetches
   the live pond and toy on every move, the toy renders visible while
   play is on, and the frog tracks fast during play. --- */
test('Play: the ball chases the pointer — a document-level listener that re-fetches the live pond and toy', () => {
  assert.ok(!html.includes('pond.onpointermove='), 'the fragile pond.onpointermove property binding is gone');
  const bind = html.slice(html.indexOf('function bindCritter(){'));
  const start = bind.indexOf('function startPlayMode(){');
  assert.ok(start >= 0, 'startPlayMode exists');
  const play = bind.slice(start, bind.indexOf('document.querySelectorAll', start));
  assert.ok(play.includes("document.addEventListener('pointermove',playPointerHandler)"), 'the chase is a document-level pointermove listener, so it survives the pond being rebuilt');
  const handler = play.slice(play.indexOf('playPointerHandler=function(ev){'), play.indexOf("document.addEventListener('pointermove',playPointerHandler)"));
  assert.ok(handler.includes("document.getElementById('pond')"), 'the handler re-fetches the live pond on every move');
  assert.ok(handler.includes("document.getElementById('pondToy')"), 'the handler re-fetches the live toy on every move');
  assert.ok(handler.includes("if(t.style.display==='none')t.style.display='block'"), 'the handler re-shows the toy if a re-render hid it');
  assert.ok(handler.includes('hopToward(x,y,0.6)'), 'the chase uses a fast hop step so the frog visibly closes the gap');
  assert.ok(play.includes("if(playPointerHandler){ document.removeEventListener('pointermove',playPointerHandler); playPointerHandler=null; }"), 're-binding removes the previous listener first, so there is never more than one');
});

test('Play: the toy renders visible and the pond tracks fast while play is on, even after a re-render', () => {
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes("pondMode==='play'?'block':'none'"), 'the toy is visible in the markup while play is on, not hardcoded display:none');
  assert.ok(page.includes("pondMode==='play'?' playing':''"), 'the pond gets a playing class while play is on');
  assert.ok(html.includes('.pond.playing .frog-wrap{transition:left .3s ease-out,top .3s ease-out}'), 'the frog tracks fast during play instead of drifting on the 1.3s wander transition');
});

test('Play: the chase listener is removed when play ends', () => {
  assert.ok(html.includes('function stopPlayChase(){'), 'stopPlayChase exists');
  const stop = html.slice(html.indexOf('function stopPlayChase(){'), html.indexOf('function stopPlayChase(){') + 400);
  assert.ok(stop.includes("document.removeEventListener('pointermove',playPointerHandler)"), 'stopPlayChase removes the document listener');
  assert.ok(stop.includes('playPointerHandler=null'), 'stopPlayChase clears the handler');
  const record = html.slice(html.indexOf('function recordCare('), html.indexOf('function placeFrog(){'));
  assert.ok(record.includes('stopPlayChase()'), 'recordCare removes the chase listener when the session ends');
  const cancel = html.slice(html.indexOf("getElementById('careCancel')"));
  assert.ok(cancel.slice(0, 400).includes('stopPlayChase()'), 'Stop playing removes the chase listener too');
});

test('Play: hopToward on a fast step moves the frog most of the way to the pointer', () => {
  const m = html.match(/function hopToward\(x,y,step\)\{([^\n]*)\}/);
  assert.ok(m, 'hopToward takes a step parameter');
  let frogPos = { x: 50, y: 56 };
  let placed = null;
  const placeFrog = () => { placed = { x: frogPos.x, y: frogPos.y }; };
  const hopToward = eval('(function hopToward(x,y,step){' + m[1] + '})');
  hopToward(90, 80, 0.6);
  assert.equal(Math.round(frogPos.x), 74, 'a fast step covers 60% of the gap in x');
  assert.equal(Math.round(frogPos.y * 10) / 10, 70.4, 'a fast step covers 60% of the gap in y');
  assert.deepEqual(placed, frogPos, 'placeFrog is called so the frog visibly moves');
  frogPos = { x: 50, y: 56 };
  hopToward(90, 80);
  assert.equal(Math.round(frogPos.x), 64, 'the default step is still 0.35, so wandering callers are unchanged');
});
