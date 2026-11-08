// Skills pack tests — every topic has exactly one exact method.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SKILL_PACK_VERSION, SKILL_PACK_LEVEL, SKILLS, skillById, skillForTopic, skillForQuestion } = require('../lib/skills');

test('pack is versioned and labelled P3', () => {
  assert.equal(SKILL_PACK_VERSION, 'skills-v1');
  assert.match(SKILL_PACK_LEVEL, /Primary 3/);
});

test('17 skills, unique ids, every skill is complete', () => {
  assert.equal(SKILLS.length, 17);
  assert.equal(new Set(SKILLS.map((s) => s.id)).size, 17);
  for (const s of SKILLS) {
    assert.ok(s.id && s.subject && s.name && s.method, s.id);
    assert.ok(s.steps.length >= 3, s.id + ' needs >=3 steps');
    assert.ok(s.example.length > 10, s.id);
    assert.ok(s.watchOut.length > 5, s.id);
    assert.ok(s.keywords.length >= 3, s.id);
  }
});

test('all 31 Learn topics map to at most one skill', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const topicIds = [...html.matchAll(/\{id:'([a-z0-9-]+)',(?:img:'[^']*',)?sub:/g)].map((m) => m[1]);
  assert.equal(topicIds.length, 31, 'expected 31 topics, got ' + topicIds);
  // The original 14 topics each have exactly one skill; the 17
  // gap-fill topics (2026-11-08) have NO skill entry in lib/skills.js
  // — Ask Pip is a direct Gemini call now, and lib/flags.js handles a
  // missing skill gracefully. Adding skill entries is a separate
  // follow-up, not the gap-fill. So: exactly one for the original 14,
  // at most one for the new 17.
  const ORIGINAL_14 = ['eng-story', 'eng-tense', 'eng-story2', 'eng-punct', 'math-mrt', 'math-hawker', 'math-ntuc', 'math-frac', 'sci-frog', 'sci-magnet', 'sci-plants', 'chi-listen', 'chi-family', 'chi-school'];
  for (const id of topicIds) {
    const mapped = SKILLS.filter((s) => s.topicId === id);
    if (ORIGINAL_14.includes(id)) {
      assert.equal(mapped.length, 1, id + ' must map to exactly one skill');
      assert.ok(skillForTopic(id), id);
    } else {
      assert.ok(mapped.length <= 1, id + ' must map to at most one skill');
    }
  }
});

test('skillForQuestion routes real questions to the right method', () => {
  const cases = [
    ['7 x 8 = ?', 'times-tables'],
    ['What is 247 + 158?', 'add-subtract'],
    ['A pizza is cut into 8 slices, I eat 2. What fraction?', 'fractions'],
    ['Yesterday we went to the zoo — why went?', 'tenses'],
    ['Which sentence is correct? Where is my pencil', 'punctuation'],
    ['How does a tadpole become a frog?', 'life-cycle-frog'],
    ['the life cycle of butterfly', 'life-cycle-butterfly'],
    ['What does a caterpillar turn into?', 'life-cycle-butterfly'],
    ['What is the life cycle of a frog?', 'life-cycle-frog'],
    ['Will a magnet attract a steel spoon?', 'magnets'],
    ['Why do plants need sunlight?', 'plants'],
    ['妈妈 means what?', 'chinese-listening'],
    ['How do I spell "because"?', 'spelling-lscwc'],
    ['How do I score well in maths?', 'check-work'],
    ['Chicken rice $3.50 and drink $1.50, total?', 'money-change'],
  ];
  for (const [q, want] of cases) {
    const got = skillForQuestion(q);
    assert.ok(got, q);
    assert.equal(got.id, want, q);
  }
  assert.equal(skillForQuestion('blorp zzz qqq'), null);
  // A bare "life cycle" with no animal must not hijack into the frog
  // skill — Pip should answer generally instead of teaching frogs.
  assert.equal(skillForQuestion('tell me about life cycles'), null);
  assert.ok(skillById('fractions'));
  assert.equal(skillById('nope'), null);
});
