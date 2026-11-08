// Treasure costs x5 (2026-11-09): every treasure costs five times
// what it did, so the full set lasts about 7–8 weeks at 70–95
// stars a day instead of 1–2 weeks. Star EARNING is untouched —
// quests, games and critter care pay exactly what they paid before.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../lib/rules');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  return html.slice(start, end + 2);
}
// Brace-matching extractor (from memory-merge.test.js).
function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}

const TREASURES = eval(grabVar('TREASURES') + '\n;TREASURES');
// The old costs, in the same order as the treasure list — the x5
// change must multiply each one in place, never reorder or rename.
const OLD_COSTS = [10, 12, 15, 16, 18, 20, 22, 24, 25, 26, 28, 30, 32, 36, 38, 40, 45, 48, 50, 55, 60, 65, 70, 80];
const OLD_IDS = ['shell', 'magnifier', 'compass', 'stone', 'storybook', 'pearl', 'wand', 'binoculars', 'lantern', 'orchid', 'riddle', 'map', 'backpack', 'feather', 'song', 'bookmark', 'timer', 'torch', 'merlion', 'theatre', 'kite', 'hawker', 'rainbow', 'gardenleaf'];

test('every treasure costs exactly 5x its old value, same treasures in the same order', () => {
  assert.equal(TREASURES.length, 24, 'still 24 treasures');
  assert.deepEqual(TREASURES.map(function (t) { return t.id; }), OLD_IDS, 'the same treasures, in the same order');
  assert.deepEqual(
    TREASURES.map(function (t) { return t.cost; }),
    OLD_COSTS.map(function (c) { return c * 5; }),
    'each cost is 5x the old one (10->50, 12->60, …, 80->400)'
  );
});

test('the full set now costs 4,325 stars — about 7–8 weeks at 70–95 stars a day', () => {
  const total = TREASURES.reduce(function (a, t) { return a + t.cost; }, 0);
  assert.equal(total, 4325, 'total 4,325 (was 865)');
  assert.equal(Math.min.apply(null, TREASURES.map(function (t) { return t.cost; })), 50, 'cheapest treasure is 50 stars');
  assert.equal(Math.max.apply(null, TREASURES.map(function (t) { return t.cost; })), 400, 'priciest treasure is 400 stars');
  // Sanity: at 70–95 stars a day, 4,325 stars is 46–62 days.
  assert.ok(4325 / 95 > 45 && 4325 / 70 < 62, 'the set lasts roughly 7–8 weeks of full days');
});

test('unlocking still spends exactly the treasure’s cost through the star ledger', () => {
  // The cheapest treasure is 50 now: 49 stars cannot unlock it, 50 can.
  assert.equal(R.canUnlock(49, 50), false, '49 stars cannot unlock a 50-star treasure');
  assert.equal(R.canUnlock(50, 50), true, '50 stars can');
  assert.equal(R.starsAfterUnlock(200, 200), 0, 'the 200-star Golden Bookmark spends exactly 200');
  // The page still unlocks generically through the treasure's own
  // cost — no cost is hardcoded in the unlock flow.
  assert.ok(html.includes('spendStars(e,t.cost)'), 'unlocking spends t.cost, not a fixed number');
  const bind = html.slice(html.indexOf('function bindTreasure(){'), html.indexOf('function bindTreasure(){') + 600);
  assert.ok(bind.includes('e.stars>=t.cost'), 'the unlock gate compares stars to the treasure cost');
  const card = html.slice(html.indexOf('function treasureHTML(){'), html.indexOf('function bindTreasure(){'));
  assert.ok(card.includes("Costs ⭐ '+t.cost"), 'the card shows the treasure’s own cost');
});

test('star earning is untouched: earnStars adds exactly what it is given', () => {
  const earnStars = eval(grabFn('ensureStarsLedger') + '\n' + grabFn('earnStars') + '\n;earnStars');
  const e = { stars: 0, starsEarned: 0, starsSpent: 0 };
  earnStars(e, 5);
  assert.equal(e.stars, 5, 'a 5-star quest still pays 5');
  earnStars(e, 1);
  assert.equal(e.stars, 6, 'a 1-star care still pays 1');
  earnStars(e, 6);
  assert.equal(e.stars, 12, 'a 6-star game still pays 6');
  // The earning call sites are unchanged: quests pay their score,
  // games pay min(score, rounds), care pays 1.
  assert.ok(html.includes('earnStars(e,cur.score)'), 'quests still pay their score');
  assert.ok(html.includes('earnStars(live,Math.min(gState.score,gState.rounds))'), 'games still pay min(score, rounds)');
  assert.ok(html.includes('earnStars(eNow,1)'), 'critter care still pays 1 star');
});

test('the Golden Bookmark help states the new 200-star cost', () => {
  assert.ok(html.includes('it costs 200 stars'), 'the help text says 200 stars');
  assert.ok(!html.includes('it costs 40 stars'), 'the old 40-star cost is gone');
});
