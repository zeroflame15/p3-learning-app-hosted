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
// The page's icon helper, mirrored here so the eval'd board and card
// functions (which call ic) close over it. The stub games below have
// no img field, so ic falls back to the emoji — the same fallback
// the page uses when a file fails to load.
function ic(src, emo, cls) { return src ? '<img class="' + (cls || 'ic-sm') + '" src="' + src + '" alt="">' : emo; }
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
  const playElapsedSecs = eval('(' + fnText('function playElapsedSecs(){') + ')'); // eslint-disable-line no-unused-vars
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
  // A paused run (answered, clock frozen, seconds banked) still counts.
  gState = { answerSecs: 12, startedAt: null };
  assert.equal(recordPlayBest(e, 'race'), true, 'a paused run records its banked seconds');
  assert.ok(e.playBest.race.secs >= 11 && e.playBest.race.secs <= 13, 'paused run ~12s, got ' + e.playBest.race.secs);
  gState = {};
  assert.equal(recordPlayBest(e, 'sort'), false, 'no start time, no best recorded');
  assert.equal(e.playBest.sort, undefined);
});

test('leaderboard has one board per game, family and friends together, ranked by fastest time', () => {
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { id: 'e1', name: 'Jiyuna', face: '🦦', stars: 40, friends: ['XYZ789', 'MNP456', 'QQQ111'], deletedFriends: [], friendCode: 'ABC2DE',
        playDoneDay: { word: TODAY, memory: TODAY },
        playBest: { word: { secs: 65, day: TODAY }, number: { secs: 30, day: TODAY } } },
      { name: 'Sibling', face: '🐸', stars: 55, playDoneDay: {},
        playBest: { memory: { secs: 120, day: TODAY } } },
      { name: 'Cousin', face: '🦁', stars: 10, playDoneDay: { sort: TODAY },
        playBest: { sort: { secs: 45, day: TODAY }, word: { secs: 50, day: TODAY } } },
    ],
    activeId: 'e1',
  };
  var friendsCache = [ // eslint-disable-line no-unused-vars
    { code: 'XYZ789', name: 'Kai', stars: 30, bestTimes: { word: { secs: 40 }, number: { secs: 25 } } },
    { code: 'MNP456', name: 'Mei', stars: 5, bestTimes: { sort: { secs: 44 } } },
    { code: 'QQQ111', name: 'Ned', stars: 0, bestTimes: {} },
  ];
  var frErrMsg = ''; // eslint-disable-line no-unused-vars
  var friendsUnconfigured = false; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers[0]; } // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const playBoardHTML = eval('(' + fnText('function playBoardHTML(){') + ')');
  const out = playBoardHTML();
  assert.ok(out.indexOf('🏆 Leaderboard') >= 0, 'one combined leaderboard heading');
  assert.ok(out.indexOf('Family leaderboard') < 0 && out.indexOf('Friends leaderboard') < 0, 'no separate family/friends boards any more');
  assert.ok(out.indexOf('Fastest time wins') >= 0, 'ranked by time, not stars');
  assert.ok(out.indexOf('family and friends together') >= 0, 'the board says it combines everyone');
  assert.ok(out.indexOf('Most stars wins') < 0, 'old stars ranking is gone');
  for (const name of ['Word Garden', 'Number Pop', 'Memory Match', 'Speed Sort']) {
    assert.ok(out.indexOf(name) >= 0, 'a board for ' + name);
  }
  assert.ok(out.indexOf('Scramble') < 0, 'no board for a game nobody has timed');
  // Word Garden: friend Kai (40s) beats Cousin (50s) and Jiyuna (65s).
  const iWord = out.indexOf('Word Garden'), iNum = out.indexOf('Number Pop');
  const wordBoard = out.slice(iWord, iNum);
  assert.ok(wordBoard.indexOf('Kai') >= 0 && wordBoard.indexOf('Cousin') >= 0 && wordBoard.indexOf('Jiyuna') >= 0, 'family and friends share the board');
  assert.ok(wordBoard.indexOf('Kai') < wordBoard.indexOf('Cousin'), 'Word Garden ranked fastest first: friend Kai 40s, Cousin 50s');
  assert.ok(wordBoard.indexOf('Cousin') < wordBoard.indexOf('Jiyuna'), 'Cousin 50s before Jiyuna 65s');
  assert.ok(wordBoard.indexOf('Sibling') < 0, 'Sibling has no Word Garden time, so not on that board');
  assert.ok(wordBoard.indexOf('⏱ 40s') >= 0, 'fastest word time shown');
  assert.ok(wordBoard.indexOf('🥇') >= 0, 'medal for the fastest');
  assert.ok(wordBoard.indexOf('👥 Friend') >= 0, 'friend rows carry the Friend tag');
  assert.ok(wordBoard.indexOf('🦦') >= 0, 'family rows still show the face');
  // Sibling's 55 stars do not put him first anywhere — time does,
  // and stars are not repeated on the board rows at all: the board
  // ranks by time, and the same number down every row was noise.
  const iMem = out.indexOf('Memory Match');
  assert.ok(out.slice(iMem).indexOf('Sibling') >= 0, 'Sibling tops the Memory board on time (2m 00s)');
  assert.ok(out.indexOf('⏱ 2m 00s') >= 0, 'Sibling memory time shown');
  assert.ok(out.indexOf('⭐ 55 stars') < 0, 'no star counts on board rows');
  assert.ok(out.indexOf('⭐') < 0, 'no ⭐ anywhere on the board — time is the only number that matters here');
  // Speed Sort: friend Mei (44s) beats Cousin (45s).
  const iSort = out.indexOf('Speed Sort');
  const sortBoard = out.slice(iSort);
  assert.ok(sortBoard.indexOf('Mei') < sortBoard.indexOf('Cousin'), 'Mei 44s beats Cousin 45s on Speed Sort');
  // Ned has no timed game: on the waiting line, not on a board.
  assert.ok(out.indexOf('Ned — no timed games yet.') >= 0, 'a friend with no times sits on the waiting line');
  assert.ok(out.indexOf('id="frCode"') >= 0 && out.indexOf('id="frSend"') >= 0, 'add-a-friend row stays on the board');
  DB = { explorers: [] };
  const noEx = playBoardHTML();
  assert.ok(noEx.indexOf('Pick an explorer') >= 0, 'no explorers: the board says to pick one first');
  DB = { explorers: [{ id: 'e1', name: 'Nobody', face: '🦦', stars: 0, friends: [], deletedFriends: [], playBest: {} }], activeId: 'e1' };
  friendsCache = [];
  const noTimes = playBoardHTML();
  assert.ok(noTimes.indexOf('No timed games yet') >= 0, 'nobody timed anything: the board invites the first run');
  assert.ok(noTimes.indexOf('No friends yet') >= 0, 'and it says there are no friends yet');
});

