// Critter pacing (2026-11-09): the frog grows on the app's own
// 63-day Science timeline — Egg 7 care-days, Tadpole 42, Froglet
// 14. A care day is a day on which all three care actions are done;
// each care day adds 1 to the current stage's progress, and the
// frog grows only when the stage's days are complete. The merge
// takes the stage-days from the copy on the furthest stage (a plain
// max would be wrong — a frog that just grew to Tadpole has 0
// tadpole-days, not the 6 egg-days a stale device still holds).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  return html.slice(start, end + 2);
}
// Brace-matching extractor (from memory-merge.test.js): several of
// these functions nest other declarations, so slicing to the next
// '\nfunction ' would cut them short. It also handles single-line
// functions, which the plain '\n}\n' grab cannot.
function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}

const CARE_ACTIONS = eval(grabVar('CARE_ACTIONS') + '\n;CARE_ACTIONS');
const CRITTER_STAGE_DAYS = eval(grabVar('CRITTER_STAGE_DAYS') + '\n;CRITTER_STAGE_DAYS');
const FROG_FACTS = eval(grabVar('FROG_FACTS') + '\n;FROG_FACTS');
const careAllToday = eval('var CARE_ACTIONS=' + JSON.stringify(CARE_ACTIONS) + ';\n' + grabFn('careAllToday') + '\n;careAllToday');
const applyCareDay = eval(
  'var CRITTER_STAGE_DAYS=' + JSON.stringify(CRITTER_STAGE_DAYS) + ';\n'
  + 'var CARE_ACTIONS=' + JSON.stringify(CARE_ACTIONS) + ';\n'
  + grabFn('careAllToday') + '\n' + grabFn('applyCareDay') + '\n;applyCareDay'
);
const mergeExplorer = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
].map(grabFn).join('\n') + '\n; mergeExplorer;');

function careFor(day) {
  return {
    feed: { at: day + 'T08:00:00.000Z', day },
    clean: { at: day + 'T09:00:00.000Z', day },
    play: { at: day + 'T10:00:00.000Z', day },
  };
}
function frog(overrides) {
  return Object.assign({ critterStage: 0, critterStageDays: 0, care: {}, careGrewDay: null }, overrides);
}
/* Simulate n consecutive care days starting at startDay (YYYY-MM-DD);
   returns the applyCareDay result for each day. */
function careDays(e, n, startDay) {
  const out = [];
  const d = new Date(startDay + 'T00:00:00Z');
  for (let i = 0; i < n; i++) {
    const key = d.toISOString().slice(0, 10);
    e.care = careFor(key);
    out.push(applyCareDay(e, key));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
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
  };
  return Object.assign(base, overrides);
}

test('stage lengths are 7 / 42 / 14 care-days — the app’s own Science timeline, 63 days egg to adult', () => {
  assert.deepEqual(CRITTER_STAGE_DAYS, [7, 42, 14], 'Egg 7, Tadpole 42, Froglet 14');
  assert.equal(CRITTER_STAGE_DAYS.reduce(function (a, b) { return a + b; }, 0), 63, '63 days from egg to adult');
  // The Science bank teaches exactly this timeline, so the pacing
  // and the lessons agree with each other.
  assert.ok(html.includes("a frog\\'s egg stage lasts 7 days, the tadpole stage lasts 42 days and the froglet stage lasts 14 days"), 'the Science question states 7 / 42 / 14');
  assert.ok(html.includes('7 + 42 + 14 = 63 days'), 'the Science answer is 63 days');
  assert.ok(html.includes('function critterStageLen(stage)'), 'a stage-length helper exists');
});

test('a care day (all three actions) adds exactly 1 day to the current stage', () => {
  const e = frog({ care: careFor('2026-11-09') });
  assert.equal(applyCareDay(e, '2026-11-09'), 'day', 'a full care day logs');
  assert.equal(e.critterStageDays, 1, 'egg: 1 of 7 days');
  assert.equal(e.critterStage, 0, 'still an egg');
  assert.equal(e.careGrewDay, '2026-11-09', 'today is marked as a counted care day');
});

test('a care day counts once per day, even if the actions are done again after the cooldown', () => {
  const e = frog({ care: careFor('2026-11-09') });
  assert.equal(applyCareDay(e, '2026-11-09'), 'day', 'first time today logs');
  // The child repeats all three actions later the same day (after
  // the 4-hour cooldown) — the care record is fresh, but the day
  // must not count twice.
  e.care = {
    feed: { at: '2026-11-09T15:00:00.000Z', day: '2026-11-09' },
    clean: { at: '2026-11-09T16:00:00.000Z', day: '2026-11-09' },
    play: { at: '2026-11-09T17:00:00.000Z', day: '2026-11-09' },
  };
  assert.equal(applyCareDay(e, '2026-11-09'), 'already', 'the same day never counts twice');
  assert.equal(e.critterStageDays, 1, 'still 1 day, not 2');
});

test('a day with a care missing logs nothing', () => {
  const e = frog({ care: { feed: { at: '2026-11-09T08:00:00.000Z', day: '2026-11-09' }, clean: { at: '2026-11-09T09:00:00.000Z', day: '2026-11-09' } } });
  assert.equal(applyCareDay(e, '2026-11-09'), 'not-all', 'play is missing, so no growth day');
  assert.equal(e.critterStageDays, 0, 'no days logged');
  assert.equal(e.careGrewDay, null, 'the day is not marked as counted');
});

