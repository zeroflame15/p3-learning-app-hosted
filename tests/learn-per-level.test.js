// Learn rebuild — MOE per-level topics (2026-11-09).
// The Learn page must show the explorer's CURRENT level's MOE topics:
// a P5 explorer sees P5 Science, never the P3 list; Science is not
// taught in P1/P2; English moves by band and Chinese by phase (no
// invented per-year lists); a topic with no questions shows
// "0 questions ready" instead of a P3 substitute; the daily session
// suggestion is level-aware; P3 Magnets (last in the year) is never
// suggested before July.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, 'function ' + name + ' found in index.html');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
function grabLiteral(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' found in index.html');
  let i = start + marker.length;
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '[' || html[i] === '{') depth++;
    else if (html[i] === ']' || html[i] === '}') { depth--; if (depth === 0) return html.slice(start + marker.length, i + 1); }
  }
  assert.fail(marker + ' literal never balanced');
}

// --- MOE data + helpers, straight from the page ---------------------------
const MOE_SUBJECTS_BY_LEVEL = eval('(' + grabLiteral('var MOE_SUBJECTS_BY_LEVEL=') + ')');
const TOPICS_SRC = grabLiteral('var TOPICS=');
const REAL_IDS = [...TOPICS_SRC.matchAll(/id:'([a-z0-9-]+)'/g)].map((m) => m[1]);

function mkQ(prefix, i) {
  return { q: prefix + ' question ' + i + '?', o: ['A' + i, 'B' + i, 'C' + i, 'D' + i], a: 0, c: 'Clue ' + i, j: 'Joke ' + i };
}
var TOPICS = REAL_IDS.map((id) => {
  const t = {
    id, sub: id.startsWith('eng') ? 'eng' : id.startsWith('math') ? 'math' : id.startsWith('sci') ? 'sci' : 'chi',
    subName: 'Subject', icon: '📖', img: 'icons/topic-' + id + '.webp', name: 'Quest ' + id, blurb: 'Blurb ' + id,
    quest: [0, 1, 2, 3, 4].map((i) => mkQ('quest', i)),
    fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('fresh', i)),
    warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('warm', i)),
    retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('retry', i)),
    p4quest: [0, 1, 2, 3, 4].map((i) => mkQ('p4quest', i)),
    p4fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('p4fresh', i)),
    p4warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('p4warm', i)),
    p4retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('p4retry', i)),
  };
  return t;
});
const moeQuestTopic = eval('(' + grabFn('moeQuestTopic(') + ')');
const topicById = eval('(' + grabFn('topicById(') + ')');
function levelNum(e) { const n = parseInt((e && e.level || '').replace('P', ''), 10); return (n >= 1 && n <= 6) ? n : 3; }
function bankFor(t, kind, level) {
  if (!t) return [];
  if (level >= 4) { const p4 = t['p4' + kind]; if (p4 && p4.length) return p4; }
  return t[kind] || [];
}
function poolQuestions(t, level) { return bankFor(t, 'quest', level).concat(bankFor(t, 'fresh', level)); }
let TODAY = '2026-11-07';
function todayKey() { return TODAY; }
function esc(s) { return String(s == null ? '' : s); }
function ic(src, emo, cls) { return src ? '<img class="' + (cls || 'ic-sm') + '" src="' + src + '">' : emo; }
function pipSVG() { return '<svg>Pip</svg>'; }
function pageHero(art, emo, title, sub, stat) { return '<section class="pagehero">' + title + '|' + sub + '|' + (stat || '') + '</section>'; }
function learnPlanBannerHTML() { return '<!--PLAN-BANNER-->'; }
function spellTestsEntryHTML() { return '<!--SPELL-TESTS-->'; }
function learnBoardHTML() { return '<!--QUEST-BOARD-->'; }
function studyPlanFor() { return { subs: [] }; }
function fmtPlaySecs(s) { return s + 's'; }
const LIVE_GEN_TOPIC = 'math-ntuc';
const LIVE_GEN_COUNT = 5;
let learnView = { subject: null, openTopic: null };
let EX = null;
function ex() { return EX; }

const questState = eval('(' + grabFn('questState(') + ')');
const moeSubjects = eval('(' + grabFn('moeSubjects(') + ')');
const moeSubject = eval('(' + grabFn('moeSubject(') + ')');
const moeTopic = eval('(' + grabFn('moeTopic(') + ')');
const moeTopicPool = eval('(' + grabFn('moeTopicPool(') + ')');
const moeTopicStarted = eval('(' + grabFn('moeTopicStarted(') + ')');
const moeSubNote = eval('(' + grabFn('moeSubNote(') + ')');
const moeSubjectCounts = eval('(' + grabFn('moeSubjectCounts(') + ')');
const moeSessionFirst = eval('(' + grabFn('moeSessionFirst(') + ')');
const moeUncoveredTopics = eval('(' + grabFn('moeUncoveredTopics(') + ')');
const schoolTermOf = eval('(' + grabFn('schoolTermOf(') + ')');
const moeInSeason = eval('(' + grabFn('moeInSeason(') + ')');
const moeOutOfSeasonTopics = eval('(' + grabFn('moeOutOfSeasonTopics(') + ')');
const learnHTML = eval('(' + grabFn('learnHTML(') + ')');
const questListFor = eval('(' + grabFn('questListFor(') + ')');
const optsShuffled = eval('(' + grabFn('optsShuffled(') + ')');

