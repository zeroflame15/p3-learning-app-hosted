// Daily streak, Phase 1 (2026-11-10): the forgiving daily loop.
//   Any ONE quest finished on a new day keeps the streak alive.
//   A missed day is covered by the weekly Streak Freeze (1 granted
//   each Monday, max 1 banked); without a freeze the streak resets
//   but can be repaired the same day by finishing a quest. Day 7
//   (and 14, 30, 100) gets an explicit celebration.
// Evidence: Duolingo - a 7-day streak makes a learner 2.4x more
// likely to return the next day; Lally et al. (2010) - median 66
// days to automaticity, and one missed day does not derail a habit.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// The streak functions take an explicit today (YYYY-MM-DD), so the
// harness can drive them. The fixed "today" is Tue 2026-11-10, whose
// Monday is 2026-11-09. UI helpers fall back to todayKey(), which is
// stubbed to the same date so their output is deterministic.
const TODAY = '2026-11-10';
const MONDAY = '2026-11-09';
const YESTERDAY = '2026-11-09';
const DAY_BEFORE = '2026-11-08';

function extractFn(name, startMarker) {
  const i = html.indexOf(startMarker);
  assert.ok(i >= 0, startMarker + ' must exist in public/index.html');
  const open = html.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces for ' + name);
}

// One shared vm context: the streak functions reference each other
// (streakTick -> addDaysKey/mondayOfKey/daysBetweenKeys; the HTML
// helpers -> esc/todayKey), and mergeExplorer needs its merge deps.
const ctx = vm.createContext({ console, todayKey: () => TODAY });
function load(name, marker) {
  vm.runInContext(extractFn(name, marker), ctx);
  ctx['__' + name] = null;
}
load('parseDateKey', 'function parseDateKey(k){');
load('esc', 'function esc(s){');
load('addDaysKey', 'function addDaysKey(k, n){');
load('mondayOfKey', 'function mondayOfKey(k){');
load('daysBetweenKeys', 'function daysBetweenKeys(a, b){');
load('streakTick', 'function streakTick(e, today){');
load('recordStreak', 'function recordStreak(e, today){');
load('streakDaysThisWeek', 'function streakDaysThisWeek(e, today){');
load('streakFrogMood', 'function streakFrogMood(e, today){');
load('streakFrogMoodHTML', 'function streakFrogMoodHTML(e){');
load('streakStripHTML', 'function streakStripHTML(e, questId){');
load('streakParentCardHTML', 'function streakParentCardHTML(e){');
load('unionArr', 'function unionArr(a,b){');
load('unionObjMax', 'function unionObjMax(a,b){');
load('unionObjLatest', 'function unionObjLatest(a,b){');
load('mergeThreads', 'function mergeThreads(aThreads,bThreads){');
load('pickCritterName', 'function pickCritterName(a,b){');
load('mergeCare', 'function mergeCare(a,b){');
load('mergeLetters', 'function mergeLetters(a,b){');
load('mergeExplorer', 'function mergeExplorer(a,b){');

const {
  addDaysKey, mondayOfKey, daysBetweenKeys,
  streakTick, recordStreak, streakDaysThisWeek,
  streakFrogMood, streakFrogMoodHTML, streakStripHTML, streakParentCardHTML,
  mergeExplorer,
} = ctx;

function explorer(over) {
  return Object.assign({
    name: 'Test', critterName: 'Greg Washington',
    completed: {}, completedDay: {}, progress: {},
    playProgress: {}, playDoneDay: {},
    streak: 0, streakLongest: 0, streakLastDate: null,
    streakFreezes: 1, streakFreezeWeek: null,
    streakLost: 0, streakRepairUntil: null, streakFreezeUsedDay: null,
  }, over || {});
}

/* --- date helpers --- */

test('date helpers: addDaysKey crosses month and year boundaries', () => {
  assert.equal(addDaysKey('2026-11-10', 1), '2026-11-11');
  assert.equal(addDaysKey('2026-11-10', -1), '2026-11-09');
  assert.equal(addDaysKey('2026-11-30', 1), '2026-12-01');
  assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysKey('2026-11-10', 7), '2026-11-17');
});

test('date helpers: mondayOfKey returns the Monday of the same week', () => {
  assert.equal(mondayOfKey('2026-11-10'), '2026-11-09', 'Tuesday -> Monday');
  assert.equal(mondayOfKey('2026-11-09'), '2026-11-09', 'Monday -> itself');
  assert.equal(mondayOfKey('2026-11-15'), '2026-11-09', 'Sunday -> the Monday before');
  assert.equal(mondayOfKey('2026-11-16'), '2026-11-16', 'next Monday -> itself');
});

