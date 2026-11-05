// Agent registry tests — 19 specialists, 17 on Meta Muse.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AGENTS, agentById, liveAgents, placeholderAgents, routeQuestion } = require('../lib/agents');
const { SKILLS } = require('../lib/skills');

test('19 specialist agents, 17 on Meta Muse, 2 plain code', () => {
  assert.equal(AGENTS.length, 19);
  assert.equal(AGENTS.filter((a) => a.modelFamily === 'meta-muse').length, 17);
  assert.equal(AGENTS.filter((a) => a.modelFamily === 'local-code').length, 2);
  assert.equal(new Set(AGENTS.map((a) => a.id)).size, 19);
  for (const a of AGENTS) {
    assert.ok(a.name && a.role && a.model && a.status, a.id);
    assert.ok(['live', 'placeholder'].includes(a.status), a.id);
  }
});

test('only Muse Spark 1.3 is live on a model; Image/SAM/Voice/Open are placeholders', () => {
  assert.equal(liveAgents().length, 15);
  assert.equal(placeholderAgents().length, 4);
  assert.deepEqual(placeholderAgents().map((a) => a.id).sort(),
    ['image-guide', 'open-model', 'vision-guide', 'voice-coach']);
  for (const a of placeholderAgents()) assert.match(a.role, /PLACEHOLDER/);
  // No placeholder agent may claim a live model call exists.
  for (const a of AGENTS) if (a.status === 'placeholder') assert.notEqual(a.model, 'muse-spark-1.3');
});

test('every agent skill id exists in the skill pack', () => {
  const ids = new Set(SKILLS.map((s) => s.id));
  for (const a of AGENTS) for (const sid of a.skillIds) assert.ok(ids.has(sid), a.id + ' -> ' + sid);
});

test('routing: real questions go to the right specialist + skill', () => {
  const cases = [
    ['7 x 8 = ?', 'maths-tutor', 'times-tables'],
    ['14 + 9 stations?', 'maths-tutor', 'add-subtract'],
    ['Why is the sky blue?', 'science-tutor', null],
    ['Will a magnet attract steel?', 'science-tutor', 'magnets'],
    ['mama means?', 'chinese-tutor', 'chinese-listening'],
    ['Yesterday we went — why went?', 'english-tutor', 'tenses'],
    ['Tell me a story', 'storyteller', 'story-next'],
    ['I am tired, this is hard', 'encourager', null], // no topic skill — encouragement, not a method
    ['That answer is wrong', 'flag-checker', null],
    ['How do I spell because?', 'spelling-coach', 'spelling-lscwc'],
  ];
  for (const [q, agentId, skillId] of cases) {
    const r = routeQuestion(q);
    assert.equal(r.agent.id, agentId, q);
    if (skillId) assert.equal(r.skill && r.skill.id, skillId, q);
  }
  assert.ok(agentById('maths-tutor'));
  assert.equal(agentById('nope'), null);
});
