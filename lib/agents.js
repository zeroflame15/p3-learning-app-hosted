// Specialist agents — aligned to the myKx video
// "Can an AI tutor fix Singapore's birth rate? I built one for my 3 kids"
// https://www.youtube.com/watch?v=LiW64t2Dxes
// Chapter 2:08 "Inside myKx: 19 agents on Meta Muse" (Bryan asked for
// alignment from 2:15 onwards) and the "A specialist for every feature"
// slide. The 19 names, features and models below are the video's own.
//
//   Kids learn:      Question player -> Kix Tutor (Muse Spark 1.3)
//                    Ask Kix -> Ask Kix (Muse Spark - vision)
//                    Vibe Zone -> Vibe Zone maker (Muse Spark)
//                    Talk to Kix -> Talk to Kix (Muse Voice Transcribe)
//                    Sidekick Studio -> Sidekick Studio (Muse Image + SAM 3.1)
//   Kids play/grow:  Critter Lab -> Critter Keeper (Muse Spark)
//                    Kix's Notebook -> Memory Keeper (Muse Spark)
//                    Breaks and balance -> Screen-time guardian (plain rules)
//   Parents:         Tonight -> Tonight (Muse Spark)
//                    Location -> Guardian Brief (Muse Spark)
//                    Sentry -> Home Reader (Muse Spark - vision)
//                            + Who's who (SAM 3.1)
//                    Do something together -> Outing Scout (Muse Spark - web search)
//                                            + Outing Planner (Muse Spark)
//   The team:        New exam papers -> Past-paper scout (plain rules)
//                                   + Content Curator (Muse Spark - files)
//                    Skill packs -> Skill Editor (Muse Spark)
//                    Feedback loop -> Reviewer (Muse Spark Open, ready)
//                                   + Judge (Muse Spark Open, ready)
//
// 19 specialists, 17 on Meta Muse, 2 plain code (Screen-time guardian,
// Past-paper scout). That count is asserted in tests/agents.test.js.
//
// Status is honest about what runs TODAY in this hosted app:
//   live        — the specialist's job is implemented and callable now
//                 (Muse Spark 1.3 text via MODEL_API_KEY, or plain code).
//   ready       — the video calls it "ready": the code exists (Reviewer
//                 second-model check in lib/feedback.js, Judge verdict
//                 in lib/flags.js) but it runs on Muse Spark Open, for
//                 which no key or live call exists yet.
//   placeholder — the video's model (vision / voice / image / SAM /
//                 web search / files) has no key or live call yet.
//
// DELIBERATELY NOT LIVE, by Bryan's earlier decision: Guardian Brief
// does NOT track a child's location (it briefs from progress data
// only), and Home Reader / Who's who do NOT use a camera or send any
// picture (no doze-off detection, no photo upload). Their agent
// entries exist because the video names them, but they must never
// claim live location/camera tracking.
// A question is routed to ONE specialist, which opens the exact skill
// from lib/skills.js. Models explain; code decides (lib/rules.js).
'use strict';

const { skillForQuestion, skillById } = require('./skills');

function A(id, name, feature, model, modelFamily, status, role, skillIds, keywords, modelNote) {
  return { id, name, feature, model, modelFamily, status, role, skillIds, keywords, modelNote: modelNote || '' };
}

const ALL_TOPIC_SKILLS = [
  'vocab-story', 'tenses', 'story-next', 'punctuation',
  'add-subtract', 'money-change', 'times-tables', 'fractions',
  'life-cycle-frog', 'magnets', 'plants',
  'chinese-listening', 'chinese-family', 'chinese-school',
];

