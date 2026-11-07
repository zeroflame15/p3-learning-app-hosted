// Tests for the two custom Play Arcade games: Crossword Quest and
// Exit Parking.
//
// The page under test is PAGE_PATH (the patched copy) or
// public/index.html. The custom-game patches are applied separately by
// the orchestrator, so every test below SKIPS when the page does not
// yet carry the feature it checks — run with
//   PAGE_PATH=/tmp/custom-index.html node --test tests/games-custom.test.js
// to exercise the real assertions against the patched copy.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE, 'utf8');
const HAS_XW = html.includes('var XWORDS=');
const HAS_PARK = html.includes('var PARKLEVELS=');

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

const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"",j:""}],fresh:[]},'
  + '{quest:[{q:"Q3",o:["i","j","k","l"],a:2,c:"",j:""},{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled'].map((n) => grab(n)).join('\n');

const XWORDS = HAS_XW ? eval(grabVar('XWORDS') + '\n;XWORDS') : null;
const XWGRIDS = HAS_XW && html.includes('var XWGRIDS=') ? eval(grabVar('XWGRIDS') + '\n;XWGRIDS') : null;
const PARKLEVELS = HAS_PARK ? eval(grabVar('PARKLEVELS') + '\n;PARKLEVELS') : null;

/* ---------------- Crossword Quest ---------------- */

test('crossword grid: every crossing letter matches, and the grid is exactly as designed', { skip: !HAS_XW }, () => {
  assert.equal(XWORDS.length, 6, 'six words, one per round');
  const cell = {};
  const occupants = {};
  XWORDS.forEach((wd) => {
    assert.equal(wd.w.length, 3, wd.w + ' is a 3-letter P3 word');
    assert.ok(wd.clue && wd.clue.length > 5, wd.w + ' has a real clue');
    assert.ok(wd.dir === 'Across' || wd.dir === 'Down', wd.w + ' has a direction');
    for (let k = 0; k < wd.w.length; k++) {
      const key = (wd.x + wd.dx * k) + ',' + (wd.y + wd.dy * k);
      if (cell[key]) assert.equal(cell[key], wd.w[k], 'crossing at ' + key + ' must agree (' + wd.w + ')');
      cell[key] = wd.w[k];
      occupants[key] = (occupants[key] || 0) + 1;
    }
  });
  XWORDS.forEach((wd) => {
    let shared = 0;
    for (let k = 0; k < wd.w.length; k++) {
      if (occupants[(wd.x + wd.dx * k) + ',' + (wd.y + wd.dy * k)] > 1) shared++;
    }
    assert.ok(shared >= 1, wd.w + ' crosses at least one other word');
  });
  // The filled grid, row by row ('.' = blank cell).
  const rows = [];
  for (let y = 0; y < 5; y++) {
    let row = '';
    for (let x = 0; x < 5; x++) row += cell[x + ',' + y] || '.';
    rows.push(row);
  }
  assert.deepEqual(rows, ['CAT..', 'A.I..', 'R.PIG', 'A...U', 'T...M'], 'grid rows are exactly as designed');
  // Clue numbers: one per word start, shared by CAT/CAR at (0,0).
  const nums = XWORDS.map((wd) => wd.num);
  assert.deepEqual(nums, [1, 1, 2, 3, 4, 5], 'clue numbers follow reading order');
});

test('genRound has no crossword branch any more — the grid is typed, not multiple-choice', { skip: !HAS_XW }, () => {
  const genSrc = grab('genRound');
  assert.ok(genSrc.indexOf("gameId==='crossword'") < 0, 'no crossword round in genRound');
  assert.ok(genSrc.indexOf('xwd|') < 0 && genSrc.indexOf('xwo|') < 0, 'no crossword option shuffling left');
});

