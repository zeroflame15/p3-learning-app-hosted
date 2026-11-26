// Starlight Pond — week-4 novelty refresh (approved 2026-11-26)
// Master plan Pillar 6 / Phase 2: at week 4 a new world area and a
// new quest arc land, exactly when engagement dips (Rodrigues et
// al. 2022). Greg's Starlight Pond: the pond lights went out just
// before the December holidays. Four chapters, one per subject, in
// story order — each chapter is ONE quest on a level-aware MOE
// topic. Finishing a chapter lights one piece of the pond;
// finishing all four lights the whole pond. Gated to 2026-12-01,
// never disappears. No stars anywhere — the pond is mastery-tied,
// never star-gated (plan §3.1/§3.2). The frog is untouched: no
// evolution, no new stages (Bryan parked the critter evolution
// design 2026-11-17). One new field, arcSeenDay (the day the "New
// world unlocked" banner was seen), merged later-date-wins like
// windDownDay. Progress is derived from the existing completedDay
// record, so a quest finished on the board counts too.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grabFn(name) {
  // Match the exact name: the '(' right after it, so 'moeSubject'
  // never grabs 'moeSubjects'.
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function grabArr(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}
function grabObjLiteral(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const open = html.indexOf('{', start);
  let i = open;
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(open, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}

const ARC_START = html.match(/var ARC_START='([^']+)'/)[1];
const ARC_NAME = html.match(/var ARC_NAME='([^']+)'/)[1];
const ARC_CHAPTERS = eval(grabArr('ARC_CHAPTERS') + '\n;ARC_CHAPTERS');
const MOE_SUBJECTS_BY_LEVEL = eval('(' + grabObjLiteral('MOE_SUBJECTS_BY_LEVEL') + ')');
const SUBJECTS = { eng: 'English', math: 'Maths', sci: 'Science', chi: 'Chinese' };

function todayKey() { return '2026-12-03'; }
function esc(s) { return String(s == null ? '' : s); }

const { arcAvailable, arcTopicFor, arcChapters, arcChapterDone, arcProgress } = eval([
  grabFn('levelNum'), grabFn('schoolTermOf'), grabFn('moeInSeason'),
  grabFn('moeSubjects'), grabFn('moeSubject'), grabFn('arcAvailable'),
  grabFn('arcTopicFor'), grabFn('arcChapters'), grabFn('arcChapterDone'), grabFn('arcProgress'),
].join('\n') + '\n; ({ arcAvailable, arcTopicFor, arcChapters, arcChapterDone, arcProgress });');

function explorer(over) {
  return Object.assign({
    id: 'e1', name: 'Juhin', level: 'P3', critterName: 'Greg Washington',
    stars: 0, starsEarned: 0, badges: [], completed: {}, completedDay: {},
    progress: {}, boost: {}, arcSeenDay: null,
  }, over || {});
}
function allFourDone(e) {
  const days = {};
  arcChapters(e, '2026-12-05').forEach(function (c, i) { days[c.topicId] = '2026-12-0' + (2 + i); });
  return days;
}

// ------------------------------------------------------- gating + data

test('gating: ARC_START is 2026-12-01; hidden before, visible from Dec 1, never disappears', () => {
  assert.equal(ARC_START, '2026-12-01', 'week 4 (plan started Nov 10) is the week of Dec 1–7');
  assert.equal(arcAvailable('2026-11-30'), false, 'still November: no pond yet');
  assert.equal(arcAvailable('2026-12-01'), true, 'Dec 1: the pond surfaces');
  assert.equal(arcAvailable('2026-12-07'), true, 'still there at the end of week 4');
  assert.equal(arcAvailable('2027-06-01'), true, 'no time bomb — the refresh never disappears');
});