test('playHTML renders arcade cards with theme line, gradient band, best time and leaderboard', () => {
  var todayKey = function () { return TODAY; }; // eslint-disable-line no-unused-vars
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { name: 'Jiyuna', face: '🦦', stars: 12,
        playProgress: { word: { idx: 6, score: 5 } }, playDoneDay: { word: TODAY },
        playBest: { word: { secs: 65, day: TODAY } } },
      { name: 'Sibling', face: '🐸', stars: 30, playProgress: {}, playDoneDay: {}, playBest: { memory: { secs: 90, day: TODAY } } },
    ],
  };
  var pageHero = function () { return '<div class="hero">HERO</div>'; }; // eslint-disable-line no-unused-vars
  var ex = function () { return DB.explorers[0]; }; // eslint-disable-line no-unused-vars
  const gameState = eval('(' + fnText('function gameState(e, gameId, dayKey, doneG){') + ')'); // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  var friendsCache = null; // eslint-disable-line no-unused-vars
  var frErrMsg = ''; // eslint-disable-line no-unused-vars
  var friendsUnconfigured = false; // eslint-disable-line no-unused-vars
  const playBoardHTML = eval('(' + fnText('function playBoardHTML(){') + ')'); // eslint-disable-line no-unused-vars
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
  assert.ok(out.indexOf('🏆 Leaderboard') >= 0, 'combined leaderboard section in the side column');
  assert.ok(out.indexOf('Memory Match') >= 0, 'a board for the game Sibling timed');
  assert.ok(out.indexOf('Sibling') >= 0, 'leaderboard lists the other explorer');
  // The leaderboards sit in a right-hand column, after the games.
  assert.ok(out.indexOf('class="playwrap"') >= 0, 'games and boards share a two-column wrap');
  assert.ok(out.indexOf('class="playside"') >= 0, 'the boards live in the right-hand column');
  assert.ok(out.indexOf('class="playside"') > out.indexOf('data-game="parking"'), 'the side column comes after the game cards');
  const css = html.slice(0, html.indexOf('</style>'));
  assert.ok(css.indexOf('.playwrap{display:flex') >= 0, 'playwrap is a flex row');
  assert.ok(css.indexOf('.playwrap .playside{flex:0 0 340px') >= 0, 'the side column is a fixed 340px');
  assert.ok(css.indexOf('@media (max-width:900px)') >= 0 && css.indexOf('.playwrap{flex-direction:column}') >= 0, 'boards stack under the games on narrow screens');
});

