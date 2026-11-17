// Quest counter (Bryan 2026-11-17: "Fix it") — Juhin's Home read
// "You have finished 30 of 14 quests" / "This is quest 31 of 14".
// The total was a hardcoded 14 from the old fixed quest list, while
// done counts distinct completed quest ids (30 for Juhin: MOE topic
// ids + legacy quest ids from the old Learn). The fix is one shared
// helper, questProgress(e) — done = distinct completed ids, total =
// the explorer's current level quest set (every MOE topic id at the
// level plus every quest id those topics map to in Learn) unioned
// with the completed ids, so done can never exceed total and the
// total is level-aware (P1/P2 have no Science). All four display
// sites (Home bubble, board line, Learn header, parent page) use it.
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
function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

// --- MOE data + helpers, straight from the page (harness copied from
// tests/learn-per-level.test.js) --------------------------------------
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
const SUBJECTS = eval('(' + grabLiteral('var SUBJECTS=') + ')');
const STUDY_PLAN = eval('(' + grabLiteral('var STUDY_PLAN=') + ')');
const studyPlanFor = eval('(' + grabFn('studyPlanFor(') + ')');
const planDayLabel = eval('(' + grabFn('planDayLabel(') + ')');
const planFor = eval('(' + grabFn('planFor(') + ')');
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
const questProgress = eval('(' + grabFn('questProgress(') + ')');
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

// Juhin's real completed keys (live family 8SXU6S, read 2026-11-17):
// 30 distinct ids — MOE topic ids plus legacy quest ids from the old
// Learn (eng-story, math-mrt, sci-frog, ...). The counter must keep
// all 30 counted and never read "30 of 14" again.
const JUHIN_COMPLETED = ['chi-char', 'chi-collocation', 'chi-family', 'chi-listen', 'chi-listening', 'chi-picword', 'chi-school', 'chi-sentence', 'chi-sequencing', 'chi-speaking', 'eng-punct', 'eng-spelling', 'eng-story', 'eng-story2', 'eng-tense', 'eng-visual', 'math-angles', 'math-area', 'math-bargraphs', 'math-frac', 'math-hawker', 'math-length', 'math-mrt', 'math-ntuc', 'math-time', 'sci-classification', 'sci-frog', 'sci-magnet', 'sci-materials', 'sci-plants'];
function completedMap(ids) { const o = {}; ids.forEach((id) => { o[id] = 5; }); return o; }
function levelSetIds(lv) {
  const s = {};
  moeSubjects(lv).forEach((sub) => sub.topics.forEach((tp) => { s[tp.id] = 1; (tp.quests || []).forEach((q) => { s[q] = 1; }); }));
  return Object.keys(s);
}

test('Juhin (P3, 30 mixed MOE + legacy completions) reads 30 of 55, never 30 of 14', () => {
  const qp = questProgress(explorer({ level: 'P3', completed: completedMap(JUHIN_COMPLETED) }));
  assert.equal(qp.done, 30, 'all 30 finished quests stay counted');
  assert.equal(qp.total, 55, 'P3 level set (32) + 23 legacy completions not in the current set');
  assert.ok(qp.done <= qp.total, 'done never exceeds total');
});

test('fresh explorers: the total is level-aware (P1 23, P2 26, P3 32, P4 36, P5 33, P6 28)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((lv) => questProgress(explorer({ level: 'P' + lv, completed: {} })).total),
    [23, 26, 32, 36, 33, 28], 'total differs by level — P1/P2 have no Science');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((lv) => questProgress(explorer({ level: 'P' + lv, completed: {} })).done),
    [0, 0, 0, 0, 0, 0], 'nothing done yet');
});

test('P1/P2 with legacy completions: the total grows with the completed ids, done stays ≤ total', () => {
  const p1 = questProgress(explorer({ level: 'P1', completed: completedMap(['eng-story', 'math-mrt', 'chi-listen', 'chi-char', 'eng-spelling']) }));
  assert.deepEqual([p1.done, p1.total], [5, 28], 'P1: 23 in the set + 5 legacy completions outside it');
  const p2 = questProgress(explorer({ level: 'P2', completed: completedMap(['eng-story', 'eng-story2', 'eng-spelling', 'eng-punct', 'math-mrt', 'math-ntuc', 'math-hawker', 'chi-listen', 'chi-char']) }));
  assert.deepEqual([p2.done, p2.total], [9, 35], 'P2: 26 in the set + 9 legacy completions outside it');
});

test('done ≤ total at every level even when every legacy quest is completed', () => {
  for (let lv = 1; lv <= 6; lv++) {
    const qp = questProgress(explorer({ level: 'P' + lv, completed: completedMap(REAL_IDS) }));
    assert.equal(qp.done, 31, 'P' + lv + ': all 31 legacy quests done');
    assert.ok(qp.total >= 31, 'P' + lv + ': total ' + qp.total + ' covers all 31');
  }
});

