// Gap-fill skill entries (2026-11-09): the 17 topics added to Learn
// 2026-11-08 had no skill entry in lib/skills.js, so Pip could not
// open an exact method for them. Each one now has exactly one.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SKILLS, skillForTopic, skillForQuestion } = require('../lib/skills');

// The 17 gap-fill topics, from the TOPICS list in public/index.html
// (the 31 Learn topics minus the original 14).
const GAP_FILL = [
  ['math-length', 'measure-masters'],
  ['math-time', 'time-travellers'],
  ['math-area', 'area-perimeter'],
  ['math-angles', 'angle-explorers'],
  ['math-bargraphs', 'bar-graphs'],
  ['eng-spelling', 'spelling-stars'],
  ['eng-visual', 'visual-text'],
  ['sci-classification', 'sorting-scientists'],
  ['sci-materials', 'material-matters'],
  ['chi-char', 'char-detective'],
  ['chi-picword', 'picture-word'],
  ['chi-collocation', 'word-pairs'],
  ['chi-sequencing', 'sentence-order'],
  ['chi-sentence', 'sentence-workshop'],
  ['chi-reading', 'reading-detective'],
  ['chi-composition', 'picture-composition'],
  ['chi-oral', 'oral-star'],
];

test('every gap-fill topic has exactly one skill entry', () => {
  assert.equal(GAP_FILL.length, 17, 'expected 17 gap-fill topics');
  for (const [topicId, skillId] of GAP_FILL) {
    const mapped = SKILLS.filter((s) => s.topicId === topicId);
    assert.equal(mapped.length, 1, topicId + ' must map to exactly one skill');
    assert.equal(mapped[0].id, skillId, topicId + ' maps to ' + skillId);
    assert.ok(skillForTopic(topicId), topicId + ' resolves via skillForTopic');
  }
});

test('every gap-fill skill is complete, like the original 14', () => {
  for (const [, skillId] of GAP_FILL) {
    const s = SKILLS.find((x) => x.id === skillId);
    assert.ok(s, skillId + ' exists');
    assert.ok(s.subject && s.name && s.method, skillId);
    assert.ok(s.steps.length >= 3, skillId + ' needs >=3 steps');
    assert.ok(s.example.length > 10, skillId);
    assert.ok(s.watchOut.length > 5, skillId);
    assert.ok(s.keywords.length >= 3, skillId);
  }
});

test('gap-fill questions route to their new skill, not an old one', () => {
  const cases = [
    ['How many centimetres are in 2 m 30 cm?', 'measure-masters'],
    ['What is 7 pm in 24-hour time?', 'time-travellers'],
    ['What is the area of a rectangle 9 cm by 2 cm?', 'area-perimeter'],
    ['Which angle is obtuse, 30 degrees or 120 degrees?', 'angle-explorers'],
    ['The bar graph shows cats 12 and dogs 8. How many more cats?', 'bar-graphs'],
    ['Which word is correctly spelt: caught or cought?', 'spelling-stars'],
    ['What is the purpose of the poster?', 'visual-text'],
    ['Is a whale a mammal or a fish?', 'sorting-scientists'],
    ['Which material is waterproof, plastic or paper?', 'material-matters'],
    ['辨字：哪个字是对的？', 'char-detective'],
    ['看图选词：图上画着小明把纸屑扔进垃圾桶。', 'picture-word'],
    ['词语搭配：一___车，应该填什么量词？', 'word-pairs'],
    ['组句成段：把句子排成一段通顺的话。', 'sentence-order'],
    ['扩写句子：小猫睡觉。', 'sentence-workshop'],
    ['阅读理解：读了这段话，树叶像什么？', 'reading-detective'],
    ['看图写段：哪一句最适合做开头？', 'picture-composition'],
    ['口试：朗读时遇到逗号应该怎么做？', 'oral-star'],
  ];
  for (const [q, want] of cases) {
    const got = skillForQuestion(q);
    assert.ok(got, q);
    assert.equal(got.id, want, q);
  }
});

test('the new skills do not hijack the original routing', () => {
  // Regression guards from tests/skills.test.js: these must still
  // land on the original skills even with 17 more skills in the pack.
  assert.equal(skillForQuestion('How do I spell "because"?').id, 'spelling-lscwc');
  assert.equal(skillForQuestion('How do I score well in maths?').id, 'check-work');
  assert.equal(skillForQuestion('Will a magnet attract a steel spoon?').id, 'magnets');
  assert.equal(skillForQuestion('Why do plants need sunlight?').id, 'plants');
  assert.equal(skillForQuestion('Which sentence is correct? Where is my pencil').id, 'punctuation');
});
