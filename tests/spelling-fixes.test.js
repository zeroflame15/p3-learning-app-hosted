// Spelling + per-family schedule fixes (2026-11-09):
// (a) a "Missed it" tap is persisted (live-test re-fetch, no stale
//     reference); (b) the Add-event form holds date + name together
//     across a re-render; (c) in-progress drafts survive the auto-pull
//     re-render and the parent page does not re-render mid-keystroke;
// (d) parseSpellWords splits full-width commas/semicolons; (e) Reset
//     truly clears the custom plan (merge tie-break); (f) the three
//     remaining dance-&-art strings derive from the custom plan.
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
  const re = new RegExp('function ' + name + '(?![A-Za-z0-9_$])');
  const m = re.exec(html);
  assert.ok(m, name + ' found');
  const start = m.index;
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

/* ---------------- (d) parseSpellWords: full-width separators ---------------- */

const parseSpellWords = eval(grabFn('parseSpellWords') + '\n; parseSpellWords;');

test('(d) parseSpellWords splits full-width commas and semicolons', () => {
  assert.deepEqual(parseSpellWords('你好，谢谢'), ['你好', '谢谢'], 'a full-width comma splits a Chinese list into 2 words');
  assert.deepEqual(parseSpellWords('你好，谢谢, hello；world'), ['你好', '谢谢', 'hello', 'world'], 'a mix of ASCII and full-width separators');
  assert.deepEqual(parseSpellWords('flopped down，leaned over'), ['flopped down', 'leaned over'], 'phrases keep their spaces');
  assert.deepEqual(parseSpellWords('a；b；c'), ['a', 'b', 'c'], 'full-width semicolons split');
  assert.deepEqual(parseSpellWords('disappointed, edge\nexist'), ['disappointed', 'edge', 'exist'], 'ASCII commas and newlines still work');
});

/* ---------------- (a) spellLiveTest + finishSpellWord ---------------- */

// Eval the spelling practice functions with a stubbed environment:
// a real DB + localStorage + the real merge/save, so a stale-reference
// scenario can be driven end to end.
function spellEngine() {
  const store = {};
  const localStorageStub = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
  };
  const code = [
    'var LSKEY="jiyuna-learning-web-v1";',
    'var DB=null, DEVICE_ID="test", route="spelltest", spellTest=null, spellOpenId=null, parentUnlocked=false;',
    'var syncTimer=null, syncPulling=false, syncUploadPending=false, postRetryCount=0;',
    'function todayKey(){ return "2026-11-09"; }',
    'function syncKey(){ return DB&&DB.syncCode; }',
    'function syncCodeValid(c){ return typeof c==="string"&&/^[A-Z0-9]{6}$/.test(c); }',
    'function ensureSyncCode(){}',
    'function drainPendingUpload(){}',
    'function refreshFriendBadge(){}',
    'function toast(){}',
    'function sndWrong(){} function sndCorrect(){} function sndPop(){}',
    'function speakPip(){}',
    'function render(){}',
    'function go(){}',
    'function uploadAfterPull(){} function postToServer(){} function syncFromServer(){ return Promise.resolve(false); }',
    grabFn('parseDateKey'),
    grabFn('daysUntil'),
    grabFn('nextPracticeDay'),
    grabFn('spellStepFor'),
    grabFn('unionArr'),
    grabFn('unionObjMax'),
    grabFn('unionObjLatest'),
    grabFn('isThinkingMsg'),
    grabFn('mergeThreads'),
    grabFn('pickCritterName'),
    grabFn('mergeCare'),
    grabFn('mergeLetters'),
    grabFn('mergeExplorer'),
    grabFn('saveLocal'),
    grabFn('mergeStoredIntoDB'),
    grabFn('save'),
    grabFn('syncToServer'),
    grabFn('spellLiveTest'),
    grabFn('finishSpellWord'),
    grabFn('ex'),
    ';({spellLiveTest:spellLiveTest, finishSpellWord:finishSpellWord, save:save, saveLocal:saveLocal, ex:ex, spellStepFor:spellStepFor, setDB:function(v){DB=v;}, getDB:function(){return DB;}, setSpellTest:function(v){spellTest=v;}, getSpellTest:function(){return spellTest;}, setSpellOpenId:function(v){spellOpenId=v;}, setStore:function(v){Object.assign(store,v);}, getStore:function(){return store;}});',
  ].join('\n');
  // localStorage is a real global in the eval scope; swap in the stub.
  // store is passed as a parameter because new Function bodies run in
  // the global scope and cannot see this function's locals.
  const fn = new Function('localStorage', 'store', code + '\nreturn {spellLiveTest:spellLiveTest, finishSpellWord:finishSpellWord, save:save, saveLocal:saveLocal, ex:ex, spellStepFor:spellStepFor, setDB:function(v){DB=v;}, getDB:function(){return DB;}, setSpellTest:function(v){spellTest=v;}, getSpellTest:function(){return spellTest;}, setSpellOpenId:function(v){spellOpenId=v;}, getStore:function(){return store;}};');
  return fn(localStorageStub, store);
}

