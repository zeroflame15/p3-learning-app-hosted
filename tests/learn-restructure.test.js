// Learn restructure (2026-11-07): myKx layout — 4 subject cards → subject
// page (topics on a vertical timeline) → expand for sub-topics → Practise
// the mapped quest. Covers the MYKX data (4 subjects, 34 topics, 161
// sub-topics), the count/session helpers, the landing + subject-page
// rendering, and that the old quest flow (states, boost badges, live-gen
// line, leaderboard, spelling entry, level chip) survives the move.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// Brace-matching extractor (same pattern as tests/weak-boost.test.js).
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

// --- the real TOPICS ids, straight from the file -------------------------
const TOPICS_SRC = grabLiteral('var TOPICS=');
const REAL_IDS = [...TOPICS_SRC.matchAll(/id:'([a-z0-9-]+)'/g)].map((m) => m[1]);
assert.equal(REAL_IDS.length, 31, '31 real topics in the file (14 original + 17 gap-fill, 2026-11-08)');

// --- MYKX data ------------------------------------------------------------
let MYKX_SUBJECTS = eval(grabLiteral('var MYKX_SUBJECTS='));

// --- MOE data (Learn rebuild 2026-11-09): the page renders MOE topics now,
// so the harness topicById must resolve MOE quest ids to virtual topics,
// exactly like the page's topicById does. ---------------------------------
const MOE_SUBJECTS_BY_LEVEL = eval('(' + grabLiteral('var MOE_SUBJECTS_BY_LEVEL=') + ')');
const moeQuestTopic = eval('(' + grabFn('moeQuestTopic(') + ')');

// --- page-function stubs the eval'd code closes over ----------------------
function mkQ(prefix, i) {
  return { q: prefix + ' question ' + i + '?', o: ['A' + i, 'B' + i, 'C' + i, 'D' + i], a: 0, c: 'Clue ' + i, j: 'Joke ' + i };
}
const FAKE_TOPICS = REAL_IDS.map((id) => {
  const sub = id.split('-')[0] === 'eng' || id.split('-')[0] === 'chi' ? id.split('-')[0] : id.split('-')[0];
  const t = {
    id, sub: id.slice(0, 3) === 'chi' ? 'chi' : id.slice(0, 3), subName: 'Subject',
    icon: '📖', img: 'icons/topic-' + id + '.webp', name: 'Quest ' + id, blurb: 'Blurb ' + id,
    quest: [0, 1, 2, 3, 4].map((i) => mkQ('quest', i)),
    fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('fresh', i)),
    warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('warm', i)),
    retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('retry', i)),
    p4quest: [0, 1, 2, 3, 4].map((i) => mkQ('p4quest', i)),
    p4fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('p4fresh', i)),
    p4warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('p4warm', i)),
    p4retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('p4retry', i)),
  };
  t.sub = id.startsWith('eng') ? 'eng' : id.startsWith('math') ? 'math' : id.startsWith('sci') ? 'sci' : 'chi';
  return t;
});
var TOPICS = FAKE_TOPICS;
const topicById = eval('(' + grabFn('topicById(') + ')');
function levelNum(e) { const n = parseInt((e && e.level || '').replace('P', ''), 10); return (n >= 1 && n <= 6) ? n : 3; }
function bankFor(t, kind, level) {
  if (!t) return [];
  if (level >= 4) { const p4 = t['p4' + kind]; if (p4 && p4.length) return p4; }
  return t[kind] || [];
}
function poolQuestions(t, level) { return bankFor(t, 'quest', level).concat(bankFor(t, 'fresh', level)); }
function todayKey() { return '2026-11-07'; }
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
let learnView = { subject: null, openTopic: null };
let EX = null;
function ex() { return EX; }