test('date helpers: daysBetweenKeys counts whole days', () => {
  assert.equal(daysBetweenKeys('2026-11-09', '2026-11-10'), 1);
  assert.equal(daysBetweenKeys('2026-11-10', '2026-11-10'), 0);
  assert.equal(daysBetweenKeys('2026-11-09', '2026-11-12'), 3);
  assert.equal(daysBetweenKeys('2026-11-30', '2026-12-02'), 2);
});

/* --- streakTick: the Monday freeze grant --- */

test('streakTick grants one freeze on first sight of a new week (max 1 banked)', () => {
  const e = explorer({ streakFreezeWeek: null, streakFreezes: 0 });
  const out = streakTick(e, TODAY);
  assert.equal(out.granted, true);
  assert.equal(e.streakFreezes, 1);
  assert.equal(e.streakFreezeWeek, MONDAY);
});

test('streakTick does not re-grant a freeze within the same week', () => {
  const e = explorer({ streakFreezeWeek: MONDAY, streakFreezes: 0 });
  const out = streakTick(e, TODAY);
  assert.equal(out.granted, false);
  assert.equal(e.streakFreezes, 0, 'a consumed freeze is not topped up mid-week');
});

test('streakTick grants a fresh freeze when a new Monday arrives', () => {
  const e = explorer({ streakFreezeWeek: '2026-11-02', streakFreezes: 0 });
  const out = streakTick(e, '2026-11-16');
  assert.equal(out.granted, true);
  assert.equal(e.streakFreezes, 1);
  assert.equal(e.streakFreezeWeek, '2026-11-16');
});

/* --- streakTick: missed days --- */

test('streakTick is a no-op when the last quest was yesterday or today', () => {
  const e = explorer({ streak: 4, streakLastDate: YESTERDAY, streakFreezes: 1, streakFreezeWeek: MONDAY });
  const out = streakTick(e, TODAY);
  assert.equal(out.freezeUsed, false);
  assert.equal(out.reset, false);
  assert.equal(e.streak, 4);
  assert.equal(e.streakLastDate, YESTERDAY);
});

test('streakTick: one missed day with a freeze consumes it and preserves the streak', () => {
  // Last quest Sunday 2026-11-08, today Tue 2026-11-10: Monday missed.
  const e = explorer({ streak: 5, streakLastDate: DAY_BEFORE, streakFreezes: 1, streakFreezeWeek: '2026-11-02' });
  const out = streakTick(e, TODAY);
  assert.equal(out.freezeUsed, true);
  assert.equal(e.streakFreezes, 0);
  assert.equal(e.streak, 5, 'the streak is preserved, not reset');
  assert.equal(e.streakLastDate, '2026-11-09', 'lastDate advances onto the missed day');
  assert.equal(e.streakFreezeUsedDay, TODAY);
});

test('streakTick: one missed day with a freeze, but the week also turns over, grants the new freeze first', () => {
  const e = explorer({ streak: 3, streakLastDate: DAY_BEFORE, streakFreezes: 0, streakFreezeWeek: '2026-11-02' });
  streakTick(e, TODAY);
  assert.equal(e.streak, 3, 'the newly granted Monday freeze covers the miss');
  assert.equal(e.streakFreezes, 0, 'it is consumed the same day');
  assert.equal(e.streakFreezeWeek, MONDAY);
});

test('streakTick: one missed day without a freeze resets the streak and opens a one-day repair window', () => {
  const e = explorer({ streak: 5, streakLastDate: DAY_BEFORE, streakFreezes: 0, streakFreezeWeek: MONDAY });
  const out = streakTick(e, TODAY);
  assert.equal(out.reset, true);
  assert.equal(e.streak, 0);
  assert.equal(e.streakLost, 5, 'the lost streak is kept for the repair');
  assert.equal(e.streakRepairUntil, TODAY);
});

test('streakTick: two or more missed days reset with no repair window', () => {
  const e = explorer({ streak: 5, streakLastDate: '2026-11-07', streakFreezes: 1, streakFreezeWeek: MONDAY });
  const out = streakTick(e, TODAY);
  assert.equal(out.reset, true);
  assert.equal(e.streak, 0);
  assert.equal(e.streakLost, 0, 'a long gap cannot be repaired');
  assert.equal(e.streakRepairUntil, null);
  assert.equal(e.streakFreezes, 1, 'the freeze stays banked for a future miss');
});

