// Weak-topic boost (2026-11-07, Bryan: flag to the parent AND auto kick
// in extra help for her): detection, the 5-question boost drill, flag
// clearing, the parent section, and the merge/sync of the new e.boost
// records. The detection rule mirrors lib/rules.js (stuck = under 3/5,
// flagged only after TWO stuck runs in a row).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = require('../lib/rules.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const TODAY = '2026-11-07';

// Brace-matching extractor (same pattern as tests/memory-merge.test.js):
// several page functions nest other declarations, so slicing to the next
// '\nfunction ' would cut them short.
function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found in index.html');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

function mkQ(prefix, i) {
  return { q: prefix + ' question ' + i + '?', o: ['A' + i, 'B' + i, 'C' + i, 'D' + i], a: 0, c: 'Clue for ' + prefix + ' ' + i, j: 'Why ' + prefix + ' ' + i };
}
const TOPIC = {
  id: 'eng-tense', sub: 'eng', subName: 'English', name: 'Tenses Trek',
  quest: [0, 1, 2, 3, 4].map((i) => mkQ('quest', i)),
  fresh: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => mkQ('fresh', i)),
  warm: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mkQ('warm', i)),
  retry: [0, 1, 2, 3, 4, 5].map((i) => mkQ('retry', i)),
};

/* --- finishRound execution harness ---------------------------------- */
// The eval'd page function closes over these module-level bindings.
let cur = null;
let EX = null;
let calls = null;
function ex() { return EX; }
function todayKey() { return TODAY; }
function levelNum() { return 3; }
function bankFor(t, k) { return (t && t[k]) || []; }
function questListFor(t, c) { return (c && c.boostList) || (t ? t.quest : []); }
function recordLearnBest() { return false; }
function earnStars(e, n) { e.stars = (e.stars || 0) + n; e.starsEarned = (e.starsEarned || 0) + n; }
function awardBadge(id) { calls.badges.push(id); }
function save() { calls.saves++; }
function sndFanfare() {}
function confettiStars() {}

const finishRound = eval('(' + grabFn('finishRound') + ')');

function explorer(over) {
  return Object.assign({
    id: 'e1', name: 'Test', stars: 0, starsEarned: 0, starsSpent: 0,
    badges: [], completed: {}, completedDay: {}, progress: {},
    stuck: [], stuckCount: {}, boost: {},
  }, over || {});
}
function runQuest(score, opts) {
  opts = opts || {};
  cur = {
    topicId: 'eng-tense', phase: 'quest', idx: 5, score: score,
    wrong: score < 5 ? [0] : [], picked: null, answered: true,
    pool: [0, 1, 2, 3, 4], fresh: false, answerSecs: 0, startedAt: null,
    missedExample: score < 3 ? { q: 'missed question?', a: 'right answer' } : null,
  };
  if (opts.phase) cur.phase = opts.phase;
  if (opts.boostList) cur.boostList = opts.boostList;
  calls = { badges: [], saves: 0 };
  finishRound(TOPIC);
  return EX.boost['eng-tense'];
}
function isActive(rec) {
  return !!rec && rec.lastScore < 3 && rec.prevScore != null && rec.prevScore < 3
    && !(rec.dismissedAt && rec.at && rec.dismissedAt >= rec.at)
    && !(rec.clearedAt && rec.at && rec.clearedAt >= rec.at);
}

test('detection: one stuck run never flags (one wobbly day is just a bad day)', () => {
  EX = explorer();
  const rec = runQuest(2);
  assert.equal(rec.lastScore, 2, 'latest quest score recorded');
  assert.equal(rec.prevScore, null, 'no previous run yet');
  assert.equal(rec.at, undefined, 'no flag date after a single stuck run');
  assert.equal(isActive(rec), false, 'not active');
});

test('detection: two stuck runs in a row flag, with the missed example and flag score', () => {
  EX = explorer();
  runQuest(2);
  const rec = runQuest(1);
  assert.ok(rec.at && rec.at.indexOf('20') === 0, 'flag date stamped on the second stuck run');
  assert.equal(rec.flagScore, 1, 'the score that set the flag');
  assert.equal(rec.prevScore, 2, 'first stuck run kept');
  assert.equal(rec.lastScore, 1, 'second stuck run kept');
  assert.deepEqual(rec.missed, { q: 'missed question?', a: 'right answer' }, 'the missed question is saved for the parent page');
  assert.equal(isActive(rec), true, 'active');
  // The page rule agrees with lib/rules.js on the same scores.
  assert.equal(R.isStuck(2), true, 'rules: 2/5 is stuck');
  assert.equal(R.stuckAfterRuns([2, 1]), true, 'rules: two stuck runs flag');
  assert.equal(R.stuckAfterRuns([2]), false, 'rules: one stuck run does not flag');
});