test('playHTML calls the combined board directly; no separate friends board remains', () => {
  assert.ok(html.indexOf('friendsBoardHTML') < 0, 'the old separate friends board is gone from the page');
  assert.ok(html.indexOf('learnFriendsBoardHTML') < 0, 'the old separate Learn friends board is gone too');
  assert.ok(html.indexOf("'<aside class=\"playside\">'+playBoardHTML()") >= 0, 'playHTML renders the combined board in the side column');
});

test('timer wiring: startGame stamps startedAt, in-game flowhero has theme class and timer chip', () => {
  const startSrc = fnText('function startGame(id){');
  const seedAt = startSrc.indexOf('gState.seed=seed;');
  const stampAt = startSrc.indexOf('gState.startedAt=Date.now();');
  assert.ok(seedAt >= 0 && stampAt > seedAt, 'startedAt recorded right after the seed line');
  const gameSrc = fnText('function gameHTML(){');
  assert.ok(gameSrc.indexOf("gametheme-'+g.id") >= 0, 'in-game flowhero carries the per-game theme class');
  assert.ok(gameSrc.indexOf('fmtPlaySecs(playElapsedSecs())') >= 0,
    'timer chip shows the answer-only elapsed time, render-driven, no interval');
  assert.ok(gameSrc.indexOf('setInterval') < 0, 'no setInterval added by the timer');
  const css = html.slice(0, html.indexOf('</style>'));
  for (const id of GAME_IDS) {
    assert.ok(css.indexOf('.flowhero.gametheme-' + id) >= 0, 'theme tint CSS for ' + id);
  }
});