test('ARC_CHAPTERS: four chapters, one per subject, in story order; no stars, no evolution', () => {
  assert.ok(ARC_NAME.indexOf('Starlight Pond') >= 0, 'the pond is named: ' + ARC_NAME);
  assert.equal(ARC_CHAPTERS.length, 4, 'four chapters');
  assert.deepEqual(ARC_CHAPTERS.map(function (c) { return c.sub; }), ['eng', 'math', 'sci', 'chi'], 'story order: English, Maths, Science, Chinese');
  for (const c of ARC_CHAPTERS) {
    assert.ok(typeof c.title === 'string' && c.title.length > 3, 'a chapter title: ' + c.title);
    assert.ok(typeof c.emoji === 'string' && c.emoji.length > 0, 'a chapter emoji');
    assert.ok(typeof c.piece === 'string' && c.piece.length > 3, 'a pond piece: ' + c.piece);
    assert.ok(typeof c.pieceEmoji === 'string' && c.pieceEmoji.length > 0, 'a piece emoji');
    assert.ok(typeof c.blurb === 'string' && c.blurb.length > 20, 'a story blurb');
    assert.equal(c.cost, undefined, 'no star cost on a chapter: ' + c.title);
    assert.equal(c.stars, undefined, 'no star price anywhere in the arc');
  }
});

test('the refresh never touches the frog or the star economy', () => {
  const arcSrc = html.slice(html.indexOf('/* ============================================================ STARLIGHT POND'), html.indexOf('/* ============================================================ TREASURE REALM'));
  assert.ok(arcSrc.length > 1000, 'the arc block is found');
  assert.ok(!arcSrc.includes('critterStage'), 'no critter stage in the arc');
  assert.ok(!/evolve/i.test(arcSrc), 'no evolution mechanics in the arc — Bryan parked that');
  assert.ok(!arcSrc.includes('variant'), 'no critter variants in the arc');
  assert.ok(!arcSrc.includes('spendStars'), 'the pond never spends stars');
  assert.ok(!arcSrc.includes('earnStars'), 'the pond never earns stars');
  assert.ok(!arcSrc.includes('cost'), 'nothing in the pond has a cost');
});

// ------------------------------------------------------- topic mapping

test('arcTopicFor (P3, Dec): one quest topic per subject, each with a local question bank', () => {
  const e = explorer({ level: 'P3' });
  assert.equal(arcTopicFor(e, 'eng', '2026-12-03'), 'eng-reading');
  assert.equal(arcTopicFor(e, 'math', '2026-12-03'), 'math-whole-10000');
  assert.equal(arcTopicFor(e, 'sci', '2026-12-03'), 'sci-diversity-living');
  assert.equal(arcTopicFor(e, 'chi', '2026-12-03'), 'chi-listening');
  // Each picked topic carries a local fallback bank, so the quest has
  // questions ready even offline — the arc never serves a 0-question topic.
  for (const sub of ['eng', 'math', 'sci', 'chi']) {
    const tid = arcTopicFor(e, sub, '2026-12-03');
    const subj = MOE_SUBJECTS_BY_LEVEL['3'].find(function (s) { return s.id === sub; });
    const tp = subj.topics.find(function (t) { return t.id === tid; });
    assert.ok(tp.fallback, tid + ' has a local fallback bank');
    assert.ok(html.indexOf("id:'" + tp.fallback + "'") >= 0, 'fallback ' + tp.fallback + ' exists in the local bank');
  }
});

test('arcTopicFor is level-aware: P1/P2 have no Science chapter; P6 gets its own topics', () => {
  const p1 = explorer({ level: 'P1' });
  assert.equal(arcTopicFor(p1, 'sci', '2026-12-03'), null, 'Science is not taught in P1');
  assert.equal(arcTopicFor(p1, 'eng', '2026-12-03'), 'eng-reading');
  assert.equal(arcTopicFor(p1, 'math', '2026-12-03'), 'math-whole-100');
  const p2 = explorer({ level: 'P2' });
  assert.equal(arcTopicFor(p2, 'sci', '2026-12-03'), null, 'Science is not taught in P2');
  assert.equal(arcTopicFor(p2, 'math', '2026-12-03'), 'math-whole-1000');
  const p6 = explorer({ level: 'P6' });
  assert.equal(arcTopicFor(p6, 'sci', '2026-12-03'), 'sci-forces');
  assert.equal(arcTopicFor(p6, 'math', '2026-12-03'), 'math-frac-divide');
});

