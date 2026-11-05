// Tests for lib/arithmetic.js — code decides the number for plain
// sums, so Pip can never again tell a child "3 + 3 + 3 = 7".
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSimpleSum } = require('../lib/arithmetic');

test('3 x 4 is 12, with the full repeated-addition working', () => {
  const s = extractSimpleSum('what is 3 x 4');
  assert.equal(s.answer, 12);
  assert.equal(s.expression, '3 x 4 = 12');
  assert.equal(s.working, '3 added 4 times is 3 + 3 + 3 + 3 = 12');
});

test('3 times 4 is the same sum', () => {
  assert.equal(extractSimpleSum('what is 3 times 4').answer, 12);
});

test('7 x 8 is 56', () => {
  assert.equal(extractSimpleSum('7 x 8').answer, 56);
});

test('addition and subtraction', () => {
  assert.equal(extractSimpleSum('23 + 7').answer, 30);
  assert.equal(extractSimpleSum('20 minus 6').answer, 14);
});

test('exact division only', () => {
  assert.equal(extractSimpleSum('12 divided by 3').answer, 4);
  assert.equal(extractSimpleSum('10 divided by 3'), null);
});

test('non-sums return null for the model to answer', () => {
  assert.equal(extractSimpleSum('What is a verb?'), null);
  assert.equal(extractSimpleSum('How is the life cycle of plant'), null);
  assert.equal(extractSimpleSum('tell me a joke'), null);
});
