// Spelling plan (2026-11-09): the hardcoded Higher Chinese spelling
// routine is gone (the words change every week — the owner adds them
// as a Chinese spelling test instead), and the "Recommended" routine
// is now a followable day-by-day plan derived from the test date:
// Learn on the first practice day, Practise on the middle days,
// Redo the missed words the day before the test, Recap on test day.
// The plan shows under each test on Learn and in the practice view
// (today highlighted), with a Home nudge when a test is due soon.
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
function grabLine(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  return html.slice(start, html.indexOf('\n', start));
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
  + grabFn('spellPlanLine') + '\n'
  + grabFn('spellHomeNudgeHTML') + '\n'
  + grabFn('spellParentLine') + '\n'
  + ';({spellStepFor:spellStepFor, spellPlanFor:spellPlanFor, spellPlanLine:spellPlanLine, spellHomeNudgeHTML:spellHomeNudgeHTML, spellParentLine:spellParentLine});'
);

function spellTest(over) {
  return Object.assign({
    id: 'sp1', lang: 'eng', words: ['disappointed', 'edge', 'exist'],
    testDate: '2026-11-13', routine: 'auto', days: [], missed: [], practised: [],
  }, over);
}
function planKeys(plan) { return plan.map(function (p) { return p.key; }); }
function planDates(plan) { return plan.map(function (p) { return p.date; }); }

/* ---------------- the plan: derivation from test date ---------------- */