function explorer(over) {
  return Object.assign({
    id: 'e1', name: 'Test', stars: 7, glow: '#ffb020', level: 'P3',
    completed: {}, completedDay: {}, progress: {}, learnBest: {},
    boost: {}, stuck: [],
  }, over || {});
}
function renderLanding(e) { EX = e; learnView = { subject: null, openTopic: null }; return learnHTML(); }
function renderSubject(e, subj, openTopic) {
  EX = e; learnView = { subject: subj, openTopic: openTopic || null }; return learnHTML();
}
function sciTopics(lv) { return moeSubject('sci', lv).topics.map((t) => t.name); }
function subjTopicIds(lv, subj) { return moeSubject(subj, lv).topics.map((t) => t.id); }

/* --- data shape ----------------------------------------------------------- */
test('MOE data: 4 subjects per level in order, 154 topic-levels', () => {
  for (let lv = 1; lv <= 6; lv++) {
    assert.deepEqual(moeSubjects(lv).map((s) => s.id), ['eng', 'math', 'sci', 'chi'], 'P' + lv + ' subject order');
    assert.deepEqual(moeSubjects(lv).map((s) => s.name), ['English', 'Maths', 'Science', 'Chinese']);
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((lv) => moeSubjects(lv).map((s) => s.topics.length)),
    [[6, 8, 0, 5], [6, 11, 0, 5], [6, 12, 4, 6], [6, 15, 5, 6], [6, 12, 5, 6], [6, 8, 4, 6]],
    'topic counts per level per subject');
  const total = [1, 2, 3, 4, 5, 6].reduce((a, lv) => a + moeSubjects(lv).reduce((b, s) => b + s.topics.length, 0), 0);
  assert.equal(total, 154, '154 MOE topic-levels');
  // Every topic is well-formed: id, name, at least one sub-topic, one quest (itself).
  for (let lv = 1; lv <= 6; lv++) {
    for (const s of moeSubjects(lv)) {
      for (const t of s.topics) {
        assert.ok(t.id && t.name, 'P' + lv + ' topic has id + name');
        assert.ok(t.subs.length >= 1, t.id + ' has sub-topics');
        // A topic's first quest is itself (its server-bank topic); a
        // topic may list extra Practise quests. The one exception:
        // chi-reading also lists chi-picword (看图选词), which has no
        // skill of its own in the per-level MOE list — it is
        // vocabulary practice, so it lives under Reading.
        assert.equal(t.quests[0], t.id, t.id + ' first quest is itself');
        // Extra quests (beyond the first) must be real local banks —
        // the first quest is the topic's own server-bank id, which
        // may be virtual (resolved via its fallback).
        for (const qid of t.quests.slice(1)) assert.ok(REAL_IDS.includes(qid), t.id + ' extra quest ' + qid + ' is a real local quest');
        if (t.id === 'chi-reading') assert.deepEqual(t.quests, ['chi-reading', 'chi-picword'], 'Reading also Practises 看图选词');
        else assert.equal(t.quests.length, 1, t.id + ' has exactly one quest');
        const seen = new Set();
        for (const sb of t.subs) { assert.ok(sb.id && sb.name, 'sub has id + name'); assert.ok(!seen.has(sb.id), sb.id + ' once'); seen.add(sb.id); }
        if (t.fallback) assert.ok(REAL_IDS.includes(t.fallback), t.id + ' fallback is a real local quest');
      }
    }
  }
});

test('Science per level is the MOE list: P3 4, P4 5, P5 5, P6 4', () => {
  assert.deepEqual(sciTopics(3), ['Diversity of Living and Non-Living Things', 'Diversity of Materials', 'Cycles in Plants and Animals (Life Cycles)', 'Interaction of Forces (Magnets)']);
  assert.deepEqual(sciTopics(4), ['Cycles in Matter and Water (Matter)', 'Plant System (Plant parts and functions)', 'Human System (Digestive System)', 'Energy Forms and Uses (Light)', 'Energy Forms and Uses (Heat)']);
  assert.deepEqual(sciTopics(5), ['Cycles in Plants and Animals (Reproduction)', 'Cycles in Matter and Water (Water)', 'Human System (Respiratory and Circulatory Systems)', 'Plant System (transport)', 'Electrical System']);
  assert.deepEqual(sciTopics(6), ['Interaction of Forces (Frictional, Gravitational, Elastic Spring)', 'Interactions within the Environment', 'Energy Forms and Uses (Photosynthesis)', 'Energy Conversion']);
});