test('arcChapters: P3 gets 4 numbered chapters in story order; P1 gets 3 (no Science)', () => {
  const p3 = arcChapters(explorer({ level: 'P3' }), '2026-12-03');
  assert.equal(p3.length, 4);
  assert.deepEqual(p3.map(function (c) { return c.sub; }), ['eng', 'math', 'sci', 'chi']);
  assert.deepEqual(p3.map(function (c) { return c.n; }), [1, 2, 3, 4]);
  assert.equal(p3[0].title, 'The Story Lantern');
  assert.equal(p3[3].piece, 'Star Bridge Rises');
  const p1 = arcChapters(explorer({ level: 'P1' }), '2026-12-03');
  assert.equal(p1.length, 3);
  assert.deepEqual(p1.map(function (c) { return c.sub; }), ['eng', 'math', 'chi']);
  assert.deepEqual(p1.map(function (c) { return c.n; }), [1, 2, 3]);
});

// ------------------------------------------------------- progress

test('arcProgress derives from completedDay: only finishes on/after Dec 1 count', () => {
  const e = explorer({ level: 'P3' });
  let p = arcProgress(e, '2026-12-03');
  assert.equal(p.done, 0, 'nothing done yet');
  assert.equal(p.total, 4);
  assert.equal(p.complete, false);
  assert.equal(p.next.sub, 'eng', 'chapter 1 is next');
  // A November finish does NOT light the piece — the arc is a December story.
  e.completedDay = { 'eng-reading': '2026-11-30' };
  p = arcProgress(e, '2026-12-03');
  assert.equal(p.done, 0, 'a Nov 30 finish does not count');
  assert.equal(p.next.sub, 'eng');
  // Replaying it in December lights it (the board already replays finished quests as a fresh set).
  e.completedDay = { 'eng-reading': '2026-12-03' };
  p = arcProgress(e, '2026-12-03');
  assert.equal(p.done, 1);
  assert.equal(p.next.sub, 'math', 'chapter 2 is next once chapter 1 is lit');
  assert.equal(p.chapters[0].done, true);
  assert.equal(p.chapters[1].done, false);
  // A quest finished on the board counts too — progress is not tied to the arc card.
  e.completedDay['math-whole-10000'] = '2026-12-02';
  p = arcProgress(e, '2026-12-03');
  assert.equal(p.done, 2);
});

test('arcProgress: all four done means complete, and there is no next chapter', () => {
  const e = explorer({ level: 'P3', completedDay: allFourDone(explorer({ level: 'P3' })) });
  const p = arcProgress(e, '2026-12-05');
  assert.equal(p.done, 4);
  assert.equal(p.total, 4);
  assert.equal(p.complete, true);
  assert.equal(p.next, null);
});

test('arcChapterDone: false for a missing record, a null explorer, or a pre-December finish', () => {
  const ch = { topicId: 'eng-reading' };
  assert.equal(arcChapterDone(null, ch), false, 'no explorer');
  assert.equal(arcChapterDone(explorer({}), ch), false, 'no completedDay at all');
  assert.equal(arcChapterDone(explorer({ completedDay: { 'eng-reading': '2026-11-20' } }), ch), false, 'November does not count');
  assert.equal(arcChapterDone(explorer({ completedDay: { 'eng-reading': '2026-12-01' } }), ch), true, 'Dec 1 itself counts');
});

// ------------------------------------------------------- merge + defaults