const questState = eval('(' + grabFn('questState(') + ')');
const mykxSubject = eval('(' + grabFn('mykxSubject(') + ')');
const mykxTopic = eval('(' + grabFn('mykxTopic(') + ')');
const mykxTopicPool = eval('(' + grabFn('mykxTopicPool(') + ')');
const mykxTopicStarted = eval('(' + grabFn('mykxTopicStarted(') + ')');
const mykxSubReady = eval('(' + grabFn('mykxSubReady(') + ')');
const mykxSubNote = eval('(' + grabFn('mykxSubNote(') + ')');
const mykxSubjectCounts = eval('(' + grabFn('mykxSubjectCounts(') + ')');
const mykxSessionFirst = eval('(' + grabFn('mykxSessionFirst(') + ')');
// MOE rebuild (2026-11-09): learnHTML now renders the MOE structure.
const schoolTermOf = eval('(' + grabFn('schoolTermOf(') + ')');
const moeInSeason = eval('(' + grabFn('moeInSeason(') + ')');
const moeSubjects = eval('(' + grabFn('moeSubjects(') + ')');
const moeSubject = eval('(' + grabFn('moeSubject(') + ')');
const moeTopic = eval('(' + grabFn('moeTopic(') + ')');
const moeTopicPool = eval('(' + grabFn('moeTopicPool(') + ')');
const moeTopicStarted = eval('(' + grabFn('moeTopicStarted(') + ')');
const moeSubNote = eval('(' + grabFn('moeSubNote(') + ')');
const moeSubjectCounts = eval('(' + grabFn('moeSubjectCounts(') + ')');
const moeSessionFirst = eval('(' + grabFn('moeSessionFirst(') + ')');
const learnHTML = eval('(' + grabFn('learnHTML(') + ')');

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

/* --- data shape ----------------------------------------------------------- */
test('MYKX data: 4 subjects in myKx order, 34 topics, 161 sub-topics', () => {
  assert.deepEqual(MYKX_SUBJECTS.map((s) => s.id), ['eng', 'math', 'sci', 'chi'], 'myKx order: English, Maths, Science, Chinese');
  assert.deepEqual(MYKX_SUBJECTS.map((s) => s.name), ['English', 'Maths', 'Science', 'Chinese']);
  const topics = MYKX_SUBJECTS.flatMap((s) => s.topics);
  const subs = topics.flatMap((t) => t.subs);
  assert.equal(topics.length, 34, '34 myKx topics');
  assert.equal(subs.length, 161, '161 sub-topics');
  assert.deepEqual(MYKX_SUBJECTS.map((s) => s.topics.length), [6, 10, 7, 11], 'topics per subject');
  assert.deepEqual(topics.map((t) => t.subs.length).reduce((a, n) => a + n, 0), 161);
});

test('MYKX data: every sub-topic is well-formed and maps to a real quest (or null)', () => {
  // Gap-fill (2026-11-08): every sub-topic now has a bank, and every
  // bank lives inside its own topic — the old Grammar/connectors
  // exception (taught by eng-story2, outside Grammar's own quests) is
  // gone: connectors is now taught by eng-tense. crossTopic must be
  // empty, so a typo can never hide as a "cross-topic" map.
  const crossTopic = [];
  for (const s of MYKX_SUBJECTS) {
    for (const t of s.topics) {
      assert.ok(t.id && t.name, 'topic has id + name');
      assert.ok(Array.isArray(t.quests), 'topic has a quests array');
      assert.ok(t.subs.length >= 1, t.id + ' has at least one sub-topic');
      const seen = new Set();
      for (const qid of t.quests) assert.ok(REAL_IDS.includes(qid), t.id + ' Practise quest ' + qid + ' is a real TOPICS id');
      for (const sb of t.subs) {
        assert.ok(sb.id && sb.name, 'sub-topic has id + name');
        assert.ok(['yes', 'partial', 'p4', 'no'].includes(sb.cov), sb.id + ' cov is one of yes/partial/p4/no, got ' + sb.cov);
        assert.ok(!seen.has(sb.id), sb.id + ' listed once in ' + t.id);
        seen.add(sb.id);
        if (sb.map === null) assert.equal(sb.cov, 'no', sb.id + ' with no bank is cov=no');
        else {
          assert.ok(REAL_IDS.includes(sb.map), sb.id + ' maps to a real TOPICS id');
          if (!t.quests.includes(sb.map)) {
            assert.equal(sb.cov, 'p4', sb.id + ' maps outside its own topic only as a P4-only bank');
            crossTopic.push(sb.id);
          }
        }
      }
    }
  }
  assert.deepEqual(crossTopic, [], 'no cross-topic banks after the gap-fill');
});