function spellExplorer() {
  return {
    id: 'e1', name: 'Test', stars: 0, critterStage: 0, badges: [], treasures: [],
    discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
    hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, playBest: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [],
    deletedThreadIds: [], flashcards: [], deletedFlashcards: [], planner: [],
    deletedPlanner: [], friends: [], deletedFriends: [], friendCode: 'ABCDEF',
    nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦', lookAt: null,
    critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
    spellingTests: [{ id: 'sp1', lang: 'eng', words: ['apple', 'banana', 'cherry'], testDate: '2026-11-12', routine: 'auto', days: [], missed: [], practised: [] }],
    deletedSpellingTests: [],
  };
}

test('(a) spellLiveTest re-fetches the live test from the explorer', () => {
  const e = spellEngine();
  e.setDB({ explorers: [spellExplorer()], parentPin: '2468', dailyLimit: 30, playLimit: 20, activeId: 'e1', syncCode: 'ABCDEF', updatedAt: null, flags: [], familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null });
  e.setSpellOpenId('sp1');
  const t = e.spellLiveTest();
  assert.ok(t, 'the live test is found');
  assert.equal(t.id, 'sp1', 'it is the open test');
  assert.deepEqual(t.words, ['apple', 'banana', 'cherry'], 'the words are the live ones');
  e.setSpellOpenId('nope');
  assert.equal(e.spellLiveTest(), null, 'a missing test gives null, not a stale copy');
});

test('(a) finishSpellWord records practised on the LIVE test even when handed a stale copy', () => {
  const e = spellEngine();
  e.setDB({ explorers: [spellExplorer()], parentPin: '2468', dailyLimit: 30, playLimit: 20, activeId: 'e1', syncCode: 'ABCDEF', updatedAt: null, flags: [], familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null });
  e.setSpellOpenId('sp1');
  e.setSpellTest({ testId: 'sp1', words: ['apple', 'banana', 'cherry'], idx: 3 });
  // A stale (detached) copy of the test, as a handler would hold after
  // a background sync replaced the explorer object.
  const stale = JSON.parse(JSON.stringify(e.ex().spellingTests[0]));
  e.finishSpellWord(stale);
  assert.deepEqual(e.ex().spellingTests[0].practised, ['2026-11-09'], 'practised lands on the live test');
  assert.deepEqual(stale.practised, [], 'the stale copy is not where it was written');
});

test('(a) a Miss survives a save/merge round-trip and the card step updates', () => {
  const e = spellEngine();
  e.setDB({ explorers: [spellExplorer()], parentPin: '2468', dailyLimit: 30, playLimit: 20, activeId: 'e1', syncCode: 'ABCDEF', updatedAt: null, flags: [], familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null });
  e.setSpellOpenId('sp1');
  e.saveLocal(); // prime localStorage, as a real device would have
  e.setSpellTest({ testId: 'sp1', words: ['apple', 'banana', 'cherry'], idx: 0 });
  // Got it (apple), Missed it (banana), Got it (cherry) — each through
  // the live test, exactly as the fixed handlers do.
  function tap(kind) {
    const lt = e.spellLiveTest();
    const w = e.getSpellTest().words[e.getSpellTest().idx];
    if (kind === 'miss') { if (!lt.missed) lt.missed = []; if (lt.missed.indexOf(w) < 0) lt.missed.push(w); }
    else { lt.missed = (lt.missed || []).filter((x) => x !== w); }
    const st = e.getSpellTest(); st.idx++; e.setSpellTest(st);
    e.finishSpellWord(lt);
    e.save();
  }
  tap('got');
  tap('miss');
  tap('got');
  const live = e.ex().spellingTests[0];
  assert.deepEqual(live.missed, ['banana'], 'the missed word survives the saves');
  assert.deepEqual(live.practised, ['2026-11-09'], 'the session is recorded');
  assert.equal(e.spellStepFor(live).key, 'practise', 'the card step moves on from learn');
  assert.ok(e.spellStepFor(live).title.includes('Practise'), 'the card shows the self-test step');
  // And localStorage agrees (the persistence layer, not just memory).
  const stored = JSON.parse(e.getStore()['jiyuna-learning-web-v1']);
  assert.deepEqual(stored.explorers[0].spellingTests[0].missed, ['banana'], 'localStorage has the miss too');
});

