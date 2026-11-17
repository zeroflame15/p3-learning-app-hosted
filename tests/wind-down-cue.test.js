// Quest-complete wind-down cue (2026-11-17, Bryan: "add the
// wind-down cue"). After the DAILY quest — the first quest finished
// on a new day — Pip yawns, the background dims, and Pip says the
// critter is full-and-sleepy (fed today) or sleepy (not fed). Once
// per day, dismissible, never a lock: extra quests, Play and every
// other route keep working.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

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
function fnSlice(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  assert.ok(start >= 0, startMarker + ' not found');
  const end = html.indexOf(endMarker, start);
  assert.ok(end > start, endMarker + ' not found after ' + startMarker);
  return html.slice(start, end);
}

// Same mergeExplorer eval chain as tests/create-planner-look.test.js.
const mergeExplorer = eval(
  fnText('function unionArr(a,b){') + '\n' +
  fnText('function unionObjMax(a,b){') + '\n' +
  fnText('function unionObjLatest(a,b){') + '\n' +
  fnText('function isThinkingMsg(m){') + '\n' +
  fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
  fnText('function pickCritterName(a,b){') + '\n' +
  fnText('function mergeCare(a,b){') + '\n' +
  fnText('function hashStr(s){') + '\n' +
  fnText('function flashcardId(f, b, n){') + '\n' +
  fnText('function stampFlashcardIds(e){') + '\n' +
  fnText('function bridgeFlashcardTombstones(e){') + '\n' +
  fnText('function mergeExplorer(a,b){') + '\n' +
  ';mergeExplorer;'
);

function explorer(over) {
  return Object.assign({
    name: 'MightyOtter', nameAt: null, glow: '#ffb020', badge: '⭐', lookAt: null,
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, completedDay: {}, playDoneDay: {}, hclMissed: [], favAnswers: [],
    progress: {}, playProgress: {}, daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads: [], threadsClearedAt: null, deletedThreadIds: [],
    flashcards: [], deletedFlashcards: [], planner: [], deletedPlanner: [],
    critterName: 'Greg Washington', critterNameAt: null, care: {}, careGrewDay: null,
    streak: 0, streakLongest: 0, streakLastDate: null, streakFreezes: 1,
    streakFreezeWeek: null, streakLost: 0, streakRepairUntil: null, streakFreezeUsedDay: null,
  }, over || {});
}

const windDownLine = eval(grabFn('windDownLine') + '\n; windDownLine;');

test('the line uses the explorer’s real critter name — never a hardcoded one', () => {
  assert.equal(
    windDownLine(explorer({ critterName: 'Greg Washington', care: {} }), '2026-11-17'),
    'Greg Washington is sleepy! Great job today — see you tomorrow!',
    'Juhin’s critter is Greg Washington'
  );
  assert.equal(
    windDownLine(explorer({ critterName: 'Bubbles', care: {} }), '2026-11-17'),
    'Bubbles is sleepy! Great job today — see you tomorrow!',
    'another explorer’s name flows through'
  );
  assert.ok(!grabFn('windDownLine').includes("'Splash is"), 'no hardcoded Splash in the line');
});

test('the line says “full and sleepy” only when the critter was fed today', () => {
  const fed = explorer({ critterName: 'Greg Washington', care: { feed: { at: '2026-11-17T10:00:00.000Z', day: '2026-11-17' } } });
  assert.equal(
    windDownLine(fed, '2026-11-17'),
    'Greg Washington is full and sleepy! Great job today — see you tomorrow!',
    'fed today → full and sleepy'
  );
  const fedYesterday = explorer({ critterName: 'Greg Washington', care: { feed: { at: '2026-11-16T10:00:00.000Z', day: '2026-11-16' } } });
  assert.equal(
    windDownLine(fedYesterday, '2026-11-17'),
    'Greg Washington is sleepy! Great job today — see you tomorrow!',
    'fed yesterday, not today → just sleepy, so Pip never says something untrue'
  );
  const neverFed = explorer({ critterName: 'Greg Washington', care: {} });
  assert.ok(windDownLine(neverFed, '2026-11-17').includes(' is sleepy!'), 'never fed → just sleepy');
});

test('the trigger fires on the first quest of the day only', () => {
  const recordStreak = eval([grabFn('parseDateKey'), grabFn('daysBetweenKeys'), grabFn('recordStreak')].join('\n') + '\n; recordStreak;');
  const e = explorer({ streakLastDate: null, windDownDay: null });
  const first = recordStreak(e, '2026-11-17');
  assert.equal(first.incremented, true, 'first quest of the day increments the streak — that is the daily quest');
  assert.equal(e.windDownDay !== '2026-11-17', true, 'no cue shown yet today, so the trigger may fire');
  const second = recordStreak(e, '2026-11-17');
  assert.equal(second.incremented, false, 'a second quest the same day does not increment — no cue');
  const finish = fnBody('function finishRound(t){');
  assert.ok(finish.includes('if(_st&&_st.incremented&&e.windDownDay!==todayKey()){ cur.windDown=true; e.windDownDay=todayKey(); }'), 'finishRound sets the cue only on an incrementing (first-of-day) quest, once per day');
});

