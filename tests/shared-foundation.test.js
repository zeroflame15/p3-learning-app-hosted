// Shared foundation for the game revamp + primary-level system
// (built 2026-11-07): mute + sound variety, streaks, fresh-seed
// replays, Play explanations, and the P1–P6 level system.
// Conventions follow tests/memory-merge.test.js and
// tests/sounds.test.js: the page functions are pulled out of
// public/index.html and either string-checked or eval'd with
// small stubs, so the tests run against the real page without
// a browser.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

// Brace-matching extractor (from tests/memory-merge.test.js):
// several of these functions nest other functions, so slicing to
// the next '\nfunction ' would cut them short.
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

function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

// saveGameProgress ends with 'save(); }' rather than a bare '}'
// on its own line (same trick as tests/game-resume.test.js).
function fnSaveGame() {
  const start = html.indexOf('function saveGameProgress(){');
  assert.ok(start >= 0, 'saveGameProgress found');
  const end = html.indexOf('save(); }', start);
  assert.ok(end >= 0, 'saveGameProgress end found');
  return html.slice(start, end + 'save(); }'.length);
}

// ---------------------------------------------------------------- mute

test('mute: isMuted reads localStorage key jyn-muted, toggleMute flips it and returns the new state', () => {
  const store = {};
  global.localStorage = {
    getItem: function (k) { return (k in store) ? store[k] : null; },
    setItem: function (k, v) { store[k] = v; },
  };
  const isMuted = eval('(' + grabFn('isMuted') + ')');
  const toggleMute = eval('(' + grabFn('toggleMute') + ')');
  assert.equal(isMuted(), false, 'absent key: sound on');
  assert.equal(toggleMute(), true, 'first toggle mutes and says so');
  assert.equal(store['jyn-muted'], '1', 'muted is stored as "1"');
  assert.equal(isMuted(), true, 'stored "1" reads back as muted');
  assert.equal(toggleMute(), false, 'second toggle unmutes');
  assert.equal(store['jyn-muted'], '0', 'unmuted is stored as "0"');
  delete global.localStorage;
});

test('tone() returns early when muted, and the topbar carries a mute button', () => {
  const toneSrc = fnText('function tone(');
  assert.ok(toneSrc.indexOf('isMuted()') >= 0, 'tone() checks isMuted before playing anything');
  assert.ok(html.indexOf('id="tbMute"') >= 0, 'topbar has the #tbMute button');
  assert.ok(html.indexOf("isMuted()?'🔇':'🔊'") >= 0, 'the button shows 🔇 when muted, 🔊 when sound is on');
  assert.ok(html.indexOf('toggleMute(); renderTop();') >= 0, 'tapping it flips the mute and re-renders the topbar');
});

// ------------------------------------------------------- sound variety

test('slide() slides an oscillator frequency with an exponential ramp', () => {
  const slideSrc = fnText('function slide(');
  assert.ok(slideSrc.indexOf('exponentialRampToValueAtTime') >= 0, 'the frequency slides, not jumps');
  assert.ok(slideSrc.indexOf('createOscillator') >= 0, 'it is an oscillator, same AudioContext pattern as tone()');
  assert.ok(slideSrc.indexOf('isMuted()') >= 0, 'a muted device stays silent');
});

test('sndCorrect(streak) sounds exactly as today with no argument, and transposes up with the streak', () => {
  const toneCalls = [];
  function tone(f) { toneCalls.push(f); } // eslint-disable-line no-unused-vars
  const sndCorrect = eval('(' + fnText('function sndCorrect(') + ')');
  sndCorrect();
  assert.deepEqual(toneCalls, [523, 659, 784, 1047, 1319, 1568], 'no streak: the same C–E–G–C arpeggio as today');
  toneCalls.length = 0;
  sndCorrect(3);
  const ratio = toneCalls[0] / 523;
  assert.ok(Math.abs(ratio - Math.pow(2, 3 / 12)) < 0.001, 'streak 3 lifts every note by 3 semitones');
  assert.ok(toneCalls.every(function (f, i) { return Math.abs(f / [523, 659, 784, 1047, 1319, 1568][i] - ratio) < 0.001; }), 'the whole arpeggio transposes together');
  toneCalls.length = 0;
  sndCorrect(99);
  assert.ok(Math.abs(toneCalls[0] / 523 - Math.pow(2, 6 / 12)) < 0.001, 'the lift caps at +6 semitones');
  assert.equal(toneCalls.length, 6, 'still exactly 6 notes');
});

