// Scroll-position fixes + Play 20 / Daily 90 defaults (2026-11-09).
// Bryan reported two jump-to-the-bottom bugs:
//  (1) entering a Learn topic/sub-topic jumps the page to the bottom;
//  (2) saving a schedule on the parent page jumps the page to the
//      bottom. Both are render() losing the scroll position: render()
//      rebuilds the whole page with root.innerHTML, destroying every
//      scroll anchor, and the schedule save additionally collapses
//      the tall editor, so the stale offset is clamped to the new,
//      shorter document's maximum scroll — the bottom. The fix:
//      render() captures window.scrollY and restores it on every exit
//      path; the topic handler scrolls the opened topic into view;
//      the save/reset handlers scroll the schedule card (id
//      fsSchedCard) into view. Time limits: Bryan set Play 20 /
//      Daily 90 — Play was already 20, Daily moves 30 -> 90 in both
//      default sites; stored values are untouched.
//
// NOTE on what these tests can and cannot prove: node has no layout
// engine, so no test here can prove a real browser keeps (or loses)
// a scroll offset across an innerHTML rebuild. What IS proven: the
// real helper functions call the right scroll APIs with the right
// arguments, render() wires the capture/restore on every exit path,
// the two tap handlers scroll to the right element after render(),
// and the defaults are 90/20 with stored values preserved. The
// end-to-end "tap a topic on a phone, stay at the topic" step still
// needs one live check on the real link.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

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
function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function countIn(src, sub) {
  let n = 0, i = 0;
  while ((i = src.indexOf(sub, i)) >= 0) { n++; i += sub.length; }
  return n;
}

// --- The real helpers, evaluated from the page ---------------------------
const restoreScrollY = eval(grabFn('restoreScrollY') + '\n; restoreScrollY;');
const scrollToLearnTopic = eval(grabFn('scrollToLearnTopic') + '\n; scrollToLearnTopic;');
const scrollToScheduleCard = eval(grabFn('scrollToScheduleCard') + '\n; scrollToScheduleCard;');

/* ---------------- render() preserves the scroll offset ---------------- */

test('render() captures window.scrollY before the rebuild and restores it on every exit path', () => {
  const renderSrc = fnBody('function render(){');
  assert.ok(renderSrc.includes("var _sy=(typeof window!=='undefined'&&typeof window.scrollY==='number')?window.scrollY:0;"),
    'render() captures the scroll offset first');
  // Every exit path restores it: the admin, door and parent-without-
  // explorer early returns, plus the fall-through end — 4 restores.
  assert.equal(countIn(renderSrc, 'restoreScrollY(_sy)'), 4,
    'all four render() exits restore the captured offset, got ' + countIn(renderSrc, 'restoreScrollY(_sy)'));
  // The capture happens before the first restore, and before the
  // first innerHTML rebuild.
  assert.ok(renderSrc.indexOf('var _sy=') < renderSrc.indexOf('restoreScrollY(_sy)'),
    'the offset is captured before any restore');
  assert.ok(renderSrc.indexOf('var _sy=') < renderSrc.indexOf('root.innerHTML'),
    'the offset is captured before the DOM is rebuilt');
});

test('restoreScrollY scrolls the window back to the captured offset (real function)', () => {
  const calls = [];
  global.window = { scrollTo: (x, y) => calls.push([x, y]) };
  try {
    restoreScrollY(420);
  } finally { delete global.window; }
  assert.deepEqual(calls, [[0, 420]], 'it restores the exact captured offset');
});

test('restoreScrollY is a no-op where there is no window (node / SSR-safe)', () => {
  assert.equal(typeof window, 'undefined', 'precondition: no window in this test process');
  assert.doesNotThrow(() => restoreScrollY(123), 'it must not throw without a window');
});

test('go() still scrolls to the top before render(), so navigation lands at the top', () => {
  const goSrc = fnBody('function go(r){');
  assert.ok(goSrc.includes('window.scrollTo(0,0)'), 'go() still scrolls to the top');
  assert.ok(goSrc.indexOf('window.scrollTo(0,0)') < goSrc.indexOf('render()'),
    'go() scrolls first, so render() captures 0 and restores 0');
});