test('coverage counts match the doc table (per subject)', () => {
  // Gap-fill (2026-11-08): all 161 sub-topics now have a bank.
  const want = {
    eng: { yes: 39, p4: 0, partial: 0, no: 0 },
    math: { yes: 67, p4: 0, partial: 0, no: 0 },
    sci: { yes: 38, p4: 0, partial: 0, no: 0 },
    chi: { yes: 17, p4: 0, partial: 0, no: 0 },
  };
  for (const s of MYKX_SUBJECTS) {
    const c = { yes: 0, p4: 0, partial: 0, no: 0 };
    s.topics.forEach((t) => t.subs.forEach((sb) => { c[sb.cov]++; }));
    assert.deepEqual(c, want[s.id], s.id + ' coverage');
  }
  const total = { yes: 161, p4: 0, partial: 0, no: 0 };
  const all = { yes: 0, p4: 0, partial: 0, no: 0 };
  MYKX_SUBJECTS.forEach((s) => s.topics.forEach((t) => t.subs.forEach((sb) => { all[sb.cov]++; })));
  assert.deepEqual(all, total, '161 total: all yes');
});

/* --- helpers: counts, pools, session -------------------------------------- */
test('subject counts: fresh explorer, 0 started, distinct pools only', () => {
  const e = explorer();
  // Gap-fill (2026-11-08): FAKE_TOPICS are built from the 31 real
  // ids, each with a 15-question pool (5 quest + 10 fresh). Ready is
  // the sum over DISTINCT quests: English 6, Maths 9, Science 5,
  // Chinese 11 — computed from the assembled MYKX_SUBJECTS.
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('eng'), 3), { started: 0, total: 6, ready: 90, quests: 6 }, 'English: 6 distinct quests x 15');
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('math'), 3), { started: 0, total: 10, ready: 135, quests: 9 });
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('sci'), 3), { started: 0, total: 7, ready: 75, quests: 5 });
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('chi'), 3), { started: 0, total: 11, ready: 165, quests: 11 });
  // A quest shared by two topics counts once: MRT Numbers serves both
  // Numbers and Addition, so Maths ready is 9 x 15, not 10 x 15.
  assert.equal(mykxTopicPool(mykxTopic('math', 'math-numbers'), 3), 15, 'Numbers pool is one quest');
  assert.equal(mykxTopicPool(mykxTopic('math', 'math-addsub'), 3), 30, 'Addition pool is two quests');
  assert.equal(mykxTopicPool(mykxTopic('eng', 'eng-spelling'), 3), 15, 'Spelling has a pool now (gap-fill)');
  assert.equal(mykxTopicPool(mykxTopic('chi', 'chi-lesson-words'), 3), 30, 'Lesson words pool is two quests');
});

test('subject counts: started derives from progress/completed', () => {
  const e = explorer({ progress: { 'eng-tense': { idx: 2 } }, completed: { 'eng-story': 5 } });
  assert.equal(mykxSubjectCounts(e, mykxSubject('eng'), 3).started, 2, 'Grammar (in progress) + Vocabulary (completed)');
  assert.equal(mykxTopicStarted(e, mykxTopic('eng', 'eng-grammar')), true);
  assert.equal(mykxTopicStarted(e, mykxTopic('eng', 'eng-vocab')), true);
  assert.equal(mykxTopicStarted(e, mykxTopic('eng', 'eng-visual')), false);
});