test('Science is not taught in P1/P2: no topics, honest note, never hidden', () => {
  for (const lv of [1, 2]) {
    const sci = moeSubject('sci', lv);
    assert.equal(sci.topics.length, 0, 'P' + lv + ' Science has no topics');
    assert.equal(sci.notTaught, true, 'P' + lv + ' Science flagged notTaught');
    assert.deepEqual(moeSubjectCounts(explorer({ level: 'P' + lv }), sci, lv), { started: 0, total: 0, ready: 0, quests: 0 });
    assert.equal(moeSessionFirst(explorer({ level: 'P' + lv }), sci, lv), null, 'no session for a subject with no topics');
    const out = renderSubject(explorer({ level: 'P' + lv }), 'sci');
    assert.ok(out.includes('Science starts in P3'), 'P' + lv + ' page says Science starts in P3');
    assert.ok(out.includes('There is no Science subject in Primary 1 or Primary 2'), 'P' + lv + ' page explains honestly');
    assert.ok(!out.includes('data-learn-topic'), 'no topic rows for a subject that is not taught');
  }
  const landing = renderLanding(explorer({ level: 'P1' }));
  assert.ok(landing.includes('0 of 0 topics started · 0 questions ready'), 'P1 landing: Science shows 0 of 0, not a fake list');
  assert.ok(landing.includes('Science starts in P3'), 'P1 landing Science blurb is honest');
});

test('P5 Science shows the P5 MOE topics, never the P3 list (the reported bug)', () => {
  const out = renderSubject(explorer({ level: 'P5' }), 'sci');
  for (const name of sciTopics(5)) assert.ok(out.includes(name), 'P5 topic shown: ' + name);
  for (const name of ['Diversity of living and non-living things', 'Classification of living things', 'Diversity of materials', 'Life cycle of plants', 'Life cycle of animals', 'Properties of magnets', 'Making and using magnets']) {
    assert.ok(!out.includes(name), 'P5 page must not show P3 topic: ' + name);
  }
  assert.ok(!out.includes('Garden & Plants'), 'P5 page must not suggest Garden & Plants');
  // The suggestion line shows once a topic is started; a fresh explorer
  // sees "No evidence yet" instead.
  const started = renderSubject(explorer({ level: 'P5', progress: { 'sci-reproduction': { idx: 1 } } }), 'sci');
  assert.ok(started.includes('Pip suggests starting with Cycles in Plants and Animals (Reproduction) today.'), 'P5 session suggests the first P5 topic');
  assert.ok(out.includes('25 questions · about 15 minutes'), 'P5 Science session: 5 quests x 5');
});

test('P3 Science shows the P3 list (and P3 only)', () => {
  const out = renderSubject(explorer(), 'sci');
  for (const name of sciTopics(3)) assert.ok(out.includes(name), 'P3 topic shown: ' + name);
  for (const name of ['Cycles in Plants and Animals (Reproduction)', 'Electrical System', 'Energy Conversion', 'Interactions within the Environment']) {
    assert.ok(!out.includes(name), 'P3 page must not show a later topic: ' + name);
  }
  const started = renderSubject(explorer({ progress: { 'sci-diversity-living': { idx: 1 } } }), 'sci');
  assert.ok(started.includes('Pip suggests starting with Diversity of Living and Non-Living Things today.'), 'P3 session suggests the first P3 topic');
});

test('changing the level changes the topic list — no stale P3 list', () => {
  const p3 = renderSubject(explorer({ level: 'P3' }), 'sci');
  const p5 = renderSubject(explorer({ level: 'P5' }), 'sci');
  const p6 = renderSubject(explorer({ level: 'P6' }), 'sci');
  assert.notEqual(p3, p5, 'P3 and P5 Science pages differ');
  assert.notEqual(p5, p6, 'P5 and P6 Science pages differ');
  assert.ok(p5.includes('Electrical System') && !p3.includes('Electrical System'), 'P5-only topic appears only at P5');
  assert.ok(p6.includes('Energy Conversion') && !p5.includes('Energy Conversion'), 'P6-only topic appears only at P6');
  assert.ok(!p5.includes('Diversity of Living and Non-Living Things'), 'P5 has no P3 list left over');
  assert.deepEqual(subjTopicIds(3, 'math'), ['math-whole-10000', 'math-add-sub-4digit', 'math-mult-div-6789', 'math-frac-equivalent', 'math-frac-add-sub-related', 'math-money-decimal-ops', 'math-length-mass-volume-compound', 'math-time-seconds', 'math-area-perimeter', 'math-angles', 'math-perp-parallel', 'math-bar-graphs']);
  assert.deepEqual(subjTopicIds(5, 'math'), ['math-whole-10m', 'math-four-ops-10-100-1000', 'math-frac-division', 'math-frac-four-ops', 'math-decimals-four-ops', 'math-percentage', 'math-rate', 'math-area-triangle', 'math-volume-cube-cuboid', 'math-angles-line-point', 'math-triangle', 'math-parallelogram-rhombus-trapezium']);
});

