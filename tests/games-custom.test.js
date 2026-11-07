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

test('each crossword round is deterministic and its marked answer is the true word', { skip: !HAS_XW }, () => {
  const genRound = eval(stubTopics + helpers
    + '\nvar XWORDS=' + JSON.stringify(XWORDS) + ';\n'
    + grab('genRound') + '\n;genRound');
  for (const seed of [0, 7, 12345]) {
    for (let idx = 0; idx < 6; idx++) {
      const first = genRound('crossword', idx, seed);
      const second = genRound('crossword', idx, seed);
      assert.deepEqual(second.o, first.o, 'seed ' + seed + ' round ' + idx + ': options must not move on re-render');
      assert.equal(second.a, first.a, 'seed ' + seed + ' round ' + idx + ': correct-answer index must not move');
      assert.equal(first.o[first.a], XWORDS[idx].w, 'round ' + idx + ': the marked option is the true word ' + XWORDS[idx].w);
      assert.equal(first.o.length, 4, 'round ' + idx + ': four word options');
      assert.equal(new Set(first.o).size, 4, 'round ' + idx + ': options are all different words');
      assert.ok(first.q.includes(XWORDS[idx].clue), 'round ' + idx + ': question shows the clue');
      assert.ok(first.q.includes(XWORDS[idx].dir), 'round ' + idx + ': question shows the direction');
    }
  }
});

test('crossword branches exist in the page (grid, filled words, back button)', { skip: !HAS_XW }, () => {
  const game = html.slice(html.indexOf('function gameHTML(){'), html.indexOf('function bindGame(){'));
  assert.ok(game.includes("if(gState.id==='crossword')"), 'gameHTML has a crossword branch');
  assert.ok(game.includes('class="xwgrid"') || game.includes("'xwgrid'") || game.includes('xwgrid'), 'crossword branch renders the grid');
  assert.ok(game.includes('pX&&pX.filled&&pX.idx===gState.idx'), 'filled words restore from saved progress on resume');
  assert.ok(game.includes('id="gBack"'), 'crossword branch has its own back button');
  const bind = html.slice(html.indexOf('function bindGame(){'), html.indexOf('function saveGameProgress(){'));
  assert.ok(bind.includes("if(gState.id==='crossword')"), 'bindGame has a crossword branch');
  assert.ok(bind.includes('gState.filled[gState.idx]=true'), 'a correct answer fills the word in the grid');
});

/* ---------------- Exit Parking ---------------- */

const PARK_PRELUDE = 'var PARKW=4, PARKH=4;\n';
const parkFns = HAS_PARK
  ? eval(PARK_PRELUDE + ['parkCarCells', 'parkOccupied', 'parkCanMove', 'parkMove', 'parkWon'].map((n) => grab(n)).join('\n')
    + '\n;({parkCarCells:parkCarCells,parkOccupied:parkOccupied,parkCanMove:parkCanMove,parkMove:parkMove,parkWon:parkWon})')
  : null;

// Hand-verified solutions: [carId, direction] per step.
const SOLUTIONS = [
  [['b1', 'u'], ['red', 'r'], ['red', 'r']],
  [['y1', 'u'], ['g1', 'u'], ['g1', 'u'], ['red', 'r'], ['red', 'r']],
  [['a1', 'l'], ['b1', 'u'], ['c1', 'u'], ['c1', 'u'], ['red', 'r'], ['red', 'r']],
  [['a1', 'l'], ['b1', 'u'], ['b1', 'u'], ['c1', 'u'], ['red', 'r'], ['red', 'r']],
];

