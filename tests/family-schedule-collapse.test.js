// Parent-page schedule collapse + Change PIN fix (2026-11-09).
// (1) The "Our school & study schedule" section is collapsed by
//     default; the summary shows the SAVED setup and the editor opens
//     with "Change schedule". Saving collapses back to the summary.
// (2) A just-saved timetable could be reverted by a second linked
//     device whose clock runs fast (mergeFamilyDB trusted wall-clock
//     familyPlanUpdatedAt). A monotonic familyPlanRev counter, bumped
//     on every Save/Reset and compared before the timestamp, fixes it.
// (3) The parent-page Change PIN showed a false "Parent PIN changed."
//     toast while the PIN did not change: the merge did
//     server.parentPin || local.parentPin, so the server's old PIN
//     won on upload. A parentPinUpdatedAt timestamp (set by the
//     parent change and by the admin reset) with the merge taking the
//     later one fixes it — without breaking admin-reset propagation.
// (4) The Change PIN form closed by itself on re-render. It is now
//     rendered by parentHTML while pinChangeOpen, with the typed value
//     held in pinChDraft and restored on every render.
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
function grabVar(name, nextMarker) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, 'var ' + name + ' found');
  const end = html.indexOf(nextMarker, start);
  assert.ok(end > start, nextMarker + ' not found after var ' + name);
  return html.slice(start, end);
}

/* ---------------- mergeFamilyDB (revision + PIN timestamp) ---------------- */

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
    explorers: [explorer({})], parentPin: '2468', parentPinUpdatedAt: null,
    dailyLimit: 30, playLimit: 20,
    activeId: 'e1', syncCode: 'ABCDEF', updatedAt: '2026-11-09T00:00:00.000Z', flags: [],
    familyEvents: [], deletedFamilyEvents: [], familyPlan: null, familyPlanUpdatedAt: null, familyPlanRev: 0,
  }, over);
}