test('sub-topic notes: ready vs on-the-way, partial, P4-only, practised proxy', () => {
  const e = explorer();
  const grammar = mykxTopic('eng', 'eng-grammar');
  const tense = grammar.subs.find((s) => s.id === 'tense_simple_present');
  const connectors = grammar.subs.find((s) => s.id === 'connectors');
  const perfect = grammar.subs.find((s) => s.id === 'tense_perfect');
  const context = mykxTopic('eng', 'eng-vocab').subs[0];
  const spelling = mykxTopic('eng', 'eng-spelling').subs[0];
  assert.equal(mykxSubReady(tense, 3), true);
  assert.equal(mykxSubNote(e, tense, 3), 'Not yet assessed');
  // Gap-fill (2026-11-08): no sub-topic is partial, P4-only or
  // without a bank any more — every note is 'Not yet assessed' until
  // the mapped quest is practised.
  assert.equal(mykxSubNote(e, context, 3), 'Not yet assessed', 'context clues now has a full bank');
  assert.equal(mykxSubNote(e, spelling, 3), 'Not yet assessed', 'spelling now has a bank');
  assert.equal(mykxSubReady(perfect, 3), true, 'perfect tense is no longer P4-only');
  assert.equal(mykxSubNote(e, perfect, 3), 'Not yet assessed');
  assert.equal(mykxSubNote(e, perfect, 4), 'Not yet assessed', 'opens at P4');
  assert.equal(mykxSubNote(e, connectors, 4), 'Not yet assessed');
  const done = explorer({ completed: { 'eng-tense': 5 } });
  assert.equal(mykxSubNote(done, tense, 3), 'Practised ✓', 'completed mapped quest is the proxy');
});

test('session first: first unfinished quest in myKx topic order, replay when all done', () => {
  const e = explorer();
  assert.equal(mykxSessionFirst(e, mykxSubject('eng'), 3), 'eng-tense', 'Grammar first');
  assert.equal(mykxSessionFirst(e, mykxSubject('chi'), 3), 'chi-family', 'Lesson words first');
  const oneDone = explorer({ completedDay: { 'eng-tense': '2026-11-07' } });
  assert.equal(mykxSessionFirst(oneDone, mykxSubject('eng'), 3), 'eng-punct', 'next quest in the same topic');
  // Gap-fill (2026-11-08): English has 6 distinct quests now, so
  // "all done" means all 6, including the two new ones.
  const allDone = explorer({ completedDay: { 'eng-tense': '2026-11-07', 'eng-punct': '2026-11-07', 'eng-story': '2026-11-07', 'eng-story2': '2026-11-07', 'eng-spelling': '2026-11-07', 'eng-visual': '2026-11-07' } });
  assert.equal(mykxSessionFirst(allDone, mykxSubject('eng'), 3), 'eng-tense', 'all done today: replay the first');
  assert.equal(mykxSessionFirst(e, mykxSubject('math'), 3), 'math-mrt');
  assert.equal(mykxSessionFirst(explorer(), { topics: [] }, 3), null, 'a subject with no quests has no session');
});

