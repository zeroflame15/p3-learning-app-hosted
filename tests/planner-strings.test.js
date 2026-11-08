// Planner strings (2026-11-09): two sentences used to name Jiyuna's
// classes even for a family with its own timetable — the "Weekly
// enrichment: Higher Chinese..." line and the "School ends ~2:00pm"
// / rest-day Dance-and-art feedback. With no custom plan they keep
// Jiyuna's exact wording; with a custom family plan they are
// derived from the family's own timetable (its note / enrichment
// fields), via the studyPlanFor accessor.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function grabVar(name, nextMarker) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, 'var ' + name + ' found');
  const end = html.indexOf(nextMarker, start);
  assert.ok(end > start, nextMarker + ' not found after var ' + name);
  return html.slice(start, end);
}
// Brace-matching extractor (from memory-merge.test.js).
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

/* The engine: a stubbed DB + the real accessors and helpers. */
function planEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + (html.match(/var SUBJECTS=\{[^}]+\};/) || [])[0] + '\n'
    + (html.match(/var DOWS=\[[^\]]+\];/) || [])[0] + '\n'
    + grabVar('STUDY_PLAN', 'function studyPlanFor') + '\n'
    + grabFn('studyPlanFor') + '\n'
    + grabFn('planDayLabel') + '\n'
    + grabFn('hasCustomPlan') + '\n'
    + grabFn('enrichmentLine') + '\n'
    + grabFn('schoolDayLine') + '\n'
    + grabFn('restDayText') + '\n'
    + ';({studyPlanFor:studyPlanFor, planDayLabel:planDayLabel, hasCustomPlan:hasCustomPlan, enrichmentLine:enrichmentLine, schoolDayLine:schoolDayLine, restDayText:restDayText, setDB:function(v){DB=v;}});';
  return eval(code);
}
/* A complete 7-day custom timetable; notes only on the days given. */
function customPlan(notes, restDow) {
  const plan = {};
  for (let dow = 0; dow < 7; dow++) {
    plan[dow] = {
      label: 'Custom ' + dow, subs: restDow === dow ? [] : ['eng'],
      study: '4:00–5:00pm', note: (notes && notes[dow]) || '',
      rest: restDow === dow, review: false, light: false,
    };
  }
  return plan;
}

const JIUNA_ENRICHMENT = 'Weekly enrichment: ✏️ Higher Chinese — Wednesdays 5:00–7:00pm · 💃 Dance — Saturdays 12:00–1:00pm · 🎨 Art — Saturdays 1:30–3:00pm';
const JIUNA_REST = 'Dance (12–1pm) and art (1:30–3pm) are the day’s adventures.';

test('no custom plan: Jiyuna’s exact wording is unchanged', () => {
  const e = planEngine({ familyPlan: null });
  assert.equal(e.hasCustomPlan(), false, 'no custom plan set');
  assert.equal(e.enrichmentLine(), JIUNA_ENRICHMENT, 'the enrichment line is Jiyuna’s, word for word');
  assert.equal(
    e.schoolDayLine({ study: 'Study 3:00–4:30pm', label: 'English + Maths' }),
    '🏫 School ends ~2:00pm → 🍽️ lunch & shower → 📚 Study 3:00–4:30pm',
    'the school-day line still says school ends ~2:00pm'
  );
  assert.equal(e.restDayText({ note: 'anything' }), JIUNA_REST, 'the rest-day feedback still names dance and art');
});

test('custom plan: the enrichment line is built from the family’s own notes', () => {
  const e = planEngine({ familyPlan: customPlan({ 3: 'Piano 4:00–5:00pm', 6: 'Swimming 9:00–10:00am' }) });
  assert.equal(e.hasCustomPlan(), true, 'a custom plan is set');
  assert.equal(
    e.enrichmentLine(),
    'Weekly enrichment: Wed — Piano 4:00–5:00pm · Sat — Swimming 9:00–10:00am',
    'the line lists the family’s notes by day'
  );
  assert.ok(!e.enrichmentLine().includes('Higher Chinese'), 'no Jiyuna class leaks in');
  assert.ok(!e.enrichmentLine().includes('Dance'), 'no Jiyuna enrichment leaks in');
});

test('custom plan: a timetable with no notes gets a neutral enrichment line', () => {
  const e = planEngine({ familyPlan: customPlan({}) });
  assert.ok(e.enrichmentLine().startsWith('Weekly enrichment: no enrichment noted'), 'an empty-notes plan says so plainly');
  assert.ok(!e.enrichmentLine().includes('Higher Chinese'), 'no Jiyuna class leaks in');
});

test('custom plan: the school-day line drops the ~2:00pm school end and shows the family’s study time', () => {
  const e = planEngine({ familyPlan: customPlan({}) });
  assert.equal(
    e.schoolDayLine({ study: '4:00–5:30pm', label: 'Maths + English' }),
    '📚 4:00–5:30pm',
    'just the family’s study description'
  );
  assert.ok(!e.schoolDayLine({ study: '4:00–5:30pm', label: 'Maths + English' }).includes('School ends'), 'no school-end time is invented');
  assert.equal(
    e.schoolDayLine({ study: '', label: 'Review day' }),
    '📚 Review day',
    'an empty study time falls back to the day label'
  );
});

test('custom plan: the rest-day feedback comes from that day’s note', () => {
  const e = planEngine({ familyPlan: customPlan({}, 6) });
  const sat = e.studyPlanFor(6);
  assert.equal(sat.rest, true, 'Saturday is a rest day in this custom plan');
  assert.equal(
    e.restDayText({ note: 'Family picnic at the park', rest: true }),
    'Family picnic at the park — the day’s adventure.',
    'the rest-day feedback uses the family’s note'
  );
  assert.equal(
    e.restDayText({ note: '', rest: true }),
    'It’s a rest day — the day’s adventure is yours to choose.',
    'a rest day with no note gets a generic line'
  );
  assert.ok(!e.restDayText({ note: 'Family picnic at the park', rest: true }).includes('Dance'), 'no Jiyuna enrichment leaks in');
});

test('the planner render calls the helpers, and Jiyuna’s wording lives only in their built-in branches', () => {
  const sched = html.slice(html.indexOf('function schoolScheduleHTML'), html.indexOf('function learnPlanBannerHTML'));
  assert.ok(sched.includes('enrichmentLine()'), 'the schedule card calls enrichmentLine()');
  assert.ok(!sched.includes('Higher Chinese — Wednesdays'), 'the hardcoded enrichment line is out of the render');
  const plan = html.slice(html.indexOf('function planSectionHTML'), html.indexOf('function schoolScheduleHTML'));
  assert.ok(plan.includes('schoolDayLine(plan)'), 'the week card calls schoolDayLine(plan)');
  assert.ok(plan.includes('restDayText(plan)'), 'the week card calls restDayText(plan)');
  assert.ok(!plan.includes('School ends ~2:00pm'), 'the hardcoded school-end time is out of the render');
  assert.ok(!plan.includes('Dance (12–1pm) and art (1:30–3pm)'), 'the hardcoded dance-and-art line is out of the render');
  // The exact Jiyuna wording still exists — inside the helpers, as
  // the fallback when no custom plan is set.
  assert.ok(html.includes(JIUNA_ENRICHMENT), 'the Jiyuna enrichment line is kept as the built-in fallback');
  assert.ok(html.includes(JIUNA_REST), 'the Jiyuna rest-day line is kept as the built-in fallback');
});
