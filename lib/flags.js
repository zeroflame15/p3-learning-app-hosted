// Every flag becomes a test.
// When a child (or grown-up) flags a Pip answer as possibly wrong, we
// record the flag as structured data and auto-generate a regression
// test case from it. The test case is what the test suite runs: if Pip
// (or the canned answer, or the skill) is fixed, the test passes;
// if the same mistake comes back, the test fails. That is how
// tomorrow's app beats today's.
'use strict';

const { skillForQuestion } = require('./skills');

function flagToTest(flag) {
  const question = String(flag?.question || '').trim();
  const pipAnswer = String(flag?.pipAnswer || flag?.answer || '').trim();
  const correction = String(flag?.correction || '').trim();
  if (!question) throw new Error('flag needs a question');
  if (!pipAnswer) throw new Error('flag needs Pip’s answer');
  const skill = skillForQuestion(question) || (flag?.skillId ? { id: flag.skillId } : null);
  const id = 'flag-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const expected = correction || 'Pip’s corrected answer should match the skill method, not the flagged answer.';
  return {
    id,
    title: 'Flagged: ' + question.slice(0, 80),
    question,
    pipAnswer,
    correction: correction || null,
    expected,
    skillId: skill ? skill.id : (flag?.skillId || null),
    agentId: flag?.agentId || null,
    live: flag?.live === true,
    status: 'open',
    createdAt: new Date().toISOString(),
    // A runnable regression test, in plain words + a machine check:
    // the fixed answer must NOT be the flagged answer, and must use
    // the skill method named above.
    regression: {
      assertNot: pipAnswer,
      assertSkillId: skill ? skill.id : null,
      assertContains: correction ? correction.slice(0, 60) : null,
    },
  };
}

function validateFlag(flag) {
  if (!flag || typeof flag !== 'object') return 'flag must be an object';
  if (!String(flag.question || '').trim()) return 'question is required';
  if (!String(flag.pipAnswer || flag.answer || '').trim()) return 'pipAnswer is required';
  if (String(flag.question).length > 500) return 'question is too long (max 500)';
  return null;
}

module.exports = { flagToTest, validateFlag };