test('(a) the practice handlers re-fetch the live test before mutating', () => {
  const bind = fnBody('function bindSpellTest(');
  assert.ok(bind.includes('spellLiveTest()'), 'bindSpellTest uses the live-test helper');
  assert.ok(bind.includes('var lt=spellLiveTest(); if(!lt)return;'), 'each answer handler re-fetches and bails on a missing test');
  assert.ok(!bind.includes('t.missed=(t.missed'), 'no handler mutates the bind-time test directly');
  assert.ok(!bind.includes('if(!t.missed)t.missed=[]'), 'the Miss handler does not push onto the bind-time test');
  const fin = fnBody('function finishSpellWord(');
  assert.ok(fin.includes('spellLiveTest()'), 'finishSpellWord re-fetches the live test');
  assert.ok(html.includes('function spellLiveTest(){'), 'the helper exists');
});

/* ---------------- (b)(c)(e) familyScheduleHTML: drafts + banner ---------------- */

function scheduleEngine(db, drafts) {
  const d = drafts || {};
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + 'var fsEvDraft=' + JSON.stringify(d.ev || null) + ';\n'
    + 'var fsPlanDraft=' + JSON.stringify(d.plan || null) + ';\n'
    + 'var fsSchedOpen=' + JSON.stringify(!!d.open) + ';\n'
    + (html.match(/var DOWS=\[[^\]]+\];/) || ['var DOWS=[];'])[0] + '\n'
    + (html.match(/var MONTHS=\[[^\]]+\];/) || ['var MONTHS=[];'])[0] + '\n'
    + (html.match(/var SUBJECTS=\{[^}]+\};/) || [])[0] + '\n'
    + grabVar('STUDY_PLAN', 'function studyPlanFor') + '\n'
    + grabFn('parseDateKey') + '\n'
    + grabFn('fmtDate') + '\n'
    + grabFn('fmtDateStr') + '\n'
    + grabFn('esc') + '\n'
    + grabFn('hasCustomPlan') + '\n'
    + grabFn('studyPlanFor') + '\n'
    + grabFn('planDayLabel') + '\n'
    + grabFn('familyEventEmoji') + '\n'
    + grabFn('familyScheduleSummaryHTML') + '\n'
    + grabFn('familyScheduleHTML') + '\n'
    + ';({familyScheduleHTML:familyScheduleHTML, setDB:function(v){DB=v;}, getDB:function(){return DB;}, setEvDraft:function(v){fsEvDraft=v;}, setPlanDraft:function(v){fsPlanDraft=v;}});';
  return eval(code);
}

test('(b) the Add-event form restores a draft date + name across a re-render', () => {
  const e = scheduleEngine({ familyEvents: [], familyPlan: null }, {
    ev: { date: '2026-11-20', name: 'Sports Day', kind: 'due', note: 'Bring water.' },
  });
  const out = e.familyScheduleHTML();
  assert.ok(out.includes('value="2026-11-20"'), 'the draft date is in the date field');
  assert.ok(out.includes('value="Sports Day"'), 'the draft name is in the name field');
  assert.ok(out.includes('value="due" selected'), 'the draft kind is selected');
  assert.ok(out.includes('value="Bring water."'), 'the draft note is in the note field');
  // And with no draft the form is blank (not pre-filled with junk).
  const blank = scheduleEngine({ familyEvents: [], familyPlan: null }, {}).familyScheduleHTML();
  assert.ok(blank.includes('id="fsEvDate"') && !blank.includes('value="2026-11-20"'), 'no draft means a blank date field');
});