/* --- English bands / Chinese phases (no invented per-year lists) ---------- */
test('English: same 6 areas at every level, sub-topics deepen by band only', () => {
  const areas = ['eng-listening', 'eng-reading', 'eng-speaking', 'eng-writing', 'eng-grammar', 'eng-vocabulary'];
  for (let lv = 1; lv <= 6; lv++) assert.deepEqual(subjTopicIds(lv, 'eng'), areas, 'P' + lv + ' English areas');
  // Within a band the list is identical — P1 vs P2, P3 vs P4, P5 vs P6.
  assert.deepEqual(moeSubject('eng', 1), moeSubject('eng', 2), 'P1 and P2 English are the same (Lower band)');
  assert.deepEqual(moeSubject('eng', 3), moeSubject('eng', 4), 'P3 and P4 English are the same (Middle band)');
  assert.deepEqual(moeSubject('eng', 5), moeSubject('eng', 6), 'P5 and P6 English are the same (Upper band)');
  // Across bands the depth changes.
  const lower = moeTopic('eng', 'eng-listening', 1).subs.map((s) => s.name).join(' ');
  const upper = moeTopic('eng', 'eng-listening', 5).subs.map((s) => s.name).join(' ');
  assert.ok(lower.includes('empathy'), 'Lower listening: empathy');
  assert.ok(upper.includes('abstract ideas'), 'Upper listening: abstract ideas');
  assert.notEqual(lower, upper, 'listening sub-topics deepen by band');
  const out = renderSubject(explorer({ level: 'P5' }), 'eng');
  assert.ok(out.includes('Upper Primary (P5\u2013P6)'), 'P5 page names its band');
});

test('Chinese: same 5 skills at every level, sub-topics deepen by phase; Higher Chinese only from P3', () => {
  const skills = ['chi-listening', 'chi-speaking', 'chi-reading', 'chi-writing', 'chi-characters'];
  for (let lv = 1; lv <= 6; lv++) assert.deepEqual(subjTopicIds(lv, 'chi').slice(0, 5), skills, 'P' + lv + ' Chinese skills');
  assert.deepEqual(moeSubject('chi', 1), moeSubject('chi', 2), 'P1 and P2 Chinese are the same (Foundation Stage 1)');
  assert.deepEqual(moeSubject('chi', 3), moeSubject('chi', 4), 'P3 and P4 Chinese are the same (Foundation Stage 2)');
  assert.deepEqual(moeSubject('chi', 5), moeSubject('chi', 6), 'P5 and P6 Chinese are the same (Orientation)');
  for (const lv of [1, 2]) assert.ok(!subjTopicIds(lv, 'chi').includes('chi-higher'), 'no Higher Chinese at P' + lv);
  for (const lv of [3, 4, 5, 6]) assert.ok(subjTopicIds(lv, 'chi').includes('chi-higher'), 'Higher Chinese offered at P' + lv);
  const p1 = moeTopic('chi', 'chi-writing', 1).subs.map((s) => s.name).join(' ');
  const p5 = moeTopic('chi', 'chi-writing', 5).subs.map((s) => s.name).join(' ');
  assert.ok(p1.includes('Sentence writing'), 'Stage 1 writing is sentence writing');
  assert.ok(p5.includes('\u6210\u8bed'), 'Orientation writing uses idioms');
  const out = renderSubject(explorer({ level: 'P1' }), 'chi');
  assert.ok(out.includes('Foundation Phase, Stage 1 (P1\u2013P2)'), 'P1 page names its phase');
});

test('看图选词 is reachable: Reading lists chi-picword at every level and its card renders', () => {
  // 2026-11-12: chi-picword was orphaned — in the bank and the
  // syllabus map, but in no per-level topic, so no Learn page ever
  // showed it. It lives under Reading (vocabulary application) at
  // every level, as a second Practise quest.
  for (let lv = 1; lv <= 6; lv++) {
    assert.deepEqual(moeTopic('chi', 'chi-reading', lv).quests, ['chi-reading', 'chi-picword'], 'P' + lv + ' Reading lists 看图选词');
  }
  const t = topicById('chi-picword');
  assert.ok(t, 'chi-picword resolves to a real topic');
  assert.equal(poolQuestions(t, 3).length, 15, '看图选词 has a 15-question pool (5 quest + 10 fresh)');
  const out = renderSubject(explorer({ level: 'P3' }), 'chi', 'chi-reading');
  assert.ok(out.includes('data-quest="chi-picword"'), 'expanded Reading shows a 看图选词 quest card');
  // The real topic definition (not the harness fake) carries the name
  // and blurb the child sees.
  assert.ok(html.includes("name:'看图选词'"), 'real chi-picword topic is named 看图选词');
  assert.ok(html.includes("blurb:'Read the scene, pick the right word.'"), 'real chi-picword blurb describes the scene, not a picture');
});

