// Tests for the three new Play Arcade MCQ games: Word Scramble,
// Maths Race and Sentence Builder — plus the GAMES metadata for the
// two custom games (Crossword Quest, Exit Parking) whose logic lands
// separately. Same determinism contract as the existing games:
// a round's options must not move across re-renders, must vary by
// round, and the marked answer must be the true answer.
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
const genRound = eval(stubTopics + helpers + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval

const NEW_GAMES = {
  scramble: { e: '🔀', name: 'Word Scramble', blurb: 'Unscramble the letters to find the word!', rounds: 6 },
  race: { e: '🏁', name: 'Maths Race', blurb: 'Quick-fire sums against the clock!', rounds: 6 },
  sentence: { e: '📝', name: 'Sentence Builder', blurb: 'Put the words in the right order.', rounds: 6 },
  crossword: { e: '🧩', name: 'Crossword Quest', blurb: 'Solve the clues and fill the grid!', rounds: 6 },
  parking: { e: '🚗', name: 'Exit Parking', blurb: 'Slide the cars and free the red car!', rounds: 4 },
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

test('all three new MCQ games: rounds stable across re-renders, vary by round, marked answer is correct', () => {
  for (const gameId of ['scramble', 'race', 'sentence']) {
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

test('Word Scramble: the question letters are a true scramble of the marked answer', () => {
  const sorted = (s) => s.split('').sort().join('');
  for (const seed of [0, 42, 987654321]) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('scramble', idx, seed);
      const m = r.q.match(/^Unscramble: ([A-Z]+)$/);
      assert.ok(m, 'question shows the scrambled letters: ' + r.q);
      const answer = r.o[r.a];
      assert.ok(/^[A-Z]+$/.test(answer), 'answer is a word: ' + answer);
      assert.equal(sorted(m[1]), sorted(answer), 'scrambled letters are exactly the answer letters');
      assert.notEqual(m[1], answer, 'the scramble must not accidentally equal the word');
      assert.ok(answer.length >= 3, 'P3 word, at least 3 letters: ' + answer);
    }
  }
});

test('Maths Race: the marked option is the true answer to the sum', () => {
  for (const seed of [0, 777, 55555]) {
    const kinds = new Set();
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('race', idx, seed);
      const m = r.q.match(/^(\d+) ([×+\-]) (\d+) = \?$/);
      assert.ok(m, 'question parses: ' + r.q);
      const a = +m[1], b = +m[3];
      let expected;
      if (m[2] === '×') { expected = a * b; kinds.add('mul'); assert.ok(a >= 2 && a <= 6 && b >= 2 && b <= 6, 'times tables 2-6: ' + r.q); }
      else if (m[2] === '+') { expected = a + b; kinds.add('add'); assert.ok(expected <= 20, 'add to 20: ' + r.q); }
      else { expected = a - b; kinds.add('sub'); assert.ok(expected >= 0 && expected <= 20, 'subtract to 20: ' + r.q); }
      assert.equal(r.o[r.a], String(expected), 'the marked answer is the true answer: ' + r.q);
      for (const o of r.o) assert.ok(+o >= 0, 'no negative options for a P3 child: ' + r.q);
    }
    // Over several seeds the game should use more than one kind of sum.
    assert.ok(kinds.size >= 2, 'race mixes sum kinds, got: ' + [...kinds].join(','));
  }
});

const SENTENCES = [
  'The dog chases the cat',
  'I read my favourite book',
  'The cat drinks milk',
  'She hugs her teddy bear',
  'We love our school',
  'The bird sings a song',
  'He kicked the ball',
  'My mum bakes a cake',
  'The sun warms the earth',
  'The children love to play',
];

test('Sentence Builder: options are 4 orderings of the same words, only the marked one is the sentence', () => {
  const sortedWords = (s) => s.split(' ').sort().join(' ');
  for (const seed of [0, 777, 2024]) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('sentence', idx, seed);
      const m = r.q.match(/^Jumbled: (.+)$/);
      assert.ok(m, 'question shows the jumbled words: ' + r.q);
      const jumbled = m[1].split(' / ');
      assert.ok(jumbled.length >= 3, 'sentence has at least 3 words');
      for (const o of r.o) assert.equal(sortedWords(o), sortedWords(jumbled.join(' ')), 'each option is an ordering of the same words: ' + o);
      assert.ok(SENTENCES.includes(r.o[r.a]), 'the marked answer is the intended sentence: ' + r.o[r.a]);
      assert.equal(sortedWords(r.o[r.a]), sortedWords(jumbled.join(' ')), 'the marked sentence uses exactly the jumbled words');
    }
  }
});

test('the new MCQ branches use the seeded shuffle, never Math.random', () => {
  const body = grab('genRound');
  const mine = body.slice(body.indexOf("if(gameId==='scramble')"), body.indexOf('var a, b;'));
  assert.ok(mine.length > 100, 'the three new branches sit between sort and the number section');
  assert.ok(!mine.includes('Math.random'), 'no Math.random in the new branches');
  assert.ok(mine.includes('optsShuffled'), 'new rounds go through the seeded option shuffle');
});
