// Tests for revamp batch A: Word Garden (60-question pool + garden
// strip), Number Pop (level ramp, table-neighbour distractors, escape
// countdown) and Memory Match (levels, themed decks, 3D flip, stars
// by moves).
//
// Reads the page from PAGE_PATH when set, so it can run against a
// patched temp copy before the patch lands in public/index.html:
//   PAGE_PATH=/tmp/revamp-a-index.html node --test tests/revamp-a.test.js
// Conventions follow tests/games.test.js, tests/play-nav.test.js and
// tests/game-resume.test.js: page functions are pulled out of the HTML
// source and eval'd with small stubs.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function grab(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('\n}\n', start);
  assert.ok(end > start, name + ' has a closing brace');
  return html.slice(start, end + 3);
}
function grabLine(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  return html.slice(start, html.indexOf('\n', start));
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

// Short TOPICS stub (two topics, like tests/games.test.js) — the
// word pool must still play instead of crashing on a short list.
const stubTopics = 'var TOPICS=['
  + '{quest:[{q:"Q1",o:["a","b","c","d"],a:0,c:"Word one explains!",j:""},{q:"Q2",o:["e","f","g","h"],a:1,c:"",j:""}],fresh:[{q:"Q3",o:["i","j","k","l"],a:2,c:"Fresh explains!",j:""}]},'
  + '{quest:[{q:"Q4",o:["m","n","o","p"],a:3,c:"",j:""}],fresh:[]}];\n';
const helpers = ['hashStr', 'seededShuffle', 'optsShuffled', 'shuffle']
  .map(grab).join('\n');
const genRound = eval(stubTopics + helpers + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval

// The real banks: Q + TOPICS + FRESH_BANK + the fresh assignment,
// sliced out of the page. Nothing else lives between them.
const realBanksSrc = (() => {
  const start = html.indexOf('function Q(q,o,a,c,j)');
  assert.ok(start >= 0, 'Q found');
  const assignAt = html.indexOf('TOPICS.forEach(function(t){ t.fresh=');
  assert.ok(assignAt > start, 'fresh assignment found');
  const end = html.indexOf('\n', assignAt);
  return html.slice(start, end);
})();
const realGenRound = eval(realBanksSrc + '\n' + helpers + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval

// Live handles for gameHTML/gameOptsHTML, play-nav.test.js style.
const gamesSrc = html.match(/var GAMES=\[[\s\S]*?\];/)[0];
function makeGame() {
  return eval(stubTopics + helpers + '\n'
    + gamesSrc + '\n'
    + grabLine('esc') + '\n'
    + grabLine('ic') + '\n'
    + grabLine('fmtPlaySecs') + '\n'
    + grabLine('streakChipHTML') + '\n'
    + grab('playElapsedSecs') + '\n'
    + 'var PRAISE=["Great!"]; var ENCOURAGE=["Try again!"];\n'
    + 'function pipSVG(){ return ""; }\n'
    + 'function ex(){ return {glow:"#ffb020", stars:0, playProgress:{}}; }\n'
    + 'var gState=null;\n'
    + grab('genRound') + '\n'
    + grab('gameOptsHTML') + '\n'
    + grab('gameHTML') + '\n'
    + ';({ setState:function(s){ gState=s; }, html:function(){ return gameHTML(); },'
    + ' round:function(id,idx,seed,tier){ return genRound(id,idx,seed,tier); } })'); // eslint-disable-line no-eval
}

// Live handle for startGame, game-resume.test.js style. The shuffle
// stub is the identity, so decks come back in build order.
function makeStart() {
  return eval(
    'var gState=null;\n'
    + 'var explorer={id:"e1",name:"T",stars:0,playBest:{},playDoneDay:{},playFresh:{},playProgress:{}};\n'
    + 'var DB={explorers:[explorer],activeId:"e1"};\n'
    + 'function ex(){ return DB.explorers[0]; }\n'
    + 'var GAMES=[{id:"memory",name:"Memory Match",rounds:0}];\n'
    + 'function todayKey(){ return "2026-11-07"; }\n'
    + 'function save(){}\n'
    + 'function go(){}\n'
    + 'function render(){}\n'
    + 'function shuffle(a){ return a.slice(); }\n'
    + 'var timers=[];\n'
    + 'function setTimeout(fn){ timers.push(fn); return timers.length; }\n'
    + 'function canPlay(){ return true; }\n'
    + grabLine('hashStr') + '\n'
    + fnText('function startGame(id){') + '\n'
    + ';({ start:function(id){ startGame(id); }, state:function(){ return gState; },'
    + ' explorer:function(){ return explorer; }, timers:function(){ return timers; },'
    + ' setFresh:function(seed){ explorer.playFresh={memory:{day:"2026-11-07",seed:seed}}; },'
    + ' setProgress:function(p){ explorer.playProgress.memory=p; } })'); // eslint-disable-line no-eval
}

const MEM12 = ['🐸', '🦦', '🍓', '⭐', '🚀', '🦋', '🐸', '🦦', '🍓', '⭐', '🚀', '🦋'];
const MEM8 = ['🍎', '🍎', '🍌', '🍌', '🍇', '🍇', '🍓', '🍓'];

/* ---------------- Word Garden ---------------- */

test('Word Garden draws from 60 questions — all four English topics', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    for (let idx = 0; idx < 6; idx++) seen.add(realGenRound('word', idx, seed).q);
  }
  assert.ok(seen.size > 40, 'more than 40 distinct questions across seeds (old 30-pool caps at 30), got ' + seen.size);
  assert.ok(seen.has('Kai found a tiny door behind the library shelf. He pushed it open and…'),
    'a Finish the Story (TOPICS[2]) question appears in the pool');
  // Every drawn round is a well-formed 4-option question.
  for (let seed = 1; seed <= 10; seed++) {
    for (let idx = 0; idx < 6; idx++) {
      const r = realGenRound('word', idx, seed);
      assert.equal(r.o.length, 4, '4 options: ' + r.q);
      assert.equal(new Set(r.o).size, 4, 'options distinct: ' + r.q);
      assert.ok(r.a >= 0 && r.a < 4, 'answer index in range: ' + r.q);
    }
  }
});

test('Word Garden still plays on a short TOPICS list (test stubs carry two topics)', () => {
  for (let idx = 0; idx < 6; idx++) {
    const r = genRound('word', idx, 777);
    assert.equal(r.o.length, 4, '4 options on the short stub list');
    assert.ok(r.q, 'a question is returned, not a crash');
  }
  // Deterministic across re-renders, like every other game.
  assert.deepEqual(genRound('word', 2, 777).o, genRound('word', 2, 777).o, 'options stable');
});

test('Word Garden grows a real garden: one flower per correct answer, sunshine on a streak', () => {
  const g = makeGame();
  g.setState({ id: 'word', idx: 2, score: 2, streak: 3, picked: null, answered: false, rounds: 6, seed: 777 });
  const html2 = g.html();
  assert.ok(html2.includes('class="garden"'), 'the garden strip is on the Word Garden screen');
  assert.ok(html2.includes('🌷') && html2.includes('🌻'), 'two flowers have bloomed for two right answers');
  assert.ok(!html2.includes('🌼'), 'the third flower has not bloomed yet');
  assert.equal((html2.match(/🌱/g) || []).length, 4, 'four sprouts wait for the remaining rounds');
  assert.ok(html2.includes('2 of 6 flowers blooming'), 'the garden counts its blooms');
  assert.ok(html2.includes('☀️ Sunshine streak ×3'), 'a streak of 3 brings out the sunshine');
  // No streak, no flowers yet: all sprouts, no sun.
  g.setState({ id: 'word', idx: 0, score: 0, streak: 0, picked: null, answered: false, rounds: 6, seed: 777 });
  const fresh = g.html();
  assert.equal((fresh.match(/🌱/g) || []).length, 6, 'a fresh garden is all sprouts');
  assert.ok(!fresh.includes('Sunshine streak'), 'no sunshine without a streak');
  // Other games get no garden.
  g.setState({ id: 'number', idx: 0, score: 0, streak: 0, picked: null, answered: false, rounds: 6, seed: 777 });
  assert.ok(!g.html().includes('class="garden"'), 'Number Pop has no garden strip');
});

test('Word Garden feedback still shows the question explanation', () => {
  const g = makeGame();
  // Seed 0 returns pool[0] unshuffled: Q1, whose explanation is set.
  g.setState({ id: 'word', idx: 0, score: 1, streak: 1, picked: 0, answered: true, rounds: 6, seed: 0 });
  const html2 = g.html();
  assert.ok(html2.includes('Q1'), 'the stub question is on screen');
  assert.ok(html2.includes('💡 Word one explains!'), 'the explanation shows in the feedback');
});

/* ---------------- Number Pop: difficulty ramp ---------------- */

test('Number Pop ramps by round and level tier', () => {
  const check = (tier, bandIdx, loA, hiA, loB, hiB) => {
    for (const seed of [1, 2, 3, 42, 777, 12345, 999999]) {
      for (const idx of bandIdx) {
        const r = genRound('number', idx, seed, tier);
        const m = r.q.match(/^(\d+) × (\d+) = \?$/);
        assert.ok(m, tier + ' round ' + idx + ' is a times question: ' + r.q);
        const a = +m[1], b = +m[2];
        assert.ok(a >= loA && a <= hiA, tier + ' round ' + idx + ': first factor ' + a + ' in ' + loA + '..' + hiA);
        assert.ok(b >= loB && b <= hiB, tier + ' round ' + idx + ': second factor ' + b + ' in ' + loB + '..' + hiB);
        assert.equal(r.o[r.a], String(a * b), 'the marked option is the true product');
        assert.equal(new Set(r.o).size, 4, 'options distinct: ' + r.q);
      }
    }
  };
  // mid (P3–P4): tables 2–5, then 6–9, then 2-digit × 1-digit.
  check('mid', [0, 1], 2, 5, 2, 9);
  check('mid', [2, 3], 6, 9, 2, 9);
  check('mid', [4, 5], 12, 59, 2, 9);
  // low (P1–P2): small tables throughout, never 2-digit.
  check('low', [0, 1], 2, 3, 2, 5);
  check('low', [2, 3], 4, 5, 2, 9);
  check('low', [4, 5], 2, 5, 2, 9);
  // high (P5–P6): starts at 6–9, reaches 2-digit sooner and higher.
  check('high', [0, 1], 6, 9, 2, 9);
  check('high', [2, 3], 12, 59, 2, 9);
  check('high', [4, 5], 12, 99, 3, 9);
  // No tier argument keeps the old mid behaviour.
  for (const idx of [0, 2, 4]) {
    const r = genRound('number', idx, 777);
    const a = +r.q.match(/^(\d+) ×/)[1];
    assert.ok(idx < 2 ? (a >= 2 && a <= 5) : idx < 4 ? (a >= 6 && a <= 9) : (a >= 12 && a <= 59),
      'default tier is mid for round ' + idx);
  }
  // The seed-0 path works for every tier.
  for (const tier of ['low', 'mid', 'high']) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('number', idx, 0, tier);
      assert.ok(/^(\d+) × (\d+) = \?$/.test(r.q), tier + ' seed 0 round ' + idx + ' parses');
    }
  }
});