/* --- syllabus guardrails --------------------------------------------------- */
test('no Speed at any level; Algebra, Ratio and Average are P6 only', () => {
  const all = [];
  for (let lv = 1; lv <= 6; lv++) for (const s of moeSubjects(lv)) for (const t of s.topics) all.push([lv, t.id, t.name]);
  assert.ok(!all.some(([, , name]) => /speed/i.test(name)), 'Speed is not a Maths topic');
  for (const id of ['math-algebra', 'math-ratio', 'math-average']) {
    assert.deepEqual(all.filter(([, tid]) => tid === id).map(([lv]) => lv), [6], id + ' appears only at P6');
  }
  assert.ok(!all.some(([, tid]) => tid === 'math-speed'), 'no math-speed topic id');
});

/* --- counts, pools, "0 questions ready" ------------------------------------ */
test('subject counts at P3 (fake 15-question fallback pools)', () => {
  const e = explorer();
  assert.deepEqual(moeSubjectCounts(e, moeSubject('eng', 3), 3), { started: 0, total: 6, ready: 75, quests: 6 });
  assert.deepEqual(moeSubjectCounts(e, moeSubject('math', 3), 3), { started: 0, total: 12, ready: 180, quests: 12 });
  assert.deepEqual(moeSubjectCounts(e, moeSubject('sci', 3), 3), { started: 0, total: 4, ready: 60, quests: 4 });
  assert.deepEqual(moeSubjectCounts(e, moeSubject('chi', 3), 3), { started: 0, total: 6, ready: 90, quests: 6 });
  const p5 = explorer({ level: 'P5' });
  assert.deepEqual(moeSubjectCounts(p5, moeSubject('math', 5), 5), { started: 0, total: 12, ready: 120, quests: 12 }, 'P5 Maths: 8 fallback topics x 15');
  assert.deepEqual(moeSubjectCounts(p5, moeSubject('sci', 5), 5), { started: 0, total: 5, ready: 30, quests: 5 }, 'P5 Science: 2 fallback topics x 15');
});

test('a topic with no questions shows "0 questions ready", never a P3 substitute', () => {
  // P6 Algebra has no local fallback bank at all.
  const alg = moeTopic('math', 'math-algebra', 6);
  assert.equal(alg.fallback, undefined, 'Algebra has no fallback');
  assert.equal(moeTopicPool(alg, 6), 0, 'Algebra pool is 0');
  assert.ok(moeUncoveredTopics(6).includes('math-algebra'), 'Algebra is flagged uncovered');
  assert.ok(moeUncoveredTopics(6).includes('math-ratio'), 'Ratio is flagged uncovered');
  const out = renderSubject(explorer({ level: 'P6' }), 'math');
  assert.ok(out.includes('Algebra'), 'Algebra is still listed');
  assert.ok(out.includes('0 questions ready'), 'a topic with no questions says 0 questions ready');
  assert.ok(!out.includes('Questions on the way'), 'no "on the way" copy on the MOE page');
  const open = renderSubject(explorer({ level: 'P6' }), 'math', 'math-algebra');
  assert.ok(open.includes('0 questions ready'), 'expanded Algebra sub-note is 0 questions ready');
  assert.ok(open.includes('data-quest="math-algebra"'), 'Algebra still has a Practise quest (server bank first)');
  assert.ok(open.includes('📚 Pip’s shelf'), 'Algebra card says its questions come from Pip’s shelf');
  // The P3 list is never the substitute: P6 Maths shows no P3-only topic names.
  assert.ok(!out.includes('Whole Numbers up to 10 000'), 'P6 page shows no P3 topic');
});

test('session first: level-aware, replay when all done, never a P3 topic for a non-P3 explorer', () => {
  const p5 = explorer({ level: 'P5' });
  assert.equal(moeSessionFirst(p5, moeSubject('math', 5), 5), 'math-whole-10m', 'P5 Maths starts with Whole Numbers up to 10 million');
  assert.equal(moeSessionFirst(explorer(), moeSubject('math', 3), 3), 'math-whole-10000', 'P3 Maths starts with Whole Numbers up to 10 000');
  const oneDone = explorer({ level: 'P5', completedDay: { 'math-whole-10m': '2026-11-07' } });
  assert.equal(moeSessionFirst(oneDone, moeSubject('math', 5), 5), 'math-four-ops-10-100-1000', 'next P5 topic after the first is done');
  const allDone = explorer({ level: 'P5', completedDay: Object.fromEntries(subjTopicIds(5, 'math').map((id) => [id, '2026-11-07'])) });
  assert.equal(moeSessionFirst(allDone, moeSubject('math', 5), 5), 'math-whole-10m', 'all done today: replay the first P5 topic');
});

