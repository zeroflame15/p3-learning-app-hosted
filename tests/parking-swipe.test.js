// Exit Parking — swipe/drag, hard pack (levels 13-18), per-level stars.
//
// The page under test is PAGE_PATH (the patched copy) or
// public/index.html. Like tests/games-custom.test.js, every test
// SKIPS when the page does not yet carry the feature it checks —
// run with
//   PAGE_PATH=/tmp/park-swipe-verify/public/index.html node --test tests/parking-swipe.test.js
// to exercise the real assertions against the patched copy.
//
// Conventions (see parking-swipe-diff.md):
// - A "move" is one drag: one car sliding any number of cells in
//   one direction costs 1. Pars for levels 13-18 are BFS minimal
//   slide counts + 1 (3 stars allows one wasted slide; 2 stars at
//   par+2). Levels 1-12 keep their original cell-step pars.
// - A level's stars bank the moment it is won, once per level per
//   day (parkStarsToBank, same rule in lib/rules.js). A same-day
//   replay banks nothing extra; a new day resets the count.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE, 'utf8');
const HAS_PARK = html.includes('var PARKLEVELS=');
const HAS_SWIPE = HAS_PARK && ['function parkSlide(', 'function parkDragRange(', 'function parkPackName(', 'function parkStarsToBank(', 'pointerdown'].every((s) => html.includes(s));
const HAS_HARD = HAS_PARK && html.includes('Pack 4 (6×6) Hard');
const HAS_BANK = HAS_PARK && html.includes('function parkStarsToBank(');
const R = require('../lib/rules');

function grab(name, endMarker) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf(endMarker || '\n}\n', start);
  assert.ok(end > start, name + ' has its end marker');
  return html.slice(start, end + (endMarker || '\n}\n').length);
}
function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}

const PARKLEVELS = HAS_PARK ? eval(grabVar('PARKLEVELS') + '\n;PARKLEVELS') : null;
const parkFns = HAS_PARK
  ? eval('var PARKW=4, PARKH=4, PARKEXIT={x:3,y:2};\n'
    + ['parkCarCells', 'parkOccupied', 'parkCanMove', 'parkMove', 'parkWon', 'parkLevelStars',
      'parkDragRange', 'parkSlide', 'parkPackName', 'parkStarsToBank'].map((n) => grab(n)).join('\n')
    + '\n;({parkCarCells:parkCarCells,parkOccupied:parkOccupied,parkCanMove:parkCanMove,parkMove:parkMove,parkWon:parkWon,parkLevelStars:parkLevelStars,parkDragRange:parkDragRange,parkSlide:parkSlide,parkPackName:parkPackName,parkStarsToBank:parkStarsToBank})')
  : null;

// BFS over slide-moves (one drag = one move), built on the page's
// own parkSlide / parkDragRange / parkWon. Returns {min, path}.
function parkSolveBFS(startCars, lv, maxStates) {
  const cap = maxStates || 3000000;
  const keyOf = (cars) => cars.map((c) => c.x + ',' + c.y).join('|');
  const seen = new Map();
  const queue = [{ cars: startCars, depth: 0, path: [] }];
  seen.set(keyOf(startCars), 0);
  let head = 0;
  while (head < queue.length) {
    const node = queue[head++];
    if (parkFns.parkWon(node.cars, lv)) return { min: node.depth, path: node.path, states: seen.size };
    if (seen.size >= cap) return { min: -1, path: null, states: seen.size, capped: true };
    for (const c of node.cars) {
      const dirs = c.o === 'h' ? ['l', 'r'] : ['u', 'd'];
      for (const dir of dirs) {
        const range = parkFns.parkDragRange(node.cars, c.id, lv);
        const maxN = dir === 'l' || dir === 'u' ? range.back : range.fwd;
        for (let n = 1; n <= maxN; n++) {
          const next = parkFns.parkSlide(node.cars, c.id, dir, n, lv);
          if (!next) break;
          const k = keyOf(next);
          if (seen.has(k)) continue;
          seen.set(k, node.depth + 1);
          queue.push({ cars: next, depth: node.depth + 1, path: node.path.concat([[c.id, dir, n]]) });
        }
      }
    }
  }
  return { min: -1, path: null, states: seen.size };
}