/* ---------------- Learn topic: stay at the opened topic ---------------- */

test('opening a Learn topic scrolls the topic into view; closing it does not jump', () => {
  const bindSrc = fnBody('function bindLearn(){');
  const topicHandler = bindSrc.slice(bindSrc.indexOf('[data-learn-topic]'));
  assert.ok(topicHandler.includes('var opening=learnView.openTopic!==id;'),
    'the handler knows whether this tap opens or closes the topic');
  assert.ok(topicHandler.includes('if(opening)scrollToLearnTopic(id);'),
    'opening scrolls the just-opened topic into view after render()');
  assert.ok(!topicHandler.includes('window.scrollTo(0,0)'),
    'a topic tap never scrolls to the top — the user stays at the topic');
});

test('scrollToLearnTopic scrolls the tapped row into view, nearest edge (real function)', () => {
  const calls = [];
  const row = { scrollIntoView: (opts) => calls.push(opts) };
  let selector = null;
  global.document = { querySelector: (sel) => { selector = sel; return row; } };
  try {
    scrollToLearnTopic('sci-magnets');
  } finally { delete global.document; }
  assert.equal(selector, '[data-learn-topic="sci-magnets"]', 'it finds the tapped topic row');
  assert.deepEqual(calls, [{ behavior: 'smooth', block: 'nearest' }],
    "block:'nearest' moves nothing when the row is already on screen — no jump to the bottom");
});

test('scrollToLearnTopic is a no-op when the row is gone (defensive)', () => {
  global.document = { querySelector: () => null };
  try {
    assert.doesNotThrow(() => scrollToLearnTopic('nope'), 'a missing row must not throw');
  } finally { delete global.document; }
});

test('opening a subject page / going back to All subjects lands at the top (new views)', () => {
  const bindSrc = fnBody('function bindLearn(){');
  const subjHandler = bindSrc.slice(bindSrc.indexOf('[data-learn-subject]'), bindSrc.indexOf('[data-learn-back]'));
  const backHandler = bindSrc.slice(bindSrc.indexOf('[data-learn-back]'), bindSrc.indexOf('[data-learn-topic]'));
  assert.ok(subjHandler.includes('window.scrollTo(0,0)'), 'opening a subject scrolls to the top');
  assert.ok(backHandler.includes('window.scrollTo(0,0)'), 'going back to All subjects scrolls to the top');
});

/* ---------------- Schedule save: stay at the schedule section ---------------- */

test('the schedule card carries id="fsSchedCard" exactly once', () => {
  assert.equal(countIn(html, 'id="fsSchedCard"'), 1, 'one scroll target on the page');
  const schedSrc = fnBody('function familyScheduleHTML(){');
  assert.ok(schedSrc.includes('id="fsSchedCard"'), 'familyScheduleHTML renders the card with that id');
});

test('saving (and resetting) the timetable scrolls the schedule card into view after render()', () => {
  const bindSrc = fnBody('function bindParent(){');
  const saveAt = bindSrc.indexOf("document.getElementById('fsPlanSave')");
  assert.ok(saveAt >= 0, 'the Save timetable handler is present');
  const saveHandler = bindSrc.slice(saveAt, bindSrc.indexOf("document.getElementById('fsPlanReset')"));
  assert.ok(saveHandler.includes('save(); render(); scrollToScheduleCard();'),
    'save re-renders, then scrolls to the schedule section before the async confirm toast');
  const resetHandler = bindSrc.slice(bindSrc.indexOf("document.getElementById('fsPlanReset')"));
  assert.ok(resetHandler.includes('save(); render(); scrollToScheduleCard();'),
    'reset collapses the editor the same way, so it lands on the schedule section too');
  assert.ok(saveHandler.includes('fsSchedOpen=false'), 'save still collapses the editor to the summary');
});

