// Schedule editor + Home week holiday badges (2026-11-09).
// (1) A rest day in the timetable editor switches that day's subject
// checkboxes and study-time field off (and clears any ticked
// subjects); readFamilyPlanFromForm also forces subs=[] and an empty
// study time for a rest day, so a stale tick can never survive.
// (2) Study time and Note are two unmistakably separate, clearly
// labelled fields per day, and they round-trip independently.
// (3) Home > My week marks MOE school holidays (term breaks +
// single days) per calendar date, from the MOE 2026/2027 calendar.
// (4) The same strip marks Singapore public holidays (MOM gazetted,
// observed Mondays included). A day that is both shows both badges.
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
function grabVar(name, nextMarker) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, 'var ' + name + ' found');
  const end = html.indexOf(nextMarker, start);
  assert.ok(end > start, nextMarker + ' not found after var ' + name);
  return html.slice(start, end);
}

/* ---------- holiday helpers: eval the real constants + fns ---------- */

function holidayEngine() {
  const code = grabVar('MOE_SCHOOL_HOLIDAYS', 'var MOE_SCHOOL_HOLIDAY_DAYS') + '\n'
    + grabVar('MOE_SCHOOL_HOLIDAY_DAYS', 'var SG_PUBLIC_HOLIDAYS') + '\n'
    + grabVar('SG_PUBLIC_HOLIDAYS', '/* Returns the school-holiday name') + '\n'
    + grabFn('isSchoolHoliday') + '\n'
    + grabFn('isPublicHoliday') + '\n'
    + ';({isSchoolHoliday:isSchoolHoliday, isPublicHoliday:isPublicHoliday});';
  return eval(code);
}

/* ---------------- (3) MOE school holidays ---------------- */

test('isSchoolHoliday: true inside every 2026 term-break range', () => {
  const e = holidayEngine();
  assert.equal(e.isSchoolHoliday('2026-03-14'), 'March holidays', 'March break starts 14 Mar');
  assert.equal(e.isSchoolHoliday('2026-03-22'), 'March holidays', 'March break ends 22 Mar');
  assert.equal(e.isSchoolHoliday('2026-06-15'), 'June holidays', 'mid-June is a holiday');
  assert.equal(e.isSchoolHoliday('2026-05-30'), 'June holidays', 'June break starts 30 May');
  assert.equal(e.isSchoolHoliday('2026-06-28'), 'June holidays', 'June break ends 28 Jun');
  assert.equal(e.isSchoolHoliday('2026-09-05'), 'September holidays', 'September break starts 5 Sep');
  assert.equal(e.isSchoolHoliday('2026-09-13'), 'September holidays', 'September break ends 13 Sep');
  assert.equal(e.isSchoolHoliday('2026-11-21'), 'Year-end holidays', 'year-end starts 21 Nov');
  assert.equal(e.isSchoolHoliday('2026-12-25'), 'Year-end holidays', 'Christmas Day is inside the year-end break');
  assert.equal(e.isSchoolHoliday('2026-12-31'), 'Year-end holidays', 'year-end ends 31 Dec');
});

test('isSchoolHoliday: true inside every 2027 term-break range', () => {
  const e = holidayEngine();
  assert.equal(e.isSchoolHoliday('2027-03-13'), 'March holidays');
  assert.equal(e.isSchoolHoliday('2027-03-21'), 'March holidays');
  assert.equal(e.isSchoolHoliday('2027-05-29'), 'June holidays');
  assert.equal(e.isSchoolHoliday('2027-06-27'), 'June holidays');
  assert.equal(e.isSchoolHoliday('2027-09-04'), 'September holidays');
  assert.equal(e.isSchoolHoliday('2027-09-12'), 'September holidays');
  assert.equal(e.isSchoolHoliday('2027-11-20'), 'Year-end holidays');
  assert.equal(e.isSchoolHoliday('2027-12-31'), 'Year-end holidays');
});

