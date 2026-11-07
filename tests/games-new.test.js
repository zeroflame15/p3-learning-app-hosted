// Tests for the new Play Arcade games: Word Scramble, Maths Race and
// Sentence Builder — plus the GAMES metadata for the two custom games
// (Crossword Quest, Exit Parking) whose logic lands separately.
// Sentence Builder is now REAL tap-to-build (tiles + build strip),
// not multiple-choice: it no longer uses genRound at all, so its
// tests eval the sent* helpers out of the page instead.
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

function grabGames() {
  const start = clientSrc.indexOf('var GAMES=[');
  assert.ok(start >= 0, 'GAMES found');
  const arrStart = clientSrc.indexOf('[', start);
  const arrEnd = clientSrc.indexOf('];', arrStart) + 1;
  return eval(clientSrc.slice(arrStart, arrEnd)); // eslint-disable-line no-eval
}

// Pull the helpers genRound needs out of the page source and run them.
// Word Garden reads TOPICS, so the eval gets a small stand-in for it.
const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"",j:""},{q:"Q2",o:["e","f","g","h"],a:1,c:"",j:""}],fresh:[]},'
  + '{quest:[{q:"Q3",o:["i","j","k","l"],a:2,c:"",j:""},{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled', 'shuffle']
  .map(grab).join('\n');