test('Number Pop distractors are table neighbours, not ans±1/±2', () => {
  for (const seed of [1, 42, 777, 12345, 987654321]) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('number', idx, seed, 'mid');
      const m = r.q.match(/^(\d+) × (\d+) = \?$/);
      const a = +m[1], b = +m[2], ans = a * b;
      const neighbours = new Set([(a - 1) * b, (a + 1) * b, a * (b - 1), a * (b + 1), (a - 1) * (b - 1), (a + 1) * (b + 1)]);
      const fallbacks = new Set([ans + 1, ans - 1, ans + 2, ans - 2]);
      r.o.forEach((o, i) => {
        if (i === r.a) return;
        const d = +o;
        assert.ok(neighbours.has(d) || fallbacks.has(d),
          'distractor ' + d + ' for ' + a + '×' + b + '=' + ans + ' is a table neighbour (or a fallback)');
      });
      // At least two of the three distractors are genuine neighbours.
      const neighbourCount = r.o.filter((o, i) => i !== r.a && neighbours.has(+o)).length;
      assert.ok(neighbourCount >= 2, 'at least 2 table-neighbour distractors for ' + r.q + ', got ' + neighbourCount);
      // Deterministic across re-renders.
      assert.deepEqual(genRound('number', idx, seed, 'mid').o, r.o, 'options stable on re-render');
    }
  }
  // The worked example from the audit: 7×8=56 → 48, 63, 49 are all neighbours.
  const neighbours56 = new Set([48, 63, 49, 64, 54, 72]);
  assert.ok([48, 63, 54].every((d) => neighbours56.has(d)), 'audit example distractors are table neighbours');
});