test('sndTick(n) is a short celesta tick that rises with n', () => {
  assert.ok(html.indexOf('function sndTick(n){') >= 0, 'sndTick exists');
  const tickSrc = fnText('function sndTick(');
  assert.ok(tickSrc.indexOf('celesta(') >= 0, 'it ticks on the celesta, like the other UI sounds');
  assert.ok(tickSrc.indexOf('Math.pow(2,') >= 0, 'its pitch rises with n');
});

test('sndWrong, sndFanfare and sndPop signatures are unchanged', () => {
  assert.ok(html.indexOf('function sndWrong(){') >= 0, 'sndWrong untouched');
  assert.ok(html.indexOf('function sndFanfare(){') >= 0, 'sndFanfare untouched');
  assert.ok(html.indexOf('function sndPop(){') >= 0, 'sndPop untouched');
});

// ---------------------------------------------------------------- streak

test('game streak (combo): startGame resets it, the generic handler grows it on a correct answer and clears it on a wrong one', () => {
  const startSrc = fnText('function startGame(id){');
  assert.ok(startSrc.indexOf('gState.streak=0;') >= 0, 'every run starts at streak 0');
  const bindSrc = fnText('function bindGame(){');
  assert.ok(bindSrc.indexOf('gState.streak=(gState.streak||0)+1; sndCorrect(gState.streak);') >= 0, 'a correct answer grows the streak and lifts the chime');
  assert.ok(bindSrc.indexOf('gState.streak=0; sndWrong();') >= 0, 'a wrong answer clears the streak');
  const saveSrc = fnSaveGame();
  assert.ok(saveSrc.indexOf('streak') < 0, 'the streak is never saved — it is session-only');
  const mergeSrc = grabFn('mergeExplorer');
  assert.ok(mergeSrc.indexOf('gState.streak') < 0, 'the game combo streak never enters the merge list');
  assert.ok(mergeSrc.indexOf('streakLastDate') >= 0, 'the DAILY streak is merged (Phase 1, 2026-11-10): one quest a day keeps it alive across devices');
});

test('streakChipHTML shows nothing below 2 and a 🔥 ×N chip from 2 up', () => {
  var gState = { streak: 0 }; // eslint-disable-line no-unused-vars
  const streakChipHTML = eval('(' + grabFn('streakChipHTML') + ')');
  assert.equal(streakChipHTML(), '', 'streak 0: no chip');
  gState.streak = 1;
  assert.equal(streakChipHTML(), '', 'streak 1: still no chip');
  gState.streak = 2;
  assert.ok(streakChipHTML().indexOf('🔥 ×2') >= 0, 'streak 2: the chip appears');
  gState.streak = 5;
  assert.ok(streakChipHTML().indexOf('🔥 ×5') >= 0, 'streak 5: the chip counts up');
});

test('the streak chip sits in the generic game header, next to the Round chip', () => {
  const gameSrc = fnText('function gameHTML(){');
  assert.ok(gameSrc.indexOf("streakChipHTML()+'<span class=\"chip\">Just '") >= 0, 'the chip renders between the Round chip and the Just-more chip');
});

// ----------------------------------------------------- replay fresh seed

test('replay after finishing today uses a fresh seed; an unfinished game keeps its exact rounds', () => {
  const startSrc = fnText('function startGame(id){');
  assert.ok(startSrc.indexOf('if(p&&!doneP){ seed=p.seed||0;') >= 0, 'resume keeps the saved seed — a child who left at question 4 comes back to question 4');
  assert.ok(startSrc.indexOf("else if(doneP){ seed=hashStr('play|'+id+'|'+todayKey()+'|'+e.id+'|'+Date.now());") >= 0, 'a replay after finishing today mixes a fresh seed from the current time');
  assert.ok(startSrc.indexOf("seed:hashStr('play|'+id+'|'+todayKey()+'|'+e.id)") >= 0, 'the first play of the day still uses the day seed');
});

// ---------------------------------------------- explanations in Play

test('Play feedback shows the question explanation when one exists', () => {
  const gameSrc = fnText('function gameHTML(){');
  assert.ok(gameSrc.indexOf("(q.c?'<br>💡 '+esc(q.c):'')") >= 0, 'the 💡 line appears under the praise/encouragement line when q.c is set, and nowhere when it is empty');
});

// ----------------------------------------------------- primary level

const levelHelpers = eval([
  grabFn('levelNum'), grabFn('levelTier'), grabFn('bankFor'),
].join('\n') + '\n; ({ levelNum, levelTier, bankFor });');

