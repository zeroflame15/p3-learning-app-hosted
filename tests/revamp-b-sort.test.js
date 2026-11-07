// Revamp batch B — Speed Sort: 24 tiered sets, category-named questions,
// daily rotation, tiles fly in, auto-advance after a correct sort.
// Reads the page from PAGE_PATH when set, so it can run against a
// patched temp copy before the patch lands in public/index.html.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const clientSrc = fs.readFileSync(pagePath, 'utf8');

function grab(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = clientSrc.indexOf('\n}\n', start);
  return clientSrc.slice(start, end + 3);
}

const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"",j:""},{q:"Q2",o:["e","f","g","h"],a:1,c:"",j:""}],fresh:[]},'
  + '{quest:[{q:"Q3",o:["i","j","k","l"],a:2,c:"",j:""},{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled', 'shuffle']
  .map(grab).join('\n');
const revampBlock = clientSrc.slice(clientSrc.indexOf('var SORT_SETS='), clientSrc.indexOf('function genRound'));
const genRound = eval(stubTopics + helpers + '\n' + revampBlock + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval
const SORT_SETS = eval(revampBlock.slice(0, revampBlock.indexOf('function sortTierMax')) + '\n;SORT_SETS'); // eslint-disable-line no-eval
const sortTierMax = eval(revampBlock + '\n;sortTierMax'); // eslint-disable-line no-eval

test('24 sets in 4 tiers, 6 per tier, each with a named category and an explanation', () => {
  assert.equal(SORT_SETS.length, 24, '24 sets, not 6');
  for (let t = 1; t <= 4; t++) {
    assert.equal(SORT_SETS.filter((s) => s.t === t).length, 6, 'tier ' + t + ' has 6 sets');
  }
  for (const s of SORT_SETS) {
    assert.equal(s.items.length, 4, '4 tiles: ' + s.q);
    assert.equal(new Set(s.items).size, 4, 'tiles are distinct: ' + s.q);
    assert.ok(/Which one (is NOT|does NOT|has NO)/.test(s.q), 'the question names the category: ' + s.q);
    assert.ok(s.why && s.why.length > 10, 'feedback explains why: ' + s.q);
    assert.ok(s.why.includes(s.items[3]), 'feedback names the odd one out: ' + s.q);
  }
  // The odd one out is always the last item before the shuffle.
  for (const s of SORT_SETS) {
    assert.ok(s.items[3].length > 0, 'odd item present: ' + s.q);
  }
});

test('level tier filters the pool: P1-P2 never see tiers 3-4, P5-P6 see them all', () => {
  assert.equal(sortTierMax('low'), 2, 'low caps at tier 2');
  assert.equal(sortTierMax('mid'), 3, 'mid caps at tier 3');
  assert.equal(sortTierMax('high'), 4, 'high sees all 4 tiers');
  assert.equal(sortTierMax(undefined), 3, 'no tier means mid');
  // Behavioural: collect the sets a low-tier game can show, over many seeds.
  const seenLow = new Set(), seenHigh = new Set();
  for (let seed = 0; seed < 40; seed++) {
    for (let idx = 0; idx < 6; idx++) {
      seenLow.add(genRound('sort', idx, seed, 'low').c);
      seenHigh.add(genRound('sort', idx, seed, 'high').c);
    }
  }
  const whyOf = (t) => new Set(SORT_SETS.filter((s) => s.t === t).map((s) => s.why));
  const lowWhys = whyOf(1), midWhys = whyOf(2), hardWhys = new Set([...whyOf(3), ...whyOf(4)]);
  for (const c of seenLow) assert.ok(!hardWhys.has(c), 'low tier never shows a tier 3-4 set: ' + c);
  assert.ok([...seenLow].some((c) => lowWhys.has(c)), 'low tier does show tier 1 sets');
  assert.ok([...seenLow].some((c) => midWhys.has(c)), 'low tier does show tier 2 sets');
  assert.ok([...seenHigh].some((c) => hardWhys.has(c)), 'high tier does show tier 3-4 sets');
});

test('daily rotation: different days show different sets, the same day is stable', () => {
  const seq = (seed) => {
    const out = [];
    for (let idx = 0; idx < 6; idx++) out.push(genRound('sort', idx, seed, 'mid').c);
    return out.join('|');
  };
  assert.equal(seq(777), seq(777), 'same seed, same 6 sets in the same order');
  const days = new Set();
  for (let seed = 0; seed < 30; seed++) days.add(seq(seed));
  assert.ok(days.size > 10, 'different seeds rotate the sets, got ' + days.size + ' distinct days');
  // Across a month of games the child sees far more than 6 sets.
  const seen = new Set();
  for (let seed = 0; seed < 30; seed++) {
    for (let idx = 0; idx < 6; idx++) seen.add(genRound('sort', idx, seed, 'mid').c);
  }
  assert.ok(seen.size > 12, 'rotation covers most of the pool, saw ' + seen.size + ' of 18 mid-tier sets');
});

test('the marked answer is the odd one out, and the feedback names the category', () => {
  for (const seed of [0, 777, 4242, 99999]) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('sort', idx, seed, 'mid');
      assert.equal(r.o.length, 4, '4 tiles');
      assert.ok(r.a >= 0 && r.a < 4, 'answer index in range');
      const set = SORT_SETS.find((s) => s.q === r.q && s.why === r.c);
      assert.ok(set, 'round matches a known set: ' + r.q);
      assert.equal(r.o[r.a], set.items[3], 'the marked tile is the odd one out: ' + r.q);
      // The category noun from the question reappears in the feedback.
      const noun = r.q.match(/NOT (?:a |an )?([a-z]+)/);
      if (noun) assert.ok(r.c.toLowerCase().includes(noun[1]), 'feedback names the category "' + noun[1] + '": ' + r.c);
    }
  }
});

test('sort tiles fly in (staggered) and a correct sort auto-advances after ~700ms', () => {
  assert.ok(clientSrc.includes('@keyframes tileIn'), 'tileIn keyframes exist');
  assert.ok(clientSrc.includes('.sorttile{') && clientSrc.includes('animation:tileIn'), 'sort tiles use the fly-in animation');
  const optsSrc = grab('gameOptsHTML');
  assert.ok(optsSrc.includes("style=\"--d:'+(i*70)+'ms\""), 'each sort tile gets a staggered delay');
  const bindSrc = grab('bindGame');
  assert.ok(bindSrc.includes("if(gState.id==='sort'&&i===q.a){ setTimeout(function(){ var nx=document.getElementById('gNext'); if(nx)nx.click(); },700); }"),
    'a correct sort clicks Next after 700ms');
  // Only a CORRECT sort auto-advances — a wrong tap still waits for Next.
  assert.ok(!bindSrc.includes("if(gState.id==='sort'){ setTimeout"), 'no auto-advance on a wrong sort');
});