test('"finished everything" only when done === total (and total > 0)', () => {
  for (let lv = 1; lv <= 6; lv++) {
    const ids = levelSetIds(lv);
    assert.ok(ids.length > 0, 'P' + lv + ' has a non-empty quest set');
    const all = questProgress(explorer({ level: 'P' + lv, completed: completedMap(ids) }));
    assert.equal(all.done, all.total, 'P' + lv + ': completing the whole set finishes everything');
    const oneShort = completedMap(ids.slice(0, ids.length - 1));
    const almost = questProgress(explorer({ level: 'P' + lv, completed: oneShort }));
    assert.ok(almost.done < almost.total, 'P' + lv + ': one quest short is not "everything"');
  }
  const fresh = questProgress(explorer({ level: 'P3', completed: {} }));
  assert.ok(!(fresh.done === fresh.total), 'a fresh explorer has not finished everything');
});

test('Home bubble + board line use the helper — no hardcoded 14, "everything" only at done === total', () => {
  const home = fnBody('function homeHTML(){');
  assert.ok(home.includes('var qp=questProgress(e);'), 'Home computes the counter from questProgress');
  assert.ok(home.includes("qp.done+' of '+qp.total+' quests"), 'Home bubble shows done of total');
  assert.ok(home.includes('qp.done===qp.total'), '"finished EVERYTHING" fires only at done === total');
  assert.ok(home.includes("Math.min(qp.done+1,qp.total)+' of '+qp.total"), 'board line caps the next-quest number at the total');
  assert.ok(!home.includes('of 14'), 'no hardcoded 14 left in Home');
  assert.ok(!home.includes('doneCount'), 'the old doneCount variable is gone from Home');
});

test('Learn header uses the helper — no hardcoded 14', () => {
  const learn = fnBody('function learnHTML(){');
  assert.ok(learn.includes('var qp=questProgress(e);'), 'Learn computes the counter from questProgress');
  assert.ok(learn.includes("qp.done+' of '+qp.total+' quests finished"), 'Learn header shows done of total');
  assert.ok(!learn.includes('of 14'), 'no hardcoded 14 left in Learn');
  assert.ok(!learn.includes('doneCount'), 'the old doneCount variable is gone from Learn');
});

test('parent page uses the helper — no hardcoded 14', () => {
  const parent = html.slice(html.indexOf('function parentHTML'), html.indexOf('function bindParent'));
  assert.ok(parent.includes('var qp=questProgress(sel);'), 'parent page computes the counter from questProgress');
  assert.ok(parent.includes("qp.done+' of '+qp.total+' quests"), 'evening summary shows done of total');
  assert.ok(parent.includes("Learning quests finished: '+qp.done"), 'the balance line counts the same done');
  assert.ok(!parent.includes('of 14'), 'no hardcoded 14 left in the parent page');
});

test('no hardcoded 14 survives in any counter string in the file', () => {
  assert.ok(!html.includes('doneCount'), 'no doneCount variable remains anywhere');
  // "of 14 quests" may appear exactly once: inside the questProgress
  // comment that documents the bug it fixes. Every other counter
  // string must use the helper's total.
  const hits = [...html.matchAll(/of 14 quests/g)].map((m) => m.index);
  const commentStart = html.indexOf('/* Quest counter (2026-11-17)');
  const fnEnd = html.indexOf('\n}\n', html.indexOf('function questProgress('));
  assert.ok(commentStart >= 0 && fnEnd > commentStart, 'the questProgress comment + function are present');
  assert.ok(hits.length >= 1, 'the documenting comment is still there');
  hits.forEach((i) => assert.ok(i > commentStart && i < fnEnd, '"of 14 quests" at offset ' + i + ' is outside the questProgress comment'));
  assert.ok(!/of 14 —/.test(html), 'no "of 14 —" board line remains');
});

test('Learn landing really renders the helper numbers for Juhin', () => {
  const juhin = renderLanding(explorer({ level: 'P3', completed: completedMap(JUHIN_COMPLETED) }));
  assert.ok(juhin.includes('30 of 55 quests finished'), 'Juhin landing reads 30 of 55, got: ' + juhin.slice(0, 400));
  assert.ok(!juhin.includes('of 14 quests'), 'no 14 anywhere in the landing header');
  const fresh = renderLanding(explorer({ level: 'P3', completed: {} }));
  assert.ok(fresh.includes('0 of 32 quests finished'), 'a fresh P3 explorer reads 0 of 32');
});
