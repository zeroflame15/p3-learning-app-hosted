// P1/P2 have no Science — planner + Trivia (2026-11-17, Bryan):
// "leave out anything about science from p1 and p2, be it in
// planner or trivia." Extends p1-p2-no-science.test.js (Learn +
// quest board). The gates:
//   - planFor(e, dow): a level-aware copy of the studyPlanFor day
//     with 'sci' dropped from subs and the label re-derived
//     (Tue 'Science + Chinese' -> 'Chinese', Thu 'Maths +
//     Science' -> 'Maths'; a day left with no subjects becomes a
//     review day). STUDY_PLAN and studyPlanFor are unchanged; the
//     family schedule EDITOR still edits the raw plan, and the
//     notes list is family-written free text, not subject labels.
//   - triviaOrder/triviaHTML: a P1/P2 explorer never gets a
//     Science question in any deck (not under 'all', not under
//     'sci'), never sees the '🔬 Science' pill, and the footer
//     names only English, Maths and Chinese. A saved 'sci'
//     category, or a deck built before a level change, falls back
//     to All topics on open.
// P3–P6 are completely unchanged. The real functions are loaded
// from public/index.html into eval engines (same approach as
// family-schedule.test.js) — nothing here re-implements the app.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

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

/* ---------------- planFor ---------------- */

function planEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + (html.match(/var SUBJECTS=\{[^}]+\};/) || [])[0] + '\n'
    + grabVar('STUDY_PLAN', 'function studyPlanFor') + '\n'
    + grabFn('studyPlanFor') + '\n'
    + grabFn('planDayLabel') + '\n'
    + grabFn('levelNum') + '\n'
    + grabFn('planFor') + '\n'
    + ';({studyPlanFor:studyPlanFor, planDayLabel:planDayLabel, planFor:planFor, STUDY_PLAN:STUDY_PLAN, setDB:function(v){DB=v;}, getDB:function(){return DB;}});';
  return eval(code); // eslint-disable-line no-eval
}
const P1 = { id: 'e1', level: 'P1' };
const P2 = { id: 'e1', level: 'P2' };
const P3 = { id: 'e1', level: 'P3' };
const NO_PLAN = { familyPlan: null };

test('planFor: Tue/Thu drop Science for P1/P2, labels re-derived; P3 unchanged', () => {
  const e = planEngine(NO_PLAN);
  for (const lv of [P1, P2]) {
    const tue = e.planFor(lv, 2);
    assert.deepEqual(tue.subs, ['chi'], lv.level + ' Tue: only Chinese left');
    assert.equal(tue.label, 'Chinese', lv.level + ' Tue label is just Chinese');
    const thu = e.planFor(lv, 4);
    assert.deepEqual(thu.subs, ['math'], lv.level + ' Thu: only Maths left');
    assert.equal(thu.label, 'Maths', lv.level + ' Thu label is just Maths');
    const mon = e.planFor(lv, 1);
    assert.deepEqual(mon.subs, ['eng', 'math'], lv.level + ' Mon untouched');
    assert.equal(mon.label, 'English + Maths', lv.level + ' Mon label untouched');
  }
  const tue3 = e.planFor(P3, 2);
  assert.deepEqual(tue3.subs, ['sci', 'chi'], 'P3 Tue keeps Science');
  assert.equal(tue3.label, 'Science + Chinese', 'P3 Tue label unchanged');
  const thu3 = e.planFor(P3, 4);
  assert.deepEqual(thu3.subs, ['math', 'sci'], 'P3 Thu keeps Science');
  assert.equal(thu3.label, 'Maths + Science', 'P3 Thu label unchanged');
});

test('planFor: a custom day with only Science becomes a review day for P1/P2', () => {
  const sciOnly = { label: 'Science', subs: ['sci'], study: 'Study 3:00–4:30pm', note: '', rest: false, review: false, light: false };
  const e = planEngine({ familyPlan: { 2: sciOnly } });
  for (const lv of [P1, P2]) {
    const day = e.planFor(lv, 2);
    assert.deepEqual(day.subs, [], lv.level + ': no subjects left');
    assert.equal(day.label, 'Review day', lv.level + ': a subject-less day is a review day');
    assert.equal(day.review, true, lv.level + ': flagged as a review day');
    assert.equal(day.study, 'Study 3:00–4:30pm', lv.level + ': study time is kept');
  }
  const day3 = e.planFor(P3, 2);
  assert.deepEqual(day3.subs, ['sci'], 'P3 keeps the custom Science day');
  assert.equal(day3.label, 'Science', 'P3 keeps its label');
  // The stored family plan is never mutated by the filter.
  assert.deepEqual(e.getDB().familyPlan[2].subs, ['sci'], 'the saved custom day still has Science');
});