test('isSchoolHoliday: true for every single-day MOE holiday, false on school days', () => {
  const e = holidayEngine();
  const singles = {
    '2026-07-06': 'Youth Day (school holiday)',
    '2026-09-04': "Teachers' Day",
    '2026-10-02': "Children's Day",
    '2027-02-09': 'Off in lieu',
    '2027-05-03': 'Off in lieu',
    '2027-07-05': 'Youth Day (school holiday)',
    '2027-08-10': 'Day after National Day',
    '2027-09-03': "Teachers' Day",
    '2027-10-08': "Children's Day",
  };
  for (const [k, name] of Object.entries(singles)) assert.equal(e.isSchoolHoliday(k), name, k + ' is ' + name);
  // Mon 27 Dec 2027 is an off-in-lieu day, but it falls inside the
  // year-end break, so the range name is what the badge shows.
  assert.equal(e.isSchoolHoliday('2027-12-27'), 'Year-end holidays', '27 Dec 2027 is inside the year-end break');
  assert.equal(e.isSchoolHoliday('2026-11-10'), null, 'Tue 10 Nov 2026 is a normal Term 4 school day');
  assert.equal(e.isSchoolHoliday('2027-01-05'), null, 'Tue 5 Jan 2027 is a normal Term 1 school day');
  assert.equal(e.isSchoolHoliday('2026-02-10'), null, 'Tue 10 Feb 2026 is a normal Term 1 school day');
  assert.equal(e.isSchoolHoliday('2026-03-13'), null, 'day before the March break is a school day');
  assert.equal(e.isSchoolHoliday('2026-03-23'), null, 'day after the March break is a school day');
  assert.equal(e.isSchoolHoliday('2026-09-04'), "Teachers' Day", 'Teachers’ Day is the day before the September break, not inside it');
});

/* ---------------- (4) Singapore public holidays ---------------- */

test('isPublicHoliday: every listed 2026 date, with the right name', () => {
  const e = holidayEngine();
  const days = {
    '2026-01-01': "New Year's Day",
    '2026-02-17': 'Chinese New Year',
    '2026-02-18': 'Chinese New Year',
    '2026-03-21': 'Hari Raya Puasa',
    '2026-04-03': 'Good Friday',
    '2026-05-01': 'Labour Day',
    '2026-05-27': 'Hari Raya Haji',
    '2026-05-31': 'Vesak Day',
    '2026-06-01': 'Vesak Day (observed)',
    '2026-08-09': 'National Day',
    '2026-08-10': 'National Day (observed)',
    '2026-11-08': 'Deepavali',
    '2026-11-09': 'Deepavali (observed)',
    '2026-12-25': 'Christmas Day',
  };
  for (const [k, name] of Object.entries(days)) assert.equal(e.isPublicHoliday(k), name, k + ' is ' + name);
  assert.equal(e.isPublicHoliday('2026-11-10'), null, 'Tue 10 Nov 2026 is not a public holiday');
  assert.equal(e.isPublicHoliday('2026-02-19'), null, 'Thu 19 Feb 2026 is not a public holiday');
});

test('isPublicHoliday: every listed 2027 date, with the right name', () => {
  const e = holidayEngine();
  const days = {
    '2027-01-01': "New Year's Day",
    '2027-02-06': 'Chinese New Year',
    '2027-02-07': 'Chinese New Year',
    '2027-02-08': 'Chinese New Year (observed)',
    '2027-03-10': 'Hari Raya Puasa',
    '2027-03-26': 'Good Friday',
    '2027-05-01': 'Labour Day',
    '2027-05-17': 'Hari Raya Haji',
    '2027-05-20': 'Vesak Day',
    '2027-08-09': 'National Day',
    '2027-10-28': 'Deepavali',
    '2027-12-25': 'Christmas Day',
  };
  for (const [k, name] of Object.entries(days)) assert.equal(e.isPublicHoliday(k), name, k + ' is ' + name);
  assert.equal(e.isPublicHoliday('2027-01-05'), null, 'Tue 5 Jan 2027 is not a public holiday');
  assert.equal(e.isPublicHoliday('2027-05-02'), null, 'Sun 2 May 2027 is not a public holiday (Labour Day fell on Sat, no observed Monday)');
});

/* ---------------- (5) a day that is both shows both ---------------- */

test('a day can be both a school holiday and a public holiday', () => {
  const e = holidayEngine();
  assert.equal(e.isSchoolHoliday('2026-06-01'), 'June holidays', 'Mon 1 Jun 2026 is inside the June break');
  assert.equal(e.isPublicHoliday('2026-06-01'), 'Vesak Day (observed)', 'and it is the observed Vesak Day');
  assert.equal(e.isSchoolHoliday('2026-05-31'), 'June holidays', 'Vesak Day itself is inside the June break too');
  assert.equal(e.isPublicHoliday('2026-05-31'), 'Vesak Day');
  assert.equal(e.isSchoolHoliday('2026-11-09'), null, 'Deepavali observed is a public holiday only — Term 4 is still running');
  assert.equal(e.isPublicHoliday('2026-11-09'), 'Deepavali (observed)');
});

