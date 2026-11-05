// Flag-derived regression tests — "it becomes a test, re-run every night".
// Every flag in tests/flag-cases.json is a test case generated from a
// real flagged answer (see lib/flags.js flagToTest). The nightly runner
// (scripts/run-nightly.js) re-runs this file every night; a fixed
// mistake passes, the same mistake coming back fails.
// To add a flag: append its test case to flag-cases.json (question,
// pipAnswer, correction, skillId) — never edit a test to make it pass.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { proveFix } = require('../lib/feedback');
const { skillById } = require('../lib/skills');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'flag-cases.json'), 'utf8'));

test('flag cases file is well formed', () => {
  assert.ok(Array.isArray(cases) && cases.length >= 2, 'at least 2 flag cases');
  for (const c of cases) {
    assert.ok(c.id && c.question && c.pipAnswer, c.id);
    assert.ok(c.regression && c.regression.assertNot, c.id);
    assert.ok(skillById(c.regression.assertSkillId), c.id + ' skill must exist');
  }
});

for (const c of cases) {
  test(`flag regression: ${c.title}`, () => {
    // The fixed answer is the correction (or the skill method when no
    // correction was given). Code proves the fix: reproduced, the fixed
    // answer is not the flagged answer, the skill exists, and it
    // contains the correction.
    const fixed = c.correction || c.expected;
    const proof = proveFix(c, fixed);
    assert.equal(proof.proven, true, c.id + ' fix not proved: ' + JSON.stringify(proof.checks));
    assert.notEqual(fixed, c.pipAnswer);
  });
}

test('a returning mistake fails the regression', () => {
  // If Pip gave the flagged answer again, proveFix must NOT prove it.
  const c = cases[0];
  const proof = proveFix(c, c.pipAnswer);
  assert.equal(proof.proven, false);
  assert.equal(proof.checks.notFlaggedAnswer, false);
});