const revampStart = clientSrc.indexOf('var SORT_SETS=');
const revampBlock = revampStart >= 0 ? clientSrc.slice(revampStart, clientSrc.indexOf('function genRound')) : '';
const genRound = eval(stubTopics + helpers + '\n' + revampBlock + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval
// The Sentence Builder helpers live in the same block (just before
// genRound), so the same eval context yields them too.
const sent = eval(stubTopics + helpers + '\n' + revampBlock + '\n;({SENTENCES:SENTENCES,sentFor:sentFor,sentBank:sentBank,sentLocked:sentLocked,sentSolved:sentSolved,sentKey:sentKey})'); // eslint-disable-line no-eval

const NEW_GAMES = {
  scramble: { e: '🔀', name: 'Word Scramble', blurb: 'Unscramble the letters to find the word!', rounds: 6 },
  race: { e: '🏁', name: 'Maths Race', blurb: 'Quick-fire sums against the clock!', rounds: 6 },
  sentence: { e: '📝', name: 'Sentence Builder', blurb: 'Put the words in the right order.', rounds: 6 },
  crossword: { e: '🧩', name: 'Crossword Quest', blurb: 'Solve the clues and fill the grid!', rounds: 6 },
  parking: { e: '🚗', name: 'Exit Parking', blurb: 'Slide the cars and free the red car!', rounds: 18 },
};

test('GAMES has 9 entries: the 4 originals plus scramble, race, sentence, crossword, parking', () => {
  const GAMES = grabGames();
  assert.equal(GAMES.length, 9);
  assert.deepEqual(
    GAMES.map((g) => g.id),
    ['word', 'number', 'memory', 'sort', 'scramble', 'race', 'sentence', 'crossword', 'parking']
  );
  for (const [id, want] of Object.entries(NEW_GAMES)) {
    const g = GAMES.find((x) => x.id === id);
    assert.ok(g, id + ' in GAMES');
    assert.equal(g.e, want.e, id + ' emoji');
    assert.equal(g.name, want.name, id + ' name');
    assert.equal(g.blurb, want.blurb, id + ' blurb');
    assert.equal(g.rounds, want.rounds, id + ' rounds');
  }
});

test('race: rounds stable across re-renders, vary by round, marked answer is correct', () => {
  for (const gameId of ['race']) {
    for (const seed of [0, 777, 123456]) {
      const seen = new Set();
      for (let idx = 0; idx < 6; idx++) {
        const first = genRound(gameId, idx, seed);
        const second = genRound(gameId, idx, seed);
        const third = genRound(gameId, idx, seed);
        assert.deepEqual(second.o, first.o, gameId + ' seed ' + seed + ' round ' + idx + ': options must not move');
        assert.deepEqual(third.o, first.o, gameId + ' seed ' + seed + ' round ' + idx + ': options must not move on a third render');
        assert.equal(second.a, first.a, gameId + ' seed ' + seed + ' round ' + idx + ': correct-answer index must not move');
        assert.equal(first.o.length, 4, gameId + ' round ' + idx + ': exactly 4 options');
        assert.equal(new Set(first.o).size, 4, gameId + ' round ' + idx + ': options must be distinct');
        assert.ok(first.a >= 0 && first.a < 4, gameId + ' round ' + idx + ': answer index in range');
        seen.add(first.q + '|' + first.o.join(','));
      }
      assert.ok(seen.size > 1, gameId + ' seed ' + seed + ': rounds must differ from each other');
    }
  }
});

test('Word Scramble: a real tile round — word, scrambled letters, hint (no more fake MCQ)', () => {
  const sorted = (s) => s.split('').sort().join('');
  for (const seed of [0, 42, 987654321]) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('scramble', idx, seed);
      assert.equal(r.q, 'Unscramble the letters!', 'scramble asks to unscramble: ' + r.q);
      assert.ok(/^[A-Z]+$/.test(r.word), 'the round carries the word: ' + r.word);
      assert.ok(/^[A-Z]+$/.test(r.scr), 'the round carries its scrambled letters: ' + r.scr);
      assert.equal(sorted(r.scr), sorted(r.word), 'scrambled letters are exactly the word letters');
      assert.notEqual(r.scr, r.word, 'the scramble must not accidentally equal the word');
      assert.ok(r.c && r.c.length > 3, 'the round carries a hint for the 💡 button: ' + r.c);
      // The generic feedback ("The answer is …") still works: the
      // single option is the word, marked correct.
      assert.deepEqual(r.o, [r.word], 'options are just the word, for the feedback line');
      assert.equal(r.a, 0, 'the word is the marked answer');
      // Length ramps by round (mid tier): short words first, long last.
      const len = r.word.length;
      if (idx < 2) assert.ok(len >= 3 && len <= 4, 'rounds 1-2 use 3-4 letter words: ' + r.word);
      else if (idx < 4) assert.ok(len >= 5 && len <= 6, 'rounds 3-4 use 5-6 letter words: ' + r.word);
      else assert.ok(len >= 7 && len <= 9, 'rounds 5-6 use 7-9 letter words: ' + r.word);
    }
  }
  // Determinism: the same round re-renders identically.
  for (const seed of [0, 777]) {
    for (let idx = 0; idx < 6; idx++) {
      assert.deepEqual(genRound('scramble', idx, seed), genRound('scramble', idx, seed), 'seed ' + seed + ' round ' + idx + ' is stable');
    }
  }
});