// Same mergeExplorer eval chain as tests/wind-down-cue.test.js.
const mergeExplorer = eval(
  fnText('function unionArr(a,b){') + '\n' +
  fnText('function unionObjMax(a,b){') + '\n' +
  fnText('function unionObjLatest(a,b){') + '\n' +
  fnText('function isThinkingMsg(m){') + '\n' +
  fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
  fnText('function pickCritterName(a,b){') + '\n' +
  fnText('function mergeCare(a,b){') + '\n' +
  fnText('function hashStr(s){') + '\n' +
  fnText('function flashcardId(f, b, n){') + '\n' +
  fnText('function stampFlashcardIds(e){') + '\n' +
  fnText('function bridgeFlashcardTombstones(e){') + '\n' +
  fnText('function mergeExplorer(a,b){') + '\n' +
  ';mergeExplorer;'
);

function mergeBase(over) {
  return Object.assign({
    name: 'Juhin', nameAt: null, glow: '#ffb020', badge: '⭐', lookAt: null,
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [],
    progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads: [], threadsClearedAt: null, deletedThreadIds: [],
    flashcards: [], deletedFlashcards: [], planner: [], deletedPlanner: [],
    critterName: 'Greg Washington', critterNameAt: null, care: {}, careGrewDay: null,
    streak: 0, streakLongest: 0, streakLastDate: null, streakFreezes: 1,
    streakFreezeWeek: null, streakLost: 0, streakRepairUntil: null, streakFreezeUsedDay: null,
  }, over || {});
}

test('new explorers start with arcSeenDay null; merge keeps the later seen day and never invents it', () => {
  assert.ok(html.includes('arcSeenDay:null'), 'new explorers start with no seen day');
  const a = mergeBase({ arcSeenDay: '2026-12-01' });
  const b = mergeBase({ arcSeenDay: null });
  assert.equal(mergeExplorer(a, b).arcSeenDay, '2026-12-01', 'the flag survives when one side holds it');
  assert.equal(mergeExplorer(b, a).arcSeenDay, '2026-12-01', 'argument order must not matter');
  const earlier = mergeBase({ arcSeenDay: '2026-12-01' });
  const later = mergeBase({ arcSeenDay: '2026-12-03' });
  assert.equal(mergeExplorer(earlier, later).arcSeenDay, '2026-12-03', 'the later date wins');
  assert.equal(mergeExplorer(later, earlier).arcSeenDay, '2026-12-03', 'the later date wins either way round');
  const legacyA = mergeBase({});
  const legacyB = mergeBase({});
  delete legacyA.arcSeenDay;
  delete legacyB.arcSeenDay;
  assert.equal(mergeExplorer(legacyA, legacyB).arcSeenDay, undefined, 'a merge never invents the field on legacy explorers');
});

// ------------------------------------------------------- Home: banner + card

test('homeHTML wires the banner above the hero and the arc card after the quest board', () => {
  const homeSrc = fnText('function homeHTML(){');
  assert.ok(homeSrc.includes('var arcBanner=arcBannerHTML(e);'), 'the banner is built');
  assert.ok(homeSrc.includes('var arcCard=arcCardHTML(e);'), 'the arc card is built');
  assert.ok(homeSrc.includes('return lvlPrompt+arcBanner+hero'), 'the banner sits above the hero');
  assert.ok(homeSrc.indexOf('+ boardSection') < homeSrc.indexOf('+ arcCard'), 'the arc card follows the quest board');
  assert.ok(homeSrc.indexOf('+ arcCard') < homeSrc.indexOf('+ boostCard'), 'the arc card comes before the boost card');
});

const arcBannerHTML = eval('(' + grabFn('arcBannerHTML') + ')');