test('the week strip renders both badges on a both-holiday day', () => {
  const section = fnBody('function planSectionHTML(');
  assert.ok(section.includes('isSchoolHoliday('), 'the strip checks school holidays per cell');
  assert.ok(section.includes('isPublicHoliday('), 'the strip checks public holidays per cell');
  assert.ok(section.includes('🏖️'), 'a school-holiday badge is rendered');
  assert.ok(section.includes('🎉'), 'a public-holiday badge is rendered');
});

/* ---- behavioural: render the real week strip with "today" = Mon 1 Jun 2026 ---- */

function weekStripEngine() {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(2026, 5, 1, 12, 0, 0); // Mon 1 Jun 2026, noon local
      else super(...args);
    }
    static now() { return new RealDate(2026, 5, 1, 12, 0, 0).getTime(); }
  }
  const code = 'var DB={familyPlan:null,familyEvents:[]};\n'
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
    + grabFn('dateKeyOf') + '\n'
    + grabFn('todayKey') + '\n'
    + 'function spellHomeNudgeHTML(e){ return \'\'; }\n'
    + grabFn('planSectionHTML') + '\n'
    + ';({planSectionHTML:planSectionHTML, studyPlanFor:studyPlanFor, DOWS:DOWS});';
  const ctx = vm.createContext({ DOWS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], Date: FakeDate, console });
  vm.runInContext(code, ctx);
  return ctx;
}

test('week strip: Mon 1 Jun 2026 shows both badges; the rest of the week shows the school-holiday badge only', () => {
  const ctx = weekStripEngine();
  const plan = ctx.studyPlanFor(1); // Monday's plan
  const out = ctx.planSectionHTML({ mood: {} }, plan, null);
  assert.ok(out.includes('Mon 1'), 'the strip shows Monday 1 June');
  assert.ok(out.includes('🏖️ June holidays'), 'the June-break badge is on the week');
  assert.ok(out.includes('🎉 Vesak Day (observed)'), 'the observed Vesak Day badge is on Monday 1 June');
  const both = (out.match(/🏖️ June holidays/g) || []).length;
  assert.equal(both, 7, 'every day Mon 1 – Sun 7 Jun 2026 is inside the June break');
  const pub = (out.match(/🎉 Vesak Day \(observed\)/g) || []).length;
  assert.equal(pub, 1, 'the public-holiday badge appears exactly once — on Monday');
});

/* ---------- (1)+(2) editor: fake-DOM engine for read + sync ---------- */

function editorEngine(days) {
  // days: {dow: {rest, subs:[...], study, note}} — element objects are
  // kept live so tests can assert on disabled/checked after syncRestDay.
  const els = {};
  function mkEl(kind, dow, sub) {
    const d = days[dow] || {};
    if (kind === 'rest') return { checked: !!d.rest, disabled: false, getAttribute: () => String(dow) };
    if (kind === 'sub') return { checked: (d.subs || []).indexOf(sub) >= 0, disabled: false, getAttribute: () => dow + ':' + sub };
    if (kind === 'time') return { value: d.study || '', disabled: false };
    return { value: d.note || '', disabled: false };
  }
  for (let dow = 0; dow < 7; dow++) {
    els['[data-fsrest="' + dow + '"]'] = mkEl('rest', dow);
    for (const s of ['eng', 'math', 'sci', 'chi']) els['[data-fssub="' + dow + ':' + s + '"]'] = mkEl('sub', dow, s);
    els['[data-fsstime="' + dow + '"]'] = mkEl('time', dow);
    els['[data-fsnote="' + dow + '"]'] = mkEl('note', dow);
  }
  const documentStub = {
    querySelector: (sel) => els[sel] || null,
    querySelectorAll: () => [],
  };
  const code = grabFn('planDayLabel') + '\n'
    + grabFn('readFamilyPlanFromForm') + '\n'
    + grabFn('syncRestDay');
  const sandbox = { document: documentStub, SUBJECTS: { eng: 'English', math: 'Maths', sci: 'Science', chi: 'Chinese' } };
  // planDayLabel needs SUBJECTS; readFamilyPlanFromForm / syncRestDay need document.
  const ctx = vm.createContext(sandbox);
  vm.runInContext('var SUBJECTS={eng:"English",math:"Maths",sci:"Science",chi:"Chinese"};\n' + code, ctx);
  return { read: ctx.readFamilyPlanFromForm, sync: ctx.syncRestDay, els, ctx };
}