const AGENTS = [
  // --- Kids learn ---
  A('kix-tutor', 'Kix Tutor', 'Question player', 'muse-spark-1.3', 'meta-muse', 'live',
    'The Question player tutor. Opens the exact skill-pack method by id for the child’s level, thinks inside (instructions + lessons learned + guardrails), then code decides marks/mastery/rewards — and gives a hint, not the answer.',
    [...ALL_TOPIC_SKILLS, 'spelling-lscwc', 'check-work'],
    ['math', 'plus', 'minus', 'times', 'fraction', 'money', 'mrt', 'add', 'subtract', 'multiply', 'english', 'tense', 'verb', 'punctuation', 'sentence', 'story', 'word', 'past', 'future', 'went', 'yesterday', 'science', 'frog', 'tadpole', 'magnet', 'plant', 'leaf', 'root', 'seed', 'sky', 'sun', 'moon', 'earth', 'rain', 'water', 'air', 'chinese', '华文', '妈妈', 'mama', 'baba', '听写', '拼音', 'pinyin', '老师', 'spell', 'spelling', 'listen', 'hear', '听']),
  A('ask-kix', 'Ask Kix', 'Ask Kix', 'muse-spark-vision', 'meta-muse', 'live',
    'Open questions in Ask Pip. Answers general questions by opening a skill when one fits. Video model is Muse Spark – vision; vision input is not wired yet, so today it answers by text on Muse Spark 1.3.',
    ALL_TOPIC_SKILLS,
    ['what is', 'what are', 'why is', 'why do', 'how do', 'tell me', 'explain', 'what does', 'who is', 'where is'],
    'Video model: Muse Spark – vision. Vision input not wired yet; text answers run on Muse Spark 1.3.'),
  A('vibe-zone-maker', 'Vibe Zone maker', 'Vibe Zone', 'muse-spark-1.3', 'meta-muse', 'live',
    'Makes the Vibe Zone. Today the calming sounds (Forest Morning) are generated in code; a model-made vibe is not wired yet.',
    [],
    ['vibe', 'music', 'calm', 'relax', 'forest morning', 'rain sound', 'play some music', 'soothing', 'sleepy']),
  A('talk-to-kix', 'Talk to Kix', 'Talk to Kix', 'muse-voice-transcribe', 'meta-muse', 'placeholder',
    'Voice chat with Pip. PLACEHOLDER — Muse Voice Transcribe has no key or live call yet; read-aloud today is the device’s own text-to-speech voice picker.',
    ['chinese-listening'],
    ['voice', 'speak', 'talk to', 'read aloud', 'transcribe', 'hear me', 'say it', 'voice chat']),
  A('sidekick-studio', 'Sidekick Studio', 'Sidekick Studio', 'muse-image-sam-3.1', 'meta-muse', 'placeholder',
    'Changes Pip’s look and draws pictures to explain ideas. PLACEHOLDER — Muse Image + SAM 3.1 have no key or live call yet; Pip’s look today is the built-in 3D otter.',
    [],
    ['sidekick', 'change my look', 'change pip', 'draw', 'picture', 'image', 'show me a picture', 'avatar', 'make a picture']),
  // --- Kids play and grow ---
  A('critter-keeper', 'Critter Keeper', 'Critter Lab', 'muse-spark-1.3', 'meta-muse', 'live',
    'Looks after the critter in Critter Lab — feeding, care, and life-cycle stages.',
    ['life-cycle-frog', 'plants'],
    ['critter lab', 'feed my tadpole', 'feed my frog', 'my critter', 'raise a frog', 'my tadpole', 'critter care', 'pet']),
  A('memory-keeper', 'Memory Keeper', 'Kix’s Notebook', 'muse-spark-1.3', 'meta-muse', 'live',
    'Keeps the child’s notebook: flashcards and things worth remembering.',
    ['chinese-family', 'chinese-school', 'spelling-lscwc'],
    ['notebook', 'flashcard', 'remember this', 'my notes', 'memory', 'revise my words']),
  A('screen-time-guardian', 'Screen-time guardian', 'Breaks and balance', 'code-rules', 'local-code', 'live',
    'Plain rules, no model: watches screen time against the parent-set daily limit and calls for breaks. Code decides; no model ever decides a limit.',
    [],
    ['screen time', 'too much screen', 'take a break', 'break time', 'time limit', 'screen-time']),
  // --- Parents ---
  A('tonight', 'Tonight', 'Tonight', 'muse-spark-1.3', 'meta-muse', 'live',
    'The evening summary for grown-ups: what the child learned, where she got stuck, and how she may be feeling — for the PIN parent page.',
    [],
    ['tonight', 'evening summary', 'what did i learn today', 'what did she learn', 'parent summary', 'progress report', 'how is she doing']),
  A('guardian-brief', 'Guardian Brief', 'Location', 'muse-spark-1.3', 'meta-muse', 'live',
    'Briefs a grown-up from the child’s progress data only. NO live location tracking — this app never tracks where a child is, and this agent must never claim to.',
    [],
    ['guardian brief', 'where is my child', 'where am i', 'location', 'is she home', 'pick up']),
  A('home-reader', 'Home Reader', 'Sentry', 'muse-spark-vision', 'meta-muse', 'placeholder',
    'Reads the home scene for Sentry. PLACEHOLDER — Muse Spark – vision has no key or live call yet, and NO camera or picture is ever sent: no doze-off detection, no photo upload.',
    [],
    ['home reader', 'sentry', 'look at my work', 'check my homework', 'photo of my work', 'my drawing'],
    'Video model: Muse Spark – vision. No camera, no picture sent.'),
  A('whos-who', 'Who’s who', 'Sentry', 'sam-3.1', 'meta-muse', 'placeholder',
    'Tells who is who in a scene for Sentry. PLACEHOLDER — SAM 3.1 has no key or live call yet, and no picture is ever sent.',
    [],
    ['who is in the photo', 'who’s who', 'whos who', 'who is that', 'who is in this picture']),
  A('outing-scout', 'Outing Scout', 'Do something together', 'muse-spark-web-search', 'meta-muse', 'placeholder',
    'Finds places to go together. PLACEHOLDER — Muse Spark web search has no key or live call yet.',
    [],
    ['outing', 'do something together', 'where should we go', 'find a place', 'places to go', 'weekend outing', 'find somewhere']),
  A('outing-planner', 'Outing Planner', 'Do something together', 'muse-spark-1.3', 'meta-muse', 'live',
    'Plans the outing / tomorrow from the study timetable and school calendar.',
    ['check-work'],
    ['plan our outing', 'plan tomorrow', 'plan the weekend', 'timetable', 'schedule', 'homework plan', 'plan a trip']),
  // --- The team ---
  A('past-paper-scout', 'Past-paper scout', 'New exam papers', 'code-rules', 'local-code', 'live',
    'Plain rules, no model: finds new exam papers and checks them against the skill pack by id.',
    [],
    ['past paper', 'exam paper', 'new exam', 'practice paper', 'test paper']),
  A('content-curator', 'Content Curator', 'New exam papers', 'muse-spark-files', 'meta-muse', 'placeholder',
    'Curates new questions from exam-paper files. PLACEHOLDER — Muse Spark files has no key or live call yet.',
    [],
    ['curate', 'new questions', 'content curator', 'make new questions', 'from the exam paper']),
  A('skill-editor', 'Skill Editor', 'Skill packs', 'muse-spark-1.3', 'meta-muse', 'live',
    'Edits the versioned skill pack: one exact method per topic, by id. The pack itself is code (lib/skills.js, skills-v1); the editor opens and cites the method, never invents one.',
    [...ALL_TOPIC_SKILLS, 'spelling-lscwc', 'check-work'],
    ['skill pack', 'skill editor', 'the method', 'which method', 'skill for']),
  A('reviewer', 'Reviewer', 'Feedback loop', 'muse-spark-open', 'meta-muse', 'ready',
    'Second model in the feedback loop: reads a flagged case and checks it. READY per the video — the check code exists (lib/feedback.js) and runs a second model pass when a model key is configured; Muse Spark Open itself has no key or live call yet.',
    [],
    ['wrong', 'mistake', 'flag', 'incorrect', 'that answer is wrong', 'you are wrong', 'review this']),
  A('judge', 'Judge', 'Feedback loop', 'muse-spark-open', 'meta-muse', 'ready',
    'Judges whether a fix ships: only when code proves it (reproduced, re-tested, no regressions). READY per the video — the verdict code exists (lib/feedback.js); Muse Spark Open itself has no key or live call yet.',
    [],
    ['judge', 'should this ship', 'is the fix good', 'judge this fix']),
];