test('scrollToScheduleCard scrolls the schedule card to the top of the viewport (real function)', () => {
  const calls = [];
  const card = { scrollIntoView: (opts) => calls.push(opts) };
  global.document = { getElementById: (id) => (id === 'fsSchedCard' ? card : null) };
  try {
    scrollToScheduleCard();
  } finally { delete global.document; }
  assert.deepEqual(calls, [{ behavior: 'smooth', block: 'start' }],
    "block:'start' puts the schedule heading at the top — the parent stays at the schedule section");
});

test('scrollToScheduleCard is a no-op when the card is gone (defensive)', () => {
  global.document = { getElementById: () => null };
  try {
    assert.doesNotThrow(() => scrollToScheduleCard(), 'a missing card must not throw');
  } finally { delete global.document; }
});

/* ---------------- Time limits: Play 20 / Daily 90 ---------------- */

function makeSyncCode() { return 'ABCDEF'; } // stub for the new-family literal below

test('new-family defaults are Play 20 / Daily 90 (real load() literal)', () => {
  const start = html.indexOf('DB={explorers:[], parentPin:null, dailyLimit:');
  assert.ok(start >= 0, 'the new-family DB literal is present');
  const end = html.indexOf('};', start) + 1;
  const fresh = eval('(' + html.slice(start + 3, end) + ')');
  assert.equal(fresh.dailyLimit, 90, 'a new family starts on a 90-minute daily limit');
  assert.equal(fresh.playLimit, 20, 'a new family starts on a 20-minute play limit');
});

const mergeFamilyDB = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer', 'mergeFamilyDB',
].map(grabFn).join('\n') + '\n; mergeFamilyDB;');

function explorer(overrides) {
  const base = {
    id: 'e1', name: 'Test', stars: 0, critterStage: 0, badges: [], treasures: [],
    discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
    hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, playBest: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [],
    deletedThreadIds: [], flashcards: [], deletedFlashcards: [], planner: [],
    deletedPlanner: [], friends: [], deletedFriends: [], friendCode: 'ABCDEF',
    nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦', lookAt: null,
    critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
    spellingTests: [], deletedSpellingTests: [],
  };
  return Object.assign(base, overrides);
}
function familyDB(over) {
  return Object.assign({
    // One explorer: mergeFamilyDB short-circuits to the server copy
    // when local.explorers is empty, so an empty list would never
    // reach the dailyLimit fallback line under test.
    explorers: [explorer({})], parentPin: '2468', parentPinUpdatedAt: null,
    dailyLimit: null, playLimit: null,
    activeId: 'e1', syncCode: 'ABCDEF', updatedAt: '2026-11-09T00:00:00.000Z', flags: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null, familyPlanRev: 0,
  }, over);
}

test('merge fallback is Daily 90 / Play 20 when neither side has a value (real mergeFamilyDB)', () => {
  const merged = mergeFamilyDB(familyDB({}), familyDB({}));
  assert.equal(merged.dailyLimit, 90, 'the fallback is 90, not the old 30');
  assert.equal(merged.playLimit, 20, 'the play fallback stays 20');
});

test('stored limits are kept — an existing family is never migrated', () => {
  // A family that stored Daily 30 keeps 30; the 90 is a default for
  // new families only, not a migration of stored data.
  assert.equal(mergeFamilyDB(familyDB({ dailyLimit: 30 }), familyDB({})).dailyLimit, 30,
    'a stored Daily 30 stays 30');
  assert.equal(mergeFamilyDB(familyDB({ dailyLimit: 90 }), familyDB({})).dailyLimit, 90,
    'a stored Daily 90 stays 90');
  assert.equal(mergeFamilyDB(familyDB({}), familyDB({ dailyLimit: 45 })).dailyLimit, 45,
    'a server-side value still wins over the fallback');
  assert.equal(mergeFamilyDB(familyDB({ playLimit: 15 }), familyDB({})).playLimit, 15,
    'a stored Play limit is untouched too');
});
