// Per-family school & study schedule (2026-11-09): a family's own
// school events + weekly study timetable, set in the Grown-ups page.
// schoolEventFor / nextSchoolEvents / studyPlanFor check the custom
// schedule first and fall back to the built-in Jiyuna defaults.
// Family-level fields (familyEvents, deletedFamilyEvents, familyPlan,
// familyPlanUpdatedAt) merge in mergeFamilyDB: events by id, the
// timetable by later updatedAt.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
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
function grabVar(name, nextMarker) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, 'var ' + name + ' found');
  const end = html.indexOf(nextMarker, start);
  assert.ok(end > start, nextMarker + ' not found after var ' + name);
  return html.slice(start, end);
}

/* ---------------- studyPlanFor: custom day wins, else built-in ---------------- */

function planEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + (html.match(/var SUBJECTS=\{[^}]+\};/) || [])[0] + '\n'
    + grabVar('STUDY_PLAN', 'function studyPlanFor') + '\n'
    + grabFn('studyPlanFor') + '\n'
    + grabFn('planDayLabel') + '\n'
    + ';({studyPlanFor:studyPlanFor, planDayLabel:planDayLabel, setDB:function(v){DB=v;}, getDB:function(){return DB;}});';
  return eval(code);
}

test('studyPlanFor: no custom timetable means Jiyuna’s built-in day', () => {
  const e = planEngine({ familyPlan: null });
  assert.equal(e.studyPlanFor(1).label, 'English + Maths', 'Monday is the built-in English + Maths');
  assert.deepEqual(e.studyPlanFor(1).subs, ['eng', 'math'], 'the built-in subjects');
  assert.equal(e.studyPlanFor(3).label, 'Light study, then Higher Chinese', 'Wednesday keeps HCL');
  assert.equal(e.studyPlanFor(6).rest, true, 'Saturday is a rest day in the built-in plan');
  assert.equal(e.studyPlanFor(6).label, 'Dance & art day', 'Saturday is dance & art');
});

test('studyPlanFor: a custom day replaces the built-in day', () => {
  const custom = { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00–5:30pm', note: 'Swimming 6–7pm', rest: false, review: false, light: false };
  const e = planEngine({ familyPlan: { 1: custom } });
  assert.equal(e.studyPlanFor(1).label, 'Maths + English', 'the custom Monday wins');
  assert.equal(e.studyPlanFor(1).study, '4:00–5:30pm', 'the custom study time wins');
  assert.equal(e.studyPlanFor(2).label, 'Science + Chinese', 'Tuesday still falls back to built-in');
});

test('planDayLabel: rest, review, or the joined subjects', () => {
  const e = planEngine({ familyPlan: null });
  assert.equal(e.planDayLabel({ rest: true, subs: [] }), 'Rest day', 'a rest day');
  assert.equal(e.planDayLabel({ rest: false, subs: [] }), 'Review day', 'no subjects, not rest');
  assert.equal(e.planDayLabel({ rest: false, subs: ['eng', 'math'] }), 'English + Maths', 'joined subjects');
  assert.equal(e.planDayLabel({ rest: false, subs: ['chi'] }), 'Chinese', 'one subject');
});

/* ---------------- schoolEventFor: custom event wins, built-in still found ---------------- */

function eventEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + grabVar('SCHOOL_EVENTS', 'function mdKey') + '\n'
    + grabFn('mdKey') + '\n'
    + grabFn('familyEventFor') + '\n'
    + grabFn('schoolEventFor') + '\n'
    + ';({schoolEventFor:schoolEventFor, familyEventFor:familyEventFor, setDB:function(v){DB=v;}});';
  return eval(code);
}

test('schoolEventFor: a custom event wins on its exact date', () => {
  const custom = { id: 'fe1', date: '2026-11-09', name: 'Sports Day — school closed', kind: 'closure', note: 'No school today.', e: '🏫' };
  const e = eventEngine({ familyEvents: [custom] });
  const ev = e.schoolEventFor(new Date(2026, 10, 9));
  assert.ok(ev, 'an event is found');
  assert.equal(ev.name, 'Sports Day — school closed', 'the custom event wins over the built-in Deepavali');
  assert.equal(ev.kind, 'closure', 'the custom kind');
});