/* ---------------- Number Pop: escape countdown ---------------- */

test('Number Pop balloons rise over the escape window, with a countdown bar', () => {
  const g = makeGame();
  const cases = [
    { tier: undefined, idx: 0, rise: '10s' },
    { tier: undefined, idx: 5, rise: '5s' },
    { tier: 'low', idx: 0, rise: '12s' },
    { tier: 'low', idx: 5, rise: '7s' },
    { tier: 'high', idx: 0, rise: '8s' },
    { tier: 'high', idx: 5, rise: '4s' },
  ];
  for (const c of cases) {
    g.setState({ id: 'number', idx: c.idx, score: 0, streak: 0, picked: null, answered: false, rounds: 6, seed: 777, tier: c.tier });
    const h = g.html();
    assert.ok(h.includes('--rise:' + c.rise), 'tier ' + (c.tier || 'mid') + ' round ' + (c.idx + 1) + ' rises over ' + c.rise);
    assert.ok(h.includes('escapebar'), 'countdown bar present for round ' + (c.idx + 1));
    assert.ok(h.includes('⏳ Pop the right balloon before they float away'), 'countdown explained');
    assert.ok(!h.includes('balloonwrap done'), 'an unanswered round is still rising');
  }
  // Answered: the rise stops so the answer stays visible.
  const q = g.round('number', 1, 777);
  g.setState({ id: 'number', idx: 1, score: 1, streak: 1, picked: q.a, answered: true, rounds: 6, seed: 777 });
  const done = g.html();
  assert.ok(done.includes('balloonwrap done'), 'an answered round stops the rise');
  assert.ok(done.includes('🎈 The balloons stopped'), 'the stopped label replaces the countdown');
});

