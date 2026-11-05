// Tests for the Play Arcade games: a round's options must not move
// after the child taps one. gameHTML re-generates the round on every
// render, so any Math.random shuffle there makes the tapped answer
// visibly jump to another balloon and the right/wrong highlight land
// on the wrong one (seen live in Number Pop, 2026-11-05).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const clientSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grab(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = clientSrc.indexOf('\n}\n', start);
  return clientSrc.slice(start, end + 3);
}

// Pull the helpers genRound needs out of the page source and run them.
// Word Garden reads TOPICS, so the eval gets a small stand-in for it.
const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"",j:""},{q:"Q2",o:["e","f","g","h"],a:1,c:"",j:""}],fresh:[]},'
  + '{quest:[{q:"Q3",o:["i","j","k","l"],a:2,c:"",j:""},{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled', 'shuffle']
  .map(grab).join('\n');
const genRound = eval(stubTopics + helpers + '\n' + grab('genRound') + '\n;genRound');

test('Number Pop options are identical on every re-render of the same round', () => {
  for (const seed of [0, 12345, 987654321]) {
    for (let idx = 0; idx < 6; idx++) {
      const first = genRound('number', idx, seed);
      const second = genRound('number', idx, seed);
      const third = genRound('number', idx, seed);
      assert.deepEqual(second.o, first.o, 'seed ' + seed + ' round ' + idx + ': options must not move');
      assert.deepEqual(third.o, first.o, 'seed ' + seed + ' round ' + idx + ': options must not move on a third render');
      assert.equal(second.a, first.a, 'correct-answer index must not move either');
      // The marked option must be the true answer to the question.
      const m = first.q.match(/^(\d+) ([×+]) (\d+) = \?$/);
      assert.ok(m, 'question parses: ' + first.q);
      const expected = m[2] === '×' ? (+m[1]) * (+m[3]) : (+m[1]) + (+m[3]);
      assert.equal(first.o[first.a], String(expected), 'the marked answer is the true answer');
    }
  }
});

test('Number Pop options are still shuffled, not always in the same order', () => {
  const orders = new Set();
  for (let idx = 0; idx < 6; idx++) orders.add(genRound('number', idx, 4242).o.join(','));
  assert.ok(orders.size > 1, 'different rounds should not all share one option order');
});

test('Word Garden and Speed Sort rounds are also stable across re-renders', () => {
  for (const gameId of ['word', 'sort']) {
    for (let idx = 0; idx < 3; idx++) {
      const first = genRound(gameId, idx, 777);
      const second = genRound(gameId, idx, 777);
      assert.deepEqual(second.o, first.o, gameId + ' round ' + idx + ': options must not move');
      assert.equal(second.a, first.a, gameId + ' round ' + idx + ': correct-answer index must not move');
    }
  }
});

test('the number round no longer uses a random shuffle', () => {
  const body = grab('genRound');
  const numBranch = body.slice(body.indexOf("var a, b;"));
  assert.ok(!numBranch.includes('shuffle(['), 'number options must not go through Math.random shuffle');
  assert.ok(numBranch.includes('optsShuffled'), 'number options use the seeded shuffle like the other games');
});
