// Tests for Play Arcade navigation + Number Pop balloons + Speed Sort
// big tiles (play-nav batch).
//
// Conventions follow tests/games.test.js: the page functions are
// pulled out of the HTML source and eval'd with small stubs, so the
// tests run against PAGE_PATH (default: the real public/index.html,
// or a temp copy under test) without a browser.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const clientSrc = fs.readFileSync(PAGE_PATH, 'utf8');

function grab(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = clientSrc.indexOf('\n}\n', start);
  assert.ok(end > start, name + ' has a closing brace');
  return clientSrc.slice(start, end + 3);
}

// esc is a one-liner, so grab() (which looks for a closing brace on
// its own line) would overshoot into the next function.
function grabLine(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  return clientSrc.slice(start, clientSrc.indexOf('\n', start));
}

const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"",j:""},{q:"Q2",o:["e","f","g","h"],a:1,c:"",j:""}],fresh:[]},'
  + '{quest:[{q:"Q3",o:["i","j","k","l"],a:2,c:"",j:""},{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled', 'shuffle']
  .map(grab).join('\n');
const hclWordsSrc = clientSrc.match(/var HCL_WORDS=\[[^\]]*\];/)[0];
const gamesSrc = clientSrc.match(/var GAMES=\[[\s\S]*?\];/)[0];

// Live handles for the game functions, with gState settable per test.
function makeGame() {
  return eval(stubTopics + helpers + '\n'
    + gamesSrc + '\n'
    + grabLine('esc') + '\n'
    + 'var PRAISE=["Great!"]; var ENCOURAGE=["Try again!"];\n'
    + 'function pipSVG(){ return ""; }\n'
    + 'function ex(){ return {glow:"#ffb020", stars:0, playProgress:{}}; }\n'
    + 'var gState=null;\n'
    + grab('genRound') + '\n'
    + grab('gameOptsHTML') + '\n'
    + grab('gameHTML') + '\n'
    + ';({ setState:function(s){ gState=s; }, html:function(){ return gameHTML(); },'
    + ' round:function(id,idx,seed){ return genRound(id,idx,seed); } })');
}

// Live handles for the spelling card, with hclTest settable per test.
function makeHcl() {
  return eval(hclWordsSrc + '\n'
    + grab('hclStepFor') + '\n'
    + grabLine('esc') + '\n'
    + 'var hclTest=null;\n'
    + grab('hclCardHTML') + '\n'
    + ';({ html:function(e){ return hclCardHTML(e); }, setTest:function(t){ hclTest=t; } })');
}

const MEM_DECK = ['🐸', '🐸', '🦦', '🦦', '🍓', '🍓', '⭐', '⭐', '🚀', '🚀', '🦋', '🦋'];

test('spelling card has a Back to Learn button at the top, in list mode', () => {
  const hcl = makeHcl();
  const html = hcl.html({ hclMissed: [] });
  assert.ok(html.includes('id="hclBack"'), 'list mode has the back button');
  assert.ok(html.includes('← Back to Learn'), 'button reads "Back to Learn"');
  assert.ok(html.indexOf('id="hclBack"') < html.indexOf('听写 Spelling routine'),
    'back button sits at the top of the card, before the heading');
});

test('spelling card keeps the Back to Learn button during the self-test', () => {
  const hcl = makeHcl();
  hcl.setTest({ words: [{ w: '老师', p: 'lǎo shī', m: 'teacher' }], idx: 0 });
  const html = hcl.html({ hclMissed: [] });
  assert.ok(html.includes('id="hclBack"'), 'self-test mode has the back button');
  assert.ok(html.includes('← Back to Learn'), 'button reads "Back to Learn"');
});

test('spelling Back button leaves the test and returns to Learn (top of page)', () => {
  const bindLearn = grab('bindLearn');
  const at = bindLearn.indexOf("getElementById('hclBack')");
  assert.ok(at >= 0, 'bindLearn wires hclBack');
  const handler = bindLearn.slice(at);
  assert.ok(handler.includes('hclTest=null'), 'leaving the card ends the self-test, so Learn shows the topic list');
  assert.ok(handler.includes("go('learn')"), 'button goes to the Learn page');
  // go() itself scrolls to the top on every route change.
  const goFn = grab('go');
  assert.ok(goFn.includes('window.scrollTo(0,0)'), 'go() scrolls to the top');
});