test('Number Pop combo callout appears on a streak of 2+ correct pops', () => {
  const g = makeGame();
  const q = g.round('number', 1, 777);
  g.setState({ id: 'number', idx: 1, score: 2, streak: 2, picked: q.a, answered: true, rounds: 6, seed: 777 });
  assert.ok(g.html().includes('🎈 Pop combo ×2!'), 'two in a row is a combo');
  g.setState({ id: 'number', idx: 1, score: 1, streak: 1, picked: q.a, answered: true, rounds: 6, seed: 777 });
  assert.ok(!g.html().includes('Pop combo'), 'a single correct pop is no combo yet');
  const wrongPick = (q.a + 1) % 4;
  g.setState({ id: 'number', idx: 1, score: 0, streak: 0, picked: wrongPick, answered: true, rounds: 6, seed: 777 });
  assert.ok(!g.html().includes('Pop combo'), 'a wrong pick is no combo');
});

/* ---------------- Memory Match: levels, decks, flip, stars ---------------- */

test('Memory Match deals 4, 6 or 8 pairs from the run seed, with 4 themed decks', () => {
  const THEMES = [
    ['🐸', '🦦', '🍓', '⭐', '🚀', '🦋', '🐢', '🦁'],
    ['🍎', '🍌', '🍇', '🍓', '🥝', '🍊', '🍉', '🍍'],
    ['🐟', '🐙', '🦀', '🐢', '🐬', '🦈', '🐳', '🦭'],
    ['🚀', '⭐', '🌙', '🪐', '☀️', '🌟', '🛸', '👽'],
  ];
  const cases = [
    { seed: 0, pairs: 4, theme: 0 },
    { seed: 1, pairs: 6, theme: 0 },
    { seed: 2, pairs: 8, theme: 0 },
    { seed: 3, pairs: 4, theme: 1 },
    { seed: 7, pairs: 6, theme: 2 },
    { seed: 11, pairs: 8, theme: 3 },
  ];
  for (const c of cases) {
    const s = makeStart();
    s.setFresh(c.seed);
    s.start('memory');
    const deck = s.state().deck;
    assert.equal(deck.length, c.pairs * 2, 'seed ' + c.seed + ' deals ' + c.pairs + ' pairs');
    const unique = [...new Set(deck)];
    assert.deepEqual(unique, THEMES[c.theme].slice(0, c.pairs), 'seed ' + c.seed + ' uses theme ' + c.theme);
    unique.forEach((em) => {
      assert.equal(deck.filter((x) => x === em).length, 2, 'every face appears exactly twice: ' + em);
    });
    assert.equal(s.state().tier, 'mid', 'the harness default tier is mid (levelTier is typeof-guarded)');
  }
});