test('detection: a good run clears the flag, and a single 4/5 never flags', () => {
  EX = explorer();
  runQuest(2);
  runQuest(1);
  assert.equal(isActive(EX.boost['eng-tense']), true, 'flagged first');
  EX.stuck = ['eng-tense']; // legacy array entry, cleaned up by the good run
  const rec = runQuest(4);
  assert.ok(rec.clearedAt, 'clear timestamp stamped on the good run');
  assert.equal(isActive(rec), false, 'no longer active');
  assert.deepEqual(EX.stuck, [], 'legacy stuck entry removed by the good run');
  EX = explorer();
  runQuest(4);
  assert.equal(EX.boost['eng-tense'].at, undefined, 'a single 4/5 never flags');
  EX = explorer();
  runQuest(2);
  runQuest(3);
  assert.equal(EX.boost['eng-tense'].at, undefined, '2/5 then 3/5: the good run breaks the streak');
});

test('a Second Chance (retry) finish never clears a flag — even a perfect retry', () => {
  EX = explorer();
  runQuest(2);
  runQuest(1);
  assert.equal(isActive(EX.boost['eng-tense']), true, 'flagged first');
  cur = {
    topicId: 'eng-tense', phase: 'retry', idx: 3, score: 3,
    wrong: [], picked: null, answered: true, answerSecs: 0, startedAt: null,
  };
  calls = { badges: [], saves: 0 };
  finishRound(TOPIC);
  const rec = EX.boost['eng-tense'];
  assert.equal(rec.clearedAt, undefined, 'retry did not clear the flag');
  assert.equal(isActive(rec), true, 'still active after a 3/3 retry');
});

test('boost finish: 4/5 clears the flag and awards stars once per day', () => {
  EX = explorer();
  runQuest(2);
  runQuest(1);
  const list = TOPIC.retry.slice(0, 3).concat(TOPIC.fresh.slice(0, 2));
  const rec = runQuest(4, { phase: 'boost', boostList: list });
  assert.ok(rec.clearedAt, '4/5 clears the flag');
  assert.equal(isActive(rec), false, 'no longer active');
  assert.deepEqual(rec.lastBoost, { score: 4, day: TODAY, source: 'bank' }, 'drill recorded for the parent page');
  assert.equal(cur.starsEarned, 4, 'first boost of the day earns 4 stars');
  assert.equal(EX.stars, 6, 'stars added: 2 from the first quest run + 4 from the boost');
  // A second boost the same day earns no extra stars.
  const rec2 = runQuest(5, { phase: 'boost', boostList: list });
  assert.equal(cur.starsEarned, 0, 'replay boost earns no extra stars');
  assert.equal(EX.stars, 6, 'star total unchanged by the replay');
  assert.equal(rec2.starDay, TODAY, 'star day kept');
});

test('boost finish: below 4/5 keeps the flag and records the drill', () => {
  EX = explorer();
  runQuest(2);
  runQuest(1);
  const list = TOPIC.retry.slice(0, 3).concat(TOPIC.fresh.slice(0, 2));
  const rec = runQuest(2, { phase: 'boost', boostList: list });
  assert.equal(rec.clearedAt, undefined, '2/5 does not clear');
  assert.equal(isActive(rec), true, 'still active');
  assert.deepEqual(rec.lastBoost, { score: 2, day: TODAY, source: 'bank' }, 'drill recorded');
  assert.equal(cur.starsEarned, 2, 'the drill still earns its 2 stars the first time');
  // The parent trend stays quest-only: boost scores never touch lastScore.
  assert.equal(rec.lastScore, 1, 'last quest score untouched by the boost');
  assert.equal(rec.prevScore, 2, 'previous quest score untouched by the boost');
});

/* --- boostListFor ---------------------------------------------------- */
const boostListFor = eval([
  grabFn('bankFor'), grabFn('hashStr'), grabFn('seededShuffle'), grabFn('boostListFor'),
].join('\n') + '\n; boostListFor;');

test('boost drill: 5 questions, retry cousins first, then fresh, deterministic per day', () => {
  const a = boostListFor(TOPIC, 3, 'e1', TODAY);
  const b = boostListFor(TOPIC, 3, 'e1', TODAY);
  assert.equal(a.length, 5, 'five questions');
  assert.deepEqual(a, b, 'same day + topic + explorer gives the same drill');
  assert.ok(a.slice(0, 3).every((q) => TOPIC.retry.indexOf(q) >= 0), 'first three come from the retry bank');
  assert.ok(a.slice(3).every((q) => TOPIC.fresh.indexOf(q) >= 0), 'last two come from the fresh bank');
  assert.equal(new Set(a.map((q) => q.q)).size, 5, 'no repeats inside one drill');
  const otherDay = boostListFor(TOPIC, 3, 'e1', '2026-11-08');
  assert.notDeepEqual(otherDay, a, 'a different day draws a different drill');
});