test('streakTick: an expired repair window clears the lost streak', () => {
  const e = explorer({ streak: 0, streakLost: 5, streakRepairUntil: YESTERDAY, streakFreezes: 1, streakFreezeWeek: MONDAY });
  const out = streakTick(e, TODAY);
  assert.equal(out.repairExpired, true);
  assert.equal(e.streakLost, 0);
  assert.equal(e.streakRepairUntil, null);
});

test('streakTick is idempotent: running it twice re-derives the same state', () => {
  const e = explorer({ streak: 5, streakLastDate: DAY_BEFORE, streakFreezes: 1, streakFreezeWeek: '2026-11-02' });
  streakTick(e, TODAY);
  const snap = JSON.stringify(e);
  streakTick(e, TODAY);
  assert.equal(JSON.stringify(e), snap, 'the second tick changes nothing');
  assert.equal(e.streak, 5);
  assert.equal(e.streakFreezes, 0);
});

/* --- recordStreak: completing a quest --- */

test('recordStreak starts a streak at 1 on the first ever quest', () => {
  const e = explorer();
  const out = recordStreak(e, TODAY);
  assert.equal(out.incremented, true);
  assert.equal(e.streak, 1);
  assert.equal(e.streakLastDate, TODAY);
  assert.equal(e.streakLongest, 1);
});

test('recordStreak does not increment twice on the same day', () => {
  const e = explorer({ streak: 3, streakLongest: 3, streakLastDate: TODAY });
  const out = recordStreak(e, TODAY);
  assert.equal(out.incremented, false);
  assert.equal(e.streak, 3);
});

test('recordStreak increments by 1 on the next day', () => {
  const e = explorer({ streak: 3, streakLongest: 3, streakLastDate: YESTERDAY });
  const out = recordStreak(e, TODAY);
  assert.equal(out.incremented, true);
  assert.equal(e.streak, 4);
  assert.equal(e.streakLongest, 4);
});

test('recordStreak: Day 7 celebrates, and so do 14, 30 and 100', () => {
  const e7 = explorer({ streak: 6, streakLongest: 6, streakLastDate: YESTERDAY });
  assert.equal(recordStreak(e7, TODAY).celebrate, 7);
  assert.equal(e7.streak, 7);
  const e14 = explorer({ streak: 13, streakLongest: 13, streakLastDate: YESTERDAY });
  assert.equal(recordStreak(e14, TODAY).celebrate, 14);
  const e30 = explorer({ streak: 29, streakLongest: 29, streakLastDate: YESTERDAY });
  assert.equal(recordStreak(e30, TODAY).celebrate, 30);
  const e100 = explorer({ streak: 99, streakLongest: 99, streakLastDate: YESTERDAY });
  assert.equal(recordStreak(e100, TODAY).celebrate, 100);
  const e8 = explorer({ streak: 7, streakLongest: 7, streakLastDate: YESTERDAY });
  assert.equal(recordStreak(e8, TODAY).celebrate, 0, 'Day 8 is not a milestone');
});

test('recordStreak repairs a reset streak to its pre-miss value plus one', () => {
  const e = explorer({ streak: 0, streakLost: 5, streakRepairUntil: TODAY });
  const out = recordStreak(e, TODAY);
  assert.equal(out.repaired, true);
  assert.equal(e.streak, 6, '5 lost days restored, plus today');
  assert.equal(e.streakLost, 0);
  assert.equal(e.streakRepairUntil, null);
});

test('recordStreak after a long gap with no repair starts fresh at 1', () => {
  const e = explorer({ streak: 0, streakLongest: 5, streakLastDate: '2026-11-07' });
  const out = recordStreak(e, TODAY);
  assert.equal(out.repaired, false);
  assert.equal(e.streak, 1);
  assert.equal(e.streakLongest, 5, 'the longest is never lowered');
});

/* --- streakDaysThisWeek + frog mood --- */

test('streakDaysThisWeek counts distinct quest days in the current Mon-Sun week only', () => {
  const e = explorer({ completedDay: { t1: '2026-11-09', t2: '2026-11-10', t3: '2026-11-10', t4: '2026-11-08', t5: '2026-11-16' } });
  assert.equal(streakDaysThisWeek(e, TODAY), 2, 'Mon + Tue only; Sun before and Mon after are out of week');
  assert.equal(streakDaysThisWeek(explorer(), TODAY), 0);
});