test('crossword branches exist in the page (grid, typing input, clue list, toggle)', { skip: !HAS_XW }, () => {
  const game = html.slice(html.indexOf('function gameHTML(){'), html.indexOf('function bindGame(){'));
  assert.ok(game.includes("if(gState.id==='crossword')"), 'gameHTML has a crossword branch');
  assert.ok(game.includes('class="xwgrid"') || game.includes("'xwgrid'") || game.includes('xwgrid'), 'crossword branch renders the grid');
  assert.ok(game.includes('id="xwInput"'), 'a keyboard input for typing the word');
  assert.ok(game.includes('id="xwCheck"'), 'a Check button for the typed word');
  assert.ok(game.includes('class="xwclues"'), 'the hint list (clues only — no answer options)');
  assert.ok(game.includes('data-clue'), 'each clue selects its word');
  assert.ok(game.indexOf('data-gopt') < 0, 'no multiple-choice options in the crossword branch');
  assert.ok(game.includes('id="gBack"'), 'crossword branch has its own back button');
  const bind = html.slice(html.indexOf('function bindGame(){'), html.indexOf('function saveGameProgress(){'));
  assert.ok(bind.includes("if(gState.id==='crossword')"), 'bindGame has a crossword branch');
  assert.ok(bind.includes('xwSelectCell'), 'tapping a square selects its word (same square again toggles)');
  assert.ok(bind.includes('checkWord'), 'typing is checked as a whole word');
  assert.ok(bind.includes('gState.wrong'), 'a wrong word flashes red');
  const start = html.slice(html.indexOf('function startGame(id){'), html.indexOf('function gameOptsHTML'));
  assert.ok(start.includes("else if(id==='crossword')"), 'startGame restores the crossword grid state');
  assert.ok(start.includes('letters'), 'typed letters restore on resume');
  const save = html.slice(html.indexOf('function saveGameProgress(){'), html.indexOf('/* ============================================================ ASK PIP'));
  assert.ok(save.includes('letters:Object.assign({},gState.letters||{})'), 'typed letters are saved with the game');
  const merge = html.slice(html.indexOf('function mergeExplorer'), html.indexOf('function mergeFamilyDB'));
  assert.ok(merge.includes('letters:'), 'the sync merge carries typed letters');
});

/* ---------------- Exit Parking ---------------- */

const PARK_PRELUDE = 'var PARKW=4, PARKH=4, PARKEXIT={x:3,y:2};\n';
const parkFns = HAS_PARK
  ? eval(PARK_PRELUDE + ['parkCarCells', 'parkOccupied', 'parkCanMove', 'parkMove', 'parkWon', 'parkLevelStars', 'parkSlide'].map((n) => grab(n)).join('\n')
    + '\n;({parkCarCells:parkCarCells,parkOccupied:parkOccupied,parkCanMove:parkCanMove,parkMove:parkMove,parkWon:parkWon,parkLevelStars:parkLevelStars,parkSlide:parkSlide})')
  : null;