test('the cue renders on the quest completion screen only — never on boosts or retries', () => {
  const done = fnBody('function quizDoneHTML(t){');
  assert.ok(done.includes("+(cur.windDown?windDownHTML(e):'')"), 'the quest completion screen appends the cue when set');
  const boostBranch = done.slice(0, done.indexOf("if(cur.phase==='retry')"));
  assert.ok(!boostBranch.includes('windDownHTML'), 'the boost completion screen never shows the cue');
  const retryBranch = done.slice(done.indexOf("if(cur.phase==='retry')"), done.indexOf('var perfect='));
  assert.ok(!retryBranch.includes('windDownHTML'), 'the retry completion screen never shows the cue');
  const cue = grabFn('windDownHTML');
  assert.ok(cue.includes('windDownLine(e)'), 'the cue line comes from windDownLine, not a hardcoded string');
  assert.ok(cue.includes('pipSVG(96,e.glow)'), 'sleepy Pip art is in the cue');
  assert.ok(cue.includes('pip-sleepy'), 'Pip gets the sleepy/yawning animation');
  assert.ok(cue.includes('pip-zzz'), 'a 💤 floats above sleepy Pip');
  assert.ok(cue.includes('id="windDownDismiss"'), 'the cue has a dismiss button');
  assert.ok(cue.includes('winddown-dim'), 'the cue brings its dim layer');
});

test('the dim is a translucent wash over the active theme, and it never blocks clicks', () => {
  const m = html.match(/\.winddown-dim\{([^}]+)\}/);
  assert.ok(m, '.winddown-dim CSS must exist');
  const css = m[1];
  assert.ok(css.includes('position:fixed'), 'the dim covers the viewport');
  assert.ok(css.includes('background:rgba(20,16,40,.38)'), 'the dim is a dark translucent wash, not a theme colour');
  assert.ok(!css.includes('var(--'), 'the dim references no theme variable — it dims any theme the same way');
  assert.ok(!css.includes('Star Garden') && !css.includes('Ocean Deep') && !css.includes('Frog Pond'), 'the dim names no specific theme');
  assert.ok(css.includes('pointer-events:none'), 'the dim never intercepts clicks');
  const card = html.match(/\.winddown-card\{([^}]+)\}/);
  assert.ok(card && card[1].includes('z-index:51'), 'the cue card sits above the dim so it stays bright');
});

test('dismissing clears the cue and leaves the results screen — nothing is locked', () => {
  const bind = fnBody('function bindQuiz(){');
  assert.ok(bind.includes("var wd=document.getElementById('windDownDismiss'); if(wd)wd.onclick=function(){ cur.windDown=false; render(); };"), 'dismiss clears the cue flag and re-renders');
  const done = fnBody('function quizDoneHTML(t){');
  assert.ok(done.includes('id="doneHome"'), 'Back to Learn is still rendered alongside the cue');
  assert.ok(done.includes('retryBtn'), 'the Second Chance retry is still rendered alongside the cue');
  const bindDone = bind.slice(0, bind.indexOf('/* Pip\'s Boost tip screen'));
  assert.ok(bindDone.includes("dh.onclick=function(){ cur=null; go('learn'); }"), 'Back to Learn still navigates after dismissing');
});

test('the once-per-day flag is a new-explorer default and survives a merge round-trip', () => {
  assert.ok(html.includes('windDownDay:null'), 'new explorers start with no wind-down day');
  const a = explorer({ windDownDay: '2026-11-17' });
  const b = explorer({ windDownDay: null });
  assert.equal(mergeExplorer(a, b).windDownDay, '2026-11-17', 'the flag survives when one side holds it');
  assert.equal(mergeExplorer(b, a).windDownDay, '2026-11-17', 'argument order must not matter');
  const laterA = explorer({ windDownDay: '2026-11-16' });
  const laterB = explorer({ windDownDay: '2026-11-17' });
  assert.equal(mergeExplorer(laterA, laterB).windDownDay, '2026-11-17', 'the later date wins');
  assert.equal(mergeExplorer(laterB, laterA).windDownDay, '2026-11-17', 'the later date wins either way round');
  const legacyA = explorer({});
  const legacyB = explorer({});
  delete legacyA.windDownDay;
  delete legacyB.windDownDay;
  assert.equal(mergeExplorer(legacyA, legacyB).windDownDay, undefined, 'a merge never invents the field on legacy explorers');
});
