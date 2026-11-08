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
assert.equal(REAL_IDS.length, 14, '14 real topics in the file');

// --- MYKX data ------------------------------------------------------------
let MYKX_SUBJECTS = eval(grabLiteral('var MYKX_SUBJECTS='));

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
function topicById(id) { return FAKE_TOPICS.find((t) => t.id === id) || null; }
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
function hclEntryHTML() { return '<!--HCL-ENTRY-->'; }
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
  // One deliberate exception: Grammar/connectors is taught by the P4
  // Finish-the-Story bank (eng-story2), which lives outside Grammar's
  // own Practise quests. It is the ONLY cross-topic bank; the test
  // enforces that so a typo can never hide as a "cross-topic" map.
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
  assert.deepEqual(crossTopic, ['connectors'], 'connectors is the only cross-topic bank');
});

test('coverage counts match the doc table (per subject)', () => {
  const want = {
    eng: { yes: 5, p4: 2, partial: 10, no: 22 },
    math: { yes: 9, p4: 9, partial: 6, no: 43 },
    sci: { yes: 9, p4: 5, partial: 7, no: 17 },
    chi: { yes: 2, p4: 0, partial: 2, no: 13 },
  };
  for (const s of MYKX_SUBJECTS) {
    const c = { yes: 0, p4: 0, partial: 0, no: 0 };
    s.topics.forEach((t) => t.subs.forEach((sb) => { c[sb.cov]++; }));
    assert.deepEqual(c, want[s.id], s.id + ' coverage');
  }
  const total = { yes: 25, p4: 16, partial: 25, no: 95 };
  const all = { yes: 0, p4: 0, partial: 0, no: 0 };
  MYKX_SUBJECTS.forEach((s) => s.topics.forEach((t) => t.subs.forEach((sb) => { all[sb.cov]++; })));
  assert.deepEqual(all, total, '161 total: 25 yes + 16 P4-only + 25 partial + 95 without');
});

/* --- helpers: counts, pools, session -------------------------------------- */
test('subject counts: fresh explorer, 0 started, distinct pools only', () => {
  const e = explorer();
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('eng'), 3), { started: 0, total: 6, ready: 60, quests: 4 }, 'English: 4 distinct quests x 15');
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('math'), 3), { started: 0, total: 10, ready: 60, quests: 4 });
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('sci'), 3), { started: 0, total: 7, ready: 45, quests: 3 });
  assert.deepEqual(mykxSubjectCounts(e, mykxSubject('chi'), 3), { started: 0, total: 11, ready: 45, quests: 3 });
  // A quest shared by two topics counts once: MRT Numbers serves both
  // Numbers and Addition, so Maths ready is 4 x 15, not 5 x 15.
  assert.equal(mykxTopicPool(mykxTopic('math', 'math-numbers'), 3), 15, 'Numbers pool is one quest');
  assert.equal(mykxTopicPool(mykxTopic('math', 'math-addsub'), 3), 30, 'Addition pool is two quests');
  assert.equal(mykxTopicPool(mykxTopic('eng', 'eng-spelling'), 3), 0, 'Spelling has no pool');
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
  assert.equal(mykxSubNote(e, context, 3), 'Some questions ready', 'partial bank says so honestly');
  assert.equal(mykxSubNote(e, spelling, 3), 'Questions on the way');
  assert.equal(mykxSubReady(perfect, 3), false, 'perfect tense is P4-only');
  assert.equal(mykxSubNote(e, perfect, 3), 'Questions on the way');
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
  const allDone = explorer({ completedDay: { 'eng-tense': '2026-11-07', 'eng-punct': '2026-11-07', 'eng-story': '2026-11-07', 'eng-story2': '2026-11-07' } });
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
  assert.ok(out.includes('0 of 6 topics started · 60 questions ready'), 'English counts');
  assert.ok(out.includes('0 of 10 topics started · 60 questions ready'), 'Maths counts');
  assert.ok(out.includes('0 of 7 topics started · 45 questions ready'), 'Science counts');
  assert.ok(out.includes('0 of 11 topics started · 45 questions ready'), 'Chinese counts');
  assert.ok(out.includes('20 questions · about 12 minutes'), 'English session: 4 quests x 5, about 12 min');
  assert.ok(out.includes('15 questions · about 9 minutes'), 'Science session: 3 quests x 5, about 9 min');
  assert.ok(out.includes('🎒 P3'), 'level chip on the landing hero');
  assert.ok(out.includes('Frog Quest'), 'hero keeps the Frog Quest story');
  assert.ok(out.includes('<!--PLAN-BANNER-->'), 'study-plan banner stays on the landing');
  assert.ok(out.includes('<!--HCL-ENTRY-->'), 'spelling entry card stays on the landing');
  assert.ok(out.includes('<!--QUEST-BOARD-->'), 'quest leaderboard stays at the bottom');
  assert.ok(!out.includes('data-learn-topic'), 'no timeline rows on the landing');
  assert.ok(!out.includes('Questions on the way'), 'no locked-topic copy on the landing');
});

