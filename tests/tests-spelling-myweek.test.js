// Spelling routine on Home > My week (2026-11-09): each day cell in
// the week strip names the spelling practice due that day, derived
// from every spelling test's plan — Learn on the first practice day,
// Practise on the middle days, Redo the missed words the day before
// the test, Test on test day. The old one-line Home nudge is gone:
// the cells now show the same fact (which test, today's step) for
// all 7 days, so the nudge was pure duplication.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' not found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}
function grabLine(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  return html.slice(start, html.indexOf('\n', start));
}
function grabVar(name, nextMarker) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, 'var ' + name + ' found');
  const end = html.indexOf(nextMarker, start);
  assert.ok(end > start, nextMarker + ' not found after var ' + name);
  return html.slice(start, end);
}

// Eval the spelling helpers with a fixed "today" (2026-11-09, Monday).
const spellFns = eval(
  (html.match(/var DOWS=\[[^\]]+\];/) || ['var DOWS=[];'])[0] + '\n'
  + (html.match(/var MONTHS=\[[^\]]+\];/) || ['var MONTHS=[];'])[0] + '\n'
  + 'function todayKey(){ return "2026-11-09"; }\n'
  + grabLine('esc') + '\n'
  + grabFn('parseDateKey') + '\n'
  + grabFn('daysUntil') + '\n'
  + grabFn('fmtDate') + '\n'
  + grabFn('fmtDateStr') + '\n'
  + grabFn('nextPracticeDay') + '\n'
  + grabFn('spellStepFor') + '\n'
  + grabFn('spellPlanFor') + '\n'
  + grabFn('spellStepsForDay') + '\n'
  + grabFn('spellDayLinesHTML') + '\n'
  + ';({spellStepFor:spellStepFor, spellPlanFor:spellPlanFor, spellStepsForDay:spellStepsForDay, spellDayLinesHTML:spellDayLinesHTML});'
);

function spellTest(over) {
  return Object.assign({
    id: 'sp1', lang: 'eng', words: ['disappointed', 'edge', 'exist'],
    testDate: '2026-11-13', routine: 'auto', days: [], missed: [], practised: [],
  }, over);
}
function explorerWith(tests) { return { mood: {}, spellingTests: tests }; }

/* ---------------- (1) a Recommended test lands in the right cells ---------------- */

test('spellStepsForDay: a Recommended test lands Learn/Practise/Redo/Test in the right week cells', () => {
  const e = explorerWith([spellTest({ testDate: '2026-11-13', lang: 'chi' })]);
  const at = (d) => spellFns.spellStepsForDay(e, d, '2026-11-09');
  assert.deepEqual(at('2026-11-09').map((s) => s.step), ['learn'], 'Monday learns');
  assert.deepEqual(at('2026-11-10').map((s) => s.step), ['practise'], 'Tuesday practises');
  assert.deepEqual(at('2026-11-11').map((s) => s.step), ['practise'], 'Wednesday practises');
  assert.deepEqual(at('2026-11-12').map((s) => s.step), ['redo'], 'Thursday redoes');
  const fri = at('2026-11-13');
  assert.deepEqual(fri.map((s) => s.step), ['recap'], 'Friday is the test day');
  assert.equal(fri[0].isTest, true, 'the test day is flagged');
  assert.equal(fri[0].test.lang, 'chi', 'the entry names its test');
  assert.deepEqual(at('2026-11-14'), [], 'Saturday has nothing due');
  assert.deepEqual(at('2026-11-15'), [], 'Sunday has nothing due');
  assert.deepEqual(at('2026-11-08'), [], 'a day before today has nothing due — the plan starts today');
});

/* ---------------- (2) two tests due the same day both show ---------------- */

test('spellStepsForDay: two tests due the same day both show', () => {
  const e = explorerWith([
    spellTest({ id: 'sp1', testDate: '2026-11-13', lang: 'chi' }),
    spellTest({ id: 'sp2', testDate: '2026-11-10', lang: 'eng' }),
  ]);
  const mon = spellFns.spellStepsForDay(e, '2026-11-09', '2026-11-09');
  assert.equal(mon.length, 2, 'both tests have practice due on Monday');
  assert.deepEqual(mon.map((s) => s.test.lang).sort(), ['chi', 'eng'], 'one Chinese, one English');
  assert.deepEqual(mon.map((s) => s.step), ['learn', 'learn'], 'both are Learn on the first day');
  const lines = spellFns.spellDayLinesHTML(e, '2026-11-09', '2026-11-09');
  assert.ok(lines.includes('Learn — Chinese, test Fri 13 Nov'), 'the Chinese line is there');
  assert.ok(lines.includes('Learn — English, test Tue 10 Nov'), 'the English line is there');
  assert.equal((lines.match(/✏️ Spelling:/g) || []).length, 2, 'two lines, one per test');
});

/* ---------------- (3) a day with no spelling due shows no line ---------------- */