test('schoolEventFor: built-in events are still found when no custom event matches', () => {
  const e = eventEngine({ familyEvents: [] });
  assert.equal(e.schoolEventFor(new Date(2026, 10, 9)).name, 'Deepavali — school closed', 'Deepavali is still there');
  assert.equal(e.schoolEventFor(new Date(2026, 10, 11)).name, 'Admin Day — school closed', 'Admin Day is still there');
  assert.equal(e.schoolEventFor(new Date(2026, 10, 18)).kind, 'due', 'the SLS due date is still there');
  assert.equal(e.schoolEventFor(new Date(2026, 10, 12)), null, 'a plain day has no event');
});

/* ---------------- nextSchoolEvents: custom events merged, sorted ---------------- */

function nextEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + grabVar('SCHOOL_EVENTS', 'function mdKey') + '\n'
    + grabFn('nextSchoolEvents') + '\n'
    + ';({nextSchoolEvents:nextSchoolEvents});';
  return eval(code);
}

test('nextSchoolEvents: custom events join the list, sorted by date', () => {
  // A custom event far in the future, so it is always upcoming.
  const custom = { id: 'fe9', date: '2099-01-15', name: 'Founders Day', kind: 'event', note: '', e: '📌' };
  const e = nextEngine({ familyEvents: [custom] });
  const list = e.nextSchoolEvents(10);
  const found = list.find(function (u) { return u.ev.name === 'Founders Day'; });
  assert.ok(found, 'the custom event is in the list');
  assert.equal(found.date.getFullYear(), 2099, 'the custom date is kept');
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].date >= list[i - 1].date, 'the list is sorted by date');
  }
  const past = nextEngine({ familyEvents: [{ id: 'fe0', date: '2020-01-05', name: 'Old Day', kind: 'event', note: '', e: '📌' }] });
  assert.ok(!past.nextSchoolEvents(10).some(function (u) { return u.ev.name === 'Old Day'; }), 'a past custom event is not listed');
});

test('nextSchoolEvents: past built-in events drop out instead of rolling to next year', () => {
  // Built-ins are 2026 dates: once one is past it must leave the
  // "what's coming" list, not reappear as a next-year date (the old
  // code rolled Deepavali / Admin Day to 2027, so they never left).
  const e = nextEngine({ familyEvents: [] });
  const list = e.nextSchoolEvents(10);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  list.forEach(function (u) {
    assert.ok(u.date >= today, u.ev.name + ' is today or in the future, never past');
    assert.equal(u.date.getFullYear(), now.getFullYear(), u.ev.name + ' stays in this year — it does not roll forward to next year');
  });
  assert.ok(!list.some(function (u) { return u.ev.name === 'Deepavali — school closed'; }), 'Deepavali (9 Nov) is gone once past');
  assert.ok(!list.some(function (u) { return u.ev.name === 'Admin Day — school closed'; }), 'Admin Day (11 Nov) is gone once past');
});

test('schoolScheduleHTML: an empty "what\'s coming" list shows a nothing-coming-up line', () => {
  const sched = fnBody('function schoolScheduleHTML(');
  assert.ok(sched.includes('ups.length?'), 'the card branches on an empty list');
  assert.ok(sched.includes('Nothing coming up on the school calendar right now'), 'an empty list renders a nothing-coming-up line instead of a blank card');
});

/* ---------------- mergeFamilyDB: events by id, plan by later updatedAt ---------------- */

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
    explorers: [explorer({})], parentPin: '2468', dailyLimit: 30, playLimit: 20,
    activeId: 'e1', syncCode: 'ABCDEF', updatedAt: '2026-11-09T00:00:00.000Z', flags: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null,
  }, over);
}