/* --- pacing: every topic has a term; serving is gated on it --------------- */
test('terms: every topic has a term 1-4; Maths/Science spread in syllabus order, English/Chinese all Term 1', () => {
  for (let lv = 1; lv <= 6; lv++) {
    for (const s of moeSubjects(lv)) {
      for (const t of s.topics) {
        assert.ok(t.term >= 1 && t.term <= 4, t.id + ' has a term 1-4, got ' + t.term);
      }
      if (s.id === 'math' || s.id === 'sci') {
        const terms = s.topics.map((t) => t.term);
        for (let i = 1; i < terms.length; i++) assert.ok(terms[i] >= terms[i - 1], s.id + ' P' + lv + ' terms are monotonic in syllabus order');
        if (terms.length) {
          assert.equal(terms[0], 1, s.id + ' P' + lv + ' first topic is Term 1');
          assert.equal(terms[terms.length - 1], 4, s.id + ' P' + lv + ' last topic is Term 4');
        }
      } else {
        assert.ok(s.topics.every((t) => t.term === 1), s.id + ' P' + lv + ' skill areas run all year (Term 1)');
      }
    }
  }
  // P3 Science is the confirmed case: Diversity T1, Materials T2,
  // Life Cycles T3, Magnets T4 (last topic, latter half of the year).
  assert.deepEqual(moeSubject('sci', 3).topics.map((t) => [t.id, t.term]),
    [['sci-diversity-living', 1], ['sci-diversity-materials', 2], ['sci-life-cycles', 3], ['sci-magnets', 4]]);
  assert.equal(moeTopic('sci', 'sci-magnets', 3).term, 4, 'Magnets is Term 4');
});

test('schoolTermOf: month bands, rolling forward every year (no hardcoded date)', () => {
  assert.deepEqual(['2026-01-15', '2026-03-01', '2026-03-31'].map(schoolTermOf), [1, 1, 1], 'Term 1 Jan-Mar');
  assert.deepEqual(['2026-04-01', '2026-05-31'].map(schoolTermOf), [2, 2], 'Term 2 Mar-May');
  assert.deepEqual(['2026-06-01', '2026-08-31'].map(schoolTermOf), [3, 3], 'Term 3 Jun-Sep');
  assert.deepEqual(['2026-09-01', '2026-11-07', '2026-12-15'].map(schoolTermOf), [4, 4, 4], 'Term 4 Sep-Nov (Dec counts as Term 4: the year has been taught)');
  assert.equal(schoolTermOf('2027-02-01'), 1, 'next year rolls forward');
  assert.equal(schoolTermOf('2030-10-01'), 4, 'a future year rolls forward');
  const mag = moeTopic('sci', 'sci-magnets', 3);
  assert.equal(moeInSeason(mag, '2026-03-01'), false, 'Magnets out of season in March');
  assert.equal(moeInSeason(mag, '2026-09-01'), true, 'Magnets in season in September');
  assert.deepEqual(moeOutOfSeasonTopics(3, '2026-03-01').filter((id) => id.startsWith('sci-')),
    ['sci-diversity-materials', 'sci-life-cycles', 'sci-magnets'], 'March P3 Science: only Diversity is in season');
});

test('pacing: P3 Magnets is never the session suggestion before its term', () => {
  const sci3 = moeSubject('sci', 3);
  const othersDoneMar = explorer({ completedDay: { 'sci-diversity-living': '2026-03-01', 'sci-diversity-materials': '2026-03-01', 'sci-life-cycles': '2026-03-01' } });
  assert.equal(moeSessionFirst(othersDoneMar, sci3, 3, '2026-03-01'), 'sci-diversity-living', 'March: only Magnets is unfinished, and it is held back — the session replays the first in-season topic instead');
  const othersDoneNov = explorer({ completedDay: { 'sci-diversity-living': '2026-11-07', 'sci-diversity-materials': '2026-11-07', 'sci-life-cycles': '2026-11-07' } });
  assert.equal(moeSessionFirst(othersDoneNov, sci3, 3, '2026-11-07'), 'sci-magnets', 'November: Magnets is in season');
  assert.equal(moeSessionFirst(explorer(), sci3, 3, '2026-03-01'), 'sci-diversity-living', 'March: session starts with the first topic, not Magnets');
  // June is Term 3: Life Cycles (T3) is in season, Magnets (T4) is not.
  const twoDoneJun = explorer({ completedDay: { 'sci-diversity-living': '2026-06-15', 'sci-diversity-materials': '2026-06-15' } });
  assert.equal(moeSessionFirst(twoDoneJun, sci3, 3, '2026-06-15'), 'sci-life-cycles', 'June: session reaches Life Cycles, not Magnets');
  TODAY = '2026-03-01';
  try {
    const out = renderSubject(explorer(), 'sci');
    assert.ok(out.includes('Later in the year'), 'March page marks Magnets as later in the year');
    assert.ok(out.includes('Later in the year · Term 4'), 'March page names Magnets’ term');
  } finally { TODAY = '2026-11-07'; }
});