// BFS minimal slide counts, measured with the solver above on the
// final level data (see parking-swipe-diff.md §Levels). Levels 1-12
// keep their cell-step pars; their slide-minima are only lower
// bounds here (a drag can cover several cells at once).
const SLIDE_MIN_1_12 = [2, 3, 4, 4, 3, 3, 4, 4, 3, 4, 4, 4];
// Levels 13-18: par = minimal slides + 1. Fill from the diff doc.
const SLIDE_MIN_13_18 = [9, 10, 13, 14, 16, 17];

/* ---------------- Drag helpers ---------------- */

test('parking drag: parkSlide moves several cells at once, or null when blocked', { skip: !HAS_SWIPE }, () => {
  const cars = PARKLEVELS[0].cars;
  // Level 1: blue up 1, then red has a 2-cell runway to the exit.
  let moved = parkFns.parkSlide(cars, 'b1', 'u', 1, PARKLEVELS[0]);
  assert.ok(moved, 'blue slides up one cell');
  moved = parkFns.parkSlide(moved, 'red', 'r', 2, PARKLEVELS[0]);
  assert.ok(moved, 'red slides two cells in one drag');
  assert.ok(parkFns.parkWon(moved, PARKLEVELS[0]), 'red reaches the exit after the 2-cell drag');
  // A drag is one move even across several cells: the whole level is
  // 2 drags (blue up, red right-right), not 3 one-cell moves.
  assert.equal(parkFns.parkSlide(cars, 'red', 'r', 1, PARKLEVELS[0]), null, 'red cannot drag into the blue car');
  assert.equal(parkFns.parkSlide(cars, 'red', 'r', 3, PARKLEVELS[0]), null, 'red cannot drag past the blue car');
  assert.equal(parkFns.parkSlide(cars, 'b1', 'u', 2, PARKLEVELS[0]), null, 'blue cannot drag two cells up (wall)');
  assert.equal(parkFns.parkSlide(cars, 'b1', 'l', 1, PARKLEVELS[0]), null, 'a vertical car cannot drag sideways');
  assert.equal(parkFns.parkSlide(cars, 'b1', 'u', 0, PARKLEVELS[0]), null, 'a zero-cell drag is not a move');
  assert.equal(parkFns.parkSlide(cars, 'nope', 'r', 1, PARKLEVELS[0]), null, 'an unknown car cannot drag');
  // Colours survive a multi-cell slide, like parkMove.
  const coloured = parkFns.parkSlide(PARKLEVELS[5].cars, 'b1', 'u', 1, PARKLEVELS[5]);
  assert.ok(coloured, 'level 6 blue slides');
  coloured.forEach((c, i) => assert.equal(c.bg, PARKLEVELS[5].cars[i].bg, 'car ' + c.id + ' keeps its colour after a drag'));
});

test('parking drag: parkDragRange reports the free run each way', { skip: !HAS_SWIPE }, () => {
  const lv = PARKLEVELS[0];
  assert.deepEqual(parkFns.parkDragRange(lv.cars, 'red', lv), { back: 0, fwd: 0 }, 'red is boxed in at the start of level 1');
  assert.deepEqual(parkFns.parkDragRange(lv.cars, 'b1', lv), { back: 1, fwd: 1 }, 'blue has one free cell up and one down');
  const after = parkFns.parkMove(lv.cars, 'b1', 'u', lv);
  assert.deepEqual(parkFns.parkDragRange(after, 'red', lv), { back: 0, fwd: 2 }, 'once blue moves, red has a 2-cell runway');
  assert.deepEqual(parkFns.parkDragRange(lv.cars, 'nope', lv), { back: 0, fwd: 0 }, 'an unknown car has no range');
});

/* ---------------- Hard pack: levels 13-18 ---------------- */