test('readFamilyPlanFromForm: a rest day returns no subjects and no study time, even with stale ticks', () => {
  const { read } = editorEngine({ 6: { rest: true, subs: ['eng', 'math'], study: '3:00–4:30pm', note: 'Dance 12:00–1:00pm · Art 1:30–3:00pm' } });
  const plan = read();
  assert.equal(plan[6].subs.length, 0, 'rest day has no subjects');
  assert.equal(plan[6].study, '', 'rest day has no study time');
  assert.equal(plan[6].rest, true);
  assert.equal(plan[6].label, 'Rest day');
  assert.equal(plan[6].note, 'Dance 12:00–1:00pm · Art 1:30–3:00pm', 'the activity stays in the Note');
});

test('readFamilyPlanFromForm: a normal day keeps its subjects, study time and note independently', () => {
  const { read, els } = editorEngine({ 1: { rest: false, subs: ['eng', 'math'], study: '3:00–4:30pm', note: 'Higher Chinese 5:00–7:00pm' } });
  let plan = read();
  assert.equal([...plan[1].subs].join(','), 'eng,math', 'subjects kept');
  assert.equal(plan[1].study, '3:00–4:30pm');
  assert.equal(plan[1].note, 'Higher Chinese 5:00–7:00pm');
  assert.equal(plan[1].label, 'English + Maths');
  // Changing only the study time does not clobber the note, and vice versa.
  els['[data-fsstime="1"]'].value = '4:00–5:30pm';
  plan = read();
  assert.equal(plan[1].study, '4:00–5:30pm', 'study time updated');
  assert.equal(plan[1].note, 'Higher Chinese 5:00–7:00pm', 'note untouched by a study-time change');
  els['[data-fsnote="1"]'].value = 'Swim class in the morning';
  plan = read();
  assert.equal(plan[1].study, '4:00–5:30pm', 'study time untouched by a note change');
  assert.equal(plan[1].note, 'Swim class in the morning', 'note updated');
});

test('syncRestDay: ticking rest disables + clears subjects and disables study time; unticking re-enables', () => {
  const { sync, els } = editorEngine({ 3: { rest: false, subs: ['chi'], study: 'Light study 3:00–4:00pm', note: 'Higher Chinese 5:00–7:00pm' } });
  sync(3);
  assert.equal(els['[data-fssub="3:chi"]'].disabled, false, 'subjects enabled while not a rest day');
  assert.equal(els['[data-fsstime="3"]'].disabled, false, 'study time enabled while not a rest day');
  els['[data-fsrest="3"]'].checked = true;
  sync(3);
  assert.equal(els['[data-fssub="3:chi"]'].checked, false, 'ticked subject is cleared on rest');
  assert.equal(els['[data-fssub="3:chi"]'].disabled, true, 'subject checkbox is disabled on rest');
  assert.equal(els['[data-fssub="3:eng"]'].disabled, true, 'all four subjects are disabled on rest');
  assert.equal(els['[data-fsstime="3"]'].disabled, true, 'study time is disabled on rest');
  assert.equal(els['[data-fsnote="3"]'].disabled, false, 'the Note stays editable on a rest day');
  els['[data-fsrest="3"]'].checked = false;
  sync(3);
  assert.equal(els['[data-fssub="3:chi"]'].disabled, false, 'subjects re-enable when rest is unticked');
  assert.equal(els['[data-fsstime="3"]'].disabled, false, 'study time re-enables when rest is unticked');
});

test('editor: rest days render subjects + study time disabled, and the two fields are clearly labelled', () => {
  const section = fnBody('function familyScheduleHTML(');
  assert.ok(section.includes("disabled"), 'rest days render disabled inputs');
  assert.ok(section.includes('>Study time</label>'), 'a clearly labelled Study time field');
  assert.ok(section.includes('Note — classes, reminders'), 'a clearly labelled Note field');
  assert.ok(!section.includes('Study time / description'), 'the muddled Study time / description label is gone');
  assert.ok(!section.includes('Note / enrichment'), 'the muddled Note / enrichment label is gone');
  const bind = fnBody('function bindParent(');
  assert.ok(bind.includes('syncRestDay('), 'the rest-day switch is wired in the editor');
  assert.ok(bind.includes("getAttribute('data-fsrest')"), 'the switch reads which day was toggled');
});