test('planFor: rest and review days keep their own labels for P1/P2', () => {
  const e = planEngine(NO_PLAN);
  for (const lv of [P1, P2]) {
    const sat = e.planFor(lv, 6);
    assert.equal(sat.rest, true, lv.level + ' Sat is still a rest day');
    assert.equal(sat.label, 'Dance & art day', lv.level + ' Sat keeps its rest label');
    assert.deepEqual(sat.subs, [], lv.level + ' Sat has no subjects');
    const sun = e.planFor(lv, 0);
    assert.equal(sun.label, 'Sunday review', lv.level + ' Sun keeps its own label, not "Review day"');
    assert.equal(sun.review, true, lv.level + ' Sun is still a review day');
  }
});

test('planFor: never mutates the built-in plan; null explorer sees the raw day', () => {
  const e = planEngine(NO_PLAN);
  e.planFor(P1, 2);
  e.planFor(P2, 4);
  assert.deepEqual(e.STUDY_PLAN[2].subs, ['sci', 'chi'], 'the built-in Tuesday still lists Science');
  assert.equal(e.STUDY_PLAN[2].label, 'Science + Chinese', 'the built-in Tuesday label is untouched');
  assert.deepEqual(e.STUDY_PLAN[4].subs, ['math', 'sci'], 'the built-in Thursday still lists Science');
  const raw = e.planFor(null, 2);
  assert.equal(raw.label, 'Science + Chinese', 'no explorer: the raw day');
  assert.deepEqual(raw.subs, ['sci', 'chi'], 'no explorer: raw subjects');
  assert.strictEqual(e.planFor(P3, 2), e.studyPlanFor(2), 'P3 gets the stored day itself, no copy');
});

test('gates live in the page: displays use planFor, the editor still uses the raw plan', () => {
  for (const s of [
    'var todayPlan=planFor(e, new Date().getDay());',
    'var p=planFor(e, d.getDay());',
    'var plan=planFor(e, new Date().getDay());',
    'planFor(e, new Date().getDay()).subs.indexOf(t.sub)>=0',
    'var day=planFor(e, dow);',
    'var tPlan=planFor(sel, tmrD.getDay());',
    'planFor(sel, new Date().getDay()).label',
    'familyScheduleHTML(sel)',
  ]) assert.ok(html.includes(s), 'display uses planFor: ' + s);
  assert.ok(html.includes("var day=(fsPlanDraft&&fsPlanDraft[dow])||studyPlanFor(dow);"), 'the timetable editor still reads the raw plan');
  assert.ok(html.includes('function planFor(e, dow){'), 'planFor is defined');
});

/* ---------------- triviaOrder / triviaHTML ---------------- */

function triviaEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + grabVar('TRIVIA', 'var triviaState') + '\n'
    + grabVar('TRIVIA_CATS', '/* Trivia bank') + '\n'
    + 'var triviaState=null;\n'
    + grabFn('shuffle') + '\n'
    + grabFn('ex') + '\n'
    + grabFn('levelNum') + '\n'
    + grabFn('triviaP12') + '\n'
    + grabFn('triviaOrder') + '\n'
    + grabFn('esc') + '\n'
    + grabFn('triviaHTML') + '\n'
    + 'function pageHero(){ return "<div class=\\"hero\\"></div>"; }\n'
    + ';({triviaOrder:triviaOrder, triviaHTML:triviaHTML, TRIVIA:TRIVIA, setState:function(s){triviaState=s;}, getState:function(){return triviaState;}, setDB:function(v){DB=v;}});';
  return eval(code); // eslint-disable-line no-eval
}
function engineFor(level) {
  return triviaEngine({ explorers: [{ id: 'e1', level: level }], activeId: 'e1' });
}
function sciIdxs(TRIVIA) {
  return TRIVIA.map(function (t, i) { return t.cat === 'sci' ? i : -1; }).filter(function (i) { return i >= 0; });
}