test('mergeFamilyDB: the timetable takes the later updatedAt', () => {
  const planA = { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00–5:30pm', note: '', rest: false, review: false, light: false } };
  const planB = { 1: { label: 'English + Maths', subs: ['eng', 'math'], study: '3:00–4:30pm', note: '', rest: false, review: false, light: false } };
  const local = familyDB({ familyPlan: planA, familyPlanUpdatedAt: '2026-11-09T02:00:00.000Z' });
  const server = familyDB({ familyPlan: planB, familyPlanUpdatedAt: '2026-11-09T01:00:00.000Z' });
  const merged = mergeFamilyDB(local, server);
  assert.equal(merged.familyPlan[1].label, 'Maths + English', 'the later local plan wins');
  const other = mergeFamilyDB(
    familyDB({ familyPlan: planB, familyPlanUpdatedAt: '2026-11-09T01:00:00.000Z' }),
    familyDB({ familyPlan: planA, familyPlanUpdatedAt: '2026-11-09T02:00:00.000Z' }));
  assert.equal(other.familyPlan[1].label, 'Maths + English', 'the later server plan wins');
});

test('mergeFamilyDB: a reset (null plan, later updatedAt) clears the timetable', () => {
  const plan = { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00–5:30pm', note: '', rest: false, review: false, light: false } };
  const local = familyDB({ familyPlan: null, familyPlanUpdatedAt: '2026-11-09T03:00:00.000Z' });
  const server = familyDB({ familyPlan: plan, familyPlanUpdatedAt: '2026-11-09T01:00:00.000Z' });
  const merged = mergeFamilyDB(local, server);
  assert.equal(merged.familyPlan, null, 'the reset propagates');
});

test('mergeFamilyDB: family events union by id, and a deleted event stays deleted', () => {
  const ev1 = { id: 'fe1', date: '2026-12-01', name: 'Sports Day', kind: 'event', note: '', e: '📌' };
  const ev2 = { id: 'fe2', date: '2026-12-05', name: 'Concert', kind: 'event', note: '', e: '📌' };
  const merged = mergeFamilyDB(
    familyDB({ familyEvents: [ev1] }),
    familyDB({ familyEvents: [ev2] }));
  assert.equal(merged.familyEvents.length, 2, 'events from both sides survive');
  const deleted = mergeFamilyDB(
    familyDB({ familyEvents: [], deletedFamilyEvents: ['fe2'] }),
    familyDB({ familyEvents: [ev1, ev2] }));
  assert.deepEqual(deleted.familyEvents.map(function (x) { return x.id; }), ['fe1'], 'the deleted event is dropped');
  assert.deepEqual(deleted.deletedFamilyEvents, ['fe2'], 'the tombstone survives');
});

/* ---------------- parent page: the schedule section ---------------- */

test('parent page has an Our school & study schedule section', () => {
  const section = fnBody('function familyScheduleHTML(');
  assert.ok(section.includes('Our school &amp; study schedule'), 'the section is titled');
  assert.ok(section.includes('id="fsEvDate"'), 'an event date field');
  assert.ok(section.includes('id="fsEvName"'), 'an event name field');
  assert.ok(section.includes('id="fsEvKind"'), 'an event kind picker');
  assert.ok(section.includes('id="fsEvNote"'), 'an event note field');
  assert.ok(section.includes('id="fsEvAdd"'), 'an Add event button');
  assert.ok(section.includes('data-fsevdel'), 'each event has a Delete button');
  assert.ok(section.includes('data-fsrest'), 'each day has a rest-day toggle');
  assert.ok(section.includes('data-fssub'), 'each day has subject toggles');
  assert.ok(section.includes('data-fsstime'), 'each day has a study-time field');
  assert.ok(section.includes('data-fsnote'), 'each day has a note field');
  assert.ok(section.includes('id="fsPlanSave"'), 'a Save timetable button');
  assert.ok(section.includes('id="fsPlanReset"'), 'a Reset to the default timetable button');
  const parent = fnBody('function parentHTML(');
  assert.ok(parent.includes('familyScheduleHTML()'), 'the section renders on the parent page');
  const bind = fnBody('function bindParent(');
  assert.ok(bind.includes("getElementById('fsEvAdd')"), 'adding an event is wired');
  assert.ok(bind.includes("getElementById('fsPlanSave')"), 'saving the timetable is wired');
  assert.ok(bind.includes("getElementById('fsPlanReset')"), 'resetting the timetable is wired');
  assert.ok(bind.includes('familyPlanUpdatedAt'), 'saving bumps the plan timestamp');
});

test('the timetable editor pre-fills from the effective plan', () => {
  const section = fnBody('function familyScheduleHTML(');
  assert.ok(section.includes('studyPlanFor(dow)'), 'each row reads the effective day plan');
  assert.ok(section.includes('[1,2,3,4,5,6,0]'), 'the rows run Monday to Sunday');
  const reader = fnBody('function readFamilyPlanFromForm(');
  assert.ok(reader.includes('planDayLabel(day)'), 'the label is derived when saving');
  assert.ok(reader.includes('day.review=true'), 'a day with no subjects becomes a review day');
});