test('boost drill: a tiny retry bank tops up from fresh so the drill still has 5', () => {
  const small = Object.assign({}, TOPIC, { retry: [mkQ('retry', 0)] });
  const list = boostListFor(small, 3, 'e1', TODAY);
  assert.equal(list.length, 5, '1 retry + 4 fresh');
  assert.equal(list[0].q, 'retry question 0?', 'the one retry question still leads');
});

/* --- mergeExplorer: boost records ------------------------------------ */
const mergeExplorer = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
].map(grabFn).join('\n') + '\n; mergeExplorer;');

function mergeBase(over) {
  return explorer(Object.assign({
    critterStage: 0, treasures: [], discoveredCritters: [],
    playDoneDay: {}, hclMissed: [], favAnswers: [], progress: {}, playProgress: {},
    playBest: {}, learnBest: {}, daily: {}, totalMinutes: 0, mood: {},
    threads: [], deletedThreadIds: [], flashcards: [], deletedFlashcards: [],
    planner: [], deletedPlanner: [], friends: [], deletedFriends: [],
    friendCode: 'ABCDEF', nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦',
    lookAt: null, critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
  }, over || {}));
}
function flaggedRec(over) {
  return Object.assign({
    at: '2026-11-07T10:00:00.000Z', flagScore: 1, prevScore: 2, lastScore: 1,
    lastDay: '2026-11-07', missed: { q: 'missed question?', a: 'right answer' },
  }, over || {});
}

test('merge: a flag set on one device survives a sync with a device that has no boost record', () => {
  const server = mergeBase({ boost: {} });
  const local = mergeBase({ boost: { 'eng-tense': flaggedRec() } });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.boost['eng-tense'].at, '2026-11-07T10:00:00.000Z', 'the flag is not wiped by the empty side');
  assert.equal(merged.boost['eng-tense'].flagScore, 1, 'flag score kept');
  assert.deepEqual(merged.boost['eng-tense'].missed, { q: 'missed question?', a: 'right answer' }, 'missed example kept');
});

test('merge: a clear on one device beats a still-active record on the stale device', () => {
  const server = mergeBase({ boost: { 'eng-tense': flaggedRec() } });
  const local = mergeBase({ boost: { 'eng-tense': flaggedRec({ lastScore: 4, lastDay: '2026-11-08', clearedAt: '2026-11-08T09:00:00.000Z' }) } });
  const merged = mergeExplorer(server, local);
  const rec = merged.boost['eng-tense'];
  assert.equal(rec.clearedAt, '2026-11-08T09:00:00.000Z', 'the clear timestamp survives');
  assert.equal(rec.lastScore, 4, 'the clearing run is the latest score');
  assert.equal(isActive(rec), false, 'merged record is inactive');
});

test('merge: a parent dismiss survives, and a fresh flag after it re-flags', () => {
  const server = mergeBase({ boost: { 'eng-tense': flaggedRec() } });
  const dismissed = flaggedRec({ dismissedAt: '2026-11-07T20:00:00.000Z' });
  const merged = mergeExplorer(server, mergeBase({ boost: { 'eng-tense': dismissed } }));
  assert.equal(merged.boost['eng-tense'].dismissedAt, '2026-11-07T20:00:00.000Z', 'dismissal is a timestamp, not a delete, so it syncs');
  assert.equal(isActive(merged.boost['eng-tense']), false, 'dismissed flag is inactive');
  // She gets stuck twice again after the dismiss: a newer at re-flags it.
  const reflagged = flaggedRec({ at: '2026-11-09T10:00:00.000Z', dismissedAt: '2026-11-07T20:00:00.000Z', lastDay: '2026-11-09' });
  const merged2 = mergeExplorer(mergeBase({ boost: { 'eng-tense': dismissed } }), mergeBase({ boost: { 'eng-tense': reflagged } }));
  assert.equal(merged2.boost['eng-tense'].at, '2026-11-09T10:00:00.000Z', 'the newer flag date wins');
  assert.equal(isActive(merged2.boost['eng-tense']), true, 're-flagged and active again');
});