test('LEVELS lists all six primary levels', () => {
  assert.ok(html.indexOf("var LEVELS=['P1','P2','P3','P4','P5','P6'];") >= 0, 'LEVELS is P1–P6 in order');
});

test('levelNum/levelTier: P1 low, P3 mid, P6 high, missing level defaults to P3/mid', () => {
  const { levelNum, levelTier } = levelHelpers;
  assert.equal(levelNum({ level: 'P1' }), 1);
  assert.equal(levelNum({ level: 'P3' }), 3);
  assert.equal(levelNum({ level: 'P6' }), 6);
  assert.equal(levelNum({}), 3, 'no level yet: P3');
  assert.equal(levelNum({ level: 'P9' }), 3, 'an invalid level is not trusted');
  assert.equal(levelTier({ level: 'P1' }), 'low');
  assert.equal(levelTier({ level: 'P2' }), 'low');
  assert.equal(levelTier({ level: 'P3' }), 'mid');
  assert.equal(levelTier({ level: 'P4' }), 'mid');
  assert.equal(levelTier({ level: 'P5' }), 'high');
  assert.equal(levelTier({ level: 'P6' }), 'high');
  assert.equal(levelTier({}), 'mid', 'no level yet: mid');
});

test('bankFor falls back to the P3 bank until a P4 bank exists, then picks the P4 bank', () => {
  const { bankFor } = levelHelpers;
  const t = { quest: ['q1', 'q2'], fresh: ['f1'], warm: ['w1'], retry: ['r1'] };
  assert.deepEqual(bankFor(t, 'quest', 3), ['q1', 'q2'], 'P3 reads the P3 quest bank');
  assert.deepEqual(bankFor(t, 'quest', 5), ['q1', 'q2'], 'P5 with no P4 bank yet reads exactly today’s P3 content');
  assert.deepEqual(bankFor(t, 'warm', 6), ['w1'], 'same fallback for warm-ups');
  t.p4quest = ['p4q1', 'p4q2'];
  assert.deepEqual(bankFor(t, 'quest', 4), ['p4q1', 'p4q2'], 'P4 with a P4 bank reads the P4 bank');
  assert.deepEqual(bankFor(t, 'quest', 6), ['p4q1', 'p4q2'], 'P6 too');
  assert.deepEqual(bankFor(t, 'quest', 3), ['q1', 'q2'], 'P3 is untouched by the P4 bank');
  t.p4quest = [];
  assert.deepEqual(bankFor(t, 'quest', 4), ['q1', 'q2'], 'an empty P4 bank falls back to P3');
  assert.deepEqual(bankFor(t, 'fresh', 4), ['f1'], 'kinds without a P4 bank fall back per kind');
});

// One explorer factory for the merge tests (same base as
// tests/memory-merge.test.js, plus the foundation's new fields).
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
    level: 'P3', levelAt: null, playDaily: {},
  };
  return Object.assign(base, overrides);
}

test('levelAt merge: the later level change wins, like themeAt and codeAt', () => {
  const mergeExplorer = eval([
    'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
    'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
  ].map(grabFn).join('\n') + '\n; mergeExplorer;');
  const server = explorer({ level: 'P3', levelAt: 1000 });
  const local = explorer({ level: 'P4', levelAt: 2000 });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.level, 'P4', 'the newer level pick survives the merge instead of reverting');
  assert.equal(merged.levelAt, 2000, 'the newer level timestamp is kept');
  const merged2 = mergeExplorer(explorer({ level: 'P5', levelAt: 3000 }), explorer({ level: 'P4', levelAt: 2000 }));
  assert.equal(merged2.level, 'P5', 'the older change does not overwrite the newer one');
});

test('new explorers default to P3 with a level timestamp, or take the picked level', () => {
  function genFriendCode() { return 'ABCDEF'; } // eslint-disable-line no-unused-vars
  const newExplorer = eval('(' + fnText('function newExplorer(') + ')');
  const e = newExplorer('Testy', ['🐸', '🦦', '🍓']);
  assert.equal(e.level, 'P3', 'no level chosen yet: P3');
  assert.ok(typeof e.levelAt === 'number' && e.levelAt > 0, 'a level timestamp is stamped at creation');
  assert.deepEqual(e.playDaily, {}, 'a new explorer starts with no Play minutes');
  const e2 = newExplorer('Testy', ['🐸', '🦦', '🍓'], 'P5');
  assert.equal(e2.level, 'P5', 'the picked level is stored at creation');
});