// BFS-minimal solutions: [carId, direction] per step. The length of
// each solution is the level's par.
const SOLUTIONS = [
  [['b1', 'u'], ['red', 'r'], ['red', 'r']],
  [['y1', 'u'], ['red', 'r'], ['g1', 'u'], ['g1', 'u'], ['red', 'r']],
  [['a1', 'l'], ['b1', 'u'], ['red', 'r'], ['c1', 'u'], ['c1', 'u'], ['red', 'r']],
  [['a1', 'l'], ['b1', 'u'], ['b1', 'u'], ['red', 'r'], ['c1', 'u'], ['red', 'r']],
  [['b1', 'u'], ['red', 'r'], ['c1', 'd'], ['red', 'r'], ['red', 'r']],
  [['b1', 'u'], ['red', 'r'], ['red', 'r'], ['f1', 'u'], ['f1', 'u'], ['red', 'r']],
  [['c1', 'u'], ['f1', 'l'], ['b1', 'u'], ['red', 'r'], ['red', 'r'], ['red', 'r']],
  [['c1', 'd'], ['c1', 'd'], ['g1', 'l'], ['b1', 'd'], ['red', 'r'], ['red', 'r'], ['red', 'r']],
  [['b1', 'u'], ['red', 'r'], ['c1', 'd'], ['red', 'r'], ['red', 'r'], ['red', 'r']],
  [['c1', 'u'], ['f1', 'l'], ['b1', 'd'], ['b1', 'd'], ['b1', 'd'], ['red', 'r'], ['red', 'r'], ['red', 'r'], ['red', 'r']],
  [['b1', 'u'], ['red', 'r'], ['c1', 'u'], ['c1', 'u'], ['red', 'r'], ['d1', 'u'], ['red', 'r'], ['red', 'r']],
  [['b1', 'u'], ['b1', 'u'], ['red', 'r'], ['c1', 'u'], ['red', 'r'], ['d1', 'u'], ['d1', 'u'], ['red', 'r'], ['red', 'r']],
];
const PARS = [3, 5, 6, 6, 5, 6, 6, 7, 6, 9, 8, 9, 10, 11, 14, 15, 17, 18];
const DIMS = [[4, 4], [4, 4], [4, 4], [4, 4], [5, 5], [5, 5], [5, 5], [5, 5], [6, 6], [6, 6], [6, 6], [6, 6], [6, 6], [6, 6], [6, 6], [6, 6], [6, 6], [6, 6]];
const EXITS = [[3, 2], [3, 2], [3, 2], [3, 2], [4, 2], [4, 2], [4, 2], [4, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 2], [5, 2], [5, 2], [5, 2], [5, 2]];
// BFS-minimal slide solutions for levels 13-18: [carId, direction, cells] per drag.
const SLIDE_SOLUTIONS = [[['a1','u',1],['b1','u',2],['f1','d',1],['g1','d',1],['d1','l',2],['e1','l',2],['c1','u',1],['k1','u',1],['red','r',4]],[['d1','r',2],['a1','u',1],['g1','u',1],['i1','l',1],['b1','d',1],['j1','d',1],['k1','l',1],['e1','l',1],['c1','d',1],['red','r',4]],[['c1','d',1],['i1','l',1],['b1','d',1],['j1','d',1],['f1','d',1],['d1','r',1],['l1','r',1],['a1','u',2],['red','r',3],['a1','d',1],['d1','l',1],['f1','u',1],['red','r',1]],[['d1','r',1],['b1','u',2],['e1','l',1],['a1','u',1],['red','r',1],['k1','r',1],['g1','u',2],['h1','l',1],['i1','l',2],['l1','l',2],['m1','l',2],['c1','d',2],['f1','d',1],['red','r',3]],[['e1','l',1],['f1','d',1],['d1','r',1],['a1','u',2],['h1','r',1],['g1','u',1],['i1','l',1],['b1','d',2],['k1','l',1],['l1','l',1],['c1','d',1],['red','r',3],['a1','d',1],['d1','l',1],['f1','u',1],['red','r',1]],[['i1','l',1],['b1','d',1],['j1','d',1],['f1','d',1],['d1','r',1],['l1','r',1],['a1','u',2],['red','r',1],['g1','u',1],['k1','l',1],['e1','l',1],['c1','d',1],['red','r',2],['a1','d',1],['d1','l',1],['f1','u',1],['red','r',1]]];