test('arcBannerHTML: the moment shows from Dec 1 until seen, then never again', () => {
  assert.equal(arcBannerHTML(explorer({}), '2026-11-30'), '', 'nothing before Dec 1');
  assert.equal(arcBannerHTML(explorer({ arcSeenDay: '2026-12-01' }), '2026-12-03'), '', 'seen once, never again');
  const out = arcBannerHTML(explorer({ critterName: 'Greg Washington' }), '2026-12-01');
  assert.ok(out.includes('NEW WORLD UNLOCKED'), 'the moment is named');
  assert.ok(out.includes('Starlight Pond'), 'the pond is named');
  assert.ok(out.includes('data-arc-explore'), 'an Explore button');
  assert.ok(out.includes('Explore the new pond'), 'the button says what it does');
  assert.ok(out.includes('data-arc-later'), 'a Maybe later button');
  assert.ok(out.includes('Greg'), 'the banner uses the frog’s real name');
  assert.ok(!out.includes('Greg Washington'), 'first name only, like the streak mood line');
});

function topicById(id) { return { name: 'Topic ' + id }; } // eslint-disable-line no-unused-vars
const arcCardHTML = eval('(' + grabFn('arcCardHTML') + ')');

test('arcCardHTML: hidden before Dec 1 and until seen; then the next chapter, with a replay label for a November finish', () => {
  assert.equal(arcCardHTML(explorer({}), '2026-11-30'), '', 'hidden before Dec 1');
  assert.equal(arcCardHTML(explorer({ arcSeenDay: null }), '2026-12-03'), '', 'hidden until the banner is seen');
  const card = arcCardHTML(explorer({ arcSeenDay: '2026-12-01' }), '2026-12-03');
  assert.ok(card.includes('Chapter 1 of 4'), 'the next chapter is named');
  assert.ok(card.includes('The Story Lantern'), 'the chapter title shows');
  assert.ok(card.includes('data-quest="eng-reading"'), 'the chapter starts its quest');
  assert.ok(card.includes('Start this chapter'), 'a fresh chapter button');
  assert.ok(card.includes('0 of 4 pond pieces lit'), 'progress shows');
  // A topic finished in November is NOT lit — but the button offers a replay, not a free light.
  const replay = arcCardHTML(explorer({ arcSeenDay: '2026-12-01', completed: { 'eng-reading': 5 }, completedDay: { 'eng-reading': '2026-11-20' } }), '2026-12-03');
  assert.ok(replay.includes('Replay to light it up'), 'a November finish becomes a replay');
  assert.ok(replay.includes('0 of 4 pond pieces lit'), 'and it is still unlit until replayed');
});

test('arcCardHTML: a finished arc becomes a small fully-lit card with no quest button', () => {
  const done = arcCardHTML(explorer({ arcSeenDay: '2026-12-01', completedDay: allFourDone(explorer({ level: 'P3' })) }), '2026-12-05');
  assert.ok(done.includes('fully lit'), 'the finished arc celebrates');
  assert.ok(done.includes('data-go2="treasure"'), 'it points at the pond');
  assert.ok(!done.includes('data-quest'), 'no quest button once the pond is lit');
});

test('bindHome: both banner buttons stamp the seen day and re-fetch the explorer at click time', () => {
  const bind = fnText('function bindHome(){');
  assert.ok(bind.includes("document.querySelectorAll('[data-arc-explore]')"), 'Explore is wired');
  assert.ok(bind.includes("document.querySelectorAll('[data-arc-later]')"), 'Maybe later is wired');
  assert.ok(bind.includes("e.arcSeenDay=todayKey(); save(); go('treasure');"), 'Explore stamps, saves and opens the pond');
  assert.ok(!bind.includes("sndPop(); go('treasure')"), 'no pop before the navigation — go() plays the one nav sound (Nov 22 polish)');
  assert.ok(bind.includes("e.arcSeenDay=todayKey(); save(); sndPop(); render();"), 'Later stamps, saves, pops and re-renders');
});

// ------------------------------------------------------- Treasure: the pond

test('treasureHTML puts the pond first, before the star collection', () => {
  const tSrc = fnText('function treasureHTML(){');
  assert.ok(tSrc.includes('+ starlightPondHTML(e)'), 'the pond section renders in Treasure Realm');
  assert.ok(tSrc.indexOf('starlightPondHTML(e)') < tSrc.indexOf('Treasure collection'), 'the pond comes before the star shop');
});