test('parking hard pack: 18 levels, pack 4 is 6x6 Hard with 10-13 cars', { skip: !HAS_HARD }, () => {
  assert.equal(PARKLEVELS.length, 18, 'eighteen levels, one per round');
  assert.ok(html.includes('rounds:18'), 'GAMES plays 18 parking rounds');
  for (let i = 12; i < 18; i++) {
    const lv = PARKLEVELS[i];
    assert.deepEqual([lv.w, lv.h], [6, 6], 'level ' + (i + 1) + ' is 6x6');
    assert.ok(lv.cars.length >= 10 && lv.cars.length <= 13, 'level ' + (i + 1) + ' has ' + lv.cars.length + ' cars (10-13)');
    assert.equal(parkFns.parkPackName(i), 'Pack 4 (6×6) Hard', 'level ' + (i + 1) + ' is Pack 4 Hard');
  }
  assert.equal(parkFns.parkPackName(0), 'Pack 1 (4×4)', 'level 1 is Pack 1');
  assert.equal(parkFns.parkPackName(3), 'Pack 1 (4×4)', 'level 4 is Pack 1');
  assert.equal(parkFns.parkPackName(4), 'Pack 2 (5×5)', 'level 5 is Pack 2');
  assert.equal(parkFns.parkPackName(7), 'Pack 2 (5×5)', 'level 8 is Pack 2');
  assert.equal(parkFns.parkPackName(8), 'Pack 3 (6×6)', 'level 9 is Pack 3');
  assert.equal(parkFns.parkPackName(11), 'Pack 3 (6×6)', 'level 12 is Pack 3');
  assert.equal(parkFns.parkPackName(17), 'Pack 4 (6×6) Hard', 'level 18 is Pack 4 Hard');
});

test('parking hard pack: every level is solvable, and pars match the BFS minima', { skip: !HAS_HARD }, () => {
  assert.equal(SLIDE_MIN_13_18.length, 6, 'six hard-pack minima recorded');
  PARKLEVELS.forEach((lv, li) => {
    const r = parkSolveBFS(lv.cars, lv);
    assert.ok(r.min > 0, 'level ' + (li + 1) + ' is solvable (BFS found a win)');
    if (li < 12) {
      assert.equal(r.min, SLIDE_MIN_1_12[li], 'level ' + (li + 1) + ': minimal slides are ' + SLIDE_MIN_1_12[li]);
      assert.ok(lv.par >= r.min, 'level ' + (li + 1) + ': the kept cell-step par (' + lv.par + ') is not tighter than the slide minimum');
    } else {
      assert.equal(r.min, SLIDE_MIN_13_18[li - 12], 'level ' + (li + 1) + ': minimal slides are ' + SLIDE_MIN_13_18[li - 12]);
      assert.equal(lv.par, r.min + 1, 'level ' + (li + 1) + ': par is minimal slides + 1 (one wasted slide still earns 3 stars)');
      // The BFS solution replays to a win, one drag at a time.
      let cars = lv.cars;
      r.path.forEach(([id, dir, n]) => {
        cars = parkFns.parkSlide(cars, id, dir, n, lv);
        assert.ok(cars, 'level ' + (li + 1) + ': ' + id + ' ' + dir + ' x' + n + ' is a legal drag');
      });
      assert.ok(parkFns.parkWon(cars, lv), 'level ' + (li + 1) + ': the BFS solution wins');
      assert.equal(r.path.length, r.min, 'level ' + (li + 1) + ': the solution is exactly minimal long');
    }
    // Legality, same checks as the original 12 levels.
    const seen = {};
    lv.cars.forEach((c) => {
      assert.ok(c.o === 'h' || c.o === 'v', 'level ' + (li + 1) + ' car ' + c.id + ' has an orientation');
      assert.ok(c.bg && c.bg.length > 0, 'level ' + (li + 1) + ' car ' + c.id + ' has a colour');
      parkFns.parkCarCells(c).forEach((p) => {
        assert.ok(p[0] >= 0 && p[0] < lv.w && p[1] >= 0 && p[1] < lv.h, 'level ' + (li + 1) + ' car ' + c.id + ' stays in the lot');
        assert.ok(!seen[p[0] + ',' + p[1]], 'level ' + (li + 1) + ': cars must not overlap at ' + p);
        seen[p[0] + ',' + p[1]] = c.id;
      });
    });
    const red = lv.cars.find((c) => c.id === 'red');
    assert.deepEqual([red.o, red.x, red.y, red.len], ['h', 0, lv.exit.y, 2], 'level ' + (li + 1) + ': red starts at (0,' + lv.exit.y + ')');
    assert.ok(!parkFns.parkWon(lv.cars, lv), 'level ' + (li + 1) + ': not already won at the start');
  });
});

/* ---------------- Star banking ---------------- */