test('level picker exists in the create flow, the Home prompt, and the parent page', () => {
  assert.ok(html.indexOf('Which primary level are you in?') >= 0, 'the picker label exists');
  assert.ok(html.indexOf('data-lvl=') >= 0, 'Grand Door create has level buttons');
  assert.ok(html.indexOf('data-home-lvl=') >= 0, 'the Home prompt has level buttons');
  assert.ok(html.indexOf('data-plvl=') >= 0, 'the parent page has level buttons');
  assert.ok(html.indexOf("newExplorer(name, doorCode.slice(), doorLevel)") >= 0, 'creating an explorer stores the picked level');
  assert.ok(html.indexOf("t.level=b.getAttribute('data-plvl')") >= 0, 'the parent page writes the new level');
  assert.ok(html.indexOf("e.level=b.getAttribute('data-home-lvl')") >= 0, 'the Home prompt writes the new level');
  assert.ok(html.indexOf("Current level: <b>P'+levelNum(sel)+'</b>") >= 0, 'the parent page shows the current level');
});

test('Home prompt shows only when the explorer has no level, and never blocks navigation', () => {
  const homeSrc = fnText('function homeHTML(){');
  assert.ok(homeSrc.indexOf("!e.level?'<div class=\"card\"") >= 0, 'the prompt renders only for explorers with no level');
  assert.ok(homeSrc.indexOf('data-home-lvl') >= 0, 'the prompt carries the level buttons');
  /* Phase 2 (2026-11-10): Home is hero (full width, no homegrid) +
     streak strip + frog hero + quest board. The prompt is prepended
     to that whole stack, so Home still renders everything with or
     without it. */
  assert.ok(homeSrc.indexOf('return lvlPrompt+hero') >= 0, 'Home still renders its hero, streak, frog and quest board with or without the prompt');
  assert.ok(homeSrc.indexOf('+ boardSection') >= 0, 'the quest board follows the prompt in the Home return');
});

test('Learn shows the active explorer level in its header', () => {
  const learnSrc = fnText('function learnHTML(){');
  assert.ok(learnSrc.indexOf("🎒 P'+levelNum(e)") >= 0, 'the Learn header carries a P-level chip');
});

test('Learn reads quest, warm and retry banks through bankFor', () => {
  const questSrc = fnText('function questListFor(');
  assert.ok(questSrc.indexOf("bankFor(t,'retry',level)") >= 0, 'Second Chance draws from the level bank');
  assert.ok(questSrc.indexOf("bankFor(t,'quest',level)") >= 0, 'the quest list reads the level bank');
  assert.ok(questSrc.indexOf('poolQuestions(t, level)') >= 0, 'the daily pool reads the level bank');
  const warmSrc = fnText('function warmupHTML(){');
  assert.ok(warmSrc.indexOf("bankFor(t,'warm',levelNum(ex()))") >= 0, 'the warm-up reads the level bank');
  const beginSrc = fnText('function beginQuest(topicId){');
  assert.ok(beginSrc.indexOf('dailyPoolIndices(t, todayKey(), e.id, levelNum(e))') >= 0, 'a new quest draws from the level bank');
  const doneSrc = fnText('function quizDoneHTML(t){');
  assert.ok(doneSrc.indexOf("bankFor(t,'quest',levelNum(e)).length") >= 0, 'the completion screen counts the level bank');
});

// ---------------------------------------------- daily Play time limit

test('playLimit defaults to 20; playMinutesToday reads today only; canPlay is true at 19 and false at 20', () => {
  var DB = { playLimit: 20 }; // eslint-disable-line no-unused-vars
  function todayKey() { return '2026-11-07'; } // eslint-disable-line no-unused-vars
  const fns = eval([
    grabFn('playLimit'), grabFn('playMinutesToday'), grabFn('canPlay'),
  ].join('\n') + '\n; ({ playLimit, playMinutesToday, canPlay });');
  assert.equal(fns.playLimit(), 20, 'the family limit is 20 minutes a day');
  const e = { playDaily: { '2026-11-07': 19, '2026-11-06': 99 } };
  assert.equal(fns.playMinutesToday(e), 19, 'only today counts — yesterday’s 99 minutes do not carry over');
  assert.equal(fns.canPlay(e), true, '19 of 20: one more minute of play');
  e.playDaily['2026-11-07'] = 20;
  assert.equal(fns.canPlay(e), false, '20 of 20: the cap is hit');
  delete DB.playLimit;
  assert.equal(fns.playLimit(), 20, 'an old family record without the setting still defaults to 20');
  DB.playLimit = 30;
  assert.equal(fns.playLimit(), 30, 'a parent-set limit is honoured');
  assert.equal(fns.canPlay(e), true, '20 of a 30-minute limit: still room to play');
  assert.equal(fns.playMinutesToday({}), 0, 'an explorer with no playDaily record has 0 minutes');
  assert.equal(fns.canPlay({}), true, 'and can still play');
});