/* --- rendering: landing ---------------------------------------------------- */
test('landing: 4 subject cards in myKx order, with counts, session hint, level chip', () => {
  const out = renderLanding(explorer());
  for (const name of ['English', 'Maths', 'Science', 'Chinese']) {
    assert.ok(out.includes('Open ' + name), 'Open ' + name + ' button');
    assert.ok(out.includes('Today’s ' + name + ' session'), name + ' session hint');
  }
  assert.ok(out.indexOf('Open English') < out.indexOf('Open Maths'), 'English first');
  assert.ok(out.indexOf('Open Maths') < out.indexOf('Open Science'), 'Maths second');
  assert.ok(out.indexOf('Open Science') < out.indexOf('Open Chinese'), 'Science third');
  // MOE rebuild (2026-11-09): P3 counts from the MOE structure, fake
  // 15-question fallback pools — English 5x15 (Listening has no
  // fallback), Maths 12x15, Science 4x15, Chinese 6x15.
  assert.ok(out.includes('0 of 6 topics started · 75 questions ready'), 'English counts');
  assert.ok(out.includes('0 of 12 topics started · 180 questions ready'), 'Maths counts');
  assert.ok(out.includes('0 of 4 topics started · 60 questions ready'), 'Science counts');
  assert.ok(out.includes('0 of 6 topics started · 90 questions ready'), 'Chinese counts');
  assert.ok(out.includes('30 questions · about 18 minutes'), 'English session: 6 quests x 5, about 18 min');
  assert.ok(out.includes('60 questions · about 36 minutes'), 'Maths session: 12 quests x 5, about 36 min');
  assert.ok(out.includes('20 questions · about 12 minutes'), 'Science session: 4 quests x 5, about 12 min');
  assert.ok(out.includes('30 questions · about 18 minutes'), 'Chinese session: 6 quests x 5, about 18 min');
  assert.ok(out.includes('🎒 P3'), 'level chip on the landing hero');
  assert.ok(out.includes('Frog Quest'), 'hero keeps the Frog Quest story');
  assert.ok(out.includes('<!--PLAN-BANNER-->'), 'study-plan banner stays on the landing');
  assert.ok(out.includes('<!--SPELL-TESTS-->'), 'My spelling tests card stays on the landing');
  assert.ok(out.includes('<!--QUEST-BOARD-->'), 'quest leaderboard stays at the bottom');
  assert.ok(!out.includes('data-learn-topic'), 'no timeline rows on the landing');
  assert.ok(!out.includes('Questions on the way'), 'no locked-topic copy on the landing');
});

/* --- rendering: subject page ---------------------------------------------- */
test('subject page: hero, session panel, timeline rows, no padlocks (MOE rebuild)', () => {
  const out = renderSubject(explorer(), 'eng');
  assert.ok(out.includes('P3 English'), 'subject hero');
  assert.ok(out.includes('🎒 P3'), 'level chip on the subject hero');
  assert.ok(out.includes('Today’s English session'), 'side panel heading');
  assert.ok(out.includes('30 questions · about 18 minutes'), 'session count + estimate (6 quests)');
  assert.ok(out.includes('No evidence yet: your first session starts it.'), 'no-evidence line');
  assert.ok(out.includes('data-learn-start="eng"'), 'Start session button');
  assert.ok(out.includes('Start session'), 'Start session label');
  assert.ok(out.includes('← All subjects'), 'back to the subject cards');
  // MOE rebuild (2026-11-09): the 6 Areas of Language Learning, Middle band.
  for (const name of ['Listening and Viewing', 'Reading and Viewing', 'Speaking and Representing', 'Writing and Representing', 'Grammar', 'Vocabulary']) {
    assert.ok(out.includes(name), 'topic row: ' + name);
  }
  assert.ok(out.includes('3 sub-topics · 15 questions ready'), 'Grammar row counts');
  assert.ok(out.includes('3 sub-topics · 0 questions ready'), 'Listening row honestly shows 0 (no local fallback)');
  // No topic is locked any more — no padlocks anywhere on the subject
  // page, and every topic has a play triangle (the server bank may
  // serve even a 0-questions-ready topic).
  assert.ok(!out.includes('🔒'), 'no padlock on any topic');
  assert.ok(out.includes('▶'), 'play-triangle node on topics');
  assert.ok(out.includes('Today’s session starts here'), 'session-start flag on the first topic');
  assert.ok(!out.includes('Metalanguage at text level'), 'sub-topics hidden until the topic expands');
  assert.ok(!out.includes('▶ Start quest'), 'no quest cards until a topic expands');
  assert.ok(out.includes('<!--QUEST-BOARD-->'), 'leaderboard stays on the subject page too');
});