test('the frog grows exactly when the stage’s days are complete — not before', () => {
  const e = frog();
  const firstSix = careDays(e, 6, '2026-11-09');
  assert.deepEqual(firstSix, ['day', 'day', 'day', 'day', 'day', 'day'], 'six care days log, none grows');
  assert.equal(e.critterStage, 0, 'still an egg after 6 days');
  assert.equal(e.critterStageDays, 6, '6 of 7 egg days');
  const seventh = careDays(e, 1, '2026-11-15');
  assert.deepEqual(seventh, ['grew'], 'the 7th care day grows the frog');
  assert.equal(e.critterStage, 1, 'now a tadpole');
  assert.equal(e.critterStageDays, 0, 'the count resets to 0 for the new stage');
});

test('the full journey takes 63 care days: 7 egg + 42 tadpole + 14 froglet', () => {
  const e = frog();
  careDays(e, 7, '2026-11-09');
  assert.equal(e.critterStage, 1, 'tadpole after 7 care days');
  careDays(e, 41, '2026-11-16');
  assert.equal(e.critterStage, 1, 'still a tadpole after 41 tadpole days');
  assert.equal(e.critterStageDays, 41, '41 of 42 tadpole days');
  careDays(e, 1, '2026-12-27');
  assert.equal(e.critterStage, 2, 'froglet after 42 tadpole days');
  assert.equal(e.critterStageDays, 0, 'froglet count starts at 0');
  careDays(e, 13, '2026-12-28');
  assert.equal(e.critterStage, 2, 'still a froglet after 13 froglet days');
  careDays(e, 1, '2027-01-10');
  assert.equal(e.critterStage, 3, 'adult frog after 14 froglet days');
  assert.equal(e.critterStageDays, 0, 'adult has no stage count');
});

test('growth continues from 0 after a stage change — the next care day is day 1 of the new stage', () => {
  const e = frog();
  careDays(e, 7, '2026-11-09');
  assert.equal(e.critterStage, 1, 'tadpole');
  careDays(e, 1, '2026-11-16');
  assert.equal(e.critterStageDays, 1, '1 of 42 tadpole days');
});

test('an adult frog never grows further — Greg Washington stays an adult', () => {
  const e = frog({ critterStage: 3, critterStageDays: 0, care: careFor('2026-11-09') });
  assert.equal(applyCareDay(e, '2026-11-09'), 'adult', 'adults do not grow');
  assert.equal(e.critterStage, 3, 'still an Adult Frog');
  assert.equal(e.critterStageDays, 0, 'no stage count for an adult');
  // Even a long run of care days leaves the adult exactly where it is.
  careDays(e, 30, '2026-11-10');
  assert.equal(e.critterStage, 3, 'still an adult after 30 more care days');
});

test('merge: same stage takes the max days', () => {
  const a = explorer({ critterStage: 1, critterStageDays: 10 });
  const b = explorer({ critterStage: 1, critterStageDays: 12 });
  const merged = mergeExplorer(a, b);
  assert.equal(merged.critterStage, 1, 'still a tadpole');
  assert.equal(merged.critterStageDays, 12, 'the further tadpole progress wins');
  assert.equal(mergeExplorer(b, a).critterStageDays, 12, 'argument order must not matter');
});

test('merge: the days come from the copy on the furthest stage, not a plain max', () => {
  // A grew to Tadpole today (0 tadpole-days); B is stale, still an
  // egg with 6 egg-days. A plain max would wrongly give the tadpole
  // 6 days. The furthest stage's count (0) is the right one.
  const grown = explorer({ critterStage: 1, critterStageDays: 0, careGrewDay: '2026-11-09' });
  const stale = explorer({ critterStage: 0, critterStageDays: 6, careGrewDay: '2026-11-08' });
  const merged = mergeExplorer(grown, stale);
  assert.equal(merged.critterStage, 1, 'the furthest stage wins');
  assert.equal(merged.critterStageDays, 0, 'the tadpole starts at 0 days, not the stale 6 egg-days');
  assert.equal(mergeExplorer(stale, grown).critterStageDays, 0, 'argument order must not matter');
  assert.equal(merged.careGrewDay, '2026-11-09', 'the later care-day marker wins');
});

test('the Growing up bar shows the stage name and the days within it', () => {
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes("STAGES[e.critterStage][1]+' — '+stageDays+' of '+stageLen+' days"), 'the bar reads e.g. "Tadpole — 12 of 42 days"');
  assert.ok(page.includes('stageDays/stageLen*100'), 'the bar fills with the days in the stage');
  assert.ok(page.includes('more care days to grow'), 'the days left to grow are shown');
  assert.ok(page.includes('more care day'), 'the singular day is handled too');
  assert.ok(page.includes('Grew today!'), 'a growth today is still celebrated');
  assert.ok(page.includes('Growth day logged!'), 'a logged care day that does not grow yet is named');
  assert.ok(page.includes('grew into a '), 'a growth names the new stage');
});

test('the 12 frog facts say nothing about fast growth — no timeline to contradict the 63 days', () => {
  assert.equal(FROG_FACTS.length, 12, 'still 12 facts');
  for (const f of FROG_FACTS) {
    assert.ok(!/\b\d+\s*days?\b/i.test(f), 'no fact states a day-count: ' + f);
    assert.ok(!/\b\d+\s*weeks?\b/i.test(f), 'no fact states a week-count: ' + f);
  }
});