test('counts reflect in-season topics only (total still shows the whole year)', () => {
  const e = explorer();
  assert.deepEqual(moeSubjectCounts(e, moeSubject('sci', 3), 3, '2026-03-01'), { started: 0, total: 4, ready: 15, quests: 1 }, 'March P3 Science: 1 in-season quest (Diversity only)');
  assert.deepEqual(moeSubjectCounts(e, moeSubject('sci', 3), 3, '2026-11-07'), { started: 0, total: 4, ready: 60, quests: 4 }, 'November P3 Science: all 4 in season');
  assert.deepEqual(moeSubjectCounts(e, moeSubject('math', 3), 3, '2026-03-01'), { started: 0, total: 12, ready: 60, quests: 4 }, 'March P3 Maths: 4 Term-1 topics x 15');
  TODAY = '2026-03-01';
  try {
    const out = renderLanding(e);
    assert.ok(out.includes('0 of 4 topics started · 15 questions ready'), 'March landing: Science counts only the in-season topic');
  } finally { TODAY = '2026-11-07'; }
});

test('out-of-season topics are listed but cannot start a quest', () => {
  TODAY = '2026-03-01';
  try {
    const page = renderSubject(explorer(), 'sci');
    assert.ok(page.includes('⏳'), 'March page marks held-back topics with ⏳');
    assert.ok(page.includes('Later in the year · Term 4'), 'March page names the term');
    const open = renderSubject(explorer(), 'sci', 'sci-magnets');
    assert.ok(!open.includes('data-quest="sci-magnets"'), 'March: no Start button for Magnets');
    assert.ok(open.includes('Later in the year — Pip brings this one in Term 4'), 'March: held-back note instead of a Start button');
  } finally { TODAY = '2026-11-07'; }
  const openNov = renderSubject(explorer(), 'sci', 'sci-magnets');
  assert.ok(openNov.includes('data-quest="sci-magnets"'), 'November: Magnets can start');
  // The serving gate lives in the quest/boost flows, not just the card.
  assert.ok(html.includes('school has not taught it yet'), 'startQuestFlow/startBoostFlow refuse out-of-season topics');
});

/* --- quest flow serves the MOE topic --------------------------------------- */
test('topicById resolves a MOE quest id to a virtual topic (local banks stay untouched)', () => {
  const t = topicById('sci-reproduction');
  assert.ok(t, 'P5 Reproduction resolves');
  assert.equal(t.sub, 'sci', 'virtual topic subject is Science');
  assert.equal(t.name, 'Cycles in Plants and Animals (Reproduction)');
  assert.equal(t.moe, true, 'virtual topic is flagged moe');
  assert.equal(t.fallback, 'sci-frog', 'Reproduction falls back to the frog bank for questions only');
  assert.equal(t.quest.length, 5, 'fallback quest bank rides along');
  assert.equal(topicById('math-ntuc').name, 'Quest math-ntuc', 'local quests still resolve first, unchanged');
  assert.equal(topicById('no-such-topic'), null, 'unknown id still resolves to null');
  const alg = topicById('math-algebra');
  assert.equal(alg.quest.length, 0, 'no-fallback topic has no local quest bank (server first)');
  assert.ok(alg.warm.length > 0, 'no-fallback topic still has a warm-up bank (subject default) while the server set lands');
});

test('questListFor serves a server set for a MOE topic (FIB/MCQ mixed set, verbatim)', () => {
  const serverSet = [
    { id: 'math-algebra-6-001', q: 'If a = 5, what is a + 3? ____', o: [], a: 0, c: '5 + 3 = 8.', j: '', k: 'fib', ans: '8', accept: [] },
    { id: 'math-algebra-6-002', q: 'Which is 3a when a = 4?', o: ['7', '12', '34', '43'], a: 1, c: '3 x 4 = 12.', j: '', k: 'mcq' },
    { id: 'math-algebra-6-003', q: 'Simplify b + b + b. ____', o: [], a: 0, c: 'Three b’s is 3b.', j: '', k: 'fib', ans: '3b', accept: ['3 b'] },
    { id: 'math-algebra-6-004', q: 'If x = 2, x + x + 5 = ?', o: ['7', '9', '11', '4'], a: 1, c: '2 + 2 + 5 = 9.', j: '', k: 'mcq' },
    { id: 'math-algebra-6-005', q: 'Solve: y \u2212 4 = 6. y = ____', o: [], a: 0, c: '6 + 4 = 10.', j: '', k: 'fib', ans: '10', accept: [] },
  ];
  const t = topicById('math-algebra');
  const list = questListFor(t, { phase: 'quest', liveGen: serverSet, pool: [0, 1, 2, 3, 4], fresh: false }, 6);
  assert.equal(list.length, 5, 'server set plays verbatim (5 questions)');
  assert.deepEqual(list.map((q) => q.k), ['fib', 'mcq', 'fib', 'mcq', 'fib'], 'FIB/MCQ mixed format survives for a MOE topic');
  assert.equal(list[0].ans, '8', 'FIB expected answer rides along');
});