test('parking stars: parkStarsToBank banks once per level per day', { skip: !HAS_BANK }, () => {
  const t = parkFns.parkStarsToBank;
  // First win of level 1 today, 2 moves on par 3: 3 stars, banked.
  assert.deepEqual(t(0, 2, 3, null, 0, '2026-11-08'), { bank: 3, starBanked: 1, starDay: '2026-11-08' });
  // Winning it again the same day banks nothing (replay, same level).
  assert.deepEqual(t(0, 2, 3, '2026-11-08', 1, '2026-11-08'), { bank: 0, starBanked: 1, starDay: '2026-11-08' });
  // Next level the same day banks its own stars.
  assert.deepEqual(t(1, 5, 5, '2026-11-08', 1, '2026-11-08'), { bank: 3, starBanked: 2, starDay: '2026-11-08' });
  // A new day resets the count: the same level banks again.
  assert.deepEqual(t(0, 2, 3, '2026-11-08', 18, '2026-11-09'), { bank: 3, starBanked: 1, starDay: '2026-11-09' });
  // Star rating follows the level: par+2 is 2 stars, par+3 is 1.
  assert.deepEqual(t(5, 8, 6, null, 0, '2026-11-08'), { bank: 2, starBanked: 6, starDay: '2026-11-08' });
  assert.deepEqual(t(5, 9, 6, null, 0, '2026-11-08'), { bank: 1, starBanked: 6, starDay: '2026-11-08' });
  // The page copy matches lib/rules.js on the same inputs.
  assert.equal(typeof R.parkStarsToBank, 'function', 'lib/rules.js carries the same rule');
  const cases = [
    [0, 2, 3, null, 0, '2026-11-08'], [0, 2, 3, '2026-11-08', 1, '2026-11-08'],
    [1, 5, 5, '2026-11-08', 1, '2026-11-08'], [0, 2, 3, '2026-11-08', 18, '2026-11-09'],
    [5, 8, 6, null, 0, '2026-11-08'], [17, 20, 15, '2026-11-08', 17, '2026-11-08'],
  ];
  cases.forEach((c) => assert.deepEqual(t(...c), R.parkStarsToBank(...c), 'page and lib agree on ' + JSON.stringify(c)));
});

test('parking stars: wins persist starTotal/starBanked/starDay, and a same-day replay banks nothing', { skip: !HAS_BANK }, () => {
  const fns = parkingBankHarness();
  // Fresh game: nothing banked.
  fns.startGame('parking');
  let st = fns.getState();
  assert.equal(st.starTotal, 0, 'fresh run: no stars banked yet');
  assert.equal(st.starBanked, 0, 'fresh run: no levels banked');
  assert.equal(st.starDay, null, 'fresh run: no banking day yet');
  // Win level 1 in 2 moves (par 3): 3 stars bank on the spot.
  const win1 = fns.simulateWin(2);
  assert.equal(win1.banked, 3, 'level 1 win banks 3 stars at once');
  assert.equal(fns.getDB().explorers[0].stars, 3, 'the balance goes up by exactly 3');
  st = fns.getState();
  assert.equal(st.starTotal, 3, 'starTotal counts the banked stars');
  assert.equal(st.starBanked, 1, 'one level banked');
  assert.equal(st.starDay, '2026-11-08', 'the banking day is today');
  const saved = JSON.parse(JSON.stringify(fns.getDB().explorers[0].playProgress.parking));
  assert.equal(saved.starTotal, 3, 'starTotal is saved with progress');
  assert.equal(saved.starBanked, 1, 'starBanked is saved with progress');
  assert.equal(saved.starDay, '2026-11-08', 'starDay is saved with progress');
  // Quit and resume: no double-bank — the level is already counted.
  fns.setState(null);
  fns.startGame('parking');
  st = fns.getState();
  assert.equal(st.idx, 1, 'resumed at level 2');
  assert.equal(st.starTotal, 3, 'resumed starTotal is still 3');
  assert.equal(st.starBanked, 1, 'resumed starBanked is still 1');
  assert.equal(fns.getDB().explorers[0].stars, 3, 'resuming adds no stars');
  // Win level 2 in 5 moves (par 5): 3 more stars, balance 6.
  const win2 = fns.simulateWin(5);
  assert.equal(win2.banked, 3, 'level 2 win banks 3 stars');
  assert.equal(fns.getDB().explorers[0].stars, 6, 'balance is now 6');
  // Finish the game, replay the same day: re-winning level 1 banks 0.
  fns.getDB().explorers[0].playProgress.parking = { idx: 18, score: 18, seed: 1, v: 2, cars: PARKLEVELS[17].cars, starTotal: 30, starBanked: 18, starDay: '2026-11-08' };
  fns.getDB().explorers[0].stars = 30;
  fns.getDB().explorers[0].starsEarned = 30; /* the balance is ledger-derived (earnStars recomputes it), so the earned total must match */
  fns.startGame('parking');
  st = fns.getState();
  assert.equal(st.idx, 0, 'replay starts at level 1');
  assert.equal(st.starTotal, 0, 'replay run starts with 0 run stars');
  assert.equal(st.starBanked, 18, 'replay keeps the banked count, so old levels cannot bank again');
  const replayWin = fns.simulateWin(2);
  assert.equal(replayWin.banked, 0, 're-winning level 1 the same day banks nothing');
  assert.equal(fns.getDB().explorers[0].stars, 30, 'the balance does not move on a same-day replay win');
  // ...but the next day it banks again.
  fns.setToday('2026-11-09');
  const nextDayWin = fns.simulateWin(2);
  assert.equal(nextDayWin.banked, 3, 'the next day, the same level banks again');
  assert.equal(fns.getDB().explorers[0].stars, 33, 'balance is now 33');
});