test('streakFrogMood: relief when a freeze saved the streak today, delight when today is done, waiting otherwise', () => {
  const relief = explorer({ critterName: 'Greg Washington', streakFreezeUsedDay: TODAY });
  const m1 = streakFrogMood(relief, TODAY);
  assert.equal(m1.emoji, '😌');
  assert.ok(m1.line.includes('Greg'), 'the frog is addressed by its first name');
  const done = explorer({ critterName: 'Greg Washington', streakLastDate: TODAY });
  assert.equal(streakFrogMood(done, TODAY).emoji, '😊');
  const waiting = explorer({ critterName: 'Greg Washington', streakLastDate: YESTERDAY });
  const m3 = streakFrogMood(waiting, TODAY);
  assert.equal(m3.emoji, '💤');
  assert.ok(m3.line.includes('waiting'));
});

/* --- streak UI helpers --- */

test('streakStripHTML shows the flame, streak, freezes and longest, and a repair button only when repairing', () => {
  const e = explorer({ streak: 4, streakLongest: 6, streakFreezes: 1, streakLastDate: YESTERDAY });
  const h = streakStripHTML(e, 'math-ntuc');
  assert.ok(h.includes('🔥'), 'flame');
  assert.ok(h.includes('4-day streak'), 'current streak');
  assert.ok(h.includes('Longest: 6 days'), 'longest');
  assert.ok(h.includes('1 freeze'), 'freeze count');
  assert.ok(!h.includes('Repair my streak'), 'no repair button when nothing is lost');
  const repairing = explorer({ streak: 0, streakLost: 5, streakRepairUntil: TODAY, streakFreezes: 0, streakFreezeWeek: MONDAY });
  const h2 = streakStripHTML(repairing, 'math-ntuc');
  assert.ok(h2.includes('Repair my streak'), 'repair button appears');
  assert.ok(h2.includes('data-quest="math-ntuc"'), 'repair starts the daily quest');
  const h3 = streakStripHTML(repairing, null);
  assert.ok(h3.includes('data-go2="learn"'), 'without a daily quest the repair goes to Learn');
});

test('streakParentCardHTML shows current, longest and days this week', () => {
  const e = explorer({ name: 'Jiyuna', streak: 4, streakLongest: 9, completedDay: { t1: '2026-11-09', t2: '2026-11-10' } });
  const h = streakParentCardHTML(e);
  assert.ok(h.includes('Current streak: <b>4 days</b>'), 'current streak');
  assert.ok(h.includes('Longest: <b>9 days</b>'), 'longest streak');
  assert.ok(h.includes('Quests this week: <b>2 / 7</b>'), 'days this week');
  assert.ok(h.includes('5 quest days a week'), 'the north-star goal is named, without a red/green verdict');
});

test('streakFrogMoodHTML renders the frog mood line', () => {
  const e = explorer({ critterName: 'Greg Washington', streakLastDate: YESTERDAY });
  assert.ok(streakFrogMoodHTML(e).includes('waiting for today’s quest'));
});

/* --- mergeExplorer: the streak group must survive sync --- */

test('mergeExplorer: the side with the later streakLastDate wins the whole streak group', () => {
  const a = explorer({ streak: 5, streakLongest: 5, streakLastDate: '2026-11-09' });
  const b = explorer({ streak: 6, streakLongest: 6, streakLastDate: '2026-11-10' });
  const m = mergeExplorer(a, b);
  assert.equal(m.streak, 6);
  assert.equal(m.streakLastDate, '2026-11-10');
  assert.equal(m.streakLongest, 6);
});

test('mergeExplorer: a reset on one device never beats a freeze-preserved streak on another', () => {
  // Device A reset (lastDate stayed on the missed day); device B used
  // a freeze, so its lastDate advanced onto the missed day.
  const reset = explorer({ streak: 0, streakLost: 5, streakLastDate: '2026-11-09', streakFreezes: 0 });
  const preserved = explorer({ streak: 5, streakLastDate: '2026-11-10', streakFreezes: 0 });
  assert.equal(mergeExplorer(reset, preserved).streak, 5);
  assert.equal(mergeExplorer(preserved, reset).streak, 5, 'order-independent');
});

test('mergeExplorer: longest is a max; same-week freezes take the lower count', () => {
  const a = explorer({ streak: 2, streakLongest: 9, streakLastDate: TODAY, streakFreezes: 0, streakFreezeWeek: MONDAY });
  const b = explorer({ streak: 2, streakLongest: 4, streakLastDate: TODAY, streakFreezes: 1, streakFreezeWeek: MONDAY });
  const m = mergeExplorer(a, b);
  assert.equal(m.streakLongest, 9);
  assert.equal(m.streakFreezes, 0, 'a consumed freeze is never resurrected by a stale device');
  assert.equal(m.streakFreezeWeek, MONDAY);
});