/* --- rendering: subject page ---------------------------------------------- */
test('subject page: hero, session panel, timeline rows, padlocks where no bank', () => {
  const out = renderSubject(explorer(), 'eng');
  assert.ok(out.includes('P3 English'), 'subject hero');
  assert.ok(out.includes('🎒 P3'), 'level chip on the subject hero');
  assert.ok(out.includes('Today’s English session'), 'side panel heading');
  assert.ok(out.includes('20 questions · about 12 minutes'), 'session count + estimate');
  assert.ok(out.includes('No evidence yet: your first session starts it.'), 'myKx no-evidence line');
  assert.ok(out.includes('data-learn-start="eng"'), 'Start session button');
  assert.ok(out.includes('Start session'), 'Start session label');
  assert.ok(out.includes('← All subjects'), 'back to the subject cards');
  for (const name of ['Grammar', 'Vocabulary', 'Spelling', 'Synthesis and word order', 'Visual text', 'Comprehension']) {
    assert.ok(out.includes(name), 'topic row: ' + name);
  }
  assert.ok(out.includes('19 sub-topics · 30 questions ready'), 'Grammar row counts');
  assert.ok(out.includes('1 sub-topics · Questions on the way'), 'Spelling row is locked');
  assert.ok(out.includes('🔒'), 'padlock node on locked topics');
  assert.ok(out.includes('▶'), 'play-triangle node on topics with questions');
  assert.ok(out.includes('Today’s session starts here'), 'session-start flag on the first topic');
  assert.ok(!out.includes('Tense simple present'), 'sub-topics hidden until the topic expands');
  assert.ok(!out.includes('▶ Start quest'), 'no quest cards until a topic expands');
  assert.ok(out.includes('<!--QUEST-BOARD-->'), 'leaderboard stays on the subject page too');
});

test('expanded topic: plain sub-topic list (not links) + Practise quest cards', () => {
  const out = renderSubject(explorer(), 'eng', 'eng-grammar');
  for (const name of ['Tense simple present', 'Tense perfect', 'Verb form', 'Punctuation', 'Question tags']) {
    assert.ok(out.includes(name), 'sub-topic listed: ' + name);
  }
  assert.ok(out.includes('Not yet assessed'), 'ready sub-topic note');
  assert.ok(out.includes('Questions on the way'), 'uncovered sub-topic note');
  assert.ok(out.includes('Some questions ready'), 'partial sub-topic note');
  assert.ok(out.includes('Practise Grammar:'), 'Practise heading');
  assert.ok(out.includes('Quest eng-tense'), 'Tenses Trek card');
  assert.ok(out.includes('Quest eng-punct'), 'Punctuation Pond card');
  assert.ok(out.includes('▶ Start quest'), 'Practise starts the quest');
  assert.ok(out.includes('data-quest="eng-tense"'), 'Practise wires to the quest');
  // Sub-topic rows are a plain list: <li> rows, never links or buttons.
  assert.ok(out.includes('<li><span>Tense simple present</span>'), 'sub-topic row is a plain list item');
  assert.ok(!out.includes('<a '), 'no anchor links anywhere on the Learn page');
  const subList = out.slice(out.indexOf('<ul class="learn-subs">'), out.indexOf('</ul>'));
  assert.ok(!subList.includes('data-quest'), 'sub-topic rows carry no Practise action');
  assert.ok(!subList.includes('<button'), 'sub-topic rows are not buttons');
});

test('expanded locked topic: sub-topics shown, no Practise link', () => {
  const out = renderSubject(explorer(), 'eng', 'eng-spelling');
  assert.ok(out.includes('<li><span>Spelling</span>'), 'locked topic still lists its sub-topic');
  assert.ok(out.includes('Questions on the way'), 'locked note');
  assert.ok(out.includes('No questions yet: on the way.'), 'myKx locked line');
  assert.ok(!out.includes('Practise Spelling:'), 'no Practise heading without a bank');
  assert.ok(!out.includes('data-quest='), 'no quest button without a bank');
});