test('triviaOrder: no Science question in any deck for P1/P2; P3 unchanged', () => {
  for (const lv of ['P1', 'P2']) {
    const e = engineFor(lv);
    const sci = sciIdxs(e.TRIVIA);
    assert.equal(sci.length, 12, 'the bank still holds 12 Science questions');
    const all = e.triviaOrder('all');
    assert.equal(all.length, e.TRIVIA.length - 12, lv + ': All topics drops the 12 Science questions');
    assert.ok(all.every(function (i) { return e.TRIVIA[i].cat !== 'sci'; }), lv + ': no Science in the All deck');
    const sciDeck = e.triviaOrder('sci');
    assert.equal(sciDeck.length, e.TRIVIA.length - 12, lv + ': asking for Science falls back to All minus Science');
    assert.ok(sciDeck.every(function (i) { return e.TRIVIA[i].cat !== 'sci'; }), lv + ': the fallback deck has no Science either');
    const eng = e.triviaOrder('eng');
    assert.ok(eng.length > 0 && eng.every(function (i) { return e.TRIVIA[i].cat === 'eng'; }), lv + ': the English deck is untouched');
  }
  const e3 = engineFor('P3');
  assert.equal(e3.triviaOrder('all').length, e3.TRIVIA.length, 'P3 All topics covers the whole bank');
  const sci3 = e3.triviaOrder('sci');
  assert.equal(sci3.length, 12, 'P3 still gets all 12 Science questions');
  assert.ok(sci3.every(function (i) { return e3.TRIVIA[i].cat === 'sci'; }), 'P3 Science deck is all Science');
  const noEx = triviaEngine({ explorers: [{ id: 'e1', level: 'P1' }], activeId: 'nobody' });
  assert.equal(noEx.triviaOrder('all').length, noEx.TRIVIA.length, 'no current explorer: the full bank, like P3');
});

test('triviaHTML: no Science pill, footer names only English, Maths and Chinese for P1/P2', () => {
  for (const lv of ['P1', 'P2']) {
    const e = engineFor(lv);
    e.setState(null);
    const h = e.triviaHTML();
    assert.ok(!h.includes('data-tcat="sci"'), lv + ': no Science category button');
    assert.ok(!h.includes('🔬 Science'), lv + ': no Science pill anywhere');
    assert.ok(h.includes('English, Maths and Chinese — plus General Knowledge'), lv + ': footer names three subjects');
    assert.ok(!h.includes('English, Maths, Science and Chinese'), lv + ': footer never names Science');
    const st = e.getState();
    assert.notEqual(e.TRIVIA[st.order[st.idx]].cat, 'sci', lv + ': the shown question is not Science');
  }
  const e3 = engineFor('P3');
  e3.setState(null);
  const h3 = e3.triviaHTML();
  assert.ok(h3.includes('data-tcat="sci"'), 'P3 still gets the Science category button');
  assert.ok(h3.includes('🔬 Science'), 'P3 still sees the Science pill');
  assert.ok(h3.includes('English, Maths, Science and Chinese — plus General Knowledge'), 'P3 footer still names all four subjects');
});

test('triviaHTML: a saved Science category falls back to All topics for P1/P2', () => {
  for (const lv of ['P1', 'P2']) {
    const e = engineFor(lv);
    const sci = sciIdxs(e.TRIVIA);
    e.setState({ cat: 'sci', order: sci.slice(), idx: 0, revealed: false, seen: 0 });
    const h = e.triviaHTML();
    const st = e.getState();
    assert.equal(st.cat, 'all', lv + ': saved Science category resets to All topics');
    assert.ok(st.order.every(function (i) { return e.TRIVIA[i].cat !== 'sci'; }), lv + ': the rebuilt deck has no Science');
    assert.notEqual(e.TRIVIA[st.order[st.idx]].cat, 'sci', lv + ': the shown question is not Science');
    assert.ok(!h.includes('🔬 Science'), lv + ': no Science pill after the reset');
  }
});

test('triviaHTML: a stale deck built before a level change is rebuilt for P1/P2', () => {
  const e = engineFor('P1');
  const sci = sciIdxs(e.TRIVIA);
  const eng = e.TRIVIA.map(function (t, i) { return t.cat === 'eng' ? i : -1; }).filter(function (i) { return i >= 0; });
  // An All-topics deck from when the explorer was P3, pointing at a Science question.
  e.setState({ cat: 'all', order: [sci[0], eng[0], eng[1]], idx: 0, revealed: false, seen: 0 });
  e.triviaHTML();
  const st = e.getState();
  assert.ok(st.order.indexOf(sci[0]) < 0, 'P1: the stale Science question is gone from the deck');
  assert.notEqual(e.TRIVIA[st.order[st.idx]].cat, 'sci', 'P1: the shown question is not Science');
  // Control: the same stale deck renders as-is for P3.
  const e3 = engineFor('P3');
  e3.setState({ cat: 'all', order: [sci[0], eng[0], eng[1]], idx: 0, revealed: false, seen: 0 });
  e3.triviaHTML();
  const st3 = e3.getState();
  assert.equal(st3.order[0], sci[0], 'P3: the deck is left alone');
  assert.equal(e3.TRIVIA[st3.order[st3.idx]].cat, 'sci', 'P3: the Science question still shows');
});