test('spellPlanFor: test 4 days away is Learn, Practise, Practise, Redo, Recap', () => {
  // Today Mon 2026-11-09, test Fri 2026-11-13.
  const plan = spellFns.spellPlanFor(spellTest({ testDate: '2026-11-13' }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['learn', 'practise', 'practise', 'redo', 'recap'],
    'the full routine, one entry per day');
  assert.deepEqual(planDates(plan), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'],
    'every day from today to the test');
  assert.equal(plan[4].isTest, true, 'the last entry is the test day');
  assert.equal(plan[0].done, false, 'nothing practised yet');
});

test('spellPlanFor: test 2 days away is Learn, Redo, Recap', () => {
  const plan = spellFns.spellPlanFor(spellTest({ testDate: '2026-11-11' }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['learn', 'redo', 'recap'], 'no middle Practise day when the test is close');
  assert.deepEqual(planDates(plan), ['2026-11-09', '2026-11-10', '2026-11-11']);
});

test('spellPlanFor: test tomorrow is Learn today, Recap tomorrow', () => {
  const plan = spellFns.spellPlanFor(spellTest({ testDate: '2026-11-10' }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['learn', 'recap'], 'compressed to two days');
});

test('spellPlanFor: test today is Recap only', () => {
  const plan = spellFns.spellPlanFor(spellTest({ testDate: '2026-11-09' }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['recap'], 'no practice days left');
  assert.equal(plan[0].isTest, true, 'today is the test day');
});

test('spellPlanFor: a past test has no plan', () => {
  assert.deepEqual(spellFns.spellPlanFor(spellTest({ testDate: '2026-11-08' }), '2026-11-09'), [],
    'nothing to follow once the test has passed');
});

test('spellPlanFor: after practice, the first day is Practise, not Learn', () => {
  const plan = spellFns.spellPlanFor(
    spellTest({ testDate: '2026-11-13', practised: ['2026-11-09'] }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['practise', 'practise', 'practise', 'redo', 'recap'],
    'once practice has started, today is a self-test');
  assert.equal(plan[0].done, true, 'today is marked practised');
});

test('spellPlanFor: the day before the test, already practised, is Redo', () => {
  const plan = spellFns.spellPlanFor(
    spellTest({ testDate: '2026-11-10', practised: ['2026-11-09'] }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['redo', 'recap'],
    'the day before is a redo once practice has started');
  assert.equal(plan[0].done, true, 'today is marked practised');
});

test('spellPlanFor: custom routine uses only the ticked weekdays, test day always recaps', () => {
  // Test Thu 2026-11-12, practice days Mon + Wed.
  const plan = spellFns.spellPlanFor(
    spellTest({ testDate: '2026-11-12', routine: 'custom', days: [1, 3] }), '2026-11-09');
  assert.deepEqual(planKeys(plan), ['learn', 'redo', 'recap'],
    'Monday learns, Wednesday (the day before) redoes, Thursday tests');
  assert.deepEqual(planDates(plan), ['2026-11-09', '2026-11-11', '2026-11-12'],
    'Tuesday is skipped — it is not a practice day');
  // A custom routine whose practice day is not today starts on the next one.
  const wedOnly = spellFns.spellPlanFor(
    spellTest({ testDate: '2026-11-12', routine: 'custom', days: [3] }), '2026-11-09');
  assert.deepEqual(planKeys(wedOnly), ['learn', 'recap'],
    'the first practice day (Wednesday) is the Learn day');
  assert.deepEqual(planDates(wedOnly), ['2026-11-11', '2026-11-12']);
});

/* ---------------- the plan line: followable, with checkmarks ---------------- */

test('spellPlanLine: the example line lists every day with its step and date', () => {
  const line = spellFns.spellPlanLine(spellTest({ testDate: '2026-11-13' }), '2026-11-09');
  assert.ok(line.includes('Pip’s plan:'), 'labelled as Pip’s plan for Recommended');
  assert.ok(line.includes('Learn Mon 9 Nov'), 'Learn on the first day');
  assert.ok(line.includes('Practise Tue 10 Nov'), 'Practise the next day');
  assert.ok(line.includes('Redo Thu 12 Nov'), 'Redo the day before the test');
  assert.ok(line.includes('Test Fri 13 Nov'), 'the test day is labelled Test');
  assert.ok(!line.includes('✓'), 'no checkmarks before any practice');
});

test('spellPlanLine: practised days get a checkmark', () => {
  const line = spellFns.spellPlanLine(
    spellTest({ testDate: '2026-11-13', practised: ['2026-11-09', '2026-11-10'] }), '2026-11-09');
  assert.ok(line.includes('✓ Practise Mon 9 Nov'), 'Monday practised');
  assert.ok(line.includes('✓ Practise Tue 10 Nov'), 'Tuesday practised');
  assert.ok(!line.includes('✓ Practise Wed 11 Nov'), 'Wednesday not practised yet');
});

test('spellPlanLine: a custom routine is labelled as the family’s own days', () => {
  const line = spellFns.spellPlanLine(
    spellTest({ testDate: '2026-11-12', routine: 'custom', days: [1, 3] }), '2026-11-09');
  assert.ok(line.includes('Your days:'), 'custom routines are the family’s own days');
  assert.ok(line.includes('Learn Mon 9 Nov'), 'Monday learns');
  assert.ok(line.includes('Test Thu 12 Nov'), 'Thursday tests');
});

test('spellPlanLine: a long plan collapses the middle', () => {
  // Test Thu 2026-11-19, ten days away — eleven entries.
  const line = spellFns.spellPlanLine(spellTest({ testDate: '2026-11-19' }), '2026-11-09');
  assert.ok(line.includes('…'), 'the middle is collapsed');
  assert.ok(line.includes('Learn Mon 9 Nov'), 'the first day still shows');
  assert.ok(line.includes('Redo Wed 18 Nov'), 'the day before the test still shows');
  assert.ok(line.includes('Test Thu 19 Nov'), 'the test day still shows');
  assert.ok(!line.includes('Wed 11 Nov'), 'a middle Practise day is hidden');
});

test('spellPlanLine: with highlight, today gets the gold pill', () => {
  const line = spellFns.spellPlanLine(spellTest({ testDate: '2026-11-13' }), '2026-11-09', true);
  assert.ok(line.includes('background:var(--gold)'), 'today is highlighted');
  assert.ok(line.includes('>Learn Mon 9 Nov<'), 'today’s step is the highlighted one');
  const plain = spellFns.spellPlanLine(spellTest({ testDate: '2026-11-13' }), '2026-11-09', false);
  assert.ok(!plain.includes('background:var(--gold)'), 'no highlight without the flag');
});

test('spellPlanLine: a past test has no line', () => {
  assert.equal(spellFns.spellPlanLine(spellTest({ testDate: '2026-11-08' }), '2026-11-09'), '',
    'nothing to show once the test has passed');
});

/* ---------------- the step agrees with the plan ---------------- */

test('spellStepFor: the day before the test is a redo even with no missed words', () => {
  // The plan says Redo the day before, so the step must agree — with
  // a full-list check when nothing was missed (the practice view
  // falls back to the whole list, never an empty self-test).
  const s = spellFns.spellStepFor(
    spellTest({ testDate: '2026-11-10', practised: ['2026-11-09'], missed: [] }), '2026-11-09');
  assert.equal(s.key, 'redo', 'the day before is a redo');
  assert.ok(s.text.includes('full-list'), 'it says the redo is a full-list check when nothing was missed');
  const withMissed = spellFns.spellStepFor(
    spellTest({ testDate: '2026-11-10', practised: ['2026-11-09'], missed: ['edge'] }), '2026-11-09');
  assert.equal(withMissed.key, 'redo', 'the day before with missed words is also a redo');
  const first = spellFns.spellStepFor(spellTest({ testDate: '2026-11-10', practised: [] }), '2026-11-09');
  assert.equal(first.key, 'learn', 'no practice yet still learns first, even the day before');
});

test('the practice view falls back to the full list for a redo with no missed words', () => {
  const bind = fnBody('function bindSpellTest(');
  assert.ok(bind.includes("step.key==='redo'&&lt.missed&&lt.missed.length"),
    'a redo only tests the missed words when there are missed words');
  assert.ok(bind.includes('lt.words.slice()'), 'otherwise it falls back to the whole list');
});

/* ---------------- the plan is shown where it can be followed ---------------- */

test('Learn shows the plan under each test row', () => {
  const card = fnBody('function spellTestsEntryHTML(');
  assert.ok(card.includes('spellPlanLine(t)'), 'each test row shows its plan line');
  assert.ok(card.includes('spellStepFor(t)'), 'each row still shows today’s step');
});

test('the practice view shows the plan with today highlighted', () => {
  const view = fnBody('function spellTestHTML(');
  assert.ok(view.includes('spellPlanLine(t, null, true)'), 'the plan line is in the practice view, highlighted');
});

test('Home nudges the next spelling test when it is due within 3 days', () => {
  const plan = fnBody('function planSectionHTML(');
  assert.ok(plan.includes('spellHomeNudgeHTML(e)'), 'the week section includes the spelling nudge');
  const nudge = spellFns.spellHomeNudgeHTML({
    spellingTests: [spellTest({ testDate: '2026-11-11', lang: 'eng' })],
  });
  assert.ok(nudge.includes('Spelling test'), 'a test two days away nudges');
  assert.ok(nudge.includes('Wed 11 Nov'), 'it names the test date');
  assert.ok(nudge.includes('My spelling tests'), 'it says where to practise');
  const far = spellFns.spellHomeNudgeHTML({
    spellingTests: [spellTest({ testDate: '2026-11-16', lang: 'eng' })],
  });
  assert.equal(far, '', 'a test a week away stays quiet');
  const customSkip = spellFns.spellHomeNudgeHTML({
    spellingTests: [spellTest({ testDate: '2026-11-12', routine: 'custom', days: [3] })],
  });
  assert.equal(customSkip, '', 'a custom routine stays quiet on a non-practice day');
  assert.equal(spellFns.spellHomeNudgeHTML({ spellingTests: [] }), '', 'no tests, no nudge');
  assert.equal(spellFns.spellHomeNudgeHTML({}), '', 'no spellingTests field, no nudge');
});

test('the Grown-ups evening summary names the next spelling test', () => {
  const parent = fnBody('function parentHTML(');
  assert.ok(parent.includes('spellParentLine(sel)'), 'the summary uses the spelling line');
  const line = spellFns.spellParentLine({
    spellingTests: [
      spellTest({ testDate: '2026-11-13', lang: 'chi', missed: ['老师'] }),
      spellTest({ testDate: '2026-11-10', lang: 'eng', missed: [] }),
    ],
  });
  assert.ok(line.includes('English test Tue 10 Nov'), 'the earliest upcoming test is named');
  assert.ok(line.includes('today: Learn the list'), 'today’s step is named');
  assert.ok(line.includes('Missed words: none'), 'the missed words are named');
  const none = spellFns.spellParentLine({ spellingTests: [] });
  assert.ok(none.includes('none set yet'), 'no tests says so plainly');
});

/* ---------------- the custom routine still works exactly as-is ---------------- */

test('the custom routine is untouched: skip, practice and test-day recap', () => {
  // 2026-11-09 is a Monday (dow 1). Practice days Mon + Wed.
  const custom = spellTest({ testDate: '2026-11-12', routine: 'custom', days: [1, 3], practised: [] });
  assert.equal(spellFns.spellStepFor(custom, '2026-11-09').key, 'learn', 'Monday is a practice day');
  assert.equal(spellFns.spellStepFor(custom, '2026-11-10').key, 'skip', 'Tuesday is not a practice day');
  assert.equal(spellFns.spellStepFor(custom, '2026-11-12').key, 'recap', 'test day recaps even on a non-practice day');
  const noDays = spellFns.spellStepFor(
    spellTest({ testDate: '2026-11-12', routine: 'custom', days: [], practised: [] }), '2026-11-10');
  assert.equal(noDays.key, 'learn', 'a custom routine with no days ticked behaves like Recommended');
});

/* ---------------- the hardcoded HCL routine is gone ---------------- */

test('no HCL routine code remains referenced anywhere in the page', () => {
  for (const name of ['hclStepFor', 'HCL_WORDS', 'hclMissed', 'hclTest',
    'hclCardHTML', 'hclEntryHTML', 'spellingHTML', 'bindSpelling',
    'hclOpen', 'hclBack', 'hclStart', 'hclGot', 'hclMiss', 'hclDone', 'data-hcllisten']) {
    assert.ok(!html.includes(name), 'the page no longer references ' + name);
  }
  assert.ok(!html.includes("route==='spelling'"), 'the spelling sub-view route is gone');
  assert.ok(!html.includes('function hclStepFor'), 'hclStepFor is not defined');
  assert.ok(!html.includes('var HCL_WORDS'), 'HCL_WORDS is not defined');
  assert.ok(!html.includes('var hclTest'), 'hclTest is not defined');
});

test('mergeExplorer and newExplorer no longer carry hclMissed', () => {
  const merge = fnBody('function mergeExplorer(');
  assert.ok(!merge.includes('hclMissed'), 'the merge no longer unions hclMissed');
  const ne = fnBody('function newExplorer(');
  assert.ok(!ne.includes('hclMissed'), 'new explorers no longer start with hclMissed');
  assert.ok(!ne.includes('Practise this week’s 听写 words'), 'the default planner no longer names the HCL list');
  assert.ok(ne.includes('spellingTests:[]'), 'the generic spelling tests are still there');
});

test('the Wednesday HCL class is still in the timetable — only the spelling words are gone', () => {
  assert.ok(html.includes('Higher Chinese 5:00–7:00pm'), 'the Wednesday HCL class time stays');
  assert.ok(html.includes('Higher Chinese — Wednesdays 5:00–7:00pm'), 'the enrichment line still names the class');
  assert.ok(html.includes('Light study, then Higher Chinese'), 'the Wednesday timetable label stays');
});

test('the generic My spelling tests feature is fully intact', () => {
  assert.ok(html.includes('function spellStepFor'), 'the step function stays');
  assert.ok(html.includes('function spellTestHTML'), 'the practice view stays');
  assert.ok(html.includes('function spellTestsEntryHTML'), 'the Learn card stays');
  assert.ok(html.includes("route==='spelltest'"), 'the spelltest route stays');
  const learn = fnBody('function learnHTML(');
  assert.ok(learn.includes('spellTestsEntryHTML(e)'), 'the card is on the Learn page');
  assert.ok(!learn.includes('hclEntryHTML'), 'the HCL entry card is gone from Learn');
});