test('every in-progress game screen has a save-and-back button', () => {
  const g = makeGame();
  for (const id of ['word', 'number', 'sort']) {
    g.setState({ id, idx: 1, score: 1, picked: null, answered: false, rounds: 6, seed: 777 });
    const html = g.html();
    assert.ok(html.includes('id="gBackSave"'), id + ' in-progress screen has gBackSave');
    assert.ok(html.includes('← Back to Play'), id + ' back button reads "Back to Play"');
  }
  g.setState({ id: 'memory', deck: MEM_DECK, open: [], matched: [0, 1], lock: false, moves: 3, won: false, seed: 0 });
  const mem = g.html();
  assert.ok(mem.includes('id="gBackSave"'), 'Memory Match in-progress screen has gBackSave');
  assert.ok(mem.includes('← Back to Play'), 'Memory back button reads "Back to Play"');
});

test('completion screens still use the plain Back button (progress already saved)', () => {
  const g = makeGame();
  g.setState({ id: 'word', idx: 6, score: 5, picked: null, answered: false, rounds: 6, seed: 777 });
  const done = g.html();
  assert.ok(done.includes('id="gBack"'), 'completed game keeps gBack');
  assert.ok(!done.includes('gBackSave'), 'completed game needs no save-and-back button');
  g.setState({ id: 'memory', deck: MEM_DECK, open: [], matched: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], lock: false, moves: 9, won: true, seed: 0 });
  const memDone = g.html();
  assert.ok(memDone.includes('id="gBack"'), 'completed Memory Match keeps gBack');
  assert.ok(!memDone.includes('gBackSave'), 'completed Memory Match needs no save-and-back button');
});

test('the back-save handler saves first, then leaves — and sits before the memory branch', () => {
  const bindGame = grab('bindGame');
  const at = bindGame.indexOf("getElementById('gBackSave')");
  assert.ok(at >= 0, 'bindGame wires gBackSave');
  assert.ok(at < bindGame.indexOf("if(gState.id==='memory')"),
    'gBackSave handler is inserted before the memory branch, so it covers every game');
  const handler = bindGame.slice(at, bindGame.indexOf('};', at));
  assert.ok(handler.indexOf('saveGameProgress()') >= 0, 'back button saves progress');
  assert.ok(handler.indexOf('saveGameProgress()') < handler.indexOf("go('play')"),
    'progress is saved BEFORE leaving for Play');
  assert.ok(handler.includes('gState=null'), 'game state is cleared, like Save & quit');
  // The existing handlers are untouched.
  assert.ok(bindGame.includes("getElementById('gBack')"), 'gBack handler still present');
  assert.ok(bindGame.includes("getElementById('gQuit')"), 'gQuit handler still present');
  assert.ok(bindGame.includes("querySelectorAll('[data-gopt]')"), 'option tap wiring still present');
});

test('Number Pop renders its options as balloons falling from the top', () => {
  const g = makeGame();
  g.setState({ id: 'number', idx: 0, score: 0, picked: null, answered: false, rounds: 6, seed: 777 });
  const html = g.html();
  const q = g.round('number', 0, 777);
  assert.ok(html.includes('balloonrow'), 'balloons live in a balloon row');
  const balloons = html.match(/class="balloon( |")/g) || [];
  assert.equal(balloons.length, 4, 'exactly 4 balloons, one per option');
  assert.ok(html.includes('🎈'), 'each balloon shows the 🎈 emoji');
  for (let i = 0; i < 4; i++) {
    assert.ok(html.includes('data-gopt="' + i + '"'), 'balloon ' + i + ' keeps the data-gopt tap wiring');
    assert.ok(html.includes('--d:' + (i * 0.12) + 's'), 'balloon ' + i + ' is staggered');
    assert.ok(html.includes('<span class="b-num">' + q.o[i] + '</span>'),
      'balloon ' + i + ' holds option ' + q.o[i]);
  }
  assert.ok(!html.includes('class="optbtn'), 'Number Pop no longer uses plain option buttons');
  // The fall + bob animation exists and was added after the Play CSS anchor.
  assert.ok(clientSrc.includes('@keyframes balloonFall'), 'balloonFall keyframes exist');
  assert.ok(clientSrc.includes('balloonBob'), 'balloonBob keyframes exist');
  assert.ok(clientSrc.indexOf('.balloonrow') > clientSrc.indexOf('.memcard.matched{'),
    'balloon CSS is appended after the .memcard.matched rule');
});