test('mergeExplorer: the later freeze week wins', () => {
  const a = explorer({ streakFreezes: 0, streakFreezeWeek: '2026-11-02' });
  const b = explorer({ streakFreezes: 1, streakFreezeWeek: MONDAY });
  const m = mergeExplorer(a, b);
  assert.equal(m.streakFreezes, 1);
  assert.equal(m.streakFreezeWeek, MONDAY);
});

test('mergeExplorer: two legacy explorers merge without inventing streak fields', () => {
  // A sync merge must never change the DB shape for explorers that
  // carry no streak state — otherwise a no-change pull reports a
  // change (seen 2026-11-10: 3 sync-light tests). The fields arrive
  // lazily from streakTick on first render instead.
  const legacyA = explorer();
  delete legacyA.streak; delete legacyA.streakLongest; delete legacyA.streakLastDate;
  delete legacyA.streakFreezes; delete legacyA.streakFreezeWeek;
  delete legacyA.streakLost; delete legacyA.streakRepairUntil; delete legacyA.streakFreezeUsedDay;
  const legacyB = explorer();
  delete legacyB.streak; delete legacyB.streakLongest; delete legacyB.streakLastDate;
  delete legacyB.streakFreezes; delete legacyB.streakFreezeWeek;
  delete legacyB.streakLost; delete legacyB.streakRepairUntil; delete legacyB.streakFreezeUsedDay;
  const ml = mergeExplorer(legacyA, legacyB);
  assert.equal(ml.streak, undefined, 'no streak invented');
  assert.equal(ml.streakFreezes, undefined, 'no freeze invented');
  assert.equal(ml.streakFreezeWeek, undefined);
  assert.equal(ml.streakLastDate, undefined);
});

test('mergeExplorer: a streak on one side survives a merge with a legacy explorer', () => {
  const withStreak = explorer({ streak: 4, streakLongest: 4, streakLastDate: TODAY, streakFreezes: 0, streakFreezeWeek: MONDAY });
  const legacy = explorer();
  delete legacy.streak; delete legacy.streakLongest; delete legacy.streakLastDate;
  delete legacy.streakFreezes; delete legacy.streakFreezeWeek;
  delete legacy.streakLost; delete legacy.streakRepairUntil; delete legacy.streakFreezeUsedDay;
  assert.equal(mergeExplorer(withStreak, legacy).streak, 4, 'the streaked side wins');
  assert.equal(mergeExplorer(legacy, withStreak).streak, 4, 'order-independent');
  assert.equal(mergeExplorer(legacy, withStreak).streakLastDate, TODAY);
});

/* --- defaults and wiring --- */

test('newExplorer defaults carry the streak fields', () => {
  const start = html.indexOf('function newExplorer(');
  assert.ok(start >= 0, 'newExplorer must exist');
  const block = html.slice(start, html.indexOf('\n}\n', start));
  for (const f of ['streak:0', 'streakLongest:0', 'streakLastDate:null', 'streakFreezes:1', 'streakFreezeWeek:null', 'streakLost:0', 'streakRepairUntil:null', 'streakFreezeUsedDay:null']) {
    assert.ok(block.includes(f), 'newExplorer must default ' + f);
  }
});

test('wiring: quests record the streak, render ticks it, and the strip + parent card are rendered', () => {
  const finish = html.slice(html.indexOf('function finishRound('), html.indexOf('function finishRound(') + 9000);
  assert.ok(finish.includes("if(typeof streakTick==='function')streakTick(e);"), 'finishRound ticks the streak');
  assert.ok(finish.includes("recordStreak(e)"), 'finishRound records the streak');
  const render = html.slice(html.indexOf('function render(){'), html.indexOf('function render(){') + 1200);
  assert.ok(render.includes("if(typeof streakTick==='function'){ var _stk=ex(); if(_stk)streakTick(_stk); }"), 'render ticks the streak on open');
  assert.ok(html.includes('streakStripHTML(e, quest?quest.id:null)'), 'Home renders the streak strip');
  assert.ok(html.includes('streakParentCardHTML(sel)'), 'the parent page renders the streak card');
  assert.ok(html.includes('streakFrogMoodHTML(e)'), 'the Home critter card shows the frog mood');
  assert.ok(html.includes('id="tbStreak"'), 'the top bar shows the streak chip');
  assert.ok(html.includes('about 15 minutes'), 'the daily quest card names the 15 minutes');
  assert.ok(html.includes('cur.streakCelebrate'), 'the results screen celebrates Day 7/14/30/100');
});