test('expanded topic with two quests shows both cards; one quest shared by two topics', () => {
  const add = renderSubject(explorer(), 'math', 'math-addsub');
  assert.ok(add.includes('Quest math-mrt'), 'Addition shows MRT Numbers');
  assert.ok(add.includes('Quest math-ntuc'), 'Addition shows NTUC Totals');
  const comp = renderSubject(explorer(), 'eng', 'eng-comprehension');
  assert.ok(comp.includes('Quest eng-story2'), 'Comprehension Practise is Finish the Story');
  const synth = renderSubject(explorer(), 'eng', 'eng-synthesis');
  assert.ok(synth.includes('Quest eng-story2'), 'Synthesis Practise is the same quest');
});

/* --- preserved behaviour --------------------------------------------------- */
test('quest states survive: completed-today greys out with Replay; in-progress resumes', () => {
  const done = explorer({ completed: { 'eng-tense': 5 }, completedDay: { 'eng-tense': '2026-11-07' } });
  const outDone = renderSubject(done, 'eng', 'eng-grammar');
  assert.ok(outDone.includes('✔ Completed'), 'completed-today pill');
  assert.ok(outDone.includes('↻ Replay'), 'Replay button');
  const prog = explorer({ progress: { 'eng-tense': { idx: 2, score: 2 } } });
  const outProg = renderSubject(prog, 'eng', 'eng-grammar');
  assert.ok(outProg.includes('▶ Resume quest'), 'in-progress resumes');
  assert.ok(outProg.includes('In progress — tap to resume at question 3'), 'resume position shown');
});

test('weak-boost badge and live-gen line survive on the new layout', () => {
  const flagged = explorer({ boost: { 'eng-tense': { lastScore: 1, prevScore: 2, at: '2026-11-07T00:00:00.000Z' } } });
  const out = renderSubject(flagged, 'eng', 'eng-grammar');
  assert.ok(out.includes('🌱 Needs a boost'), 'boost badge on the flagged quest card');
  assert.ok(out.includes('data-boost="eng-tense"'), 'boost button on the flagged quest card');
  assert.ok(out.includes('5 quick questions with Pip'), 'badge says what the boost is');
  const live = renderSubject(explorer(), 'math', 'math-muldiv');
  assert.ok(live.includes('📚 Pip’s shelf'), 'server-bank line stays on the NTUC Totals card');
  const chi = renderSubject(explorer(), 'chi', 'chi-listening');
  assert.ok(chi.includes('🔊 This quest has a Listen button'), 'Chinese Listen line stays');
  assert.ok(chi.includes('Quest chi-listen'), 'Listening is unlocked here, unlike myKx');
});

test('level switching: P4 hero, chip and P4-only sub-topics open; P3 keeps them locked', () => {
  const p4 = explorer({ level: 'P4' });
  const out4 = renderSubject(p4, 'eng', 'eng-grammar');
  assert.ok(out4.includes('P4 English'), 'P4 subject hero');
  assert.ok(out4.includes('🎒 P4'), 'P4 level chip');
  const p3 = renderSubject(explorer(), 'eng', 'eng-grammar');
  assert.ok(p3.includes('Tense perfect</span><span class="subnote">Questions on the way</span>'), 'perfect tense locked at P3');
  assert.ok(out4.includes('Tense perfect</span><span class="subnote">Not yet assessed</span>'), 'perfect tense opens at P4');
});

/* --- wiring + no new persisted state --------------------------------------- */
test('bindLearn wires the new navigation; go() resets to the subject cards', () => {
  const bind = grabFn('bindLearn(');
  for (const attr of ['data-learn-subject', 'data-learn-back', 'data-learn-topic', 'data-learn-start']) {
    assert.ok(bind.includes(attr), 'bindLearn wires ' + attr);
  }
  assert.ok(bind.includes("document.querySelectorAll('[data-quest]')"), 'quest wiring kept');
  assert.ok(bind.includes("document.querySelectorAll('[data-boost]')"), 'boost wiring kept');
  assert.ok(bind.includes("getElementById('hclOpen')"), 'spelling entry wiring kept');
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