test('each parking level starts legal and is solvable by its verified move sequence', { skip: !HAS_PARK }, () => {
  assert.equal(PARKLEVELS.length, 18, 'eighteen levels, one per round');
  assert.ok(html.includes('var PARKW=4, PARKH=4'), 'the 4x4 globals stay for the old 1-arg calls');
  PARKLEVELS.forEach((lv, li) => {
    assert.deepEqual([lv.w, lv.h], DIMS[li], 'level ' + (li + 1) + ' is ' + DIMS[li][0] + 'x' + DIMS[li][1]);
    assert.deepEqual([lv.exit.x, lv.exit.y], EXITS[li], 'level ' + (li + 1) + ' exit is ' + EXITS[li]);
    assert.equal(lv.par, PARS[li], 'level ' + (li + 1) + ' par is ' + PARS[li]);
    if (li < 12) {
      assert.equal(SOLUTIONS[li].length, lv.par, 'level ' + (li + 1) + ': the verified solution is exactly par long');
    } else {
      assert.equal(SLIDE_SOLUTIONS[li - 12].length, lv.par - 1, 'level ' + (li + 1) + ': the verified slide solution is exactly par-1 long (par is minimal slides + 1)');
    }
    let cars = lv.cars.map((c) => ({ id: c.id, e: c.e, o: c.o, x: c.x, y: c.y, len: c.len, bg: c.bg }));
    // No two cars overlap, every car is inside the lot, red starts at the exit row.
    const seen = {};
    cars.forEach((c) => {
      assert.ok(c.o === 'h' || c.o === 'v', 'level ' + (li + 1) + ' car ' + c.id + ' has an orientation');
      assert.ok(c.bg && c.bg.length > 0, 'level ' + (li + 1) + ' car ' + c.id + ' has a colour');
      parkFns.parkCarCells(c).forEach((p) => {
        assert.ok(p[0] >= 0 && p[0] < lv.w && p[1] >= 0 && p[1] < lv.h, 'level ' + (li + 1) + ' car ' + c.id + ' stays in the lot');
        assert.ok(!seen[p[0] + ',' + p[1]], 'level ' + (li + 1) + ': cars must not overlap at ' + p);
        seen[p[0] + ',' + p[1]] = c.id;
      });
    });
    const red = cars.find((c) => c.id === 'red');
    assert.deepEqual([red.o, red.x, red.y, red.len], ['h', 0, lv.exit.y, 2], 'level ' + (li + 1) + ': red car starts at (0,' + lv.exit.y + '), horizontal, len 2');
    assert.ok(!parkFns.parkWon(cars, lv), 'level ' + (li + 1) + ': not already won at the start');
    // Simulate the verified solution, one legal slide at a time.
    // Levels 13-18 use slide steps [id, dir, cells]; one drag is one move.
    const steps = li < 12 ? SOLUTIONS[li].map((s) => [s[0], s[1], 1]) : SLIDE_SOLUTIONS[li - 12];
    steps.forEach((step) => {
      const id = step[0], dir = step[1], n = step[2];
      cars = parkFns.parkSlide(cars, id, dir, n, lv);
      assert.ok(cars, 'level ' + (li + 1) + ': ' + id + ' ' + dir + ' x' + n + ' produces a new layout');
    });
    assert.ok(parkFns.parkWon(cars, lv), 'level ' + (li + 1) + ': red car reaches the exit after the solution');
    // Star rating: par is 3 stars, par+2 is 2, anything more is 1.
    assert.equal(parkFns.parkLevelStars(lv.par, lv.par), 3, 'level ' + (li + 1) + ': par earns 3 stars');
    assert.equal(parkFns.parkLevelStars(lv.par + 2, lv.par), 2, 'level ' + (li + 1) + ': par+2 earns 2 stars');
    assert.equal(parkFns.parkLevelStars(lv.par + 3, lv.par), 1, 'level ' + (li + 1) + ': par+3 earns 1 star');
  });
});