test('(c) the timetable editor renders from the draft when one exists', () => {
  const draft = {
    1: { label: 'Maths + Science', subs: ['math', 'sci'], study: 'Study 4:00-5:00pm', note: 'Swimming after', rest: false, review: false, light: false },
  };
  const e = scheduleEngine({ familyEvents: [], familyPlan: null }, { plan: draft });
  const out = e.familyScheduleHTML();
  assert.ok(out.includes('Study 4:00-5:00pm'), 'the draft study time is shown');
  assert.ok(out.includes('Swimming after'), 'the draft note is shown');
  assert.ok(out.includes('Maths + Science'), 'the draft label is shown');
  // Without a draft the built-in Monday shows instead.
  const plain = scheduleEngine({ familyEvents: [], familyPlan: null }, {}).familyScheduleHTML();
  assert.ok(plain.includes('Study 3:00–4:30pm'), 'without a draft the built-in Monday shows');
  assert.ok(!plain.includes('Study 4:00-5:00pm'), 'without a draft the edited time is not shown');
});

test('(e) the schedule banner says the built-in plan is in use after a reset', () => {
  const cleared = scheduleEngine({ familyEvents: [], familyPlan: null }, {}).familyScheduleHTML();
  assert.ok(cleared.includes('No custom schedule set yet'), 'a cleared plan shows the built-in banner');
  assert.ok(!cleared.includes('Your family’s own schedule is in use'), 'a cleared plan does not claim a custom schedule');
  const custom = scheduleEngine({ familyEvents: [], familyPlan: { 1: { label: 'Maths', subs: ['math'], study: '4pm', note: '', rest: false, review: false, light: false } } }, {}).familyScheduleHTML();
  assert.ok(custom.includes('Your family’s own schedule is in use'), 'a set plan shows the custom banner');
});

test('(b)(c) the parent page wires draft capture and clears drafts on Add/Save/Reset', () => {
  const bind = fnBody('function bindParent(');
  assert.ok(bind.includes('captureEvDraft'), 'the event draft is captured on input');
  assert.ok(bind.includes('capturePlanDraft'), 'the timetable draft is captured on input');
  assert.ok(bind.includes("addEventListener('input'"), 'draft capture listens for input');
  assert.ok(bind.includes('fsEvDraft=null;'), 'adding an event clears the event draft');
  assert.ok(bind.includes('fsPlanDraft=null;'), 'saving or resetting clears the timetable draft');
  const section = fnBody('function familyScheduleHTML(');
  assert.ok(section.includes('fsEvDraft'), 'the event form reads the draft');
  assert.ok(section.includes('fsPlanDraft'), 'the timetable reads the draft');
});

/* ---------------- (c) safeToRender defers while editing ---------------- */

test('(c) safeToRender defers while the schedule form has focus, and the parent pull respects it', () => {
  const safe = fnBody('function safeToRender(');
  assert.ok(safe.includes('isEditingSchedule()'), 'safeToRender includes the editing guard');
  assert.ok(safe.includes("typeof isEditingSchedule==='function'"), 'the guard is typeof-checked, so safeToRender works even where the helper is not loaded');
  assert.ok(html.includes('function isEditingSchedule(){'), 'the guard helper exists');
  const guard = fnBody('function isEditingSchedule(');
  assert.ok(guard.includes("id==='fsEvDate'"), 'the guard covers the event date field');
  assert.ok(guard.includes("id==='fsEvName'"), 'the guard covers the event name field');
  assert.ok(guard.includes("data-fsstime"), 'the guard covers the timetable time fields');
  assert.ok(guard.includes("data-fsnote"), 'the guard covers the timetable note fields');
  const go = fnBody('function go(');
  assert.ok(go.includes("if(changed&&safeToRender())render()"), 'the parent opening pull respects safeToRender');
});

/* ---------------- (e) mergeFamilyDB: a reset wins a timestamp tie ---------------- */

const mergeFamilyDB = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer', 'mergeFamilyDB',
].map(grabFn).join('\n') + '\n; mergeFamilyDB;');

function explorerBase(overrides) {
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
    explorers: [explorerBase({})], parentPin: '2468', dailyLimit: 30, playLimit: 20,
    activeId: 'e1', syncCode: 'ABCDEF', updatedAt: '2026-11-09T00:00:00.000Z', flags: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null,
  }, over);
}