test('expanded topic: plain sub-topic list (not links) + Practise quest cards', () => {
  const out = renderSubject(explorer(), 'eng', 'eng-grammar');
  // MOE rebuild (2026-11-09): Middle-band Grammar sub-topics.
  for (const name of ['Metalanguage at text level; editing and self-correction', 'Cohesive devices across clauses, sentences and paragraphs', 'Language features of different text types']) {
    assert.ok(out.includes(name), 'sub-topic listed: ' + name);
  }
  assert.ok(out.includes('Not yet assessed'), 'ready sub-topic note');
  assert.ok(!out.includes('Questions on the way'), 'no uncovered sub-topic note');
  assert.ok(!out.includes('Some questions ready'), 'no partial sub-topic note');
  assert.ok(out.includes('Practise Grammar:'), 'Practise heading');
  assert.ok(out.includes('▶ Start quest'), 'Practise starts the quest');
  assert.ok(out.includes('data-quest="eng-grammar"'), 'Practise wires to the MOE quest id');
  assert.ok(out.includes('📚 Pip’s shelf'), 'MOE quest card says its questions come from Pip’s shelf');
  // Sub-topic rows are a plain list: <li> rows, never links or buttons.
  assert.ok(out.includes('<li><span>Metalanguage at text level; editing and self-correction</span>'), 'sub-topic row is a plain list item');
  assert.ok(!out.includes('<a '), 'no anchor links anywhere on the Learn page');
  const subList = out.slice(out.indexOf('<ul class="learn-subs">'), out.indexOf('</ul>'));
  assert.ok(!subList.includes('data-quest'), 'sub-topic rows carry no Practise action');
  assert.ok(!subList.includes('<button'), 'sub-topic rows are not buttons');
});

test('every MOE topic Practises its own quest first; Reading also Practises 看图选词', () => {
  // MOE rebuild (2026-11-09): replaces the myKx version — every MOE
  // topic at every level Practises, including 0-questions-ready ones.
  // The one exception: chi-reading lists chi-picword as a second
  // Practise quest (2026-11-12) — 看图选词 has no skill of its own
  // in the per-level MOE list, so it lives under Reading as
  // vocabulary practice.
  for (let lv = 1; lv <= 6; lv++) {
    for (const s of MOE_SUBJECTS_BY_LEVEL[String(lv)]) {
      for (const t of s.topics) {
        assert.equal(t.quests[0], t.id, t.id + ' first quest is itself');
        if (t.id === 'chi-reading') assert.deepEqual(t.quests, ['chi-reading', 'chi-picword'], t.id + ' also Practises 看图选词');
        else assert.equal(t.quests.length, 1, t.id + ' has exactly one quest');
        const out = renderSubject(explorer({ level: 'P' + lv }), s.id, t.id);
        assert.ok(out.includes('Practise ' + t.name + ':'), t.id + ' shows its Practise heading');
        assert.ok(out.includes('data-quest="' + t.id + '"'), t.id + ' has a quest button');
      }
    }
  }
});

test('one quest per MOE topic; a shared fallback bank still means distinct quest ids', () => {
  // Reading, Speaking and Writing all fall back to eng-story2's bank,
  // but each MOE topic's quest id is its own — progress/completion is
  // tracked per MOE topic, never merged across them.
  for (const tid of ['eng-reading', 'eng-speaking', 'eng-writing']) {
    const out = renderSubject(explorer(), 'eng', tid);
    assert.ok(out.includes('data-quest="' + tid + '"'), tid + ' Practises its own quest id');
    assert.ok(!out.includes('data-quest="eng-story2"'), tid + ' never wires to the fallback id');
  }
});

/* --- preserved behaviour --------------------------------------------------- */
test('quest states survive: completed-today greys out with Replay; in-progress resumes', () => {
  const done = explorer({ completed: { 'eng-grammar': 5 }, completedDay: { 'eng-grammar': '2026-11-07' } });
  const outDone = renderSubject(done, 'eng', 'eng-grammar');
  assert.ok(outDone.includes('✔ Completed'), 'completed-today pill');
  assert.ok(outDone.includes('↻ Replay'), 'Replay button');
  const prog = explorer({ progress: { 'eng-grammar': { idx: 2, score: 2 } } });
  const outProg = renderSubject(prog, 'eng', 'eng-grammar');
  assert.ok(outProg.includes('▶ Resume quest'), 'in-progress resumes');
  assert.ok(outProg.includes('In progress — tap to resume at question 3'), 'resume position shown');
});

