// Agent registry tests — the video's 19 specialists, by name.
// Source: myKx video https://www.youtube.com/watch?v=LiW64t2Dxes,
// chapter 2:08 "Inside myKx: 19 agents on Meta Muse" and the
// "A specialist for every feature" slide (from 2:15 onwards).
// 19 specialists, 17 on Meta Muse, 2 plain code. Statuses are honest:
// live = callable today, ready = video's "ready" (code exists, model
// not wired), placeholder = video's model not wired yet.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AGENTS, agentById, liveAgents, readyAgents, placeholderAgents, routeQuestion } = require('../lib/agents');
const { SKILLS } = require('../lib/skills');

const VIDEO_19 = [
  ['kix-tutor', 'Kix Tutor', 'Question player', 'muse-spark-1.3', 'live'],
  ['ask-kix', 'Ask Kix', 'Ask Kix', 'muse-spark-vision', 'live'],
  ['vibe-zone-maker', 'Vibe Zone maker', 'Vibe Zone', 'muse-spark-1.3', 'live'],
  ['talk-to-kix', 'Talk to Kix', 'Talk to Kix', 'muse-voice-transcribe', 'placeholder'],
  ['sidekick-studio', 'Sidekick Studio', 'Sidekick Studio', 'muse-image-sam-3.1', 'placeholder'],
  ['critter-keeper', 'Critter Keeper', 'Critter Lab', 'muse-spark-1.3', 'live'],
  ['memory-keeper', 'Memory Keeper', 'Kix’s Notebook', 'muse-spark-1.3', 'live'],
  ['screen-time-guardian', 'Screen-time guardian', 'Breaks and balance', 'code-rules', 'live'],
  ['tonight', 'Tonight', 'Tonight', 'muse-spark-1.3', 'live'],
  ['guardian-brief', 'Guardian Brief', 'Location', 'muse-spark-1.3', 'live'],
  ['home-reader', 'Home Reader', 'Sentry', 'muse-spark-vision', 'placeholder'],
  ['whos-who', 'Who’s who', 'Sentry', 'sam-3.1', 'placeholder'],
  ['outing-scout', 'Outing Scout', 'Do something together', 'muse-spark-web-search', 'placeholder'],
  ['outing-planner', 'Outing Planner', 'Do something together', 'muse-spark-1.3', 'live'],
  ['past-paper-scout', 'Past-paper scout', 'New exam papers', 'code-rules', 'live'],
  ['content-curator', 'Content Curator', 'New exam papers', 'muse-spark-files', 'placeholder'],
  ['skill-editor', 'Skill Editor', 'Skill packs', 'muse-spark-1.3', 'live'],
  ['reviewer', 'Reviewer', 'Feedback loop', 'muse-spark-open', 'ready'],
  ['judge', 'Judge', 'Feedback loop', 'muse-spark-open', 'ready'],
];

test('19 specialists, exactly the video list, 17 on Meta Muse, 2 plain code', () => {
  assert.equal(AGENTS.length, 19);
  assert.equal(AGENTS.filter((a) => a.modelFamily === 'meta-muse').length, 17);
  assert.equal(AGENTS.filter((a) => a.modelFamily === 'local-code').length, 2);
  assert.equal(new Set(AGENTS.map((a) => a.id)).size, 19);
  for (const [id, name, feature, model, status] of VIDEO_19) {
    const a = agentById(id);
    assert.ok(a, id + ' missing from registry');
    assert.equal(a.name, name, id);
    assert.equal(a.feature, feature, id);
    assert.equal(a.model, model, id);
    assert.equal(a.status, status, id);
    assert.ok(a.role && a.role.length > 10, id);
  }
  // No old subject-tutor ids survive the alignment.
  for (const old of ['maths-tutor', 'english-tutor', 'science-tutor', 'chinese-tutor', 'spelling-coach', 'flag-checker', 'open-model']) {
    assert.equal(agentById(old), null, old + ' should be gone');
  }
});

test('status counts: 11 live, 2 ready, 6 placeholder', () => {
  assert.equal(liveAgents().length, 11);
  assert.equal(readyAgents().length, 2);
  assert.deepEqual(readyAgents().map((a) => a.id).sort(), ['judge', 'reviewer']);
  assert.equal(placeholderAgents().length, 6);
  assert.deepEqual(placeholderAgents().map((a) => a.id).sort(),
    ['content-curator', 'home-reader', 'outing-scout', 'sidekick-studio', 'talk-to-kix', 'whos-who']);
  for (const a of placeholderAgents()) assert.match(a.role, /PLACEHOLDER/);
  for (const a of readyAgents()) assert.match(a.role, /READY/);
});

test('no location tracking, no camera — Guardian Brief / Home Reader / Who’s who say so', () => {
  assert.match(agentById('guardian-brief').role, /NO live location tracking/);
  assert.match(agentById('home-reader').role, /NO camera/);
  assert.match(agentById('whos-who').role, /no picture is ever sent/);
});

test('every agent skill id exists in the skill pack', () => {
  const ids = new Set(SKILLS.map((s) => s.id));
  for (const a of AGENTS) for (const sid of a.skillIds) assert.ok(ids.has(sid), a.id + ' -> ' + sid);
});

test('routing: video example + real questions go to the right specialist + skill', () => {
  const cases = [
    // Video example: "Why can't Pip hop yet?" -> Kix Tutor, P3 Science skill.
    ["Why can't Pip hop yet?", 'kix-tutor', 'life-cycle-frog'],
    ['7 x 8 = ?', 'kix-tutor', 'times-tables'],
    ['14 + 9 stations?', 'kix-tutor', 'add-subtract'],
    ['Will a magnet attract steel?', 'kix-tutor', 'magnets'],
    ['mama means?', 'kix-tutor', 'chinese-listening'],
    ['Yesterday we went — why went?', 'kix-tutor', 'tenses'],
    ['How do I spell because?', 'kix-tutor', 'spelling-lscwc'],
    ['Why is the sky blue?', 'ask-kix', null],
    ['What is a verb?', 'ask-kix', null],
    ['Feed my tadpole, please', 'critter-keeper', 'life-cycle-frog'],
    ['Make a flashcard for the parts of a cell', 'memory-keeper', null],
    ['I need a break, too much screen time', 'screen-time-guardian', null],
    ['What did she learn tonight?', 'tonight', null],
    ['Where is my child?', 'guardian-brief', null],
    ['Look at my work, is this right?', 'home-reader', null],
    ['Who is in this picture?', 'whos-who', null],
    ['Find somewhere fun to go together', 'outing-scout', null],
    ['Plan tomorrow for us', 'outing-planner', null],
    ['Any past papers for P3?', 'past-paper-scout', null],
    ['Curate new questions from the exam paper', 'content-curator', null],
    ['Which skill pack method is this?', 'skill-editor', null],
    ['That answer is wrong', 'reviewer', null],
    ['Judge this fix', 'judge', null],
    ['Change Pip’s look', 'sidekick-studio', null],
    ['Talk to me, read this aloud', 'talk-to-kix', 'chinese-listening'],
    ['Play some calming music', 'vibe-zone-maker', null],
  ];
  for (const [q, agentId, skillId] of cases) {
    const r = routeQuestion(q);
    assert.equal(r.agent.id, agentId, q);
    if (skillId) assert.equal(r.skill && r.skill.id, skillId, q);
  }
  assert.ok(agentById('kix-tutor'));
  assert.equal(agentById('nope'), null);
});