test('merge: the latest quest run wins, and a second tab cannot wipe a flag', () => {
  const older = flaggedRec({ lastScore: 2, lastDay: '2026-11-06' });
  const newer = flaggedRec({ lastScore: 1, lastDay: '2026-11-07', at: '2026-11-07T10:00:00.000Z' });
  const merged = mergeExplorer(mergeBase({ boost: { 'eng-tense': older } }), mergeBase({ boost: { 'eng-tense': newer } }));
  assert.equal(merged.boost['eng-tense'].lastScore, 1, 'later day wins');
  assert.equal(merged.boost['eng-tense'].lastDay, '2026-11-07', 'later date kept');
  // Second tab with no boost record at all (stale tab saving): flag kept.
  const merged2 = mergeExplorer(mergeBase({ boost: { 'eng-tense': newer } }), mergeBase({ boost: {} }));
  assert.ok(merged2.boost['eng-tense'], 'a tab without the record cannot wipe it');
});

test('merge: legacy e.stuck entries are kept while flagged, dropped once the boost record clears them', () => {
  const withLegacy = mergeBase({ stuck: ['eng-tense'], boost: {} });
  const merged = mergeExplorer(withLegacy, mergeBase({}));
  assert.deepEqual(merged.stuck, ['eng-tense'], 'a legacy flag with no boost record yet stays');
  const cleared = mergeBase({
    stuck: ['eng-tense'],
    boost: { 'eng-tense': flaggedRec({ lastScore: 4, lastDay: '2026-11-08', clearedAt: '2026-11-08T09:00:00.000Z' }) },
  });
  const merged2 = mergeExplorer(cleared, mergeBase({}));
  assert.deepEqual(merged2.stuck, [], 'a cleared topic drops out of the legacy list, so a stale device cannot resurrect it');
});

/* --- quizDoneHTML: boost results screen ------------------------------- */
function esc(s) { return String(s == null ? '' : s); }
function pipSVG() { return ''; }
function fmtPlaySecs(s) { return s + 's'; }
const quizDoneHTML = eval('(' + grabFn('quizDoneHTML') + ')');

test('boost results: 4/5 says the flag is cleared and shows honest stars', () => {
  EX = explorer({ boost: { 'eng-tense': flaggedRec({ clearedAt: '2026-11-07T12:00:00.000Z', lastScore: 4 }) } });
  cur = { topicId: 'eng-tense', phase: 'boost', score: 4, starsEarned: 4, boostList: TOPIC.retry.slice(0, 3).concat(TOPIC.fresh.slice(0, 2)) };
  const out = quizDoneHTML(TOPIC);
  assert.ok(out.indexOf('Pip’s Boost complete!') >= 0, 'boost results heading');
  assert.ok(out.indexOf('took it off the boost list') >= 0, 'cleared wording');
  assert.ok(out.indexOf('earned ⭐ 4 stars!') >= 0, 'stars earned');
  assert.ok(out.indexOf('id="doneHome"') >= 0, 'back to Learn button');
});

test('boost results: below 4/5 says the flag stays, and a replay earns no extra stars', () => {
  EX = explorer({ boost: { 'eng-tense': flaggedRec() } });
  cur = { topicId: 'eng-tense', phase: 'boost', score: 2, starsEarned: 2, boostList: TOPIC.retry.slice(0, 3).concat(TOPIC.fresh.slice(0, 2)) };
  const out = quizDoneHTML(TOPIC);
  assert.ok(out.indexOf('keep it on the boost list') >= 0, 'still-wobbly wording');
  assert.ok(out.indexOf('earned ⭐ 2 stars!') >= 0, 'first boost earns its stars');
  cur.starsEarned = 0;
  cur.firstToday = false;
  const out2 = quizDoneHTML(TOPIC);
  assert.ok(out2.indexOf('no extra stars this time') >= 0, 'a replay says plainly it earned nothing extra');
});

test('boost results: a 0-star first drill is encouraged, not called a replay', () => {
  EX = explorer({ boost: { 'eng-tense': flaggedRec() } });
  cur = { topicId: 'eng-tense', phase: 'boost', score: 0, starsEarned: 0, firstToday: true, boostList: TOPIC.retry.slice(0, 3).concat(TOPIC.fresh.slice(0, 2)) };
  const out = quizDoneHTML(TOPIC);
  assert.ok(out.indexOf('no stars this time, but you kept going!') >= 0, 'a first 0/5 gets encouragement');
  assert.ok(out.indexOf('already earned them today') < 0, 'it is not called a replay');
});

