// Revamp batch B — Word Scramble: real tappable letter tiles + slots,
// Shuffle/Clear/Hint, 48 words in length bands, rising-pitch ticks.
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
function grabLine(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  return clientSrc.slice(start, clientSrc.indexOf('\n', start));
}

const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"",j:""},{q:"Q2",o:["e","f","g","h"],a:1,c:"",j:""}],fresh:[]},'
  + '{quest:[{q:"Q3",o:["i","j","k","l"],a:2,c:"",j:""},{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled', 'shuffle']
  .map(grab).join('\n');
const revampBlock = clientSrc.slice(clientSrc.indexOf('var SORT_SETS='), clientSrc.indexOf('function genRound'));
const revampFns = ['scrInitState', 'scrPlaceLetter', 'scrRemoveLetter', 'scrBuiltWord', 'scrIsComplete', 'scrBandFor']
  .map(grab).join('\n');
const genRound = eval(stubTopics + helpers + '\n' + revampBlock + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval
const scr = eval(revampBlock + '\n' + revampFns + '\n;({init:scrInitState,place:scrPlaceLetter,remove:scrRemoveLetter,word:scrBuiltWord,done:scrIsComplete,band:scrBandFor})'); // eslint-disable-line no-eval
const SCR_WORDS = eval(revampBlock.slice(revampBlock.indexOf('var SCR_WORDS='), revampBlock.indexOf('function scrBandFor')) + '\n;SCR_WORDS'); // eslint-disable-line no-eval

test('48 words in 3 length bands, every word with a hint', () => {
  assert.equal(SCR_WORDS.length, 48, '48 words, not 20');
  const words = SCR_WORDS.map((w) => w.w);
  assert.equal(new Set(words).size, 48, 'no duplicate words');
  for (let b = 0; b < 3; b++) {
    assert.equal(SCR_WORDS.filter((w) => w.b === b).length, 16, 'band ' + b + ' has 16 words');
  }
  for (const w of SCR_WORDS) {
    const len = w.w.length;
    if (w.b === 0) assert.ok(len >= 3 && len <= 4, w.w + ' is a 3-4 letter word');
    else if (w.b === 1) assert.ok(len >= 5 && len <= 6, w.w + ' is a 5-6 letter word');
    else assert.ok(len >= 7 && len <= 9, w.w + ' is a 7-9 letter word');
    assert.ok(/^[A-Z]+$/.test(w.w), w.w + ' is uppercase letters only');
    assert.ok(w.h && w.h.length > 3, w.w + ' has a hint');
  }
});

test('length ramps by round and shifts by level tier', () => {
  assert.equal(scr.band(0, 'mid'), 0, 'mid rounds 1-2: short words');
  assert.equal(scr.band(3, 'mid'), 1, 'mid rounds 3-4: medium words');
  assert.equal(scr.band(5, 'mid'), 2, 'mid rounds 5-6: long words');
  assert.equal(scr.band(5, 'low'), 1, 'low never reaches the long band');
  assert.equal(scr.band(0, 'high'), 1, 'high starts at medium words');
  assert.equal(scr.band(5, 'high'), 2, 'high ends at long words');
  // Behavioural: no 7+ letter word ever appears for a low-tier game.
  for (let seed = 0; seed < 30; seed++) {
    for (let idx = 0; idx < 6; idx++) {
      assert.ok(genRound('scramble', idx, seed, 'low').word.length <= 6, 'low tier stays at 6 letters or fewer');
    }
  }
});

test('the pool is wide: many distinct words across seeds, never the same 6 all day', () => {
  const seen = new Set();
  for (let seed = 0; seed < 25; seed++) {
    for (let idx = 0; idx < 6; idx++) seen.add(genRound('scramble', idx, seed, 'mid').word);
  }
  assert.ok(seen.size >= 40, 'saw ' + seen.size + ' distinct words of 48 — the pool actually rotates');
  // The same seed replays the same words (a resume must rebuild the
  // exact board), but a different seed deals a different hand.
  const seq = (seed) => [0, 1, 2, 3, 4, 5].map((i) => genRound('scramble', i, seed, 'mid').word).join(',');
  assert.equal(seq(777), seq(777), 'same seed, same words');
  assert.notEqual(seq(777), seq(778), 'a new seed deals new words');
});

test('tile model: tap a tile to place it, tap a slot to send it back', () => {
  const r = genRound('scramble', 0, 777, 'mid');
  const st = scr.init(r);
  assert.equal(st.tiles.length, r.word.length, 'one tile per letter');
  assert.deepEqual(st.tiles.map((t) => t.ch).sort(), r.scr.split('').sort(), 'tiles are the scrambled letters');
  assert.ok(st.tiles.every((t) => !t.used), 'no tile used yet');
  assert.ok(st.built.every((c) => c === ''), 'slots start empty');
  assert.equal(scr.done(st.built), false, 'not complete yet');
  // Place every tile: the built word is the scrambled order.
  st.tiles.forEach((t, ti) => { assert.ok(scr.place(st.tiles, st.built, ti) >= 0, 'tile ' + ti + ' places'); });
  assert.equal(scr.word(st.built), r.scr, 'placing tiles in rack order builds the scramble');
  assert.equal(scr.done(st.built), true, 'full board is complete');
  assert.equal(scr.place(st.tiles, st.built, 0), -1, 'a used tile cannot place again');
  // Send one letter back: its tile frees up and the slot empties.
  assert.equal(scr.remove(st.tiles, st.built, 0), true, 'slot 0 returns its letter');
  assert.equal(st.built[0], '', 'slot 0 is empty again');
  assert.equal(scr.done(st.built), false, 'no longer complete');
  assert.ok(st.tiles.some((t) => !t.used), 'a tile freed up');
  assert.equal(scr.remove(st.tiles, st.built, 0), false, 'an empty slot returns nothing');
});

test('spelling the word from the tiles builds the word (and the wrong order does not)', () => {
  for (const seed of [0, 42, 777]) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('scramble', idx, seed, 'mid');
      const st = scr.init(r);
      // Tap the tiles in the order that spells the word.
      for (const ch of r.word) {
        const ti = st.tiles.findIndex((t) => !t.used && t.ch === ch);
        assert.ok(ti >= 0, 'a free ' + ch + ' tile exists for ' + r.word);
        scr.place(st.tiles, st.built, ti);
      }
      assert.equal(scr.word(st.built), r.word, 'tapping in word order builds the word: ' + r.word);
      assert.equal(scr.done(st.built), true, 'board complete: ' + r.word);
    }
  }
  // The scrambled order is a valid placement but the wrong answer.
  const r = genRound('scramble', 2, 777, 'mid');
  const st = scr.init(r);
  st.tiles.forEach((t, ti) => scr.place(st.tiles, st.built, ti));
  assert.equal(scr.word(st.built), r.scr, 'rack order builds the scramble');
  assert.notEqual(scr.word(st.built), r.word, 'the scramble is not the answer');
});

