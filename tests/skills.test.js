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

test('16 skills, unique ids, every skill is complete', () => {
  assert.equal(SKILLS.length, 16);
  assert.equal(new Set(SKILLS.map((s) => s.id)).size, 16);
  for (const s of SKILLS) {
    assert.ok(s.id && s.subject && s.name && s.method, s.id);
    assert.ok(s.steps.length >= 3, s.id + ' needs >=3 steps');
    assert.ok(s.example.length > 10, s.id);
    assert.ok(s.watchOut.length > 5, s.id);
    assert.ok(s.keywords.length >= 3, s.id);
  }
});

test('all 14 Learn topics map to exactly one skill', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const topicIds = [...html.matchAll(/\{id:'([a-z0-9-]+)',sub:/g)].map((m) => m[1]);
  assert.equal(topicIds.length, 14, 'expected 14 topics, got ' + topicIds);
  for (const id of topicIds) {
    const mapped = SKILLS.filter((s) => s.topicId === id);
    assert.equal(mapped.length, 1, id + ' must map to exactly one skill');
    assert.ok(skillForTopic(id), id);
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
  assert.ok(skillById('fractions'));
  assert.equal(skillById('nope'), null);
});