test('Maths Race: the marked option is the true answer to the sum', () => {
  // Two question shapes now: a normal sum ("7 + 5 = ?") and a missing
  // number ("7 + ? = 12", "6 × ? = 42"). Both must have the marked
  // option as the true answer, and the ramp caps each round band.
  for (const seed of [0, 777, 55555]) {
    const kinds = new Set();
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('race', idx, seed);
      let expected, op;
      let m = r.q.match(/^(\d+) ([×+\-]) (\d+) = \?$/);
      if (m) {
        const a = +m[1], b = +m[3];
        op = m[2];
        if (op === '×') { expected = a * b; kinds.add('mul'); }
        else if (op === '+') { expected = a + b; kinds.add('add'); }
        else { expected = a - b; kinds.add('sub'); }
        assert.ok(expected >= 0, 'no negative answers: ' + r.q);
        if (idx < 2) {
          if (op === '×') assert.ok(a >= 2 && a <= 6 && b >= 2 && b <= 6, 'rounds 1-2: times tables 2-6: ' + r.q);
          else assert.ok(expected <= 20 && a <= 20, 'rounds 1-2: sums to 20: ' + r.q);
        } else if (idx < 4) {
          if (op === '×') assert.ok(a >= 2 && a <= 9 && b >= 2 && b <= 9, 'rounds 3-4: times tables 2-9: ' + r.q);
          else assert.ok(expected <= 30 && a <= 30, 'rounds 3-4: sums to 30: ' + r.q);
        }
      } else {
        m = r.q.match(/^(\d+) ([+×]) \? = (\d+)$/);
        assert.ok(m, 'question parses as a sum or a missing number: ' + r.q);
        const a = +m[1], c = +m[3];
        op = m[2];
        kinds.add('miss');
        assert.ok(idx >= 4, 'missing numbers only appear in the last rounds: ' + r.q);
        expected = op === '+' ? c - a : c / a;
        assert.ok(Number.isInteger(expected) && expected > 0, 'missing number is a whole positive number: ' + r.q);
      }
      assert.equal(r.o[r.a], String(expected), 'the marked answer is the true answer: ' + r.q);
      assert.equal(r.o.length, 4, 'exactly 4 options: ' + r.q);
      assert.equal(new Set(r.o).size, 4, 'options must be distinct: ' + r.q);
      for (const o of r.o) assert.ok(+o >= 0, 'no negative options for a P3 child: ' + r.q);
    }
    // Over several seeds the game should use more than one kind of sum.
    assert.ok(kinds.size >= 2, 'race mixes sum kinds, got: ' + [...kinds].join(','));
  }
});

test('genRound has no sentence branch any more — Sentence Builder builds, it does not pick options', () => {
  const body = grab('genRound');
  assert.ok(body.indexOf("gameId==='sentence'") < 0, 'no sentence round in genRound');
  assert.ok(body.indexOf('Jumbled:') < 0, 'the correct-order "jumbled" prompt is gone');
});

test('Sentence Builder: 45 sentences in 3 tiers, one per level band', () => {
  assert.equal(sent.SENTENCES.length, 45, '45 sentences');
  for (const t of [1, 2, 3]) {
    const pool = sent.SENTENCES.filter((s) => s.t === t);
    assert.equal(pool.length, 15, 'tier ' + t + ' has 15 sentences');
    pool.forEach((s) => {
      assert.ok(s.w.length >= 3 && s.w.length <= 8, 'sentence has 3-8 words: ' + s.w.join(' '));
      assert.ok(s.c && s.c.length > 5, 'every sentence carries an explanation: ' + s.w.join(' '));
      // No exact duplicate word inside one sentence (tiles must be distinct).
      assert.equal(new Set(s.w).size, s.w.length, 'no repeated word in one sentence: ' + s.w.join(' '));
      if (t === 3) assert.ok(['.', '?', '!'].includes(s.p), 'tier 3 has a punctuation mark: ' + s.w.join(' '));
      else assert.equal(s.p, undefined, 'tiers 1-2 have no punctuation choice: ' + s.w.join(' '));
    });
  }
  // The 10 original sentences survive in tier 2.
  const tier2 = sent.SENTENCES.filter((s) => s.t === 2).map((s) => s.w.join(' '));
  for (const old of ['The dog chases the cat', 'I read my favourite book', 'The cat drinks milk', 'She hugs her teddy bear', 'We love our school', 'The bird sings a song', 'He kicked the ball', 'My mum bakes a cake', 'The sun warms the earth', 'The children love to play']) {
    assert.ok(tier2.includes(old), 'original sentence kept in tier 2: ' + old);
  }
});