test('mergeFamilyDB: a just-saved plan beats a stale plan stamped later by a fast clock (regression)', () => {
  // Reproduced 2026-11-09 with the real merge: device A saves a NEW
  // plan at 03:29 and uploads; device B holds the OLD plan whose
  // fast clock stamped it 03:35. B pulled, kept OLD, re-posted it,
  // and A pulled OLD back — the save "didn't take effect".
  // The revision counter fixes it: A's save is rev 5, B's stale plan
  // is rev 4, so the NEW plan wins whatever the clocks say.
  const planNew = { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00-5:30pm', note: 'NEW', rest: false, review: false, light: false } };
  const planOld = { 1: { label: 'English + Maths', subs: ['eng', 'math'], study: '3:00-4:30pm', note: 'OLD', rest: false, review: false, light: false } };
  // Server holds A's NEW plan @ rev 5, stamped 03:29.
  const server = familyDB({ familyPlan: planNew, familyPlanUpdatedAt: '2026-11-09T03:29:00.000Z', familyPlanRev: 5 });
  // B holds the OLD plan @ rev 4, stamped 03:35 by its fast clock.
  const bLocal = familyDB({ familyPlan: planOld, familyPlanUpdatedAt: '2026-11-09T03:35:00.000Z', familyPlanRev: 4 });
  const bMerged = mergeFamilyDB(bLocal, server);
  assert.equal(bMerged.familyPlan[1].note, 'NEW', 'the newer revision wins over the later wall-clock stamp');
  assert.equal(bMerged.familyPlanRev, 5, 'the winning revision is carried');
  // B re-posts its merged copy; A pulls again and still has NEW.
  const aLocal = familyDB({ familyPlan: planNew, familyPlanUpdatedAt: '2026-11-09T03:29:00.000Z', familyPlanRev: 5 });
  const aMerged = mergeFamilyDB(aLocal, bMerged);
  assert.equal(aMerged.familyPlan[1].note, 'NEW', 'the just-saved plan survives the round trip');
});

test('mergeFamilyDB: equal revisions fall back to the later timestamp', () => {
  const planA = { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00-5:30pm', note: '', rest: false, review: false, light: false } };
  const planB = { 1: { label: 'English + Maths', subs: ['eng', 'math'], study: '3:00-4:30pm', note: '', rest: false, review: false, light: false } };
  const merged = mergeFamilyDB(
    familyDB({ familyPlan: planA, familyPlanUpdatedAt: '2026-11-09T02:00:00.000Z', familyPlanRev: 3 }),
    familyDB({ familyPlan: planB, familyPlanUpdatedAt: '2026-11-09T01:00:00.000Z', familyPlanRev: 3 }));
  assert.equal(merged.familyPlan[1].label, 'Maths + English', 'the later timestamp wins when revisions tie');
  const other = mergeFamilyDB(
    familyDB({ familyPlan: planB, familyPlanUpdatedAt: '2026-11-09T01:00:00.000Z', familyPlanRev: 3 }),
    familyDB({ familyPlan: planA, familyPlanUpdatedAt: '2026-11-09T02:00:00.000Z', familyPlanRev: 3 }));
  assert.equal(other.familyPlan[1].label, 'Maths + English', 'the later server timestamp wins too');
});

test('mergeFamilyDB: a reset (null plan, higher revision) clears the timetable', () => {
  const plan = { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: '4:00-5:30pm', note: '', rest: false, review: false, light: false } };
  const merged = mergeFamilyDB(
    familyDB({ familyPlan: null, familyPlanUpdatedAt: '2026-11-09T03:00:00.000Z', familyPlanRev: 6 }),
    familyDB({ familyPlan: plan, familyPlanUpdatedAt: '2026-11-09T04:00:00.000Z', familyPlanRev: 5 }));
  assert.equal(merged.familyPlan, null, 'the reset propagates even when the server stamp is later');
  assert.equal(merged.familyPlanRev, 6, 'the reset revision is carried');
});

test('mergeFamilyDB: a local PIN change survives the merge (regression)', () => {
  // Reproduced 2026-11-09: the parent page set DB.parentPin=1357 and
  // saved, but the merge did server.parentPin || local.parentPin, so
  // the server's old 2468 won on upload and the toast lied.
  const merged = mergeFamilyDB(
    familyDB({ parentPin: '1357', parentPinUpdatedAt: '2026-11-09T03:30:00.000Z' }),
    familyDB({ parentPin: '2468', parentPinUpdatedAt: '2026-11-09T03:00:00.000Z' }));
  assert.equal(merged.parentPin, '1357', 'the newer local PIN change wins');
  assert.equal(merged.parentPinUpdatedAt, '2026-11-09T03:30:00.000Z', 'the change timestamp is carried');
});

test('mergeFamilyDB: an admin reset propagates over a stale local PIN', () => {
  // The admin reset writes straight to the server with a fresh
  // timestamp; a device holding the old PIN must take the new one.
  // Flipping the merge to local-wins would break this — it must stay
  // later-timestamp-wins.
  const merged = mergeFamilyDB(
    familyDB({ parentPin: '2468', parentPinUpdatedAt: '2026-11-09T03:00:00.000Z' }),
    familyDB({ parentPin: '1357', parentPinUpdatedAt: '2026-11-09T03:31:00.000Z' }));
  assert.equal(merged.parentPin, '1357', 'the newer server PIN (admin reset) wins');
});

test('mergeFamilyDB: PIN tie goes to local; no timestamps keep the old server-first behaviour', () => {
  const tied = mergeFamilyDB(
    familyDB({ parentPin: '1357', parentPinUpdatedAt: '2026-11-09T03:30:00.000Z' }),
    familyDB({ parentPin: '2468', parentPinUpdatedAt: '2026-11-09T03:30:00.000Z' }));
  assert.equal(tied.parentPin, '1357', 'a tie goes to the local change, mirroring the plan tie-break');
  const legacy = mergeFamilyDB(
    familyDB({ parentPin: '1357', parentPinUpdatedAt: null }),
    familyDB({ parentPin: '2468', parentPinUpdatedAt: null }));
  assert.equal(legacy.parentPin, '2468', 'with no timestamps anywhere the old server-first fallback is kept');
});

/* ---------------- schedule collapse: summary + toggle ---------------- */

function scheduleEngine(db, state) {
  state = state || {};
  const code = 'var DB=' + JSON.stringify(db) + ';\n'
    + 'var fsEvDraft=' + JSON.stringify(state.ev || null) + ';\n'
    + 'var fsPlanDraft=' + JSON.stringify(state.plan || null) + ';\n'
    + 'var fsSchedOpen=' + JSON.stringify(!!state.open) + ';\n'
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
    + ';({familyScheduleHTML:familyScheduleHTML, familyScheduleSummaryHTML:familyScheduleSummaryHTML});';
  return eval(code);
}

test('schedule collapse: collapsed by default, the summary shows the saved setup', () => {
  const custom = scheduleEngine({
    familyEvents: [{ id: 'fe1', date: '2026-11-20', name: 'Sports Day', kind: 'event', note: '', e: '📌' }],
    familyPlan: { 1: { label: 'Maths + English', subs: ['math', 'eng'], study: 'Study 4:00-5:00pm', note: '', rest: false, review: false, light: false } },
  }, {}).familyScheduleHTML();
  assert.ok(custom.includes('id="fsSchedToggle"'), 'the toggle button is present');
  assert.ok(custom.includes('Change schedule'), 'collapsed, the button offers to change the schedule');
  assert.ok(custom.includes('Sports Day'), 'the summary shows the saved custom event');
  assert.ok(custom.includes('Maths + English'), 'the summary shows the saved Monday plan');
  assert.ok(custom.includes('Study 4:00-5:00pm'), 'the summary shows the saved study time');
  assert.ok(custom.includes('id="fsSchedEditor" style="display:none"'), 'the editor is hidden while collapsed');
  // The editor is still in the DOM (hidden), so the existing editor
  // and its draft capture keep working.
  assert.ok(custom.includes('id="fsPlanSave"'), 'the Save button is in the DOM even while collapsed');
  assert.ok(custom.includes('id="fsEvAdd"'), 'the Add event button is in the DOM even while collapsed');
});

test('schedule collapse: no custom schedule means the summary says the built-in is in use', () => {
  const out = scheduleEngine({ familyEvents: [], familyPlan: null }, {}).familyScheduleHTML();
  assert.ok(out.includes('Using the built-in schedule'), 'the summary says the built-in schedule is in use');
  assert.ok(!out.includes('Your family’s own schedule is in use'), 'it does not claim a custom schedule');
  // The built-in days still show in the summary, so the parent sees
  // what the app is actually using.
  assert.ok(out.includes('English + Maths'), 'the built-in Monday shows in the summary');
});

test('schedule collapse: expanded, the editor is visible and the toggle offers to hide it', () => {
  const out = scheduleEngine({ familyEvents: [], familyPlan: null }, { open: true }).familyScheduleHTML();
  assert.ok(out.includes('Hide editor'), 'expanded, the button offers to hide the editor');
  assert.ok(out.includes('id="fsSchedEditor"'), 'the editor container is present');
  assert.ok(!out.includes('id="fsSchedEditor" style="display:none"'), 'the editor is not hidden while expanded');
  assert.ok(out.includes('Weekly study timetable'), 'the timetable editor shows while expanded');
});

test('schedule collapse: saving bumps the revision and collapses to the summary', () => {
  const bind = fnBody('function bindParent(');
  const saveStart = bind.indexOf("getElementById('fsPlanSave')");
  assert.ok(saveStart >= 0, 'the Save handler exists');
  const saveBody = bind.slice(saveStart, bind.indexOf('fsPlanReset', saveStart));
  assert.ok(saveBody.includes('familyPlanRev=(DB.familyPlanRev||0)+1'), 'saving bumps the plan revision');
  assert.ok(saveBody.includes('fsSchedOpen=false'), 'saving collapses back to the summary');
  const resetStart = bind.indexOf("getElementById('fsPlanReset')");
  assert.ok(resetStart >= 0, 'the Reset handler exists');
  const resetBody = bind.slice(resetStart, resetStart + 600);
  assert.ok(resetBody.includes('familyPlanRev=(DB.familyPlanRev||0)+1'), 'resetting bumps the plan revision');
  assert.ok(resetBody.includes('fsSchedOpen=false'), 'resetting collapses back to the summary');
  const tog = bind.indexOf("getElementById('fsSchedToggle')");
  assert.ok(tog >= 0, 'the toggle is wired in bindParent');
  assert.ok(bind.slice(tog, tog + 200).includes('fsSchedOpen=!fsSchedOpen'), 'the toggle flips the collapsed state');
});

/* ---------------- Change PIN form: survives a re-render ---------------- */

test('Change PIN: the form is rendered by parentHTML while open, with the draft value', () => {
  const parent = fnBody('function parentHTML(');
  assert.ok(parent.includes('pinChangeOpen'), 'parentHTML renders the Change PIN form from the open flag');
  assert.ok(parent.includes("value=\"'+esc(pinChDraft)+'\""), 'the form restores the typed PIN draft');
  assert.ok(parent.includes('id="pinCh"'), 'the new-PIN field is in the form');
  assert.ok(parent.includes('id="pinChSave"'), 'the Save PIN button is in the form');
});

test('Change PIN: bindParent opens via state, captures the draft, and stamps the change', () => {
  const bind = fnBody('function bindParent(');
  assert.ok(bind.includes('pinChangeOpen=!pinChangeOpen'), 'the Change PIN button toggles the open flag');
  assert.ok(bind.includes("pinChDraft=pinChEl.value||''"), 'the typed PIN is captured into the draft on input');
  const saveStart = bind.indexOf("getElementById('pinChSave')");
  assert.ok(saveStart >= 0, 'the Save PIN handler exists');
  const saveBody = bind.slice(saveStart, saveStart + 600);
  assert.ok(saveBody.includes('DB.parentPinUpdatedAt=new Date().toISOString()'), 'saving stamps the PIN change so the merge takes it');
  assert.ok(saveBody.includes('pinChangeOpen=false'), 'saving closes the form');
  // The old innerHTML injection is gone — it is what wiped the form.
  assert.ok(!bind.includes("pinChangeArea').innerHTML"), 'no innerHTML injection of the PIN form remains');
});

test('Change PIN: the PIN field counts as editing, so a pull defers the render', () => {
  const guard = fnBody('function isEditingSchedule(');
  assert.ok(guard.includes("id==='pinCh'"), 'isEditingSchedule is true while the new-PIN field has focus');
});

test('Change PIN: the admin reset endpoint stamps the reset', () => {
  const resetApi = fs.readFileSync(path.join(__dirname, '..', 'api', 'admin-reset-pin.js'), 'utf8');
  assert.ok(resetApi.includes('data.parentPinUpdatedAt = new Date().toISOString()'), 'the admin reset stamps parentPinUpdatedAt');
});