/* --- coverage: server bank first, local fallback second -------------------- */
test('coverage: every MOE topic-level has server-bank rows (seed-all.csv)', () => {
  const csv = fs.readFileSync(path.join(__dirname, '..', 'new-questions', 'seed-all.csv'), 'utf8');
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'id,topic,level,sub_topic,stem,options,answer,explanation,joke,source', 'seed header');
  const counts = {};
  for (const line of lines.slice(1)) {
    // Topic + level are the 2nd/3rd fields, before any quoted field
    // that may contain commas — a plain split is safe for those two.
    const parts = line.split(',');
    const key = parts[1] + '|' + parts[2];
    counts[key] = (counts[key] || 0) + 1;
  }
  assert.equal(lines.length - 1, 1220, '1,220 per-level rows in the seed');
  let checked = 0;
  for (let lv = 1; lv <= 6; lv++) {
    for (const s of moeSubjects(lv)) {
      for (const t of s.topics) {
        checked++;
        const n = counts[t.id + '|' + lv] || 0;
        assert.ok(n >= 5, t.id + ' P' + lv + ' has at least 5 server rows, got ' + n);
      }
    }
  }
  assert.equal(checked, 154, 'all 154 MOE topic-levels checked against the server bank');
});

test('coverage: no MOE topic has zero questions in BOTH banks (true gaps = none)', () => {
  const csv = fs.readFileSync(path.join(__dirname, '..', 'new-questions', 'seed-all.csv'), 'utf8');
  const server = new Set();
  for (const line of csv.trim().split('\n').slice(1)) {
    const parts = line.split(',');
    server.add(parts[1] + '|' + parts[2]);
  }
  const gaps = [];
  const localOnly = [];
  for (let lv = 1; lv <= 6; lv++) {
    for (const s of moeSubjects(lv)) {
      for (const t of s.topics) {
        const hasServer = server.has(t.id + '|' + lv);
        const hasLocal = moeTopicPool(t, lv) > 0;
        if (!hasServer && !hasLocal) gaps.push(t.id + ' P' + lv);
        if (!hasLocal) localOnly.push(t.id + ' P' + lv);
      }
    }
  }
  assert.deepEqual(gaps, [], 'no topic is without questions in both banks');
  // The local-only topics are the honest "0 questions ready" ones —
  // each is still served from the server bank.
  assert.equal(localOnly.length, 30, '30 topics have no local fallback');
  for (const id of localOnly) {
    const [tid, lv] = id.split(' ');
    assert.ok(server.has(tid + '|' + lv.slice(1)), id + ' has server rows despite no local fallback');
  }
});

test('coverage: sub-topics are NOT tagged in the bank — per-sub-topic coverage is unmeasurable (structural gap)', () => {
  // Server rows tag questions only by bank kind, never by MOE
  // sub-topic — so no test can prove every sub-topic has a question.
  // This pins the limitation instead of claiming coverage we cannot
  // verify: closing it needs a sub-topic tag in sb_questions.
  const csv = fs.readFileSync(path.join(__dirname, '..', 'new-questions', 'seed-all.csv'), 'utf8');
  const kinds = new Set();
  for (const line of csv.trim().split('\n').slice(1)) kinds.add(line.split(',')[3]);
  assert.deepEqual([...kinds].sort(), ['fresh', 'quest'], 'sub_topic is only ever quest/fresh');
  let subs = 0;
  for (let lv = 1; lv <= 6; lv++) for (const s of moeSubjects(lv)) for (const t of s.topics) subs += t.subs.length;
  assert.equal(subs, 478, '478 sub-topics ride on topic-level questions only');
});

test('landing: level-aware subject cards, P5 counts, no P3 leakage', () => {
  const out = renderLanding(explorer({ level: 'P5' }));
  for (const name of ['English', 'Maths', 'Science', 'Chinese']) assert.ok(out.includes('Open ' + name), 'Open ' + name);
  assert.ok(out.includes('0 of 6 topics started · 75 questions ready'), 'P5 English counts');
  assert.ok(out.includes('0 of 12 topics started · 120 questions ready'), 'P5 Maths counts');
  assert.ok(out.includes('0 of 5 topics started · 30 questions ready'), 'P5 Science counts');
  assert.ok(out.includes('0 of 6 topics started · 90 questions ready'), 'P5 Chinese counts');
  assert.ok(out.includes('🎒 P5'), 'P5 level chip');
  assert.ok(!out.includes('Diversity of living and non-living things'), 'P5 landing leaks no P3 Science');
  assert.ok(!out.includes('Garden & Plants'), 'P5 landing never suggests Garden & Plants');
});
