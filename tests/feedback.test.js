// The continuous eval and feedback loop — video slide:
// flag -> Reviewer checks (second model) -> code proves the fix
// (reproduced, re-tested, no regressions) -> ships, undoable
// -> becomes a test, re-run every night.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { REVIEWER_PROMPT, reviewVerdictFromText, reviewFlagLocal, proveFix, judgeFix, runFeedbackLoop } = require('../lib/feedback');
const { flagToTest } = require('../lib/flags');

const flag = { question: 'What is 7 x 8?', pipAnswer: '7 x 8 = 54', correction: '7 x 8 = 56', skillId: 'times-tables', agentId: 'kix-tutor' };

test('Reviewer prompt is a second-model check, verdict parsing is exact', () => {
  assert.match(REVIEWER_PROMPT, /second tutor/);
  assert.equal(reviewVerdictFromText('CONFIRMED — Pip was wrong.'), 'confirmed-mistake');
  assert.equal(reviewVerdictFromText('NOT-A-MISTAKE, Pip was right.'), 'not-a-mistake');
  assert.equal(reviewVerdictFromText('Hmm, not sure.'), 'needs-more-info');
});

test('local review: a flag with a correction is confirmed; without one it needs a read', () => {
  assert.equal(reviewFlagLocal(flag).verdict, 'confirmed-mistake');
  assert.equal(reviewFlagLocal({ question: 'x', pipAnswer: 'y' }).verdict, 'needs-more-info');
  assert.match(reviewFlagLocal(flag).note, /second model has not read/);
});

test('code proves the fix: correction proves it, the flagged answer does not', () => {
  const tc = flagToTest(flag);
  assert.equal(proveFix(tc, '7 x 8 = 56').proven, true);
  const bad = proveFix(tc, '7 x 8 = 54');
  assert.equal(bad.proven, false);
  assert.equal(bad.checks.notFlaggedAnswer, false);
  assert.equal(proveFix(tc, '').proven, false);
});

test('Judge ships only when code proves the fix', () => {
  const tc = flagToTest(flag);
  const proof = proveFix(tc, '7 x 8 = 56');
  assert.equal(judgeFix({ verdict: 'confirmed-mistake' }, proof).verdict, 'ship');
  assert.match(judgeFix({ verdict: 'confirmed-mistake' }, proof).reason, /undoable/);
  assert.equal(judgeFix({ verdict: 'not-a-mistake' }, proof).verdict, 'hold');
  assert.equal(judgeFix({ verdict: 'confirmed-mistake' }, { proven: false }).verdict, 'hold');
});

test('full loop: flag -> review -> prove -> judge -> becomes a test', () => {
  const tc = flagToTest(flag);
  const loop = runFeedbackLoop({ ...flag, testCase: tc }, '7 x 8 = 56');
  assert.equal(loop.review.verdict, 'confirmed-mistake');
  assert.equal(loop.proof.proven, true);
  assert.equal(loop.judge.verdict, 'ship');
  assert.equal(loop.becomesTest, true);
  const unproved = runFeedbackLoop({ ...flag, testCase: tc }, '');
  assert.equal(unproved.judge.verdict, 'hold');
  assert.equal(unproved.becomesTest, false);
});