test('spellStepsForDay: a day with no spelling due shows no line', () => {
  const e = explorerWith([spellTest({ testDate: '2026-11-13', lang: 'chi' })]);
  assert.deepEqual(spellFns.spellStepsForDay(e, '2026-11-14', '2026-11-09'), [], 'Saturday is past the test');
  assert.equal(spellFns.spellDayLinesHTML(e, '2026-11-14', '2026-11-09'), '', 'no line when nothing is due');
  assert.equal(spellFns.spellDayLinesHTML({ spellingTests: [] }, '2026-11-09', '2026-11-09'), '', 'no tests, no line');
  assert.equal(spellFns.spellDayLinesHTML({}, '2026-11-09', '2026-11-09'), '', 'no spellingTests field, no line');
});

/* ---------------- (4) My own days only on ticked weekdays ---------------- */

test('spellStepsForDay: a My own days test shows only on its ticked weekdays, plus Recap on test day', () => {
  // Test Thu 2026-11-12, practice days Mon + Wed.
  const e = explorerWith([spellTest({ testDate: '2026-11-12', routine: 'custom', days: [1, 3], lang: 'eng' })]);
  const at = (d) => spellFns.spellStepsForDay(e, d, '2026-11-09');
  assert.deepEqual(at('2026-11-09').map((s) => s.step), ['learn'], 'Monday (ticked) learns');
  assert.deepEqual(at('2026-11-10'), [], 'Tuesday (not ticked) is quiet');
  assert.deepEqual(at('2026-11-11').map((s) => s.step), ['redo'], 'Wednesday (ticked, day before) redoes');
  const thu = at('2026-11-12');
  assert.deepEqual(thu.map((s) => s.step), ['recap'], 'Thursday tests even though it is not a ticked day');
  assert.equal(thu[0].isTest, true, 'the test day is flagged');
  const lines = spellFns.spellDayLinesHTML(e, '2026-11-10', '2026-11-09');
  assert.equal(lines, '', 'a non-practice day renders no line');
});

/* ---------------- (5) a past test shows nothing ---------------- */

test('spellStepsForDay: a test whose date has passed shows nothing', () => {
  const e = explorerWith([spellTest({ testDate: '2026-11-08', lang: 'chi' })]);
  for (const d of ['2026-11-09', '2026-11-10', '2026-11-13']) {
    assert.deepEqual(spellFns.spellStepsForDay(e, d, '2026-11-09'), [], d + ' shows nothing for a past test');
  }
  assert.equal(spellFns.spellDayLinesHTML(e, '2026-11-09', '2026-11-09'), '', 'no line for a past test');
});

/* ---------------- the line itself: format, checkmark, wiring ---------------- */

test('spellDayLinesHTML: the line names the step, the language and the test date', () => {
  const e = explorerWith([spellTest({ testDate: '2026-11-13', lang: 'chi' })]);
  const line = spellFns.spellDayLinesHTML(e, '2026-11-12', '2026-11-09');
  assert.ok(line.includes('✏️ Spelling: Redo — Chinese, test Fri 13 Nov'), 'the exact line for Thursday');
  assert.ok(line.includes('class="small"'), 'it is a small line, sized for the week cell');
});

test('spellDayLinesHTML: a practised day gets a checkmark', () => {
  const e = explorerWith([spellTest({ testDate: '2026-11-13', lang: 'eng', practised: ['2026-11-09'] })]);
  const mon = spellFns.spellDayLinesHTML(e, '2026-11-09', '2026-11-09');
  assert.ok(mon.includes('✓ Practise — English, test Fri 13 Nov'), 'Monday was practised, so it is a checked Practise');
  const tue = spellFns.spellDayLinesHTML(e, '2026-11-10', '2026-11-09');
  assert.ok(tue.includes('Practise — English, test Fri 13 Nov'), 'Tuesday is a plain Practise');
  assert.ok(!tue.includes('✓'), 'Tuesday has no checkmark yet');
});

test('the Home nudge is gone — the week cells carry the spelling step instead', () => {
  assert.ok(!html.includes('function spellHomeNudgeHTML'), 'the nudge function is gone');
  const plan = fnBody('function planSectionHTML(');
  assert.ok(!plan.includes('spellHomeNudgeHTML'), 'the week section no longer calls the nudge');
  assert.ok(plan.includes('spellDayLinesHTML(e, dk)'), 'each week cell renders the spelling lines for its own day');
});

test('planSectionHTML wires the spelling lines into every week cell', () => {
  const section = fnBody('function planSectionHTML(');
  assert.ok(section.includes('spellDayLinesHTML(e, dk)'), 'the cell loop asks for the spelling lines of its date');
  assert.ok(section.includes('isSchoolHoliday('), 'the holiday badges are still checked per cell');
  assert.ok(section.includes('isPublicHoliday('), 'the public-holiday badges are still checked per cell');
});

/* ---- behavioural: render the real week strip with "today" = Mon 9 Nov 2026 ---- */

