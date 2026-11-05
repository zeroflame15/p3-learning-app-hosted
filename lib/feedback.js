// The continuous eval and feedback loop — the video's third slide:
//   Kix replies (every reply signed, traceable)
//   -> A kid flags it (one tap, in their own words)
//   -> A reviewer checks (a second model reads the case)
//   -> Code proves the fix (reproduced, re-tested, no regressions)
//   -> It ships, undoable (a new version, in seconds)
//   -> It becomes a test (re-run every night)
//   -> Tomorrow's Kix is better than today's.
//
// This module is the loop in code. It never calls a model itself:
// the Reviewer's second-model prompt is here (REVIEWER_PROMPT) and
// api/flag.js runs it as a second model pass when a model key is
// configured; without a key the review is queued, never faked.
// The Judge is pure code: it ships a fix only when the code proves
// it. "Ships, undoable" is a new version of the skill pack / test
// suite — in this repo, a git commit that can be reverted.
'use strict';

const { skillById } = require('./skills');

// The Reviewer (Muse Spark Open, "ready" in the video) reads the case
// as a second model. Until a Spark Open key exists, api/flag.js runs
// this prompt as a second pass on the configured model and labels it
// honestly as a second pass — never as Spark Open.
const REVIEWER_PROMPT = [
  'You are the Reviewer, a second tutor checking a flagged answer.',
  'Read the flagged case carefully. Decide: was Pip’s answer wrong?',
  'Answer with exactly one word on the first line: CONFIRMED (Pip was wrong),',
  'NOT-A-MISTAKE (Pip was right), or NEEDS-MORE-INFO.',
  'Then, in one short sentence, say what the correct answer should be,',
  'using the exact skill method named in the case.',
].join(' ');

function reviewVerdictFromText(text) {
  const t = String(text || '').toUpperCase();
  if (t.includes('CONFIRMED')) return 'confirmed-mistake';
  if (t.includes('NOT-A-MISTAKE') || t.includes('NOT A MISTAKE')) return 'not-a-mistake';
  return 'needs-more-info';
}

// Pure review of a flag when no model is available: a flag WITH a
// correction is a confirmed mistake to check; a flag with no correction
// needs a grown-up / second-model read. Never claims a model checked it.
function reviewFlagLocal(flag) {
  const correction = String(flag?.correction || '').trim();
  if (correction) {
    return { reviewer: 'reviewer', verdict: 'confirmed-mistake', checkedBy: 'local-rule', note: 'Flag carries a correction, so the mistake is confirmed for checking. A second model has not read this case yet.' };
  }
  return { reviewer: 'reviewer', verdict: 'needs-more-info', checkedBy: 'local-rule', note: 'No correction was given, so a second model (or a grown-up) still needs to read this case.' };
}

// Code proves the fix: reproduce the flagged case, re-test it, and
// check for regressions. Pure function — the nightly runner calls it
// for every flag-derived test case in tests/flag-cases.json.
// A fix is proven only when: the fixed answer is not the flagged
// answer, the skill it uses exists in the pack, and (when a
// correction was given) the fixed answer contains the correction.
function proveFix(testCase, fixedAnswer) {
  const fixed = String(fixedAnswer || '').trim();
  const checks = {
    reproduced: Boolean(testCase && testCase.question),
    notFlaggedAnswer: fixed !== String(testCase?.pipAnswer || '').trim() && fixed.length > 0,
    skillExists: testCase?.regression?.assertSkillId ? Boolean(skillById(testCase.regression.assertSkillId)) : true,
    matchesCorrection: testCase?.regression?.assertContains
      ? fixed.toLowerCase().includes(String(testCase.regression.assertContains).toLowerCase())
      : true,
  };
  const proven = checks.reproduced && checks.notFlaggedAnswer && checks.skillExists && checks.matchesCorrection;
  return { proven, checks };
}

// The Judge (Muse Spark Open, "ready" in the video) decides whether
// a fix ships. Pure code: ship ONLY when the Reviewer confirmed the
// mistake AND code proved the fix. Anything else holds — it does not
// ship. An unreviewed flag (verdict needs-more-info) never ships on
// the strength of the code check alone.
function judgeFix(review, proof) {
  if (review?.verdict === 'not-a-mistake') {
    return { judge: 'judge', verdict: 'hold', reason: 'Reviewer says Pip was right — nothing to fix.' };
  }
  if (review?.verdict !== 'confirmed-mistake') {
    return { judge: 'judge', verdict: 'hold', reason: 'Reviewer has not confirmed the mistake yet — a second model (or a grown-up) still needs to read the case.' };
  }
  if (!proof?.proven) {
    return { judge: 'judge', verdict: 'hold', reason: 'Code has not proved the fix yet (reproduced, re-tested, no regressions).' };
  }
  return { judge: 'judge', verdict: 'ship', reason: 'Reviewer confirmed the mistake and code proved the fix. Ships as a new version, undoable by reverting it.' };
}

// One flag's full loop, in one place, for the parent page and tests:
// flag -> review -> prove -> judge. `fixedAnswer` is the corrected
// answer the skill method gives; without it, the fix cannot be proved.
function runFeedbackLoop(flag, fixedAnswer, reviewOverride) {
  const review = reviewOverride || reviewFlagLocal(flag);
  const testCase = flag?.testCase || null;
  const proof = testCase ? proveFix(testCase, fixedAnswer) : { proven: false, checks: { reproduced: false, notFlaggedAnswer: false, skillExists: false, matchesCorrection: false } };
  const judge = judgeFix(review, proof);
  return { review, proof, judge, becomesTest: judge.verdict === 'ship' };
}

module.exports = { REVIEWER_PROMPT, reviewVerdictFromText, reviewFlagLocal, proveFix, judgeFix, runFeedbackLoop };