const starlightPondHTML = eval('(' + grabFn('starlightPondHTML') + ')');

test('starlightPondHTML: hidden before Dec 1; four dim pieces, progress, and the next chapter after', () => {
  assert.equal(starlightPondHTML(explorer({}), '2026-11-30'), '', 'the pond is hidden before Dec 1');
  const pond = starlightPondHTML(explorer({ level: 'P3' }), '2026-12-03');
  assert.ok(pond.includes('Starlight Pond'), 'the area is named');
  assert.ok(pond.includes('Lily Pads Bloom'), 'piece 1 shows');
  assert.ok(pond.includes('Fireflies Arrive'), 'piece 2 shows');
  assert.ok(pond.includes('Waterfall Wakes'), 'piece 3 shows');
  assert.ok(pond.includes('Star Bridge Rises'), 'piece 4 shows');
  assert.ok(pond.includes('0 / 4'), 'progress starts at zero');
  assert.ok(!pond.includes('pondpiece lit'), 'no piece is lit yet');
  assert.ok(pond.includes('data-quest="eng-reading"'), 'the next chapter starts from the pond');
  assert.ok(pond.includes('no stars needed'), 'the pond says plainly that no stars are needed');
  assert.ok(!pond.includes('Costs'), 'no star prices in the pond section');
});

test('starlightPondHTML: a finished chapter lights its piece and advances the next chapter', () => {
  const pond1 = starlightPondHTML(explorer({ level: 'P3', completedDay: { 'eng-reading': '2026-12-02' } }), '2026-12-03');
  assert.ok(pond1.includes('pondpiece lit'), 'a finished chapter lights its piece');
  assert.ok(pond1.includes('✔ Lit by Chapter 1'), 'the lit piece says so');
  assert.ok(pond1.includes('1 / 4'), 'progress counts up');
  assert.ok(pond1.includes('data-quest="math-whole-10000"'), 'the next chapter is Maths now');
  const pondDone = starlightPondHTML(explorer({ level: 'P3', completedDay: allFourDone(explorer({ level: 'P3' })) }), '2026-12-05');
  assert.ok(pondDone.includes('fully lit'), 'the finished pond celebrates');
  assert.ok(!pondDone.includes('data-quest'), 'no quest button once complete');
  const pondP1 = starlightPondHTML(explorer({ level: 'P1' }), '2026-12-03');
  assert.ok(pond1.includes('Waterfall Wakes'), 'sanity: the P3 pond has the waterfall piece');
  assert.ok(!pondP1.includes('Waterfall Wakes'), 'P1 has no Science piece — only three pieces');
  assert.ok(pondP1.includes('0 / 3'), 'P1 progress is out of three');
});

test('bindTreasure: chapter buttons start the quest and stamp the seen day', () => {
  const bind = fnText('function bindTreasure(){');
  assert.ok(bind.includes("document.querySelectorAll('[data-quest]')"), 'chapter buttons are wired');
  assert.ok(bind.includes("startQuestFlow(b.getAttribute('data-quest'))"), 'they start the quest flow');
  assert.ok(bind.includes("if(e&&!e.arcSeenDay){ e.arcSeenDay=todayKey(); save(); }"), 'playing from the pond stamps the seen day');
});

// ------------------------------------------------------- finish + results

test('finishRound snapshots the arc first and celebrates only a newly lit piece', () => {
  const finish = fnText('function finishRound(t){');
  assert.ok(finish.includes("var _arcBefore=(typeof arcAvailable==='function'&&arcAvailable()&&typeof arcProgress==='function')?arcProgress(e):null;"), 'the arc is snapshotted before the finish is recorded');
  assert.ok(finish.includes('if(_ch&&_ch.done&&(!_was||!_was.done)){'), 'only a newly lit chapter celebrates');
  assert.ok(finish.includes('if(_ap.complete)cur.arcComplete=true; else cur.arcChapterDone=_ch;'), 'a finished pond beats a single chapter');
});