test('the scramble screen renders slots, tiles, Shuffle, Clear and Hint', () => {
  const gamesSrc = clientSrc.match(/var GAMES=\[[\s\S]*?\];/)[0];
  const g = eval(stubTopics + helpers + '\n' + revampBlock + '\n'
    + gamesSrc + '\n'
    + grabLine('esc') + '\n' + grabLine('ic') + '\n' + grabLine('fmtPlaySecs') + '\n' + grabLine('streakChipHTML') + '\n'
    + grab('playElapsedSecs') + '\n' + grab('raceTrackHTML') + '\n'
    + 'var PRAISE=["Great!"]; var ENCOURAGE=["Try again!"];\n'
    + 'function pipSVG(){ return ""; }\n'
    + 'function ex(){ return {glow:"#ffb020", stars:0, playProgress:{}}; }\n'
    + 'var gState=null;\n'
    + grab('genRound') + '\n' + grab('gameOptsHTML') + '\n' + grab('gameHTML') + '\n'
    + ';({ setState:function(s){ gState=s; }, html:function(){ return gameHTML(); } })'); // eslint-disable-line no-eval
  const r = genRound('scramble', 1, 777, 'mid');
  const st = scr.init(r);
  g.setState({ id: 'scramble', idx: 1, score: 0, picked: null, answered: false, rounds: 6, seed: 777, tier: 'mid', scrTiles: st.tiles, scrBuilt: st.built, scrWord: r.word, scrScr: r.scr });
  const html = g.html();
  assert.ok(html.includes('class="scrslots"'), 'slots row renders');
  assert.ok(html.includes('class="scrtiles"'), 'tiles row renders');
  assert.ok(html.includes('data-tile="0"') && html.includes('data-slot="0"'), 'tiles and slots are tappable');
  assert.ok(html.includes('id="scrShuffle"') && html.includes('id="scrClear"') && html.includes('id="scrHint"'), 'Shuffle, Clear and Hint buttons render');
  assert.ok(!html.includes('hintline'), 'the hint stays hidden until the 💡 button is tapped');
  assert.ok(!html.includes('class="optbtn'), 'no more fake multiple-choice buttons');
  // Hint shown: the word's clue appears.
  g.setState({ id: 'scramble', idx: 1, score: 0, picked: null, answered: false, rounds: 6, seed: 777, tier: 'mid', scrTiles: st.tiles, scrBuilt: st.built, scrWord: r.word, scrScr: r.scr, scrHintShown: true });
  assert.ok(g.html().includes('hintline') && g.html().includes(r.c), 'tapping Hint shows the clue: ' + r.c);
});

