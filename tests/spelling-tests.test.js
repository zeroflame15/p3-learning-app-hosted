// "My spelling tests" (2026-11-09): per-explorer English / Chinese
// spelling lists with a test date and a routine (Recommended or the
// explorer's own practice days), plus a practice view reusing the
// HCL self-test pattern. Tests are stored per explorer and merged
// in mergeExplorer (union by id, missed/practised unioned), with a
// deletedSpellingTests tombstone so a deleted test never comes back.
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
// Brace-matching extractor: mergeExplorer nests other functions, so
// slicing to the next '\nfunction ' would cut it short.
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

const mergeExplorer = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
].map(grabFn).join('\n') + '\n; mergeExplorer;');

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
function spellTest(over) {
  return Object.assign({
    id: 'sp1', lang: 'eng', words: ['disappointed', 'edge', 'exist'],
    testDate: '2026-11-10', routine: 'auto', days: [], missed: [], practised: [],
  }, over);
}

/* ---------------- merge: spelling tests survive sync ---------------- */

test('merge keeps a spelling test added on one device', () => {
  const server = explorer({ spellingTests: [] });
  const local = explorer({ spellingTests: [spellTest({ id: 'sp1' })] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.spellingTests.length, 1, 'the test survives the merge');
  assert.equal(merged.spellingTests[0].testDate, '2026-11-10', 'the test date survives');
  assert.deepEqual(merged.spellingTests[0].words, ['disappointed', 'edge', 'exist'], 'the words survive');
});

test('merge unions missed and practised for the same test id', () => {
  const server = explorer({ spellingTests: [spellTest({ id: 'sp1', missed: ['edge'], practised: ['2026-11-08'] })] });
  const local = explorer({ spellingTests: [spellTest({ id: 'sp1', missed: ['exist'], practised: ['2026-11-09'] })] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.spellingTests.length, 1, 'one test, not two');
  assert.deepEqual(merged.spellingTests[0].missed.sort(), ['edge', 'exist'], 'missed words union');
  assert.deepEqual(merged.spellingTests[0].practised.sort(), ['2026-11-08', '2026-11-09'], 'practised days union');
  assert.equal(merged.spellingTests[0].testDate, '2026-11-10', 'the test fields do not change');
});

test('a deleted spelling test stays deleted (tombstone)', () => {
  const server = explorer({ spellingTests: [spellTest({ id: 'sp1' })], deletedSpellingTests: [] });
  const local = explorer({ spellingTests: [], deletedSpellingTests: ['sp1'] });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.spellingTests.length, 0, 'the deleted test is dropped');
  assert.deepEqual(merged.deletedSpellingTests, ['sp1'], 'the tombstone survives');
  // And a stale device holding the test cannot resurrect it.
  const again = mergeExplorer(merged, explorer({ spellingTests: [spellTest({ id: 'sp1' })] }));
  assert.equal(again.spellingTests.length, 0, 'the tombstone blocks resurrection');
});

/* ---------------- routine step: spellStepFor ---------------- */

// Eval the step function with its helpers (no DOM, no speech).
const spellFns = eval(
  (html.match(/var DOWS=\[[^\]]+\];/) || ['var DOWS=[];'])[0] + '\n'
  + 'function todayKey(){ return "2026-11-09"; }\n'
  + grabFn('parseDateKey') + '\n'
  + grabFn('daysUntil') + '\n'
  + grabFn('nextPracticeDay') + '\n'
  + grabFn('spellStepFor') + '\n'
  + ';({spellStepFor:spellStepFor, daysUntil:daysUntil});'
);

test('spellStepFor: test today is a recap', () => {
  const s = spellFns.spellStepFor(spellTest({ testDate: '2026-11-09' }), '2026-11-09');
  assert.equal(s.key, 'recap', 'test day recaps');
});

test('spellStepFor: test tomorrow, no practice yet, is learn', () => {
  const s = spellFns.spellStepFor(spellTest({ testDate: '2026-11-10', practised: [] }), '2026-11-09');
  assert.equal(s.key, 'learn', 'first practice is learn');
});

test('spellStepFor: test tomorrow, practised, missed words, is redo', () => {
  const s = spellFns.spellStepFor(spellTest({ testDate: '2026-11-10', practised: ['2026-11-09'], missed: ['edge'] }), '2026-11-09');
  assert.equal(s.key, 'redo', 'the day before, with missed words, redoes them');
});

test('spellStepFor: test tomorrow, practised, no missed words, is practise', () => {
  const s = spellFns.spellStepFor(spellTest({ testDate: '2026-11-10', practised: ['2026-11-09'], missed: [] }), '2026-11-09');
  assert.equal(s.key, 'practise', 'no missed words means a plain self-test');
});

test('spellStepFor: test in 7 days, first day is learn, later day is practise', () => {
  const first = spellFns.spellStepFor(spellTest({ testDate: '2026-11-16', practised: [] }), '2026-11-09');
  assert.equal(first.key, 'learn', 'a week out with no practice is learn');
  const later = spellFns.spellStepFor(spellTest({ testDate: '2026-11-16', practised: ['2026-11-09'] }), '2026-11-12');
  assert.equal(later.key, 'practise', 'after practice it is a self-test');
});

test('spellStepFor: a past test is past', () => {
  const s = spellFns.spellStepFor(spellTest({ testDate: '2026-11-08' }), '2026-11-09');
  assert.equal(s.key, 'past', 'a test whose date has passed is past');
});