function weekStripEngine() {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(2026, 10, 9, 12, 0, 0); // Mon 9 Nov 2026, noon local
      else super(...args);
    }
    static now() { return new RealDate(2026, 10, 9, 12, 0, 0).getTime(); }
  }
  const code = 'var DB={familyPlan:null,familyEvents:[]};\n'
    + (html.match(/var MONTHS=\[[^\]]+\];/) || ['var MONTHS=[];'])[0] + '\n'
    + (html.match(/var SUBJECTS=\{[^}]+\};/) || [])[0] + '\n'
    + grabVar('SCHOOL_EVENTS', 'function mdKey') + '\n'
    + grabFn('mdKey') + '\n'
    + grabFn('familyEventFor') + '\n'
    + grabFn('schoolEventFor') + '\n'
    + grabVar('STUDY_PLAN', 'function studyPlanFor') + '\n'
    + grabFn('studyPlanFor') + '\n'
    + grabFn('planDayLabel') + '\n'
    + grabVar('MOE_SCHOOL_HOLIDAYS', 'var MOE_SCHOOL_HOLIDAY_DAYS') + '\n'
    + grabVar('MOE_SCHOOL_HOLIDAY_DAYS', 'var SG_PUBLIC_HOLIDAYS') + '\n'
    + grabVar('SG_PUBLIC_HOLIDAYS', '/* Returns the school-holiday name') + '\n'
    + grabFn('isSchoolHoliday') + '\n'
    + grabFn('isPublicHoliday') + '\n'
    + grabFn('esc') + '\n'
    + grabFn('hasCustomPlan') + '\n'
    + grabFn('schoolDayLine') + '\n'
    + grabFn('restDayStripText') + '\n'
    + grabFn('restDayText') + '\n'
    + grabFn('dateKeyOf') + '\n'
    + grabFn('todayKey') + '\n'
    + grabFn('parseDateKey') + '\n'
    + grabFn('daysUntil') + '\n'
    + grabFn('fmtDate') + '\n'
    + grabFn('fmtDateStr') + '\n'
    + grabFn('nextPracticeDay') + '\n'
    + grabFn('spellPlanFor') + '\n'
    + grabFn('spellStepsForDay') + '\n'
    + grabFn('spellDayLinesHTML') + '\n'
    + grabFn('planSectionHTML') + '\n'
    + ';({planSectionHTML:planSectionHTML, studyPlanFor:studyPlanFor, DOWS:DOWS});';
  const ctx = vm.createContext({ DOWS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], Date: FakeDate, console });
  vm.runInContext(code, ctx);
  return ctx;
}

test('the real week strip puts each spelling step in its own day cell (today Mon 9 Nov 2026)', () => {
  const ctx = weekStripEngine();
  const plan = ctx.studyPlanFor(1); // Monday's plan
  const e = {
    mood: {},
    spellingTests: [
      { id: 'sp1', lang: 'chi', words: ['听写', '老师', '学校'], testDate: '2026-11-13', routine: 'auto', days: [], missed: [], practised: [] },
      { id: 'sp2', lang: 'eng', words: ['edge', 'exist'], testDate: '2026-11-10', routine: 'auto', days: [], missed: [], practised: [] },
    ],
  };
  const out = ctx.planSectionHTML(e, plan, null);
  // Split the strip into its 7 day cells (Mon 9 – Sun 15 Nov).
  const cells = out.split('font-weight:900;font-size:.8rem">').slice(1);
  assert.equal(cells.length, 7, 'seven day cells, Mon 9 – Sun 15 Nov');
  const cellFor = (label) => cells.find((c) => c.startsWith(label));
  assert.ok(cellFor('Mon 9').includes('✏️ Spelling: Learn — Chinese, test Fri 13 Nov'), 'Monday learns the Chinese list');
  assert.ok(cellFor('Mon 9').includes('✏️ Spelling: Learn — English, test Tue 10 Nov'), 'Monday also learns the English list');
  assert.ok(cellFor('Tue 10').includes('✏️ Spelling: Practise — Chinese, test Fri 13 Nov'), 'Tuesday practises Chinese');
  assert.ok(cellFor('Tue 10').includes('✏️ Spelling: Test — English, test Tue 10 Nov'), 'Tuesday is the English test day');
  assert.ok(cellFor('Wed 11').includes('✏️ Spelling: Practise — Chinese, test Fri 13 Nov'), 'Wednesday practises Chinese');
  assert.ok(cellFor('Thu 12').includes('✏️ Spelling: Redo — Chinese, test Fri 13 Nov'), 'Thursday redoes Chinese');
  assert.ok(cellFor('Fri 13').includes('✏️ Spelling: Test — Chinese, test Fri 13 Nov'), 'Friday is the Chinese test day');
  assert.ok(!cellFor('Sat 14').includes('✏️ Spelling:'), 'Saturday has no spelling due');
  assert.ok(!cellFor('Sun 15').includes('✏️ Spelling:'), 'Sunday has no spelling due');
  // The spelling lines sit alongside the holiday badges, not instead of them.
  assert.ok(cellFor('Mon 9').includes('🎉 Deepavali (observed)'), 'Monday still shows its public-holiday badge');
});