test('Sentence Builder: sentFor picks deterministically per tier, sentBank deals a real shuffle', () => {
  for (const tier of ['low', 'mid', 'high']) {
    const wantT = tier === 'low' ? 1 : tier === 'high' ? 3 : 2;
    let shuffled = 0, total = 0;
    for (const seed of [0, 777, 2024]) {
      const seen = new Set();
      for (let idx = 0; idx < 6; idx++) {
        const s = sent.sentFor(seed, idx, tier);
        assert.equal(s.t, wantT, 'tier ' + tier + ' picks tier-' + s.t + ' sentences');
        assert.deepEqual(sent.sentFor(seed, idx, tier), s, 'same seed+round re-renders the same sentence');
        seen.add(sent.sentKey(s));
        const bank = sent.sentBank(s, seed, idx);
        assert.equal(bank.length, s.w.length, 'one tile per word');
        assert.deepEqual(bank.slice().sort((a, b) => a - b), s.w.map((_, i) => i), 'the bank is a permutation of the word indices');
        assert.deepEqual(sent.sentBank(s, seed, idx), bank, 'the bank re-renders identically');
        if (bank.some((b, i) => b !== i)) shuffled++;
        total++;
      }
      assert.ok(seen.size > 1, 'tier ' + tier + ' seed ' + seed + ': rounds use different sentences');
    }
    // The bank must actually shuffle (not deal the answer in order).
    // Short sentences have a real chance of an identity shuffle
    // (1 in 6 for 3 words), so the bar is half the rounds, not all.
    assert.ok(shuffled >= Math.floor(total / 2), 'the bank is shuffled, not the answer in order (' + shuffled + '/' + total + ')');
  }
  // 6 rounds never repeat a sentence within one run (pool is 15).
  const keys = [];
  for (let idx = 0; idx < 6; idx++) keys.push(sent.sentKey(sent.sentFor(42, idx, 'mid')));
  assert.equal(new Set(keys).size, 6, 'no repeat in a 6-round run');
});

test('Sentence Builder: locks, solve and resume key', () => {
  const s = sent.sentFor(7, 0, 'mid');
  const bank = sent.sentBank(s, 7, 0);
  // Empty build: nothing locked, not solved.
  const empty = s.w.map(() => null);
  assert.deepEqual(sent.sentLocked(empty, bank), s.w.map(() => false), 'empty build locks nothing');
  assert.equal(sent.sentSolved(empty, bank), false, 'empty build is not solved');
  // Build the sentence in the correct order (tile j holds word bank[j]).
  const built = s.w.map((_, i) => bank.indexOf(i));
  assert.deepEqual(sent.sentLocked(built, bank), s.w.map(() => true), 'a correct build locks every tile green');
  assert.equal(sent.sentSolved(built, bank), true, 'a correct build is solved');
  // Swap two tiles: those two slots unlock, the rest stay locked.
  const wrong = built.slice(); wrong[0] = built[1]; wrong[1] = built[0];
  const locks = sent.sentLocked(wrong, bank);
  assert.equal(locks[0], false, 'a swapped tile is not locked');
  assert.equal(locks[1], false, 'the other swapped tile is not locked');
  assert.ok(locks.slice(2).every(Boolean), 'the untouched slots stay locked');
  assert.equal(sent.sentSolved(wrong, bank), false, 'a swapped build is not solved');
  // A partially correct build locks only the right slots.
  const partial = s.w.map(() => null); partial[0] = built[0];
  assert.equal(sent.sentLocked(partial, bank)[0], true, 'a right first word locks');
  assert.equal(sent.sentSolved(partial, bank), false, 'a partial build is not solved');
  // The resume key is the sentence itself.
  assert.equal(sent.sentKey(s), s.w.join(' '), 'sentKey is the sentence text');
});

test('the new branches use the seeded shuffle, never Math.random', () => {
  const body = grab('genRound');
  const mine = body.slice(body.indexOf("if(gameId==='scramble')"), body.indexOf('var a, b;'));
  assert.ok(mine.length > 100, 'the scramble and race branches sit between sort and the number section');
  assert.ok(!mine.includes('Math.random'), 'no Math.random in the new branches');
  assert.ok(mine.includes('optsShuffled'), 'race rounds go through the seeded option shuffle');
  assert.ok(mine.includes('word:word, scr:'), 'scramble returns the word and its scrambled letters for the tiles');
});