// Harness for the banking flow: startGame + saveGameProgress + the
// page's earnStars, with a simulateWin that runs the exact lines the
// win handler runs (parkStarsToBank -> earnStars -> advance -> save).
function parkingBankHarness() {
  const prelude = 'var GAMES=['
    + "{id:'parking',e:'🚗',name:'Exit Parking',rounds:18}];\n"
    + 'var PARKLEVELS=' + JSON.stringify(PARKLEVELS) + ';\n'
    + 'var PARKW=4, PARKH=4, PARKEXIT={x:3,y:2};\n'
    + 'var gState=null;\n'
    + 'var TODAY="2026-11-08";\n'
    + 'var DB={explorers:[{id:"e1",stars:0,starsEarned:0,starsSpent:0,badges:[],playProgress:{},playFresh:{},playDoneDay:{}}],activeId:"e1"};\n'
    + 'function hashStr(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }\n'
    + 'function ex(){ return DB.explorers[0]; }\n'
    + 'function todayKey(){ return TODAY; }\n'
    + 'function save(){}\n'
    + 'function go(){}\n'
    + 'function shuffle(a){ return a.slice(); }\n'
    + 'function toast(){}\n'
    + 'function canPlay(){ return true; }\n';
  const src = prelude
    + ['parkLevelStars', 'parkStarsToBank'].map((n) => grab(n)).join('\n') + '\n'
    + grab('ensureStarsLedger') + '\n' + grab('earnStars') + '\n'
    + grab('playElapsedSecs') + '\n'
    + grab('startGame') + '\n' + grab('saveGameProgress', 'save(); }') + '\n'
    + ';({startGame:startGame,saveGameProgress:saveGameProgress,'
    + 'getState:function(){ return gState; },setState:function(s){ gState=s; },getDB:function(){ return DB; },'
    + 'setToday:function(d){ TODAY=d; },'
    + 'simulateWin:function(moves){'
    + '  var lv=PARKLEVELS[gState.idx];'
    + '  var tb=parkStarsToBank(gState.idx, moves, lv.par, gState.starDay, gState.starBanked, todayKey());'
    + '  gState.starBanked=tb.starBanked; gState.starDay=tb.starDay;'
    + '  if(tb.bank>0){ var live=ex(); earnStars(live, tb.bank); }'
    + '  gState.starTotal=(gState.starTotal||0)+tb.bank;'
    + '  gState.score++; gState.idx++;'
    + '  saveGameProgress();'
    + '  return {banked:tb.bank};'
    + '}});';
  return eval(src);
}

/* ---------------- Wiring: drag handlers, hint, awards ---------------- */