test('(e) a reset (null plan, timestamped) wins even when the timestamps tie', () => {
  const plan = { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00–5:30pm', note: '', rest: false, review: false, light: false } };
  const local = familyDB({ familyPlan: null, familyPlanUpdatedAt: '2026-11-09T03:00:00.000Z' });
  const server = familyDB({ familyPlan: plan, familyPlanUpdatedAt: '2026-11-09T03:00:00.000Z' });
  const merged = mergeFamilyDB(local, server);
  assert.equal(merged.familyPlan, null, 'the reset wins a timestamp tie');
  // And a strictly newer server plan still wins (the reset did not happen there).
  const older = mergeFamilyDB(
    familyDB({ familyPlan: null, familyPlanUpdatedAt: '2026-11-09T01:00:00.000Z' }),
    familyDB({ familyPlan: plan, familyPlanUpdatedAt: '2026-11-09T02:00:00.000Z' }));
  assert.ok(older.familyPlan, 'a strictly newer server plan still wins');
  // And when neither side carries a timestamp, the old behaviour holds.
  const untimed = mergeFamilyDB(
    familyDB({ familyPlan: null, familyPlanUpdatedAt: null }),
    familyDB({ familyPlan: plan, familyPlanUpdatedAt: null }));
  assert.ok(untimed.familyPlan, 'an untimestamped server plan is not dropped');
});

/* ---------------- (f) rest-day strings derive from the custom plan ---------------- */

function restEngine(db) {
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + grabFn('hasCustomPlan') + '\n'
    + grabFn('restDayStripText') + '\n'
    + grabFn('restDayBannerText') + '\n'
    + grabFn('restDayParentText') + '\n'
    + ';({restDayStripText:restDayStripText, restDayBannerText:restDayBannerText, restDayParentText:restDayParentText});';
  return eval(code);
}
function restPlan(note) {
  return { label: 'Rest day', subs: [], study: '', note: note || '', rest: true, review: false, light: false };
}

test('(f) the three rest-day strings come from the custom plan when one is set', () => {
  const custom = restEngine({ familyPlan: { 6: restPlan('Swimming gala 9–11am') } });
  const p = restPlan('Swimming gala 9–11am');
  assert.ok(custom.restDayStripText(p).includes('Swimming gala 9–11am'), 'the week strip uses the custom note');
  assert.ok(!custom.restDayStripText(p).includes('Dance & art'), 'the week strip does not name dance & art');
  assert.ok(custom.restDayBannerText(p).includes('Swimming gala 9–11am'), 'the Learn banner uses the custom note');
  assert.ok(!custom.restDayBannerText(p).includes('dance & art day'), 'the Learn banner does not name dance & art day');
  assert.ok(custom.restDayParentText(p).includes('Swimming gala 9–11am'), 'the parent plan uses the custom note');
  assert.ok(!custom.restDayParentText(p).includes('dance & art day'), 'the parent plan does not name dance & art day');
  // A custom rest day with no note falls back to a plain rest day, not dance & art.
  const noNote = restEngine({ familyPlan: { 6: restPlan('') } });
  assert.ok(noNote.restDayStripText(restPlan('')).includes('Rest day'), 'a note-less custom rest day is a plain rest day');
  assert.ok(noNote.restDayBannerText(restPlan('')).includes('rest day'), 'the banner is a plain rest day');
});

test('(f) without a custom plan, Jiyuna’s exact dance-&-art wording is unchanged', () => {
  const plain = restEngine({ familyPlan: null });
  const p = restPlan('');
  assert.equal(plain.restDayStripText(p), '🌴 Dance & art — no study', 'the week strip is unchanged');
  assert.equal(plain.restDayBannerText(p), '🌴 It’s dance & art day — no study quests needed. Anything you play today is pure bonus!', 'the Learn banner is unchanged');
  assert.equal(plain.restDayParentText(p), ' It is dance & art day — Pip will not set any extra study.', 'the parent plan is unchanged');
});

test('(f) the three render sites use the derived rest-day helpers', () => {
  const planSection = fnBody('function planSectionHTML(');
  assert.ok(planSection.includes('restDayStripText(p)'), 'the week strip uses the helper');
  assert.ok(!planSection.includes("'🌴 Dance & art — no study'"), 'the week strip no longer hardcodes dance & art');
  const banner = fnBody('function learnPlanBannerHTML(');
  assert.ok(banner.includes('restDayBannerText(plan)'), 'the Learn banner uses the helper');
  assert.ok(!banner.includes('It’s dance & art day'), 'the Learn banner no longer hardcodes dance & art day');
  const parent = fnBody('function parentHTML(');
  assert.ok(parent.includes('restDayParentText(tPlan)'), 'the parent plan uses the helper');
  assert.ok(!parent.includes('It is dance & art day'), 'the parent plan no longer hardcodes dance & art day');
});
