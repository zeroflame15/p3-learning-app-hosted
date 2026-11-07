// Play Arcade: timer + fastest times + same-family leaderboard.
// Reads the page from PAGE_PATH (temp patched copy) or the real
// public/index.html by default, so the suite can run against a
// patched copy before the patches land in public/index.html.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

const TODAY = '2026-11-07';
const GAME_IDS = ['word', 'number', 'memory', 'sort', 'scramble', 'race', 'sentence', 'crossword', 'parking'];

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in ' + PAGE_PATH);
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
// The arcade helpers are grabbed out of the page and run standalone,
// exactly like games.test.js does for genRound. Each eval below is a
// DIRECT eval inside its test callback (never via a helper): only then
// do the eval'd functions close over that callback's var stubs
// (todayKey, DB, GAMES, ...).
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
const GAMES9 = [
  { id: 'word', e: '🌷', name: 'Word Garden', blurb: 'Grow flowers by picking the right word.', rounds: 6 },
  { id: 'number', e: '🎈', name: 'Number Pop', blurb: 'Pop balloons with quick mental maths.', rounds: 6 },
  { id: 'memory', e: '🃏', name: 'Memory Match', blurb: 'Flip cards and find the matching pairs.', rounds: 0 },
  { id: 'sort', e: '🧺', name: 'Speed Sort', blurb: 'Spot the odd one out, speedy explorer!', rounds: 6 },
  { id: 'scramble', e: '🔤', name: 'Scramble', blurb: 'Unscramble the jumbled letters.', rounds: 6 },
  { id: 'race', e: '🏁', name: 'Race', blurb: 'Race the clock to the finish.', rounds: 6 },
  { id: 'sentence', e: '✏️', name: 'Sentence', blurb: 'Build the sentence in order.', rounds: 6 },
  { id: 'crossword', e: '🧩', name: 'Crossword', blurb: 'Fill the grid, one clue at a time.', rounds: 6 },
  { id: 'parking', e: '🚗', name: 'Parking', blurb: 'Slide the cars out of the jam.', rounds: 6 },
];

test('BAND, BAND2 and THEME cover all nine games', () => {
  const playSrc = fnText('function playHTML(){');
  // BAND keeps its exact 4-entry literal (pinned by palette.test.js:
  // 'departures kept: Play Arcade bands stay dark navy/neon') and the
  // 5 new games extend it by assignment; runtime map covers all 9.
  assert.ok(playSrc.indexOf("BAND={word:'#1e4034',number:'#4c2a33',memory:'#1e3a5f',sort:'#4a3a10'}") >= 0,
    'original 4-entry BAND literal untouched');
  for (const pair of ["BAND.scramble='#3d2b52'", "BAND.race='#5b1f1f'", "BAND.sentence='#143c46'",
    "BAND.crossword='#3a2f1a'", "BAND.parking='#2b3440'"]) {
    assert.ok(playSrc.indexOf(pair) >= 0, 'BAND extended with ' + pair);
  }
  for (const map of ['BAND2', 'THEME']) {
    const m = playSrc.match(new RegExp('var ' + map + '=\\{([^}]*)\\}'));
    assert.ok(m, map + ' map found in playHTML');
    for (const id of GAME_IDS) assert.ok(m[1].indexOf(id + ':') >= 0, map + ' covers ' + id);
  }
});

test('fmtPlaySecs formats minutes and seconds', () => {
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')');
  assert.equal(fmtPlaySecs(65), '1m 05s');
  assert.equal(fmtPlaySecs(5), '5s');
  assert.equal(fmtPlaySecs(0), '0s');
  assert.equal(fmtPlaySecs(60), '1m 00s');
  assert.equal(fmtPlaySecs(125), '2m 05s');
});

test('recordPlayBest keeps the fastest time (best-ever, across days)', () => {
  var gState = { startedAt: Date.now() - 65000 };
  var todayKey = function () { return TODAY; }; // eslint-disable-line no-unused-vars
  const recordPlayBest = eval('(' + fnText('function recordPlayBest(e, gameId){') + ')');
  const e = {};
  assert.equal(recordPlayBest(e, 'word'), true, 'first run sets a best');
  assert.ok(e.playBest.word.secs >= 63 && e.playBest.word.secs <= 67, 'first run ~65s, got ' + e.playBest.word.secs);
  assert.equal(e.playBest.word.day, TODAY, 'best records the day it was set');
  assert.ok(gState.lastSecs >= 63 && gState.lastSecs <= 67, 'lastSecs stashed for the completion screen');
  const first = e.playBest.word.secs;
  gState.startedAt = Date.now() - 90000;
  assert.equal(recordPlayBest(e, 'word'), false, 'a slower run is not a new best');
  assert.equal(e.playBest.word.secs, first, 'slower run must not replace the best');
  gState.startedAt = Date.now() - 20000;
  assert.equal(recordPlayBest(e, 'word'), true, 'a faster run is a new best');
  assert.ok(e.playBest.word.secs >= 18 && e.playBest.word.secs <= 22, 'faster run ~20s, got ' + e.playBest.word.secs);
  assert.equal(recordPlayBest(e, 'number'), true, 'a different game gets its own best');
  assert.ok(e.playBest.number.secs >= 18 && e.playBest.number.secs <= 22);
  gState = {};
  assert.equal(recordPlayBest(e, 'sort'), false, 'no start time, no best recorded');
  assert.equal(e.playBest.sort, undefined);
});