test('quizDoneHTML celebrates the pond and the chapter, and bindQuiz opens the pond', () => {
  const done = fnText('function quizDoneHTML(t){');
  assert.ok(done.includes('cur.arcComplete'), 'the full pond gets a celebration');
  assert.ok(done.includes('fully lit'), 'the celebration says the pond is fully lit');
  assert.ok(done.includes('id="arcPondBtn"'), 'a button opens the pond');
  assert.ok(done.includes('cur.arcChapterDone'), 'a single chapter gets its own line');
  assert.ok(done.includes('Chapter lit:'), 'the line names the lit chapter');
  const bind = fnText('function bindQuiz(){');
  assert.ok(bind.includes("document.getElementById('arcPondBtn')"), 'the pond button is wired');
  assert.ok(bind.includes("go('treasure')"), 'it opens Treasure Realm');
});

// ---- finishRound, run live in a sandbox like tests/maths-boost.test.js ----
let EX = null;
let cur = null;
const arcCalls = { saves: 0, badges: [] };
function ex() { return EX; }
function earnStars(e, n) { e.stars = (e.stars || 0) + n; e.starsEarned = (e.starsEarned || 0) + n; }
function recordLearnBest() { return false; }
function awardBadge(id) { arcCalls.badges.push(id); }
function save() { arcCalls.saves++; }
function sndFanfare() {}
function confettiStars() {}
function reportServerBankAnswers() {}
function bankFor() { return []; }
const finishRound = eval('(' + grabFn('finishRound') + ')');

function runQuest(e, topicId, score) {
  EX = e;
  cur = { topicId, phase: 'quest', idx: 5, score, wrong: [], picked: null, answered: true, pool: [0, 1, 2, 3, 4], liveGenSource: 'bank' };
  arcCalls.saves = 0; arcCalls.badges = [];
  finishRound({ sub: 'eng' });
  return cur;
}

test('finishRound, live: finishing an arc chapter lights it on the results screen', () => {
  const e = explorer({ level: 'P3' });
  const engId = arcTopicFor(e, 'eng', '2026-12-03');
  const out = runQuest(e, engId, 5);
  assert.equal(e.completedDay[engId], '2026-12-03', 'the quest is recorded');
  assert.ok(out.arcChapterDone, 'the chapter lights');
  assert.equal(out.arcChapterDone.title, 'The Story Lantern', 'the lit chapter is named');
  assert.equal(out.arcComplete, undefined, 'one chapter does not light the whole pond');
});

test('finishRound, live: the fourth chapter completes the pond', () => {
  const e = explorer({ level: 'P3' });
  const chs = arcChapters(e, '2026-12-03');
  chs.slice(0, 3).forEach(function (c) { e.completedDay[c.topicId] = '2026-12-02'; });
  const out = runQuest(e, chs[3].topicId, 4);
  assert.equal(out.arcComplete, true, 'the last chapter lights the whole pond');
  assert.equal(out.arcChapterDone, undefined, 'no single-chapter line when the pond completes');
});

test('finishRound, live: replaying an already-lit chapter lights nothing new', () => {
  const e = explorer({ level: 'P3' });
  const chs = arcChapters(e, '2026-12-03');
  e.completedDay = { [chs[0].topicId]: '2026-12-02' };
  const out = runQuest(e, chs[0].topicId, 5);
  assert.equal(out.arcChapterDone, undefined, 'an already-lit chapter does not celebrate again');
  assert.equal(out.arcComplete, undefined, 'and the pond does not complete twice');
});

test('finishRound, live: a non-arc quest lights nothing', () => {
  const e = explorer({ level: 'P3' });
  const out = runQuest(e, 'eng-grammar', 5);
  assert.equal(out.arcChapterDone, undefined, 'an off-arc topic is just a quest');
  assert.equal(out.arcComplete, undefined);
});