test('only one balloon holds the correct answer', () => {
  const g = makeGame();
  for (const seed of [0, 777, 4242]) {
    for (let idx = 0; idx < 6; idx++) {
      const q = g.round('number', idx, seed);
      const m = q.q.match(/^(\d+) ([×+]) (\d+) = \?$/);
      assert.ok(m, 'question parses: ' + q.q);
      const expected = m[2] === '×' ? (+m[1]) * (+m[3]) : (+m[1]) + (+m[3]);
      assert.equal(q.o[q.a], String(expected), 'the marked option is the true answer');
      assert.equal(q.o.filter(function (o) { return o === String(expected); }).length, 1,
        'the true answer appears in exactly one balloon');
      g.setState({ id: 'number', idx, score: 0, picked: null, answered: false, rounds: 6, seed });
      const html = g.html();
      const shown = [...html.matchAll(/<span class="b-num">([^<]+)<\/span>/g)].map(function (x) { return x[1]; });
      assert.deepEqual(shown, q.o, 'rendered balloons show the round options in order');
    }
  }
});

test('a correct balloon pops; a wrong pick marks the right balloon', () => {
  const g = makeGame();
  const q = g.round('number', 1, 777);
  g.setState({ id: 'number', idx: 1, score: 1, picked: q.a, answered: true, rounds: 6, seed: 777 });
  const right = g.html();
  assert.ok(right.includes('popped'), 'the picked correct balloon gets the pop class');
  assert.ok(right.includes('💥'), 'the popped balloon bursts');
  assert.ok(right.includes('class="balloon right popped"'), 'correct pick is marked right and popped');
  const wrongPick = (q.a + 1) % 4;
  g.setState({ id: 'number', idx: 1, score: 0, picked: wrongPick, answered: true, rounds: 6, seed: 777 });
  const wrong = g.html();
  assert.ok(!wrong.includes('popped'), 'a wrong pick pops nothing');
  assert.ok(wrong.includes('class="balloon wrong"'), 'the wrong pick is marked wrong');
  assert.ok(wrong.includes('class="balloon right"'), 'the true answer is still shown as right');
});

