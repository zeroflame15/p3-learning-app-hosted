// How one agent thinks — video slide "How one agent thinks":
// question -> Kix Tutor -> opens skill pack by id -> thinks inside
// (instructions + lessons learned + guardrails it can't break)
// -> code decides marks/mastery/rewards -> a hint, not the answer.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GUARDRAILS, guardrailIds, lessonsFromFlags, think, signReply } = require('../lib/think');

test('guardrails exist and cover hint-first, P3 level, no location/camera, code decides', () => {
  assert.equal(GUARDRAILS.length, 7);
  assert.deepEqual(guardrailIds(), ['hint-not-answer', 'p3-level', 'under-90-words', 'no-personal-data', 'no-location-no-camera', 'code-decides', 'skill-must-match']);
  assert.match(GUARDRAILS.find((g) => g.id === 'skill-must-match').rule, /different one/);
  assert.match(GUARDRAILS.find((g) => g.id === 'no-location-no-camera').rule, /No location tracking/);
  assert.match(GUARDRAILS.find((g) => g.id === 'code-decides').rule, /lib\/rules\.js/);
});

test('video example: "Why can\'t Pip hop yet?" opens P3 Science by id', () => {
  const t = think("Why can't Pip hop yet?");
  assert.equal(t.agent.id, 'kix-tutor');
  assert.equal(t.skillId, 'life-cycle-frog');
  assert.equal(t.skillName, 'Frog Life Cycle');
  assert.match(t.instructions.join(' '), /life-cycle-frog/);
  assert.match(t.instructions.join(' '), /Egg → tadpole → froglet → frog/);
  assert.equal(t.hintFirst, true);
  assert.equal(t.lessonsApplied, 0);
});

test('lessons the loop learned: flags for the same skill are applied', () => {
  const flags = [
    { question: '7 x 8?', pipAnswer: '54', correction: '56', skillId: 'times-tables', status: 'open' },
    { question: 'Will a magnet attract plastic?', pipAnswer: 'Yes', correction: 'No', skillId: 'magnets', status: 'open' },
  ];
  const lessons = lessonsFromFlags(flags);
  assert.equal(lessons.length, 2);
  assert.equal(lessons[0].avoid, '54');
  assert.equal(lessons[0].use, '56');
  const t = think('What is 7 x 8?', { flags });
  assert.equal(t.lessonsApplied, 1);
  assert.match(t.instructions.join(' '), /do not say "54"/);
});

test('open question: no skill, hintFirst false, Ask Kix answers', () => {
  const t = think('Why is the sky blue?');
  assert.equal(t.agent.id, 'ask-kix');
  assert.equal(t.skillId, null);
  assert.equal(t.hintFirst, false);
});

test('every reply is signed and traceable', () => {
  const t = think('7 x 8?');
  const s1 = signReply(t);
  const s2 = signReply(t);
  assert.match(s1.signature, /^pip:kix-tutor:times-tables:skills-v1:t/);
  assert.equal(s1.agentId, 'kix-tutor');
  assert.equal(s1.skillVersion, 'skills-v1');
  assert.notEqual(s1.traceId, s2.traceId); // each reply has its own trace
  assert.notEqual(s1.signature, s2.signature);
});