test('parking moves are refused when blocked, out of bounds, or against the grain', { skip: !HAS_PARK }, () => {
  let cars = PARKLEVELS[0].cars;
  assert.equal(parkFns.parkMove(cars, 'red', 'r'), null, 'red cannot drive into the blue car');
  assert.equal(parkFns.parkMove(cars, 'red', 'u'), null, 'a horizontal car cannot slide up');
  assert.equal(parkFns.parkMove(cars, 'b1', 'l'), null, 'a vertical car cannot slide left');
  assert.equal(parkFns.parkMove(cars, 'red', 'l'), null, 'red cannot leave the lot on the left');
  assert.ok(parkFns.parkCanMove(cars, 'b1', 'u'), 'blue can slide up out of the way');
  cars = parkFns.parkMove(cars, 'b1', 'u');
  assert.ok(parkFns.parkCanMove(cars, 'red', 'r'), 'once blue moves, red can drive right');
  assert.equal(parkFns.parkMove(cars, 'nope', 'r'), null, 'an unknown car cannot move');
  // The level argument is optional: old 1-arg calls still use the 4x4 globals.
  assert.ok(parkFns.parkWon([{ id: 'red', e: '🚗', o: 'h', x: 2, y: 2, len: 2 }]), 'parkWon with no level defaults to the 4x4 exit');
  assert.equal(parkFns.parkWon([{ id: 'red', e: '🚗', o: 'h', x: 2, y: 2, len: 2 }], PARKLEVELS[7]), false, 'a 4x4 win position is not a win on a 5x5 level');
});

test('parking level colours survive a move (parkMove carries bg)', { skip: !HAS_PARK }, () => {
  const cars = PARKLEVELS[5].cars;
  const moved = parkFns.parkMove(cars, 'b1', 'u', PARKLEVELS[5]);
  assert.ok(moved, 'the move is legal');
  moved.forEach((c, i) => assert.equal(c.bg, cars[i].bg, 'car ' + c.id + ' keeps its colour after a move'));
});

/* ---------------- Save / restore (both games) ---------------- */

function harness() {
  const prelude = 'var GAMES=['
    + "{id:'word',e:'🌷',name:'Word Garden',rounds:6},"
    + "{id:'number',e:'🎈',name:'Number Pop',rounds:6},"
    + "{id:'memory',e:'🃏',name:'Memory Match',rounds:0},"
    + "{id:'sort',e:'🧺',name:'Speed Sort',rounds:6},"
    + "{id:'crossword',e:'🧩',name:'Crossword Quest',rounds:6},"
    + "{id:'parking',e:'🚗',name:'Exit Parking',rounds:18}];\n"
    + 'var PARKLEVELS=' + JSON.stringify(PARKLEVELS) + ';\n'
    + 'var PARKW=4, PARKH=4, PARKEXIT={x:3,y:2};\n'
    + 'var gState=null;\n'
    + 'var DB={explorers:[{id:"e1",stars:0,badges:[],playProgress:{},playFresh:{},playDoneDay:{}}],activeId:"e1"};\n'
    + 'function ex(){ return DB.explorers[0]; }\n'
    + 'function todayKey(){ return "2026-11-07"; }\n'
    + 'function save(){}\n'
    + 'function go(){}\n'
    + 'function shuffle(a){ return a.slice(); }\n'
    + 'function toast(){}\n'
    + 'function canPlay(){ return true; }\n';
  const src = prelude + helpers + '\n'
    + 'var XWORDS=' + JSON.stringify(XWORDS) + ';\n'
    + (XWGRIDS ? 'var XWGRIDS=' + JSON.stringify(XWGRIDS) + ';\n' + grab('xwGridOfDay') + '\n' : '')
    + grab('xwNextUnsolved') + '\n'
    + ['parkCarCells', 'parkOccupied', 'parkCanMove', 'parkMove', 'parkWon'].map((n) => grab(n)).join('\n') + '\n'
    + grab('playElapsedSecs') + '\n'
    + grab('startGame') + '\n' + grab('saveGameProgress', 'save(); }') + '\n'
    + ';({startGame:startGame,saveGameProgress:saveGameProgress,parkMove:parkMove,parkWon:parkWon,xwGridOfDay:(typeof xwGridOfDay==="function"?xwGridOfDay:null),'
    + 'getState:function(){ return gState; },setState:function(s){ gState=s; },getDB:function(){ return DB; }});';
  return eval(src);
}