test('Memory Match, Crossword and Exit Parking show the timer chip during play', () => {
  const gameSrc = fnText('function gameHTML(){');
  /* The generic hero has the chip; Memory Match and Exit Parking
     had none (time only on completion) and Crossword had none
     either. All four in-game heroes now carry the same chip. */
  const chips = (gameSrc.match(/margin-left:auto;flex:0 0 auto">⏱ '\+\(fmtPlaySecs\(playElapsedSecs\(\)\)\)/g) || []).length;
  assert.equal(chips, 4, 'timer chip in all four in-game heroes (generic, memory, crossword, parking), got ' + chips);
});

test('completion screens show the new-fastest badge, recorded on both paths', () => {
  const gameSrc = fnText('function gameHTML(){');
  const badge = (gameSrc.match(/🏅 New fastest time!/g) || []).length;
  assert.equal(badge, 2, 'badge on both completion screens (generic + memory), got ' + badge);
  const bindSrc = fnText('function bindGame(){');
  /* Completions resolve the explorer FRESH at the award moment:
     a captured bindGame explorer is detached by the 30s auto-pull
     merge, so best times (and Exit Parking stars) written through
     it were lost live — 8 of 9 best times never reached the cards. */
  assert.ok(bindSrc.indexOf('recordPlayBest(e,') < 0, 'no completion records through a captured explorer');
  assert.ok(bindSrc.indexOf("gState.newBest=recordPlayBest(live,gState.id);") >= 0, 'generic completion records the best on the live explorer');
  assert.ok(bindSrc.indexOf("gState.newBest=recordPlayBest(live,'memory');") >= 0, 'memory win records the best on the live explorer');
  assert.ok(bindSrc.indexOf("gState.newBest=recordPlayBest(live,'parking');") >= 0, 'parking completion records the best on the live explorer');
  assert.ok(bindSrc.indexOf("gState.newBest=recordPlayBest(live,'crossword');") >= 0, 'crossword completion records the best on the live explorer');
  assert.ok(bindSrc.indexOf('earnStars(live,') >= 0, 'stars are awarded to the live explorer, not a stale copy');
  assert.equal((bindSrc.match(/earnStars\(live,Math\.min\(gState\.score,gState\.rounds\)\)/g) || []).length, 3,
    'round-game awards are capped at the round count (generic, crossword, parking), so a 6-round game can never pay 7 stars');
});

test('every inline script block in the page still parses', () => {
  const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.ok(blocks.length >= 5, 'expected the page script blocks, got ' + blocks.length);
  for (const b of blocks) {
    const src = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    new vm.Script(src, { filename: 'index.html inline script' });
  }
});

test('each game is its own mini-card with its own coloured header band', () => {
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { id: 'e1', name: 'Jiyuna', face: '🦦', stars: 40, friends: ['XYZ789'], deletedFriends: [], friendCode: 'ABC2DE',
        playBest: { word: { secs: 65, day: TODAY }, number: { secs: 30, day: TODAY } } },
    ],
    activeId: 'e1',
  };
  var friendsCache = [ // eslint-disable-line no-unused-vars
    { code: 'XYZ789', name: 'Kai', stars: 30, bestTimes: { word: { secs: 40 } } },
  ];
  var frErrMsg = ''; // eslint-disable-line no-unused-vars
  var friendsUnconfigured = false; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers[0]; } // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const playBoardHTML = eval('(' + fnText('function playBoardHTML(){') + ')');
  const out = playBoardHTML();
  assert.equal((out.match(/class="lbcard"/g) || []).length, 2, 'one mini-card per timed game (Word Garden, Number Pop)');
  assert.ok(out.includes('<h4 class="lbhead-word">🌷 Word Garden</h4>'), 'Word Garden has its own header band');
  assert.ok(out.includes('<h4 class="lbhead-number">🎈 Number Pop</h4>'), 'Number Pop has its own header band');
  assert.ok(out.indexOf('<h4 style="margin:14px 0 4px">') < 0, 'no more bare headings floating in one big card');
  assert.ok(html.includes('.lbcard{'), 'the mini-card has CSS');
  assert.ok(html.includes('.lbhead-word{'), 'each game header band has its own colour');
});

test('a family explorer who is also a friend appears once, as family', () => {
  var GAMES = GAMES9; // eslint-disable-line no-unused-vars
  var DB = { // eslint-disable-line no-unused-vars
    explorers: [
      { id: 'e1', name: 'Jiyuna', face: '🦦', stars: 40, friends: ['B07CDE'], deletedFriends: [], friendCode: 'ABC2DE',
        playBest: { sort: { secs: 50, day: TODAY } } },
      { id: 'e2', name: 'VerifyB07', face: '🐼', stars: 6, friends: [], deletedFriends: [], friendCode: 'B07CDE',
        playBest: { sort: { secs: 43, day: TODAY } } },
    ],
    activeId: 'e1',
  };
  var friendsCache = [ // eslint-disable-line no-unused-vars
    { code: 'B07CDE', name: 'VerifyB07', stars: 6, bestTimes: { sort: { secs: 43 } } },
  ];
  var frErrMsg = ''; // eslint-disable-line no-unused-vars
  var friendsUnconfigured = false; // eslint-disable-line no-unused-vars
  function ex() { return DB.explorers[0]; } // eslint-disable-line no-unused-vars
  const fmtPlaySecs = eval('(' + fnText('function fmtPlaySecs(s){') + ')'); // eslint-disable-line no-unused-vars
  const playBoardHTML = eval('(' + fnText('function playBoardHTML(){') + ')');
  const out = playBoardHTML();
  const sortBoard = out.slice(out.indexOf('Speed Sort'));
  assert.equal((sortBoard.match(/VerifyB07/g) || []).length, 1, 'VerifyB07 appears exactly once on the Speed Sort board');
  assert.ok(sortBoard.indexOf('🐼') >= 0, 'the single row is the family row, with the face');
  assert.ok(sortBoard.indexOf('👥 Friend') < 0, 'no duplicate friend row for the same person');
  assert.ok(sortBoard.indexOf('no timed games yet') < 0, 'the family row is not also on the waiting line');
});