test('Speed Sort renders big 2x2 tiles, not small buttons', () => {
  const g = makeGame();
  g.setState({ id: 'sort', idx: 0, score: 0, picked: null, answered: false, rounds: 6, seed: 777 });
  const html = g.html();
  const q = g.round('sort', 0, 777);
  assert.ok(html.includes('sortgrid'), 'tiles live in a sort grid');
  const tiles = html.match(/class="sorttile/g) || [];
  assert.equal(tiles.length, 4, 'exactly 4 big tiles, one per option');
  for (let i = 0; i < 4; i++) {
    assert.ok(html.includes('data-gopt="' + i + '"'), 'tile ' + i + ' keeps the data-gopt tap wiring');
    assert.ok(html.includes('>' + q.o[i] + '</button>'), 'tile ' + i + ' shows ' + q.o[i]);
  }
  assert.ok(!html.includes('class="optbtn'), 'Speed Sort no longer uses small option buttons');
  // Big-tile presentation: 2x2 grid, emoji-sized tiles.
  const sortGridCss = clientSrc.slice(clientSrc.indexOf('.sortgrid{'));
  assert.ok(sortGridCss.startsWith('.sortgrid{display:grid;grid-template-columns:1fr 1fr;'),
    'tiles sit in a 2x2 grid');
  const tileCss = clientSrc.slice(clientSrc.indexOf('.sorttile{'));
  assert.ok(tileCss.includes('font-size:3rem'), 'tile emoji are ~3rem');
  assert.ok(tileCss.includes('min-height:118px'), 'tiles are large tap targets');
});

test('Word Garden still uses plain option buttons', () => {
  const g = makeGame();
  g.setState({ id: 'word', idx: 0, score: 0, picked: null, answered: false, rounds: 6, seed: 777 });
  const html = g.html();
  assert.ok(html.includes('class="optbtn'), 'Word Garden keeps .optbtn buttons');
  assert.ok(!html.includes('balloon') && !html.includes('sorttile'),
    'Word Garden is untouched by the balloon/tile renders');
});

// Regression snapshots: genRound is untouched by this batch, so its
// outputs must be byte-identical to the pre-change values.
const SNAPSHOTS = {
  number: {
    '0|0': { q: '3 × 2 = ?', o: ['6', '8', '7', '5'], a: 0 },
    '0|1': { q: '10 + 7 = ?', o: ['16', '17', '18', '19'], a: 1 },
    '0|2': { q: '17 × 3 = ?', o: ['52', '51', '50', '53'], a: 1 },
    '777|0': { q: '13 × 10 = ?', o: ['131', '132', '129', '130'], a: 3 },
    '777|1': { q: '12 + 7 = ?', o: ['19', '18', '20', '21'], a: 0 },
    '777|2': { q: '11 × 3 = ?', o: ['34', '35', '33', '32'], a: 2 },
    '4242|0': { q: '14 × 10 = ?', o: ['140', '139', '141', '142'], a: 0 },
    '4242|1': { q: '15 + 5 = ?', o: ['19', '20', '21', '22'], a: 1 },
    '4242|2': { q: '16 × 8 = ?', o: ['130', '129', '127', '128'], a: 3 },
  },
  sort: {
    '0|0': { q: 'Which one does NOT belong?', o: ['🍎', '🍌', '🍇', '🐶'], a: 3 },
    '0|1': { q: 'Which one does NOT belong?', o: ['🚗', '🚌', '🚲', '🍕'], a: 3 },
    '0|2': { q: 'Which one does NOT belong?', o: ['🐸', '🐢', '🦁', '🚀'], a: 3 },
    '777|0': { q: 'Which one does NOT belong?', o: ['🍔', '🖍️', '📚', '✏️'], a: 0 },
    '777|1': { q: 'Which one does NOT belong?', o: ['🌧', '🏖', '⛈', '☔'], a: 1 },
    '777|2': { q: 'Which one does NOT belong?', o: ['🐙', '🐟', '🍩', '🦀'], a: 2 },
    '4242|0': { q: 'Which one does NOT belong?', o: ['🍇', '🍌', '🍎', '🐶'], a: 3 },
    '4242|1': { q: 'Which one does NOT belong?', o: ['🚌', '🚗', '🍕', '🚲'], a: 2 },
    '4242|2': { q: 'Which one does NOT belong?', o: ['🐸', '🚀', '🦁', '🐢'], a: 1 },
  },
};

test("genRound('number') and genRound('sort') outputs are unchanged and stable", () => {
  const g = makeGame();
  for (const gameId of ['number', 'sort']) {
    for (const key of Object.keys(SNAPSHOTS[gameId])) {
      const [seed, idx] = key.split('|').map(Number);
      const snap = SNAPSHOTS[gameId][key];
      const first = g.round(gameId, idx, seed);
      assert.deepEqual(
        { q: first.q, o: first.o, a: first.a }, snap,
        gameId + ' seed ' + seed + ' round ' + idx + ': output unchanged from baseline');
      const second = g.round(gameId, idx, seed);
      assert.deepEqual(second, first, gameId + ' seed ' + seed + ' round ' + idx + ': stable across re-renders');
    }
  }
});