test('leaderboard ranks explorers by stars desc, with games today and best time', () => {
  var todayKey = function () { return TODAY; }; // eslint-disable-line no-unused-vars
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { name: 'Jiyuna', face: '🦦', stars: 40, playDoneDay: { word: TODAY, memory: TODAY },
        playBest: { word: { secs: 65, day: TODAY }, number: { secs: 30, day: TODAY } } },
      { name: 'Sibling', face: '🐸', stars: 55, playDoneDay: {},
        playBest: { memory: { secs: 120, day: TODAY } } },
      { name: 'Cousin', face: '🦁', stars: 10, playDoneDay: { sort: TODAY }, playBest: {} },
    ],
  };
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const familyBoardHTML = eval('(' + fnText('function familyBoardHTML(){') + ')');
  const out = familyBoardHTML();
  assert.ok(out.indexOf('Family leaderboard') >= 0, 'leaderboard heading present');
  const iSib = out.indexOf('Sibling'), iJiy = out.indexOf('Jiyuna'), iCou = out.indexOf('Cousin');
  assert.ok(iSib >= 0 && iJiy >= 0 && iCou >= 0, 'all three explorers listed');
  assert.ok(iSib < iJiy && iJiy < iCou, 'ranked by stars desc: Sibling (55), Jiyuna (40), Cousin (10)');
  assert.ok(out.indexOf('🥇') >= 0 && out.indexOf('🥈') >= 0 && out.indexOf('🥉') >= 0, 'medals for the top three');
  assert.ok(out.indexOf('⭐ 55 stars') >= 0, 'stars shown');
  assert.ok(out.indexOf('2 games today') >= 0, 'Jiyuna finished 2 games today');
  assert.ok(out.indexOf('0 games today') >= 0, 'Sibling finished 0 games today');
  assert.ok(out.indexOf('⏱ 30s (Number Pop)') >= 0, 'fastest time across games, with the game name');
  assert.ok(out.indexOf('⏱ 2m 00s (Memory Match)') >= 0, 'Sibling best time shown');
  assert.ok(out.indexOf('⏱ No time yet') >= 0, 'explorer with no best time yet');
  DB = { explorers: [] };
  assert.equal(familyBoardHTML(), '', 'no explorers, no leaderboard section');
});

test('playHTML renders arcade cards with theme line, gradient band, best time and leaderboard', () => {
  var todayKey = function () { return TODAY; }; // eslint-disable-line no-unused-vars
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { name: 'Jiyuna', face: '🦦', stars: 12,
        playProgress: { word: { idx: 6, score: 5 } }, playDoneDay: { word: TODAY },
        playBest: { word: { secs: 65, day: TODAY } } },
      { name: 'Sibling', face: '🐸', stars: 30, playProgress: {}, playDoneDay: {}, playBest: {} },
    ],
  };
  var pageHero = function () { return '<div class="hero">HERO</div>'; }; // eslint-disable-line no-unused-vars
  var ex = function () { return DB.explorers[0]; }; // eslint-disable-line no-unused-vars
  const gameState = eval('(' + fnText('function gameState(e, gameId, dayKey, doneG){') + ')'); // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const familyBoardHTML = eval('(' + fnText('function familyBoardHTML(){') + ')'); // eslint-disable-line no-unused-vars
  const playHTML = eval('(' + fnText('function playHTML(){') + ')');
  const out = playHTML();
  for (const id of GAME_IDS) assert.ok(out.indexOf('data-game="' + id + '"') >= 0, 'card for ' + id);
  assert.ok(out.indexOf('🌸 Grow a garden of words') >= 0, 'theme line per game');
  assert.ok(out.indexOf('linear-gradient(135deg,#1e4034,#2e6b45)') >= 0, 'band gradient uses the BAND colour');
  assert.ok(out.indexOf('linear-gradient(135deg,#3d2b52,#5b4280)') >= 0, 'new game band gradient uses its BAND colour');
  assert.ok(out.indexOf('linear-gradient(135deg,#2b3440,#43536a)') >= 0, 'parking band gradient uses its BAND colour');
  assert.ok(out.indexOf('<span>🌷</span>') >= 0, 'bigger emoji in the band');
  assert.ok(out.indexOf('⏱ Best: 1m 05s') >= 0, 'best time on the finished game card');
  assert.ok(out.indexOf('⏱ No time yet — be the first!') >= 0, 'empty best time invites the first run');
  assert.ok(out.indexOf('✔ Completed — replay any time!') >= 0, 'completed-today state still renders');
  assert.ok(out.indexOf('Family leaderboard') >= 0, 'leaderboard section at the bottom');
  assert.ok(out.indexOf('Sibling') >= 0, 'leaderboard lists the other explorer');
});

