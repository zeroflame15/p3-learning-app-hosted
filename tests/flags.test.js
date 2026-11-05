// Flag-to-test tests — every flag becomes a regression test.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { flagToTest, validateFlag } = require('../lib/flags');

test('a flag generates a complete regression test case', () => {
  const tc = flagToTest({
    question: 'What is 7 x 8?',
    pipAnswer: '7 x 8 = 54',
    correction: '7 x 8 = 56',
    agentId: 'maths-tutor',
    live: true,
  });
  assert.match(tc.id, /^flag-/);
  assert.equal(tc.question, 'What is 7 x 8?');
  assert.equal(tc.pipAnswer, '7 x 8 = 54');
  assert.equal(tc.correction, '7 x 8 = 56');
  assert.equal(tc.skillId, 'times-tables');
  assert.equal(tc.agentId, 'maths-tutor');
  assert.equal(tc.status, 'open');
  assert.equal(tc.regression.assertNot, '7 x 8 = 54');
  assert.equal(tc.regression.assertSkillId, 'times-tables');
  assert.match(tc.regression.assertContains, /56/);
  assert.ok(tc.createdAt);
});

test('a flag without a correction still makes a test (skill method is the expectation)', () => {
  const tc = flagToTest({ question: 'Will a magnet attract plastic?', pipAnswer: 'Yes, all metal sticks.' });
  assert.equal(tc.skillId, 'magnets');
  assert.equal(tc.correction, null);
  assert.match(tc.expected, /skill method/);
});

test('validation rejects bad flags', () => {
  assert.match(validateFlag(null), /object/);
  assert.match(validateFlag({}), /question/);
  assert.match(validateFlag({ question: 'x' }), /pipAnswer/);
  assert.equal(validateFlag({ question: 'x', pipAnswer: 'y' }), null);
  assert.match(validateFlag({ question: 'x'.repeat(501), pipAnswer: 'y' }), /too long/);
  assert.throws(() => flagToTest({}), /question/);
  assert.throws(() => flagToTest({ question: 'x' }), /Pip/);
});