test('startGame refuses when the cap is hit, before any game state is built', () => {
  const startSrc = fnText('function startGame(id){');
  const guardAt = startSrc.indexOf('if(!canPlay(e)){');
  assert.ok(guardAt >= 0, 'startGame checks the cap first');
  assert.ok(startSrc.indexOf("toast('Play is done for today — come back tomorrow!')") >= 0, 'the refusal tells the child why');
  assert.ok(startSrc.indexOf('return; }', guardAt) >= 0, 'the refusal returns early');
  assert.ok(guardAt < startSrc.indexOf('gState={'), 'the refusal happens before any game state is built');
  assert.ok(guardAt < startSrc.indexOf('if(p&&!doneP){ seed=p.seed||0;'), 'the seed logic comes after the guard');
});

test('playDaily merges per day by max, like e.daily', () => {
  const mergeExplorer = eval([
    'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
    'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
  ].map(grabFn).join('\n') + '\n; mergeExplorer;');
  const server = explorer({ playDaily: { '2026-11-07': 12, '2026-11-06': 5 } });
  const local = explorer({ playDaily: { '2026-11-07': 18, '2026-11-05': 9 } });
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.playDaily, { '2026-11-07': 18, '2026-11-06': 5, '2026-11-05': 9 }, 'each day keeps the larger count, and days from either side survive');
});

test('playLimit merges in mergeFamilyDB: server wins when present, else local, else 20', () => {
  const famSrc = fnText('function mergeFamilyDB(');
  assert.ok(famSrc.indexOf('merged.playLimit=(server.playLimit!=null?server.playLimit:(local.playLimit!=null?local.playLimit:20));') >= 0, 'the family limit merges like dailyLimit');
});

test('the parent page has a Play limit row next to the daily limit, with the same save pattern', () => {
  assert.ok(html.indexOf('Play limit (minutes per day)') >= 0, 'the Play limit row exists');
  assert.ok(html.indexOf('id="playLimitIn"') >= 0, 'a number input for the Play limit');
  assert.ok(html.indexOf('id="playLimitSave"') >= 0, 'a Save button for the Play limit');
  assert.ok(html.indexOf("document.getElementById('playLimitSave').onclick=") >= 0, 'the Save button is wired');
  assert.ok(html.indexOf('DB.playLimit=v;') >= 0, 'saving stores the new limit on the family record');
  assert.ok(html.indexOf("toast('Play limit saved.')") >= 0, 'saving confirms with a toast');
});

test('the 60-second tick counts Play minutes only on the play/game routes while visible', () => {
  assert.ok(html.indexOf("if(route==='play'||route==='game'){") >= 0, 'the tick checks the route');
  assert.ok(html.indexOf('pe.playDaily[todayKey()]=(pe.playDaily[todayKey()]||0)+1;') >= 0, 'the tick adds one minute to today’s Play count');
  const tickAt = html.indexOf("if(route==='play'||route==='game'){");
  const addAt = html.indexOf('addMinutes(1);');
  assert.ok(addAt >= 0 && addAt < tickAt, 'the Play-minute count rides the existing 60-second interval');
});

test('the Play page shows a minutes chip/bar and locks the cards when the cap is hit', () => {
  const playSrc = fnText('function playHTML(){');
  assert.ok(playSrc.indexOf("⏱ Play today: '+mins+' / '+lim+' min") >= 0, 'the chip shows today’s Play minutes against the limit');
  assert.ok(playSrc.indexOf('progressbar') >= 0, 'the chip has a progress bar');
  assert.ok(playSrc.indexOf("(capped?' locked':'')") >= 0, 'capped cards get the locked class');
  assert.ok(playSrc.indexOf('⏱ Play time is up for today') >= 0, 'capped cards and the bar carry the up-for-today note');
  assert.ok(playSrc.indexOf("(capped?'⏱ Play time is up for today'") >= 0, 'a capped card’s button says so instead of Play/Resume/Replay');
  assert.ok(playSrc.indexOf("data-game=\"'+g.id+'\"") >= 0, 'the locked card’s button still calls startGame — tapping it shows the toast instead of starting');
  const css = html.slice(0, html.indexOf('</style>'));
  assert.ok(css.indexOf('.gamecard.locked') >= 0, 'locked cards grey out in CSS');
});
