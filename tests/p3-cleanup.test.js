// P3 cleanup: the app serves all levels P1–P6 now, not just P3, so no
// user-facing label may hardcode P3 / "Primary 3" — that confuses families
// at other levels. Regression tests for the cleanup (Bryan 2026-11-09):
// the browser tab title, the trivia page text and the Vibe blurb are
// level-neutral, the misleading internal comments were reworded, and the
// avatar sidebar/menu level labels still use levelNum (no regression of
// the avatar-level fix). Question-bank CONTENT is exempt: a question's
// own story may mention "Primary 3 pupils" (e.g. the football-trials
// poster) — that is story content inside a P3/P4 question, not a label.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

test('browser tab title is level-neutral', function () {
  assert.ok(html.includes("<title>Pip's Learning App</title>"), 'title must be Pip\'s Learning App');
  assert.ok(!html.includes('<title>P3 Learning App</title>'), 'title must not say P3 Learning App');
  assert.ok(!html.includes('P3 Learning App'), 'no "P3 Learning App" anywhere in the page');
});

test('trivia page text is level-neutral', function () {
  assert.ok(html.includes('Questions match primary school learning'), 'trivia must say primary school learning');
  assert.ok(!html.includes('Primary 3 learning'), 'trivia must not say Primary 3 learning');
});

test('Vibe blurb does not name the original family', function () {
  assert.ok(html.includes("blurb:'A gentle tune — soft and steady for study time.'"), 'vibe blurb must be the neutral wording');
  assert.ok(!html.includes('Bryan picked'), 'no user-facing blurb may say Bryan picked it');
});

test('misleading internal comments were reworded (P3-derived, being rebuilt per level)', function () {
  assert.ok(html.includes('31 topics (P3-derived; being rebuilt per level from the MOE syllabus)'), 'content comment must note the topics are P3-derived and being rebuilt per level');
  assert.ok(!html.includes('CONTENT — 31 Primary 3 topics'), 'content comment must not present P3 as the app level');
  assert.ok(html.includes('a general primary-school bank,'), 'trivia comment must call it a general bank');
  assert.ok(!html.includes('Trivia bank (requested 2026-11-07): Primary 3 level'), 'trivia comment must not call it a P3-level bank');
  assert.ok(html.includes('sub-topics of the Singapore MOE syllabus, P3-derived'), 'learn-structure comment must note the list is P3-derived');
  assert.ok(html.includes('being rebuilt per level (P1–P6) from the MOE syllabus'), 'learn-structure comment must note the per-level rebuild');
});

test('avatar sidebar/menu level labels still use levelNum (no regression)', function () {
  assert.ok(html.includes("Primary '+levelNum(ex())+' · '+esc(ex().name)"), 'sidebar must still build the level label from levelNum(ex())');
  assert.ok(html.includes("Primary '+levelNum(e)+' explorer"), 'menu must still build the level label from levelNum(e)');
  assert.ok(!html.includes("Primary 3 · '+esc(ex().name)"), 'sidebar must not hardcode Primary 3 again');
  assert.ok(!html.includes('Primary 3 explorer'), 'menu must not hardcode Primary 3 explorer again');
});

test('the only remaining "Primary 3" is question-bank story content', function () {
  // Every "Primary 3" left in the page must sit inside a question bank line
  // (the football-trials poster question). A label, title, toast, header or
  // comment must not contain it.
  const lines = html.split('\n');
  const hits = lines.filter(function (l) { return l.includes('Primary 3'); });
  assert.ok(hits.length >= 1, 'expected at least the football-trials question to still mention Primary 3');
  hits.forEach(function (l) {
    assert.ok(
      l.includes("FRESH_BANK['eng-visual']") || l.includes('FOOTBALL TRIALS') || l.includes('Primary 3 pupils'),
      'unexpected "Primary 3" outside question content: ' + l.slice(0, 120)
    );
  });
});