test('weak-boost badge and Pip shelf line survive on the new layout', () => {
  const flagged = explorer({ boost: { 'eng-grammar': { lastScore: 1, prevScore: 2, at: '2026-11-07T00:00:00.000Z' } } });
  const out = renderSubject(flagged, 'eng', 'eng-grammar');
  assert.ok(out.includes('🌱 Needs a boost'), 'boost badge on the flagged quest card');
  assert.ok(out.includes('data-boost="eng-grammar"'), 'boost button on the flagged quest card');
  assert.ok(out.includes('5 quick questions with Pip'), 'badge says what the boost is');
  const math = renderSubject(explorer(), 'math', 'math-mult-div-6789');
  assert.ok(math.includes('📚 Pip’s shelf'), 'server-bank line stays on a MOE Maths card');
  const chi = renderSubject(explorer(), 'chi', 'chi-listening');
  assert.ok(chi.includes('🔊 This quest has a Listen button'), 'Chinese Listen line stays');
  assert.ok(chi.includes('data-quest="chi-listening"'), 'Listening Practises its MOE quest id');
});

test('level switching: hero, chip and band sub-topics follow the level', () => {
  const p4 = explorer({ level: 'P4' });
  const out4 = renderSubject(p4, 'eng', 'eng-grammar');
  assert.ok(out4.includes('P4 English'), 'P4 subject hero');
  assert.ok(out4.includes('🎒 P4'), 'P4 level chip');
  // MOE rebuild (2026-11-09): English sub-topics change by band, not
  // by lock — P1/P2 show the Lower band, P3/P4 the Middle band,
  // P5/P6 the Upper band.
  const p1 = renderSubject(explorer({ level: 'P1' }), 'eng', 'eng-grammar');
  assert.ok(p1.includes('Metalanguage for talking about language at word and phrase level'), 'Lower-band grammar at P1');
  assert.ok(out4.includes('Metalanguage at text level; editing and self-correction'), 'Middle-band grammar at P4');
  const p5 = renderSubject(explorer({ level: 'P5' }), 'eng', 'eng-grammar');
  assert.ok(p5.includes('Strengthen grammatical metalanguage learnt before'), 'Upper-band grammar at P5');
  assert.ok(!p1.includes('Strengthen grammatical metalanguage learnt before'), 'P1 does not show Upper-band grammar');
});

/* --- wiring + no new persisted state --------------------------------------- */
test('bindLearn wires the new navigation; go() resets to the subject cards', () => {
  const bind = grabFn('bindLearn(');
  for (const attr of ['data-learn-subject', 'data-learn-back', 'data-learn-topic', 'data-learn-start']) {
    assert.ok(bind.includes(attr), 'bindLearn wires ' + attr);
  }
  assert.ok(bind.includes("document.querySelectorAll('[data-quest]')"), 'quest wiring kept');
  assert.ok(bind.includes("document.querySelectorAll('[data-boost]')"), 'boost wiring kept');
  assert.ok(bind.includes("getElementById('spAddBtn')"), 'spelling-tests add wiring kept');
  assert.ok(bind.includes("querySelectorAll('[data-spellopen]')"), 'spelling-tests practise wiring kept');
  const go = grabFn('go(');
  assert.ok(go.includes('window.scrollTo(0,0)'), 'go() still scrolls to the top');
  assert.ok(go.includes('learnView'), 'go() resets the Learn view');
  assert.ok(go.includes("r==='learn'"), 'reset only on entering Learn');
});

test('no new persisted fields: learnView is session-only', () => {
  const merge = grabFn('mergeExplorer(');
  assert.ok(!merge.includes('learnView'), 'merge never carries the Learn view');
  const saveGame = grabFn('saveGameProgress(');
  assert.ok(!saveGame.includes('learnView'), 'game progress never carries the Learn view');
  assert.ok(html.includes('var learnView={subject:null,openTopic:null};'), 'learnView declared session-only');
});