test('quest results: a 0-star first quest is encouraged, a 0-star replay says so plainly', () => {
  EX = explorer();
  runQuest(0);
  let out = quizDoneHTML(TOPIC);
  assert.ok(out.indexOf('no stars this time, but finishing the whole quest takes courage!') >= 0, 'a first 0/5 gets encouragement');
  assert.ok(out.indexOf('already earned them today') < 0, 'it is not called a replay');
  runQuest(0);
  out = quizDoneHTML(TOPIC);
  assert.ok(out.indexOf('a replay, so no extra stars this time') >= 0, 'a replay scoring 0 still says plainly it earned nothing extra');
});

/* --- rendering: the three surfaces exist, with kind child wording ----- */
test('home shows a Pip’s Boost card with a Start button (never fail/shame wording)', () => {
  const home = fnBody('function homeHTML(){');
  assert.ok(home.indexOf('🌱 Pip’s Boost') >= 0, 'Home boost card heading');
  assert.ok(home.indexOf('data-boost') >= 0, 'boost buttons carry data-boost');
  assert.ok(home.indexOf('Start my boost') >= 0, 'start button');
  assert.ok(home.indexOf('tricky bits need a few more tries') >= 0, 'kind wording for the child');
  assert.ok(home.indexOf('never blocks your normal quests') >= 0, 'boost never blocks quests');
});

test('learn shows a Needs-a-boost badge and button on flagged topics', () => {
  const learn = fnBody('function learnHTML(){');
  assert.ok(learn.indexOf('🌱 Needs a boost') >= 0, 'Learn badge');
  assert.ok(learn.indexOf('data-boost') >= 0, 'boost button on the topic card');
  assert.ok(learn.indexOf('5 quick questions with Pip') >= 0, 'badge says what the boost is');
});

test('quiz tip screen: Pip explains before the drill, with Start and Maybe later', () => {
  const quiz = fnBody('function quizHTML(){');
  assert.ok(quiz.indexOf('id="boostStart"') >= 0, 'tip screen has a Start button');
  assert.ok(quiz.indexOf('id="boostLater"') >= 0, 'tip screen has a Maybe later button');
  assert.ok(quiz.indexOf('Pip’s Boost — ') >= 0, 'tip screen is titled as a boost');
  assert.ok(quiz.indexOf('tripped you up') >= 0, 'tip names the missed question');
});

test('parent page: Needs-a-boost section with accuracy, missed example, date, trend and dismiss', () => {
  const parent = fnBody('function parentHTML(){');
  assert.ok(parent.indexOf('🌱 Needs a boost') >= 0, 'parent section heading');
  assert.ok(parent.indexOf('Last two quests: ') >= 0, 'accuracy shown');
  assert.ok(parent.indexOf('Last trip-up: ') >= 0, 'missed example shown');
  assert.ok(parent.indexOf('Flagged ') >= 0, 'flag date shown');
  assert.ok(parent.indexOf('Trend: ') >= 0, 'trend shown');
  assert.ok(parent.indexOf('data-boost-dismiss') >= 0, 'dismiss button');
  const bind = fnBody('function bindParent(){');
  assert.ok(bind.indexOf('data-boost-dismiss') >= 0, 'dismiss is wired in bindParent');
  assert.ok(bind.indexOf('dismissedAt') >= 0, 'dismiss stamps dismissedAt, never deletes');
});

test('wiring: home and learn bind the boost buttons; saveGameProgress stays boost-free', () => {
  const bindH = fnBody('function bindHome(){');
  assert.ok(bindH.indexOf("document.querySelectorAll('[data-boost]')") >= 0, 'Home wires data-boost');
  const bindL = fnBody('function bindLearn(){');
  assert.ok(bindL.indexOf("document.querySelectorAll('[data-boost]')") >= 0, 'Learn wires data-boost');
  const saveGame = fnBody('function saveGameProgress(){');
  assert.ok(saveGame.indexOf('boost') < 0, 'boost records live on the explorer via save(), not in game progress');
  const merge = fnBody('function mergeExplorer(a,b){');
  assert.ok(merge.indexOf('e.boost=') >= 0, 'merge carries the boost records');
  assert.ok(merge.indexOf('dismissedAt') >= 0, 'merge keeps dismissals');
  assert.ok(merge.indexOf('clearedAt') >= 0, 'merge keeps clears');
});

test('finishRound no longer writes the legacy stuck fields on a quest finish', () => {
  const finish = fnBody('function finishRound(t){');
  assert.ok(finish.indexOf('e.boost[cur.topicId]') >= 0, 'quest finish writes the boost record');
  assert.ok(finish.indexOf('e.stuck.push') < 0, 'quest finish no longer pushes to the unmerged e.stuck array');
  assert.ok(finish.indexOf('stuckCount[cur.topicId]=(e.stuckCount') < 0, 'quest finish no longer increments the resurrecting stuckCount');
});