test('Memory Match resume restores an 8-card board (not just 12)', () => {
  const s = makeStart();
  s.setProgress({ matched: [], moves: 1, won: false, seed: 999, deck: MEM8.slice(), open: [0, 5], elapsed: 33 });
  s.start('memory');
  assert.deepEqual(s.state().deck, MEM8, 'the 8-card deck survives resume instead of being rebuilt');
  assert.deepEqual(s.state().open, [0, 5], 'the face-up cards come back');
  assert.equal(s.state().moves, 1, 'move count kept');
});

test('Memory Match cards really flip in 3D and show a pairs progress bar', () => {
  const g = makeGame();
  g.setState({ id: 'memory', deck: MEM12, open: [0], matched: [2, 3], lock: false, moves: 3, won: false, seed: 0 });
  const h = g.html();
  assert.ok(h.includes('meminner'), 'each card has the flip inner wrapper');
  assert.ok(h.includes('memface memfront'), 'each card has a face-down face');
  assert.ok(h.includes('memface memback'), 'each card has a face-up face');
  assert.ok(h.includes('❓'), 'the face-down face shows the question mark');
  assert.ok(h.includes('class="memcard matched"'), 'a matched pair stays face-up');
  assert.ok(h.includes('Pairs found: 1 of 6'), 'the pairs progress counts found pairs');
  assert.ok(h.includes('progressbar'), 'the pairs progress has a bar');
  assert.ok(h.includes('width:17%'), '2 of 12 cards is 17% on the bar');
  // The CSS drives the flip.
  assert.ok(html.includes('.memcard.open .meminner,.memcard.matched .meminner{transform:rotateY(180deg)}'),
    'open/matched cards rotate the inner wrapper');
  assert.ok(html.includes('backface-visibility:hidden'), 'faces hide their backs');
  assert.ok(html.includes('@keyframes flowerPop') || html.includes('transition:transform .45s ease'),
    'the flip animates');
});

test('Memory Match stars by moves: par is about the deck size', () => {
  const g = makeGame();
  const win = (deck, moves) => {
    g.setState({ id: 'memory', deck, open: [], matched: deck.map((_, i) => i), lock: false, moves, won: true, seed: 0 });
    return g.html();
  };
  // 6 pairs, par 12: 9 moves is 3 stars, 13 is 2, 20 is 1.
  assert.ok(win(MEM12, 9).includes('⭐⭐⭐'), '9 moves on 6 pairs is 3 stars');
  assert.ok(win(MEM12, 9).includes('par is about 12 moves'), 'par is shown');
  assert.ok(win(MEM12, 13).includes('⭐⭐') && !win(MEM12, 13).includes('⭐⭐⭐'), '13 moves is 2 stars');
  assert.ok(win(MEM12, 20).includes('⭐') && !win(MEM12, 20).includes('⭐⭐'), '20 moves is 1 star');
  assert.ok(win(MEM12, 9).includes('You found all 6 pairs in 9 moves'), 'the win line counts the pairs');
  // 4 pairs, par 8: 5 moves is 3 stars.
  assert.ok(win(MEM8, 5).includes('⭐⭐⭐'), '5 moves on 4 pairs is 3 stars');
  assert.ok(win(MEM8, 5).includes('You found all 4 pairs in 5 moves'), 'the win line adapts to 4 pairs');
});

/* ---------------- Wiring: no new persisted fields, escape timer, sounds ---------------- */