test('parking progress saves mid-level car positions and restores them on resume', { skip: !HAS_PARK }, () => {
  const fns = harness();
  fns.startGame('parking');
  let st = fns.getState();
  assert.equal(st.idx, 0, 'fresh game starts at level 1');
  assert.equal(st.rounds, 18, 'eighteen levels');
  // Slide blue up, drive red right once, then save mid-level.
  st.cars = fns.parkMove(st.cars, 'b1', 'u');
  st.cars = fns.parkMove(st.cars, 'red', 'r');
  st.moves = 2;
  fns.saveGameProgress();
  const saved = JSON.parse(JSON.stringify(fns.getDB().explorers[0].playProgress.parking));
  assert.equal(saved.idx, 0, 'saved level is 1');
  assert.equal(saved.v, 2, 'the save carries the v:2 marker for the 18-level game');
  assert.deepEqual(saved.cars, st.cars, 'saved car positions match the live lot');
  // Leave and come back: positions must restore, not reset to level 1 fresh.
  fns.setState(null);
  fns.startGame('parking');
  st = fns.getState();
  assert.equal(st.idx, 0, 'resumed at the same level');
  assert.deepEqual(st.cars, saved.cars, 'mid-level car positions are restored on resume');
  assert.ok(!fns.parkWon(st.cars), 'resumed lot is not already won');
  // Finishing the level from the restored lot still wins.
  st.cars = fns.parkMove(st.cars, 'red', 'r');
  assert.ok(fns.parkWon(st.cars), 'red reaches the exit from the restored lot');
});

test('parking replay after completion starts fresh at level 1', { skip: !HAS_PARK }, () => {
  const fns = harness();
  fns.getDB().explorers[0].playProgress.parking = { idx: 18, score: 18, seed: 1, v: 2, cars: PARKLEVELS[17].cars };
  fns.startGame('parking');
  const st = fns.getState();
  assert.equal(st.idx, 0, 'completed game replays from level 1');
  assert.equal(st.score, 0, 'score resets on replay');
  assert.deepEqual(st.cars, PARKLEVELS[0].cars, 'replay uses the level 1 layout');
});

test('a legacy 4-level parking save resumes at level 5 with fresh cars, not the old 4x4 lot', { skip: !HAS_PARK }, () => {
  const fns = harness();
  // An old save: finished all 4 levels, no v marker, level-4 cars.
  fns.getDB().explorers[0].playProgress.parking = { idx: 4, score: 4, seed: 1, cars: PARKLEVELS[3].cars };
  fns.startGame('parking');
  const st = fns.getState();
  assert.equal(st.idx, 4, 'the old finished game continues at level 5, not level 1');
  assert.deepEqual(st.cars, PARKLEVELS[4].cars, 'level 5 loads its own fresh layout, not the saved 4x4 lot');
  assert.equal(st.score, 4, 'the old score carries over');
});