function agentById(id) { return AGENTS.find((a) => a.id === id) || null; }
function liveAgents() { return AGENTS.filter((a) => a.status === 'live'); }
function readyAgents() { return AGENTS.filter((a) => a.status === 'ready'); }
function placeholderAgents() { return AGENTS.filter((a) => a.status === 'placeholder'); }

// Route a question to the ONE specialist from the video map.
// Feature keywords win over subject keywords, so a critter-care
// question goes to Critter Keeper, not to Kix Tutor, and a flagged
// answer goes to Reviewer, the second model. A learning question
// with an exact skill goes to Kix Tutor; an open question with no
// skill goes to Ask Kix. Returns { agent, skill }.
function routeQuestion(text) {
  const s = String(text || '').toLowerCase();
  const has = (...kws) => kws.some((k) => s.includes(k));
  // A bare number sum is a Kix Tutor question even with no keyword.
  if (/\d\s*[x\u00d7*\u00f7+\-]\s*\d/.test(s)) {
    return { agent: agentById('kix-tutor'), skill: skillForQuestion(text) };
  }
  if (has('judge')) return { agent: agentById('judge'), skill: skillForQuestion(text) };
  if (has('wrong', 'mistake', 'incorrect', 'that answer is wrong', 'you are wrong', 'review this', 'flag')) {
    return { agent: agentById('reviewer'), skill: skillForQuestion(text) };
  }
  if (has('skill pack', 'skill editor')) return { agent: agentById('skill-editor'), skill: skillForQuestion(text) };
  if (has('who is in the photo', 'who’s who', 'whos who', 'who is that', 'who is in this picture')) {
    return { agent: agentById('whos-who'), skill: null };
  }
  if (has('look at my work', 'check my homework', 'photo of my work', 'home reader', 'sentry')) {
    return { agent: agentById('home-reader'), skill: null };
  }
  if (has('sidekick', 'change my look', 'change pip', 'make a picture', 'show me a picture', 'avatar')) {
    return { agent: agentById('sidekick-studio'), skill: null };
  }
  if (has('draw', 'picture', 'image') && !has('photo')) {
    return { agent: agentById('sidekick-studio'), skill: null };
  }
  if (has('voice', 'speak', 'talk to', 'read aloud', 'transcribe', 'voice chat', 'hear me')) {
    return { agent: agentById('talk-to-kix'), skill: skillForQuestion(text) || skillById('chinese-listening') };
  }
  if (has('vibe', 'forest morning', 'rain sound', 'play some music', 'soothing', 'sleepy', 'calm')) {
    return { agent: agentById('vibe-zone-maker'), skill: null };
  }
  if (has('notebook', 'flashcard', 'remember this', 'my notes', 'revise my words')) {
    return { agent: agentById('memory-keeper'), skill: skillForQuestion(text) };
  }
  if (has('screen time', 'too much screen', 'take a break', 'screen-time', 'time limit')) {
    return { agent: agentById('screen-time-guardian'), skill: null };
  }
  if (has('tonight', 'evening summary', 'what did i learn today', 'what did she learn', 'parent summary', 'progress report', 'how is she doing')) {
    return { agent: agentById('tonight'), skill: null };
  }
  if (has('guardian brief', 'where is my child', 'where am i', 'is she home', 'pick up')) {
    return { agent: agentById('guardian-brief'), skill: null };
  }
  if (has('plan our outing', 'plan tomorrow', 'plan the weekend', 'plan a trip', 'homework plan')) {
    return { agent: agentById('outing-planner'), skill: skillForQuestion(text) };
  }
  if (has('outing', 'do something together', 'where should we go', 'find a place', 'places to go', 'weekend outing', 'find somewhere')) {
    return { agent: agentById('outing-scout'), skill: null };
  }
  if (has('curate', 'new questions', 'content curator', 'make new questions')) {
    return { agent: agentById('content-curator'), skill: null };
  }
  if (has('past paper', 'exam paper', 'new exam', 'practice paper', 'test paper')) {
    return { agent: agentById('past-paper-scout'), skill: null };
  }
  if (has('critter lab', 'feed my tadpole', 'feed my frog', 'my critter', 'raise a frog', 'my tadpole', 'critter care', 'pet')) {
    return { agent: agentById('critter-keeper'), skill: skillForQuestion(text) };
  }
  if (has('timetable', 'schedule')) return { agent: agentById('outing-planner'), skill: null };
  // Definitional open question ("What is a verb?") -> Ask Kix, even
  // when a skill keyword matches: it is a question to explain, not a
  // problem to work through. (Bare sums were handled above.)
  if (/^what (is|are|does|do)\b/.test(s)) return { agent: agentById('ask-kix'), skill: null };
  // Learning question with an exact skill -> Kix Tutor (Question player).
  const skill = skillForQuestion(text);
  if (skill) return { agent: agentById('kix-tutor'), skill };
  // Open question, no skill -> Ask Kix.
  if (has('?', 'what', 'why', 'how', 'tell me', 'explain', 'who', 'where')) {
    return { agent: agentById('ask-kix'), skill: null };
  }
  return { agent: agentById('kix-tutor'), skill: null };
}

module.exports = { AGENTS, agentById, liveAgents, readyAgents, placeholderAgents, routeQuestion };