test('spellStepFor: custom routine skips a non-practice day, works on a practice day', () => {
  // 2026-11-09 is a Monday (dow 1). Practice days Mon + Wed.
  const custom = spellTest({ testDate: '2026-11-12', routine: 'custom', days: [1, 3], practised: [] });
  const mon = spellFns.spellStepFor(custom, '2026-11-09');
  assert.equal(mon.key, 'learn', 'Monday is a practice day');
  const tue = spellFns.spellStepFor(custom, '2026-11-10');
  assert.equal(tue.key, 'skip', 'Tuesday is not a practice day');
  assert.ok(tue.text.includes('tomorrow'), 'it says the next practice (Wednesday) is tomorrow');
  // A next practice day further away is named, not "tomorrow".
  const monOnly = spellTest({ testDate: '2026-11-16', routine: 'custom', days: [1], practised: [] });
  const tue2 = spellFns.spellStepFor(monOnly, '2026-11-10');
  assert.equal(tue2.key, 'skip', 'Tuesday is not a Monday-only practice day');
  assert.ok(tue2.text.includes('Mon'), 'it names the next practice day (Mon)');
  // Test day always recaps, even if it is not a practice day.
  const thu = spellFns.spellStepFor(custom, '2026-11-12');
  assert.equal(thu.key, 'recap', 'test day recaps even on a non-practice day');
});

test('spellStepFor: custom routine with no days ticked behaves like Recommended', () => {
  const s = spellFns.spellStepFor(spellTest({ testDate: '2026-11-12', routine: 'custom', days: [], practised: [] }), '2026-11-10');
  assert.equal(s.key, 'learn', 'no days means every day is a practice day');
});

/* ---------------- words parsing: parseSpellWords ---------------- */

const parseSpellWords = eval(grabFn('parseSpellWords') + '\n; parseSpellWords;');

test('parseSpellWords: one per line, commas, or mixed — phrases keep their spaces', () => {
  assert.deepEqual(parseSpellWords('disappointed\nedge\nexist'), ['disappointed', 'edge', 'exist'], 'one per line');
  assert.deepEqual(parseSpellWords('disappointed, edge, exist'), ['disappointed', 'edge', 'exist'], 'comma-separated');
  assert.deepEqual(parseSpellWords('flopped down\nleaned over, muffin'), ['flopped down', 'leaned over', 'muffin'], 'phrases keep their spaces');
  assert.deepEqual(parseSpellWords('  edge  \n\nedge\n exist '), ['edge', 'exist'], 'trims, skips blanks, dedupes');
  assert.deepEqual(parseSpellWords(''), [], 'empty input gives no words');
});

/* ---------------- Learn page: the card, the form, the practice view ---------------- */

test('Learn page has a My spelling tests card with an Add button', () => {
  const card = fnBody('function spellTestsEntryHTML(');
  assert.ok(card.includes('My spelling tests'), 'the card is titled');
  assert.ok(card.includes('id="spAddBtn"'), 'an Add a test button');
  assert.ok(card.includes('data-spellopen'), 'each test has a Practise button');
  assert.ok(card.includes('data-spelldel'), 'each test has a Delete button');
  assert.ok(card.includes('spellStepFor(t)'), 'each row shows today’s step');
  const learn = fnBody('function learnHTML(');
  assert.ok(learn.includes('spellTestsEntryHTML(e)'), 'the card is on the Learn page');
  assert.ok(learn.indexOf('spellTestsEntryHTML(e)') > learn.indexOf('hclEntryHTML(e)'), 'it sits after the HCL routine card');
});

test('the add form has language, words, date and routine choice', () => {
  const form = fnBody('function openSpellAddModal(');
  assert.ok(form.includes('id="spAddLang"'), 'a language picker');
  assert.ok(form.includes('value="eng"') && form.includes('value="chi"'), 'English and Chinese');
  assert.ok(form.includes('id="spAddWords"'), 'a words field');
  assert.ok(form.includes('id="spAddDate"') && form.includes('type="date"'), 'a test-date picker');
  assert.ok(form.includes('value="auto"') && form.includes('value="custom"'), 'Recommended / My own days');
  assert.ok(form.includes('class="spDay"'), 'weekday tick boxes for a custom routine');
  assert.ok(form.includes('parseSpellWords'), 'the words go through the parser');
  assert.ok(form.includes("id:'sp'"), 'the new test gets a timestamp id');
});

test('the practice view reuses the HCL self-test pattern', () => {
  const view = fnBody('function spellTestHTML(');
  assert.ok(view.includes('data-spelllisten'), 'a Listen button per word');
  assert.ok(view.includes('id="spStart"'), 'a Start the self-test button');
  assert.ok(view.includes('id="spGot"') && view.includes('id="spMiss"'), 'Got it / Missed it');
  assert.ok(view.includes('id="spDone"'), 'a Done button when finished');
  assert.ok(view.includes("step.key==='skip'"), 'a custom routine shows no practice on a rest day');
  assert.ok(view.includes("step.key==='past'"), 'a past test offers Delete');
  const bind = fnBody('function bindSpellTest(');
  assert.ok(bind.includes('speakPip'), 'Listen speaks the word');
  assert.ok(bind.includes("step.key==='redo'"), 'a redo step tests only the missed words');
  assert.ok(bind.includes('finishSpellWord'), 'finishing records the practice day');
  const del = fnBody('function deleteSpellTest(');
  assert.ok(del.includes('confirm('), 'delete asks first');
  assert.ok(del.includes('deletedSpellingTests'), 'delete writes the tombstone');
  const route = html.includes("else if(route==='spelltest')c.innerHTML=spellTestHTML(),bindSpellTest();");
  assert.ok(route, 'the spelltest route renders the practice view');
});

test('new explorers start with empty spelling tests', () => {
  const ne = fnBody('function newExplorer(');
  assert.ok(ne.includes('spellingTests:[]'), 'spellingTests starts empty');
  assert.ok(ne.includes('deletedSpellingTests:[]'), 'the tombstone starts empty');
});