test('friends hook is present verbatim and safe when friendsBoardHTML is undefined', () => {
  const hook = "+(typeof friendsBoardHTML==='function'?friendsBoardHTML():'')";
  assert.ok(html.indexOf(hook) >= 0, 'exact friends hook text present at the end of playHTML');
  var todayKey = function () { return TODAY; }; // eslint-disable-line no-unused-vars
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { explorers: [{ name: 'Jiyuna', face: '🦦', stars: 0, playProgress: {}, playDoneDay: {}, playBest: {} }] }; // eslint-disable-line no-unused-vars
  var pageHero = function () { return ''; }; // eslint-disable-line no-unused-vars
  var ex = function () { return DB.explorers[0]; }; // eslint-disable-line no-unused-vars
  const gameState = eval('(' + fnText('function gameState(e, gameId, dayKey, doneG){') + ')'); // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const familyBoardHTML = eval('(' + fnText('function familyBoardHTML(){') + ')'); // eslint-disable-line no-unused-vars
  const playHTML = eval('(' + fnText('function playHTML(){') + ')');
  let out;
  assert.doesNotThrow(function () { out = playHTML(); }, 'playHTML must not throw when friendsBoardHTML is undefined');
  assert.ok(out.indexOf('friendsBoardHTML') < 0, 'no hook output when the friends feature is absent');
});

test('friends hook plugs the friends board in when friendsBoardHTML exists', () => {
  var todayKey = function () { return TODAY; }; // eslint-disable-line no-unused-vars
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { explorers: [{ name: 'Jiyuna', face: '🦦', stars: 0, playProgress: {}, playDoneDay: {}, playBest: {} }] }; // eslint-disable-line no-unused-vars
  var pageHero = function () { return ''; }; // eslint-disable-line no-unused-vars
  var ex = function () { return DB.explorers[0]; }; // eslint-disable-line no-unused-vars
  var friendsBoardHTML = function () { return '<div class="friendsboard">FRIENDS</div>'; }; // eslint-disable-line no-unused-vars
  const gameState = eval('(' + fnText('function gameState(e, gameId, dayKey, doneG){') + ')'); // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const familyBoardHTML = eval('(' + fnText('function familyBoardHTML(){') + ')'); // eslint-disable-line no-unused-vars
  const playHTML = eval('(' + fnText('function playHTML(){') + ')');
  assert.ok(playHTML().indexOf('<div class="friendsboard">FRIENDS</div>') >= 0, 'friends board output appended');
});

test('timer wiring: startGame stamps startedAt, in-game flowhero has theme class and timer chip', () => {
  const startSrc = fnText('function startGame(id){');
  const seedAt = startSrc.indexOf('gState.seed=seed;');
  const stampAt = startSrc.indexOf('gState.startedAt=Date.now();');
  assert.ok(seedAt >= 0 && stampAt > seedAt, 'startedAt recorded right after the seed line');
  const gameSrc = fnText('function gameHTML(){');
  assert.ok(gameSrc.indexOf("gametheme-'+g.id") >= 0, 'in-game flowhero carries the per-game theme class');
  assert.ok(gameSrc.indexOf("fmtPlaySecs(Math.max(0,Math.floor((Date.now()-gState.startedAt)/1000)))") >= 0,
    'timer chip shows elapsed mm:ss from startedAt, render-driven, no interval');
  assert.ok(gameSrc.indexOf('setInterval') < 0, 'no setInterval added by the timer');
  const css = html.slice(0, html.indexOf('</style>'));
  for (const id of GAME_IDS) {
    assert.ok(css.indexOf('.flowhero.gametheme-' + id) >= 0, 'theme tint CSS for ' + id);
  }
});

test('completion screens show the new-fastest badge, recorded on both paths', () => {
  const gameSrc = fnText('function gameHTML(){');
  const badge = (gameSrc.match(/🏅 New fastest time!/g) || []).length;
  assert.equal(badge, 2, 'badge on both completion screens (generic + memory), got ' + badge);
  const bindSrc = fnText('function bindGame(){');
  assert.ok(bindSrc.indexOf("gState.newBest=recordPlayBest(e,gState.id);") >= 0, 'generic completion records the best');
  assert.ok(bindSrc.indexOf("gState.newBest=recordPlayBest(e,'memory');") >= 0, 'memory win records the best');
});

test('every inline script block in the page still parses', () => {
  const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.ok(blocks.length >= 5, 'expected the page script blocks, got ' + blocks.length);
  for (const b of blocks) {
    const src = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    new vm.Script(src, { filename: 'index.html inline script' });
  }
});
