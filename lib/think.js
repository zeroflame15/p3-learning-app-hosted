// How one agent thinks — the video's "How one agent thinks" slide.
// Jordan asks "Why can't Pip hop yet?"
//   -> Kix Tutor (Muse Spark 1.3)
//   -> Opens his skill pack (P3 Science), reads the exact method, by id
//   -> Thinks inside: My instructions | Lessons the loop learned |
//      Guardrails it can't break
//   -> Then Code decides marks · mastery · rewards
//   -> A hint, not the answer.
//
// This module is the "thinks inside" step, in code. It never calls a
// model: it assembles what the model is told, and what it must not do.
// The model call itself lives in api/ask-pip.js, which uses think()
// to build its system prompt. Marks/mastery/rewards are decided only
// by lib/rules.js — never by the model, and never here.
'use strict';

const { agentById, routeQuestion } = require('./agents');
const { skillById } = require('./skills');

const SKILL_PACK_VERSION = 'skills-v1';

// Guardrails it can't break — the video's third "thinks inside" box.
const GUARDRAILS = [
  { id: 'hint-not-answer', rule: 'Give a hint first, not the full answer. Ask one guiding question. Only give the full answer if the child says they tried, or asks for it outright.' },
  { id: 'p3-level', rule: 'Singapore Primary 3 level only (age 8-9), simple words, short sentences.' },
  { id: 'under-90-words', rule: 'Keep every reply under 90 words.' },
  { id: 'no-personal-data', rule: 'Never ask for or repeat a PIN, family sync code, address, or any personal detail.' },
  { id: 'no-location-no-camera', rule: 'Never claim to know where a child is, and never ask for a photo. No location tracking, no camera — ever.' },
  { id: 'code-decides', rule: 'Never mark, score, or award stars or badges. Marks, mastery and rewards are decided by plain code rules (lib/rules.js), not by the model.' },
  { id: 'skill-must-match', rule: 'If the skill is about a specific animal or thing (for example a frog) and the question is about a different one (for example a butterfly), do NOT use that skill\u2019s facts — answer from the question\u2019s own topic at P3 level instead, and never pretend the wrong animal\u2019s life cycle is the answer.' },
];

function guardrailIds() { return GUARDRAILS.map((g) => g.id); }

// Lessons the loop learned — built from flagged answers (DB.flags /
// flag_log). Each lesson is one flagged mistake, in the skill's words:
// "for this skill, do not say X; use the method / correction instead".
// Pure function, so tests can prove it.
function lessonsFromFlags(flags) {
  const lessons = [];
  for (const f of flags || []) {
    if (!f || !f.question) continue;
    lessons.push({
      skillId: f.skillId || null,
      question: String(f.question).slice(0, 120),
      avoid: String(f.pipAnswer || f.answer || '').slice(0, 120),
      use: String(f.correction || '').slice(0, 120) || 'the exact skill method for this question',
      status: f.status || 'open',
    });
  }
  return lessons;
}

// Assemble one agent's thinking for a question.
// Returns { agent, skill, skillId, instructions, lessons, guardrails,
// hintFirst, signatureBase } — everything api/ask-pip needs, plus the
// traceable signature base (see signReply).
// hintFirst is true for a learning question with an exact skill: the
// child is working on a problem, so Pip hints first. It is false for
// an open question with no skill (Ask Kix), where there is no problem
// to hint at — Pip explains simply instead.
function think(question, opts) {
  const options = opts || {};
  const routed = routeQuestion(question);
  const agent = routed.agent;
  const skill = (options.skillId && skillById(options.skillId)) || routed.skill || null;
  const lessons = lessonsFromFlags(options.flags || []);
  const skillLessons = lessons.filter((l) => skill && l.skillId === skill.id);
  const instructions = [
    `You are Pip, the ${agent.name} specialist (${agent.id}), a friendly otter tutor for a Singapore Primary 3 student (age 8-9).`,
    skill
      ? `Open the skill pack ${SKILL_PACK_VERSION} and read the exact method by id: ${skill.id} — ${skill.name}. Method: ${skill.method} Steps: ${skill.steps.join(' ')} Example: ${skill.example} Watch out: ${skill.watchOut}`
      : 'No exact skill matches this question — answer simply at P3 level and say which topic it is, so a skill can be added for it.',
    skillLessons.length
      ? `Lessons the loop learned for this skill: ${skillLessons.map((l) => `do not say "${l.avoid}"; use "${l.use}"`).join(' | ')}`
      : 'No lessons learned from flags for this skill yet.',
  ];
  return {
    agent,
    skill,
    skillId: skill ? skill.id : null,
    skillName: skill ? skill.name : null,
    instructions,
    lessons,
    lessonsApplied: skillLessons.length,
    guardrails: GUARDRAILS,
    hintFirst: Boolean(skill),
    signatureBase: `pip:${agent.id}:${skill ? skill.id : 'no-skill'}:${SKILL_PACK_VERSION}`,
  };
}

// Every reply is signed and traceable (video: "every reply signed,
// traceable"). The signature names the agent, the skill and the pack
// version, plus a short trace id unique to this reply.
function signReply(thought, traceId) {
  const trace = traceId || ('t' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  return {
    traceId: trace,
    signature: `${thought.signatureBase}:${trace}`,
    agentId: thought.agent.id,
    agentName: thought.agent.name,
    skillId: thought.skillId,
    skillVersion: SKILL_PACK_VERSION,
    hintFirst: thought.hintFirst,
    lessonsApplied: thought.lessonsApplied,
  };
}

module.exports = { GUARDRAILS, guardrailIds, lessonsFromFlags, think, signReply, SKILL_PACK_VERSION };