test('each parking level starts legal and is solvable by its verified move sequence', { skip: !HAS_PARK }, () => {
  assert.equal(PARKLEVELS.length, 4, 'four levels, one per round');
  assert.ok(html.includes('var PARKW=4, PARKH=4'), 'lot is 4x4 in the page');
  PARKLEVELS.forEach((lv, li) => {
    let cars = lv.cars.map((c) => ({ id: c.id, e: c.e, o: c.o, x: c.x, y: c.y, len: c.len }));
    // No two cars overlap, every car is inside the lot, red starts at (0,2).
    const seen = {};
    cars.forEach((c) => {
      assert.ok(c.o === 'h' || c.o === 'v', 'level ' + (li + 1) + ' car ' + c.id + ' has an orientation');
      parkFns.parkCarCells(c).forEach((p) => {
        assert.ok(p[0] >= 0 && p[0] < 4 && p[1] >= 0 && p[1] < 4, 'level ' + (li + 1) + ' car ' + c.id + ' stays in the lot');
        assert.ok(!seen[p[0] + ',' + p[1]], 'level ' + (li + 1) + ': cars must not overlap at ' + p);
        seen[p[0] + ',' + p[1]] = c.id;
      });
    });
    const red = cars.find((c) => c.id === 'red');
    assert.deepEqual([red.o, red.x, red.y, red.len], ['h', 0, 2, 2], 'level ' + (li + 1) + ': red car starts at (0,2), horizontal, len 2');
    assert.ok(!parkFns.parkWon(cars), 'level ' + (li + 1) + ': not already won at the start');
    // Simulate the verified solution, one legal slide at a time.
    SOLUTIONS[li].forEach((step) => {
      const id = step[0], dir = step[1];
      assert.ok(parkFns.parkCanMove(cars, id, dir), 'level ' + (li + 1) + ': ' + id + ' can slide ' + dir);
      cars = parkFns.parkMove(cars, id, dir);
      assert.ok(cars, 'level ' + (li + 1) + ': ' + id + ' ' + dir + ' produces a new layout');
    });
    assert.ok(parkFns.parkWon(cars), 'level ' + (li + 1) + ': red car reaches the exit after the solution');
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
});

/* ---------------- Save / restore (both games) ---------------- */

function harness() {
  const prelude = 'var GAMES=['
    + "{id:'word',e:'🌷',name:'Word Garden',rounds:6},"
    + "{id:'number',e:'🎈',name:'Number Pop',rounds:6},"
    + "{id:'memory',e:'🃏',name:'Memory Match',rounds:0},"
    + "{id:'sort',e:'🧺',name:'Speed Sort',rounds:6},"
    + "{id:'crossword',e:'🧩',name:'Crossword Quest',rounds:6},"
    + "{id:'parking',e:'🚗',name:'Exit Parking',rounds:4}];\n"
    + 'var PARKLEVELS=' + JSON.stringify(PARKLEVELS) + ';\n'
    + 'var PARKW=4, PARKH=4;\n'
    + 'var gState=null;\n'
    + 'var DB={explorers:[{id:"e1",stars:0,badges:[],playProgress:{},playFresh:{},playDoneDay:{}}],activeId:"e1"};\n'
    + 'function ex(){ return DB.explorers[0]; }\n'
    + 'function todayKey(){ return "2026-11-07"; }\n'
    + 'function save(){}\n'
    + 'function go(){}\n'
    + 'function shuffle(a){ return a.slice(); }\n'
    + 'function toast(){}\n';
  const src = prelude + helpers + '\n'
    + ['parkCarCells', 'parkOccupied', 'parkCanMove', 'parkMove', 'parkWon'].map((n) => grab(n)).join('\n') + '\n'
    + grab('playElapsedSecs') + '\n'
    + grab('startGame') + '\n' + grab('saveGameProgress', 'save(); }') + '\n'
    + ';({startGame:startGame,saveGameProgress:saveGameProgress,parkMove:parkMove,parkWon:parkWon,'
    + 'getState:function(){ return gState; },setState:function(s){ gState=s; },getDB:function(){ return DB; }});';
  return eval(src);
}

test('parking progress saves mid-level car positions and restores them on resume', { skip: !HAS_PARK }, () => {
  const fns = harness();
  fns.startGame('parking');
  let st = fns.getState();
  assert.equal(st.idx, 0, 'fresh game starts at level 1');
  assert.equal(st.rounds, 4, 'four levels');
  // Slide blue up, drive red right once, then save mid-level.
  st.cars = fns.parkMove(st.cars, 'b1', 'u');
  st.cars = fns.parkMove(st.cars, 'red', 'r');
  st.moves = 2;
  fns.saveGameProgress();
  const saved = JSON.parse(JSON.stringify(fns.getDB().explorers[0].playProgress.parking));
  assert.equal(saved.idx, 0, 'saved level is 1');
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
  fns.getDB().explorers[0].playProgress.parking = { idx: 4, score: 4, seed: 1, cars: PARKLEVELS[3].cars };
  fns.startGame('parking');
  const st = fns.getState();
  assert.equal(st.idx, 0, 'completed game replays from level 1');
  assert.equal(st.score, 0, 'score resets on replay');
  assert.deepEqual(st.cars, PARKLEVELS[0].cars, 'replay uses the level 1 layout');
});

test('crossword filled words save with progress and resume at the same round', { skip: !HAS_XW }, () => {
  const fns = harness();
  fns.startGame('crossword');
  let st = fns.getState();
  assert.equal(st.idx, 0, 'fresh game starts at round 1');
  assert.equal(st.rounds, 6, 'six rounds');
  // Simulate two correct answers, then save mid-game.
  st.idx = 2; st.score = 2;
  st.filled = [true, true, false, false, false, false];
  fns.saveGameProgress();
  const saved = JSON.parse(JSON.stringify(fns.getDB().explorers[0].playProgress.crossword));
  assert.equal(saved.idx, 2, 'saved round is 3');
  assert.equal(saved.score, 2, 'saved score is 2');
  assert.deepEqual(saved.filled, [true, true, false, false, false, false], 'filled words are saved');
  // Leave and come back: same round and score.
  fns.setState(null);
  fns.startGame('crossword');
  st = fns.getState();
  assert.equal(st.idx, 2, 'resumed at the same round');
  assert.equal(st.score, 2, 'resumed with the same score');
});

test('the explorer merge keeps parking cars and crossword filled words', { skip: !HAS_PARK || !HAS_XW }, () => {
  const line = html.split('\n').find((l) => l.includes('Object.keys(b.playProgress'));
  assert.ok(line, 'the playProgress merge line exists');
  assert.ok(line.includes('cars:'), 'merge keeps cars (otherwise save() would wipe mid-level lots)');
  assert.ok(line.includes('filled:'), 'merge keeps filled (otherwise save() would wipe the crossword grid)');
  assert.ok(line.includes('open:'), 'merge keeps open (otherwise save() would wipe face-up Memory cards at quit time)');
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
  assert.ok(bind.includes('parkMove(gState.cars, id, dir)'), 'car taps slide via parkMove');
  assert.ok(bind.includes('parkWon(gState.cars)'), 'win detection uses parkWon');
});