test('crossword solved words and typed letters save with progress and resume', { skip: !HAS_XW }, () => {
  const fns = harness();
  fns.startGame('crossword');
  let st = fns.getState();
  assert.equal(st.idx, 0, 'fresh game: 0 words solved');
  assert.equal(st.rounds, 6, 'six words in the grid');
  assert.deepEqual(st.filled, [false, false, false, false, false, false], 'nothing solved yet');
  assert.deepEqual(st.letters, {}, 'no typed letters yet');
  assert.equal(st.sel, 0, 'first unsolved word selected (CAT)');
  assert.ok(st.gridId >= 0 && st.gridId < 6, 'a grid is picked for the run');
  if (fns.xwGridOfDay) assert.equal(st.gridId, fns.xwGridOfDay(), 'a fresh run takes today\'s grid');
  // Solve CAT and CAR, type one letter of TIP, then save mid-game.
  st.filled = [true, true, false, false, false, false];
  st.idx = 2; st.score = 2;
  st.letters = { '2,1': 'I' };
  fns.saveGameProgress();
  const saved = JSON.parse(JSON.stringify(fns.getDB().explorers[0].playProgress.crossword));
  assert.equal(saved.idx, 2, 'two words solved');
  assert.equal(saved.score, 2, 'saved score is 2');
  assert.equal(saved.gridId, st.gridId, 'the grid id is saved with the game');
  assert.deepEqual(saved.filled, [true, true, false, false, false, false], 'solved words are saved');
  assert.deepEqual(saved.letters, { '2,1': 'I' }, 'typed letters are saved');
  // Leave and come back: same grid, same words solved, same letters, next word selected.
  fns.setState(null);
  fns.startGame('crossword');
  st = fns.getState();
  assert.equal(st.gridId, saved.gridId, 'the resume keeps the saved grid, not a fresh one');
  assert.equal(st.idx, 2, 'resumed with 2 words solved');
  assert.equal(st.score, 2, 'resumed with the same score');
  assert.deepEqual(st.filled, [true, true, false, false, false, false], 'solved words are restored');
  assert.deepEqual(st.letters, { '2,1': 'I' }, 'typed letters are restored');
  assert.equal(st.sel, 2, 'the next unsolved word (TIP) is selected on resume');
});

test('the explorer merge keeps parking cars and crossword filled words', { skip: !HAS_PARK || !HAS_XW }, () => {
  const line = html.split('\n').find((l) => l.includes('Object.keys(b.playProgress'));
  assert.ok(line, 'the playProgress merge line exists');
  assert.ok(line.includes('cars:'), 'merge keeps cars (otherwise save() would wipe mid-level lots)');
  assert.ok(line.includes('filled:'), 'merge keeps filled (otherwise save() would wipe the crossword grid)');
  assert.ok(line.includes('open:'), 'merge keeps open (otherwise save() would wipe face-up Memory cards at quit time)');
  assert.ok(line.includes('gridId:'), 'merge keeps gridId (otherwise a resume would load the wrong grid for its filled words)');
  assert.ok(line.includes('built:'), 'merge keeps the sentence build (otherwise save() would wipe a half-built sentence)');
  assert.ok(line.includes('sent:'), 'merge keeps the sentence key (otherwise a build could restore onto the wrong sentence)');
  assert.ok(line.includes('v:'), 'merge keeps the parking version marker');
  assert.ok(line.includes('starTotal:'), 'merge keeps the banked star total');
  assert.ok(line.includes('starBanked:'), 'merge keeps the banked-level count');
  assert.ok(line.includes('starDay:'), 'merge keeps the banking day');
});

test('both games render their own back button and styles', { skip: !HAS_XW || !HAS_PARK }, () => {
  assert.ok(html.includes('.xwgrid{') && html.includes('.xwcell{'), 'crossword grid styles exist');
  assert.ok(html.includes('.parklot{') && html.includes('.parkcar{'), 'parking lot styles exist');
  const game = html.slice(html.indexOf('function gameHTML(){'), html.indexOf('function bindGame(){'));
  assert.ok(game.includes("if(gState.id==='parking')"), 'gameHTML has a parking branch');
  assert.ok(game.includes('data-car='), 'parking branch renders tappable cars');
  assert.ok(game.includes('PARKEXIT'), 'parking branch marks the exit');
  const bind = html.slice(html.indexOf('function bindGame(){'), html.indexOf('function saveGameProgress(){'));
  assert.ok(bind.includes("if(gState.id==='parking')"), 'bindGame has a parking branch');
  assert.ok(bind.includes('parkMove(gState.cars, id, dir, lv)'), 'car taps slide via parkMove');
  assert.ok(bind.includes('parkWon(gState.cars, lv)'), 'win detection uses parkWon');
});