test('parking wiring: pointer drag handlers, no-scroll CSS, honest hint', { skip: !HAS_SWIPE }, () => {
  const css = html.slice(0, html.indexOf('</style>'));
  assert.ok(css.includes('.parkcar{') && css.includes('touch-action:none'), 'cars do not scroll the page while dragging');
  assert.ok(css.includes('.parkcar.parkdrag'), 'a dragging car drops its slide transition');
  const bind = html.slice(html.indexOf('function bindGame(){'), html.indexOf('function saveGameProgress(){'));
  const park = bind.slice(bind.indexOf("if(gState.id==='parking')"), bind.indexOf("if(gState.id==='memory')"));
  assert.ok(park.includes('pointerdown'), 'cars listen for pointerdown (mouse + touch)');
  assert.ok(park.includes('pointermove'), 'cars follow the pointer while dragging');
  assert.ok(park.includes('pointerup'), 'release commits the drag');
  assert.ok(park.includes('pointercancel'), 'a cancelled drag snaps back');
  assert.ok(park.includes("document.addEventListener('pointermove'"), 'the drag move handler is document-level, so the pointer can leave the car');
  assert.ok(park.includes("document.addEventListener('pointerup'"), 'release outside the car still ends the drag');
  assert.ok(park.includes("document.addEventListener('pointercancel'"), 'a cancelled drag also ends at document level');
  assert.ok(park.includes("removeEventListener('pointermove'"), 'ending a drag removes the document move listener');
  assert.ok(park.indexOf('setPointerCapture') < 0, 'no pointer capture anywhere (the frog rule forbids it page-wide)');
  assert.ok(park.includes('parkDragRange'), 'the drag is clamped to the free run');
  assert.ok(park.includes('commitParkMove'), 'taps and drags share one commit path');
  assert.ok(park.includes('parkSlide(gState.cars'), 'drags slide several cells at once');
  const game = html.slice(html.indexOf('function gameHTML(){'), html.indexOf('function bindGame(){'));
  const parkGame = game.slice(game.indexOf("if(gState.id==='parking')"), game.indexOf("if(gState.id==='sentence')"));
  assert.ok(parkGame.includes('Drag a car to slide it'), 'the hint teaches dragging');
  assert.ok(parkGame.indexOf('Tap a car to slide it one cell') < 0, 'the old one-cell hint is gone');
});

test('parking wiring: stars bank on the win, never at the end, never on the resume edge', { skip: !HAS_BANK }, () => {
  const bind = html.slice(html.indexOf('function bindGame(){'), html.indexOf('function saveGameProgress(){'));
  const park = bind.slice(bind.indexOf("if(gState.id==='parking')"), bind.indexOf("if(gState.id==='memory')"));
  // One earnStars in the parking branch: the per-level bank.
  assert.equal((park.match(/earnStars\(live/g) || []).length, 1, 'exactly one star award in the parking branch (the level win)');
  assert.ok(park.includes('earnStars(live, tb.bank)'), 'the win banks the gated amount, not the raw star count');
  assert.ok(park.indexOf('earnStars(live,Math.min(gState.score,gState.rounds))') < 0, 'no capped end-of-game payout any more');
  assert.ok(park.includes("recordPlayBest(live,'parking')"), 'the finish still records the best time');
  assert.ok(park.includes("awardBadge('player','🎮 Arcade Star')"), 'the finish still awards the badge');
  // The already-won resume edge advances without banking.
  const edge = park.slice(park.indexOf('if(parkWon(gState.cars, lv)){'), park.indexOf('if(!gState.parkHist)'));
  assert.ok(edge.indexOf('earnStars') < 0, 'the resume edge case never banks stars');
  assert.ok(edge.indexOf('gState.score++') >= 0, 'the resume edge still advances the level');
  // The sync merge carries the new star fields (otherwise a 30s
  // auto-pull would drop them and a level could bank twice).
  const merge = html.slice(html.indexOf('function mergeExplorer'), html.indexOf('function mergeFamilyDB'));
  assert.ok(merge.includes('starTotal:'), 'the merge carries starTotal');
  assert.ok(merge.includes('starBanked:'), 'the merge carries starBanked');
  assert.ok(merge.includes('starDay:'), 'the merge carries starDay');
  // The completion screen shows the banked stars, not the level count.
  const game = html.slice(html.indexOf('function gameHTML(){'), html.indexOf('function bindGame(){'));
  assert.ok(game.includes("gState.id==='parking'?(gState.starTotal||0):gState.score"), 'the completion screen shows banked stars for parking');
});
