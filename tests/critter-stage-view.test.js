// Critter stage-view bug + prominent frog card on Home (2026-11-10).
// BUG (reported live by Bryan): tapping a life-cycle stage in Critter
// Lab to VIEW it ran `if(i>e.critterStage)e.critterStage=i`, permanently
// advancing the explorer's real growth stage. A new explorer (stage 0,
// Egg/Frogspawn) who tapped "Adult Frog" instantly became an Adult Frog
// forever. Viewing must NEVER change real growth — the frog grows ONLY
// by care (applyCareDay). The view (critterView) is UI state only.
// HOME: the companion critter card sat BELOW the week planner (Bryan:
// "frog...where?"). It is now a large hero card directly under the
// streak strip, so the frog is the first thing a child sees after
// the daily quest.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// Extract the stage-tap onclick handler from bindCritter (the real
// code, not a re-implementation) so the tests run what the app runs.
function extractStageTap() {
  const bindStart = html.indexOf('function bindCritter(){');
  assert.ok(bindStart >= 0, 'bindCritter found');
  const q = html.indexOf("querySelectorAll('[data-stage]')", bindStart);
  assert.ok(q >= 0, 'stage query found');
  const fnStart = html.indexOf('b.onclick=function(){', q);
  assert.ok(fnStart >= 0, 'stage onclick found');
  const fnKw = html.indexOf('function', fnStart);
  const open = html.indexOf('{', fnKw);
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(fnKw, j + 1); }
  }
  throw new Error('unbalanced braces in stage tap handler');
}
const handlerSrc = extractStageTap();

function freshExplorer() {
  return { name: 'Test', critterName: 'Splash', critterStage: 0, critterStageDays: 0, visitedStages: [], discoveredCritters: [], badges: [] };
}

function tapContext(explorer) {
  const ctx = vm.createContext({ console });
  ctx.critterView = null;
  ctx.e = explorer;
  ctx.saved = 0;
  ctx.awarded = [];
  ctx.save = function () { ctx.saved++; };
  ctx.sndPop = function () {};
  ctx.render = function () {};
  ctx.awardBadge = function (kind, label) { ctx.awarded.push([kind, label]); };
  vm.runInContext('var __tap = ' + handlerSrc + ';', ctx);
  return ctx;
}
function tap(ctx, stageIdx) {
  ctx.b = { getAttribute: function (attr) { return attr === 'data-stage' ? String(stageIdx) : null; } };
  ctx.__tap();
}

test('viewing Adult Frog on a new explorer (stage 0 Egg) does NOT change the real stage', () => {
  const explorer = freshExplorer();
  const ctx = tapContext(explorer);
  tap(ctx, 3); // Adult Frog
  assert.strictEqual(explorer.critterStage, 0, 'still an Egg after viewing Adult Frog');
  assert.deepStrictEqual(explorer.visitedStages, [3], 'viewing records the stage as visited');
  assert.strictEqual(ctx.critterView, 3, 'the pond now shows the viewed Adult Frog stage');
  assert.strictEqual(ctx.saved, 1, 'the visit is saved');
  assert.deepStrictEqual(ctx.awarded, [], 'no badge yet — only one stage visited');
});

test('viewing all four stages still leaves the real stage at Egg, and awards the Critter Friend badge', () => {
  const explorer = freshExplorer();
  const ctx = tapContext(explorer);
  [0, 1, 2, 3].forEach(function (i) { tap(ctx, i); });
  assert.strictEqual(explorer.critterStage, 0, 'still an Egg after viewing every stage');
  assert.deepStrictEqual(explorer.visitedStages, [0, 1, 2, 3], 'all four stages recorded as visited');
  assert.deepStrictEqual(ctx.awarded, [['critter', '🐸 Critter Friend']], 'the Critter Friend badge is awarded');
  assert.strictEqual(ctx.critterView, 3, 'the pond shows the last-viewed stage');
});

test('viewing an earlier stage never rewinds a grown frog either', () => {
  const explorer = freshExplorer();
  explorer.critterStage = 2; // Froglet, grown by care
  const ctx = tapContext(explorer);
  tap(ctx, 0); // look at the eggs
  assert.strictEqual(explorer.critterStage, 2, 'still a Froglet after viewing Frogspawn');
  assert.strictEqual(ctx.critterView, 0, 'the pond shows the viewed Frogspawn stage');
});

test('the pond still shows the VIEWED stage (critterView), defaulting to the growth stage', () => {
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes('var view=(critterView==null?e.critterStage:critterView)'), 'the page shows the viewed stage, defaulting to the growth stage');
  assert.ok(page.includes('frogSVG(view)'), 'the big picture follows the viewed stage');
  assert.ok(page.includes("(view===i?'sel':'')"), 'the selected thumbnail follows the viewed stage');
  // The "Growing up" bar and speech must use the REAL stage, not the view.
  assert.ok(page.includes("STAGES[e.critterStage][1]+' — '+stageDays+' of '+stageLen+' days"), 'the growth bar names the real stage and its days');
});

test('Home: the critter hero card sits right under the streak strip, above the week planner', () => {
  const home = html.slice(html.indexOf('function homeHTML(){'), html.indexOf('function bindHome(){'));
  const ret = home.slice(home.indexOf('return lvlPrompt'));
  assert.ok(ret.indexOf('critterHeroCard') > ret.indexOf('streakStripHTML'), 'hero card comes after the streak strip');
  assert.ok(ret.indexOf('critterHeroCard') < ret.indexOf('planSectionHTML'), 'hero card comes before the week planner');
  assert.ok(!ret.includes('critterCard'), 'the old buried critter card is gone from Home');
  assert.ok(ret.includes('cardrow two'), 'the card row below the planner now holds Treasure + Creative only');
});

test('Home: the critter hero card is large and unmistakable', () => {
  const home = html.slice(html.indexOf('function homeHTML(){'), html.indexOf('function bindHome(){'));
  assert.ok(home.includes('height:220px'), 'the frog/egg picture is large (220px tall)');
  assert.ok(home.includes('tap to visit Critter Lab'), 'the label says tapping goes to Critter Lab');
  assert.ok(home.includes('Tap to feed, clean'), 'a clear call-to-action names Feed / Clean / Play');
  assert.ok(home.includes('streakFrogMoodHTML(e)'), 'the mood line is still on the card');
  assert.ok(home.includes('Critters discovered'), 'the discovered count is still on the card');
});

test('the 2-item card row balances on desktop', () => {
  assert.ok(html.includes('.cardrow.two{grid-template-columns:repeat(2,1fr)}'), 'a two-column rule exists for the Treasure + Creative row');
});