test('no new persisted fields: the memory save shape and merge are untouched', () => {
  const saveSrc = html.slice(html.indexOf('function saveGameProgress(){'), html.indexOf('/* ============================================================ ASK PIP'));
  assert.ok(saveSrc.includes('e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, combo:gState.memCombo||null, open:gState.open.slice(), elapsed:elapsed}'),
    'the memory save carries the picked combo (so a resume rebuilds the exact board) — still no pairs/level field');
  const mergeSrc = html.slice(html.indexOf('function mergeExplorer'), html.indexOf('function mergeFamilyDB'));
  assert.ok(mergeSrc.includes('matched:unionArr(x.matched,y.matched)'), 'the merge still unions matched pairs');
  assert.ok(mergeSrc.includes('deck:x.deck||y.deck'), 'the merge still carries the deck');
  assert.ok(mergeSrc.includes('combo:'), 'the merge still carries the memory combo');
  assert.ok(mergeSrc.includes('open:'), 'the merge still carries face-up cards');
  const startSrc = fnText('function startGame(id){');
  assert.ok(startSrc.includes('MEMDECKS'), 'levels and decks are derived in startGame, not stored');
  assert.ok(startSrc.includes("gState.tier=(typeof levelTier==='function'?levelTier(e):'mid')"),
    'the tier is stamped session-only with a harness-safe guard');
});

test('Number Pop escape wiring: timeout marks a miss, timer is cleared everywhere', () => {
  const bindSrc = fnText('function bindGame(){');
  assert.ok(bindSrc.includes('gState.escapeTimer'), 'bindGame tracks the escape timer');
  assert.ok(bindSrc.includes("if(gState.id==='number'&&!gState.answered)"), 'the timer arms only on an unanswered Number Pop round');
  assert.ok(bindSrc.includes("armNumberEscape("), 'bindGame arms the escape through armNumberEscape');
  const armSrc = fnText('function armNumberEscape(');
  assert.ok(armSrc.includes('gState.escapeTimer!==escId'), 'a stale timer can never mark the wrong round');
  assert.ok(armSrc.includes('gState.picked=null; gState.answered=true; gState.streak=0; sndWrong();'),
    'an escaped round counts as a miss with no pick, streak reset, answer revealed');
  const clears = (bindSrc.match(/clearTimeout\(gState\.escapeTimer\)/g) || []).length;
  assert.ok(clears >= 4, 'the timer is cleared on tap, Next, re-render and leaving (got ' + clears + ')');
  assert.ok(bindSrc.includes("slide(300,1500,0.15,'sine',0.15)"), 'a correct pop plays a rising pop sound');
  assert.ok(bindSrc.includes("slide(320,180,0.18,'sine',0.07)"), 'a Memory mismatch plays a soft falling sound');
  assert.ok(bindSrc.includes('sndTick(gState.open.length+1)'), 'card flips tick higher per card');
  assert.ok(bindSrc.includes('earnStars(live,memStars)'), 'Memory awards stars by moves');
  assert.ok(bindSrc.includes('memStars=gState.moves<=(gState.deck.length-2)?3:(gState.moves<=(gState.deck.length+2)?2:1)'),
    'the stars-by-moves formula is the par rule');
});

test('the new CSS and markup are in the page, the old fall is gone', () => {
  assert.ok(html.includes('@keyframes balloonRise'), 'balloonRise keyframes exist');
  assert.ok(html.includes('balloonRise var(--rise,10s) linear both'), 'the rise runs once over the escape window');
  assert.ok(!html.includes('balloonFall'), 'the old falling loop is gone');
  assert.ok(html.includes('.escapebar'), 'the countdown bar CSS exists');
  assert.ok(html.includes('@keyframes escapeShrink'), 'the bar shrinks over the window');
  assert.ok(html.includes('.garden{'), 'the garden strip CSS exists');
  assert.ok(html.includes('@keyframes flowerPop'), 'flowers pop in when they bloom');
  assert.ok(html.includes('gardenrow'), 'gameHTML renders the garden row');
  assert.ok(html.includes('Your garden grows with every right answer'), 'gameHTML renders the garden line');
  assert.ok(html.includes('balloonwrap'), 'gameOptsHTML renders the balloon wrapper');
  assert.ok(html.includes('Pop combo'), 'the combo callout exists in the feedback');
});
