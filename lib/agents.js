// Specialist agents — a lightweight registry, not 19 live models.
// 19 named specialist roles; 17 run on Meta Muse models, 2 are plain
// code (they decide, they never call a model). Only Muse Spark 1.3 is
// actually live today (via MODEL_API_KEY in /api/ask-pip). Muse Image,
// SAM 3.1, Muse Voice Transcribe and Muse Spark Open are wired in as
// PLACEHOLDERS: their entries exist, their prompts exist, but no key,
// account or live call exists for them — do not claim they are live.
// A question is routed to ONE specialist, which picks the exact skill
// from lib/skills.js. Models explain; code decides (lib/rules.js).
'use strict';

const { skillForQuestion } = require('./skills');

const AGENTS = [
  { id: 'maths-tutor', name: 'Maths Tutor', role: 'Explains P3 maths with the exact skill method, step by step.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['add-subtract', 'money-change', 'times-tables', 'fractions'], keywords: ['math', 'plus', 'minus', 'times', 'fraction', 'money', 'mrt', 'add', 'subtract', 'multiply'] },
  { id: 'english-tutor', name: 'English Tutor', role: 'Explains P3 English — tenses, punctuation and story words.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['vocab-story', 'tenses', 'story-next', 'punctuation'], keywords: ['english', 'tense', 'verb', 'punctuation', 'sentence', 'story', 'word', 'past', 'future', 'went', 'yesterday'] },
  { id: 'science-tutor', name: 'Science Tutor', role: 'Explains P3 science — frogs, magnets, plants — with real examples.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['life-cycle-frog', 'magnets', 'plants'], keywords: ['science', 'frog', 'tadpole', 'magnet', 'plant', 'leaf', 'root', 'seed', 'sky', 'sun', 'moon', 'earth', 'rain', 'water', 'air'] },
  { id: 'chinese-tutor', name: 'Chinese Tutor', role: 'Explains P3 Chinese words in Chinese, with pinyin help.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['chinese-listening', 'chinese-family', 'chinese-school'], keywords: ['chinese', '华文', '妈妈', 'mama', 'baba', '听写', '拼音', 'pinyin', '老师'] },
  { id: 'spelling-coach', name: 'Spelling Coach', role: 'Teaches spelling with Look–Say–Cover–Write–Check.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['spelling-lscwc', 'chinese-school'], keywords: ['spell', 'spelling', '听写', 'write'] },
  { id: 'listening-coach', name: 'Listening Coach', role: 'Coaches listening: hear it, say it, then pick.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['chinese-listening'], keywords: ['listen', 'hear', '听', 'sound'] },
  { id: 'storyteller', name: 'Storyteller', role: 'Tells short stories and helps finish them.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['story-next', 'vocab-story'], keywords: ['tell me a story', 'story', 'tale', 'once upon'] },
  { id: 'critter-guide', name: 'Critter Guide', role: 'Answers critter and life-cycle questions.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['life-cycle-frog', 'plants'], keywords: ['critter', 'animal', 'frog', 'butterfly', 'bird', 'bee'] },
  { id: 'treasure-guide', name: 'Treasure Guide', role: 'Explains what each treasure does. Decides unlocks by code rule only — never by a model.', model: 'code-rules', modelFamily: 'local-code', status: 'live', skillIds: [], keywords: ['treasure', 'unlock', 'star', 'reward'] },
  { id: 'encourager', name: 'Encourager', role: 'Cheers a stuck child on and picks the smallest next step.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: ['check-work'], keywords: ['tired', 'sad', 'hard', 'stuck', 'give up', 'help'] },
  { id: 'flag-checker', name: 'Flag Checker', role: 'Re-checks a flagged Pip answer carefully and admits mistakes warmly.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: [], keywords: ['wrong', 'mistake', 'flag', 'incorrect'] },
  { id: 'warmup-coach', name: 'Warm-up Coach', role: 'Picks fresh warm-up questions that never repeat quest questions.', model: 'code-rules', modelFamily: 'local-code', status: 'live', skillIds: [], keywords: ['warm', 'warm-up', 'warmup', 'practice', 'practise'] },
  { id: 'game-coach', name: 'Game Coach', role: 'Explains Play games and picks a 3-minute revision game for a stuck topic.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: [], keywords: ['game', 'play', 'arcade'] },
  { id: 'planner', name: 'Planner', role: 'Turns the study timetable and school calendar into tomorrow’s plan.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: [], keywords: ['tomorrow', 'plan', 'timetable', 'schedule', 'homework'] },
  { id: 'parent-summariser', name: 'Parent Summariser', role: 'Summarises what a child learned, where she got stuck, and how she may be feeling — for the PIN parent page.', model: 'muse-spark-1.3', modelFamily: 'meta-muse', status: 'live', skillIds: [], keywords: ['summary', 'parent', 'progress', 'report'] },
  { id: 'voice-coach', name: 'Voice Coach', role: 'Picks the warmest read-aloud voice on the device. PLACEHOLDER — cloud voice transcription has no key or call yet.', model: 'muse-voice-transcribe', modelFamily: 'meta-muse', status: 'placeholder', skillIds: ['chinese-listening'], keywords: ['voice', 'listen', 'speak', 'read aloud', 'transcribe'] },
  { id: 'image-guide', name: 'Image Guide', role: 'Would draw a picture to explain an idea. PLACEHOLDER — no Muse Image key or call exists yet.', model: 'muse-image', modelFamily: 'meta-muse', status: 'placeholder', skillIds: [], keywords: ['picture', 'draw', 'image', 'show me'] },
  { id: 'vision-guide', name: 'Vision Guide', role: 'Would look at a photo of a child’s work and point at the tricky part. PLACEHOLDER — no SAM 3.1 key or call exists yet.', model: 'sam-3.1', modelFamily: 'meta-muse', status: 'placeholder', skillIds: [], keywords: ['photo', 'picture of', 'look at', 'my work'] },
  { id: 'open-model', name: 'Open Model', role: 'Fallback tutor on Meta’s open-weight Muse Spark Open, if the main model is unavailable. PLACEHOLDER — no key or call exists yet.', model: 'muse-spark-open', modelFamily: 'meta-muse', status: 'placeholder', skillIds: [], keywords: [] },
];

function agentById(id) { return AGENTS.find((a) => a.id === id) || null; }
function liveAgents() { return AGENTS.filter((a) => a.status === 'live'); }
function placeholderAgents() { return AGENTS.filter((a) => a.status === 'placeholder'); }

// Route a question to the best specialist + the exact skill.
// Returns { agent, skill } — skill may be null for non-topic questions.
function routeQuestion(text) {
  const s = String(text || '').toLowerCase();
  // A bare number sum (7 x 8, 14 + 9, 30 ÷ 6) is maths even with no keyword.
  if (/\d\s*[x\u00d7*\u00f7+\-]\s*\d/.test(s)) {
    return { agent: agentById('maths-tutor'), skill: skillForQuestion(text) };
  }
  let best = null, bestScore = 0;
  for (const agent of AGENTS) {
    let score = 0;
    for (const kw of agent.keywords) if (kw && s.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
    if (score > bestScore) { bestScore = score; best = agent; }
  }
  const agent = best || agentById('encourager');
  return { agent, skill: skillForQuestion(text) };
}

module.exports = { AGENTS, agentById, liveAgents, placeholderAgents, routeQuestion };