test('bindGame wires the tiles and auto-checks when the last slot fills', () => {
  const bindSrc = grab('bindGame');
  assert.ok(bindSrc.includes("if(gState.id==='scramble'){"), 'scramble has its own bindGame branch');
  assert.ok(bindSrc.includes("document.querySelectorAll('[data-tile]')"), 'tile taps are wired');
  assert.ok(bindSrc.includes("document.querySelectorAll('[data-slot]')"), 'slot taps are wired');
  assert.ok(bindSrc.includes('sndTick(filled)'), 'each placed letter ticks higher');
  assert.ok(bindSrc.includes("setTimeout(function(){ scrCheck(); },350)"), 'a full board checks itself after a beat');
  assert.ok(bindSrc.includes('function scrCheck(){'), 'the check grades the built word');
  assert.ok(bindSrc.includes("if(built===sq.word)"), 'the built word is compared with the target word');
  assert.ok(bindSrc.includes("getElementById('scrShuffle')") && bindSrc.includes("getElementById('scrClear')") && bindSrc.includes("getElementById('scrHint')"), 'Shuffle, Clear and Hint are wired');
});

test('startGame builds the scramble board from the run seed, after the seed and tier are set', () => {
  // Rebase note: batch B first wrote this init BEFORE gState.seed was
  // assigned, so it read an undefined seed and dealt seed-0 tiles for
  // a different word than the question — an unsolvable board. The init
  // must sit after the seed assignment AND after batch A's tier stamp.
  const startSrc = grab('startGame');
  const seedAt = startSrc.indexOf('gState.seed=seed;');
  const tierAt = startSrc.indexOf("gState.tier=(typeof levelTier==='function'?levelTier(e):'mid');");
  const scrAt = startSrc.indexOf("genRound('scramble', gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx])");
  assert.ok(seedAt >= 0 && tierAt >= 0 && scrAt >= 0,
    'startGame sets the seed, stamps the tier and builds the scramble board');
  assert.ok(seedAt < scrAt, 'the scramble board is built after the run seed is set');
  assert.ok(tierAt < scrAt, 'the scramble board is built after the tier is stamped');
});

test('scramble Next is bound in its own branch: the button after an answered round advances the game', () => {
  // Batch C found this live in the code: the scramble branch returns
  // before the generic gNext binding below it, so the Next button
  // rendered after an answered scramble round had no handler at all
  // — the child could not advance (Back / Save & quit still worked).
  // The branch must bind its own Next (like Sentence does) and
  // re-deal the board for the next round.
  const bindSrc = grab('bindGame');
  const scrStart = bindSrc.indexOf("if(gState.id==='scramble'){");
  assert.ok(scrStart >= 0, 'scramble branch exists');
  const scrBranch = bindSrc.slice(scrStart);
  const nextAt = scrBranch.indexOf("getElementById('gNext')");
  assert.ok(nextAt >= 0, 'the scramble branch binds its own Next button');
  const retAt = scrBranch.indexOf('\n    return;\n  }');
  assert.ok(retAt >= 0 && nextAt < retAt, 'Next is bound before the branch returns');
  assert.ok(scrBranch.includes('scrInitState(nq)'), 'Next re-deals the board for the new round');
});
