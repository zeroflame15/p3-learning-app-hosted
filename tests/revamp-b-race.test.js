// Revamp batch B — Maths Race: a real race (rival on a track, 10s
// countdown per question), difficulty ramp by round and level tier,
// missing numbers, varied distractors, engine-rev/tick sounds.
// Reads the page from PAGE_PATH when set, so it can run against a
// patched temp copy before the patch lands in public/index.html.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const clientSrc = fs.readFileSync(pagePath, 'utf8');

function grab(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = clientSrc.indexOf('\n}\n', start);
  return clientSrc.slice(start, end + 3);
}
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
const revampBlock = clientSrc.slice(clientSrc.indexOf('var SORT_SETS='), clientSrc.indexOf('function genRound'));
const genRound = eval(stubTopics + helpers + '\n' + revampBlock + '\n' + grab('genRound') + '\n;genRound'); // eslint-disable-line no-eval
// The race countdown/rival helpers live beside tickGameTime, not in
// the block before genRound, so they are grabbed on their own.
const raceHelpers = ['raceSecsLeft', 'raceRivalPos', 'raceChildPos'].map(grab).join('\n');
const race = eval(helpers + '\n' + revampBlock + '\n' + raceHelpers + '\n;({distractors:raceDistractors,swap:raceSwapDigits,max:raceMaxFor,secsLeft:raceSecsLeft,rival:raceRivalPos,child:raceChildPos})'); // eslint-disable-line no-eval

// Solve a race question: returns the true answer, or null if the
// question does not parse.
function solve(q) {
  let m = q.match(/^(\d+) ([×+\-]) (\d+) = \?$/);
  if (m) {
    const a = +m[1], b = +m[3];
    return m[2] === '×' ? a * b : m[2] === '+' ? a + b : a - b;
  }
  m = q.match(/^(\d+) ([+×]) \? = (\d+)$/);
  if (m) {
    const a = +m[1], c = +m[3];
    return m[2] === '+' ? c - a : c / a;
  }
  return null;
}

test('every race question has a true marked answer, 4 distinct options, no negatives', () => {
  for (const tier of ['low', 'mid', 'high']) {
    for (let seed = 0; seed < 20; seed++) {
      for (let idx = 0; idx < 6; idx++) {
        const r = genRound('race', idx, seed, tier);
        const ans = solve(r.q);
        assert.ok(ans !== null && Number.isInteger(ans), 'question parses: ' + r.q);
        assert.ok(ans >= 0, 'no negative answers: ' + r.q);
        assert.equal(r.o[r.a], String(ans), 'marked option is the true answer: ' + r.q);
        assert.equal(r.o.length, 4, 'exactly 4 options: ' + r.q);
        assert.equal(new Set(r.o).size, 4, 'options distinct: ' + r.q);
        for (const o of r.o) assert.ok(+o >= 0, 'no negative options: ' + r.q);
      }
    }
  }
});

test('the ramp: gentle first, stretchy middle, 2-digit and missing numbers last', () => {
  // Mid tier, rounds 1-2: add/sub to 20, tables 2-6.
  for (let seed = 0; seed < 40; seed++) {
    for (let idx = 0; idx < 2; idx++) {
      const r = genRound('race', idx, seed, 'mid');
      const m = r.q.match(/^(\d+) ([×+\-]) (\d+) = \?$/);
      assert.ok(m, 'rounds 1-2 are plain sums, never missing numbers: ' + r.q);
      if (m[2] === '×') assert.ok(+m[1] <= 6 && +m[3] <= 6, 'rounds 1-2: tables 2-6: ' + r.q);
      else assert.ok(+m[1] <= 20 && solve(r.q) <= 20, 'rounds 1-2: sums to 20: ' + r.q);
    }
  }
  // Mid tier, rounds 3-4: add/sub to 30, tables 2-9.
  for (let seed = 0; seed < 40; seed++) {
    for (let idx = 2; idx < 4; idx++) {
      const r = genRound('race', idx, seed, 'mid');
      const m = r.q.match(/^(\d+) ([×+\-]) (\d+) = \?$/);
      assert.ok(m, 'rounds 3-4 are plain sums: ' + r.q);
      if (m[2] === '×') assert.ok(+m[1] <= 9 && +m[3] <= 9, 'rounds 3-4: tables 2-9: ' + r.q);
      else assert.ok(+m[1] <= 30 && solve(r.q) <= 30, 'rounds 3-4: sums to 30: ' + r.q);
    }
  }
  // Mid tier, rounds 5-6: 2-digit × 1-digit and missing numbers appear.
  let twoDigit = 0, missing = 0;
  for (let seed = 0; seed < 200; seed++) {
    for (let idx = 4; idx < 6; idx++) {
      const r = genRound('race', idx, seed, 'mid');
      if (/ \? = /.test(r.q)) missing++;
      const m = r.q.match(/^(\d+) × (\d+) = \?$/);
      if (m && +m[1] >= 11) twoDigit++;
    }
  }
  assert.ok(twoDigit > 0, 'rounds 5-6 include 2-digit × 1-digit sums');
  assert.ok(missing > 0, 'rounds 5-6 include missing-number questions');
  // Low tier never gets missing numbers or 2-digit multiplication.
  for (let seed = 0; seed < 40; seed++) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('race', idx, seed, 'low');
      assert.ok(!/ \? = /.test(r.q), 'low tier never sees a missing number: ' + r.q);
      const m = r.q.match(/^(\d+) × (\d+) = \?$/);
      if (m) assert.ok(+m[1] <= 6 && +m[2] <= 6, 'low tier tables stay small: ' + r.q);
    }
  }
  // High tier stretches further: sums to 50 do appear.
  let big = 0;
  for (let seed = 0; seed < 100; seed++) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('race', idx, seed, 'high');
      const m = r.q.match(/^(\d+) \+ (\d+) = \?$/);
      if (m && solve(r.q) > 30) big++;
    }
  }
  assert.ok(big > 0, 'high tier includes sums above 30');
});

test('distractors are varied, not always ans±1/±2', () => {
  // The helper: 3 distinct positive distractors, never the answer.
  for (const [ans, a, b, op] of [[56, 7, 8, 'mul'], [42, 6, 7, 'mul'], [15, 8, 7, 'add'], [9, 14, 5, 'sub'], [100, 10, 10, 'mul']]) {
    for (let seed = 0; seed < 10; seed++) {
      const d = race.distractors(ans, a, b, op, seed);
      assert.equal(d.length, 3, '3 distractors for ' + ans);
      assert.equal(new Set(d).size, 3, 'distractors distinct for ' + ans);
      for (const x of d) assert.ok(x > 0 && x !== ans, 'distractor is positive and not the answer: ' + x + ' vs ' + ans);
    }
  }
  // Table neighbours show up for multiplication (7×8=56 → 48 or 63).
  let neighbour = 0;
  for (let seed = 0; seed < 50; seed++) {
    const d = race.distractors(56, 7, 8, 'mul', seed);
    if (d.includes(48) || d.includes(63) || d.includes(49) || d.includes(64)) neighbour++;
  }
  assert.ok(neighbour > 0, 'multiplication distractors include table neighbours sometimes');
  // Digit swaps show up for two-digit answers (56 → 65).
  assert.equal(race.swap(56), 65, '56 swaps to 65');
  assert.equal(race.swap(7), -1, 'single digits have no swap');
  assert.equal(race.swap(55), -1, 'a swap that changes nothing is not a distractor');
  // Across real rounds, many distractors are NOT in the old ±1/±2 set.
  let varied = 0, total = 0;
  for (let seed = 0; seed < 50; seed++) {
    for (let idx = 0; idx < 6; idx++) {
      const r = genRound('race', idx, seed, 'mid');
      const ans = solve(r.q);
      for (const o of r.o) {
        if (+o === ans) continue;
        total++;
        if (![ans + 1, ans - 1, ans + 2, ans - 2].includes(+o)) varied++;
      }
    }
  }
  assert.ok(varied > total * 0.25, 'over a quarter of distractors are beyond ±1/±2 (' + varied + '/' + total + ')');
});

test('countdown and rival positions are pure and capped', () => {
  const realNow = Date.now;
  try {
    let now = 1000000000000;
    Date.now = function () { return now; };
    assert.equal(race.secsLeft(now + 10000), 10, 'a fresh question has 10s');
    assert.equal(race.secsLeft(now + 1500), 2, '1.5s left rounds up to 2s');
    assert.equal(race.secsLeft(now - 5000), 0, 'an expired deadline is 0, never negative');
  } finally { Date.now = realNow; }
  assert.equal(race.rival(0), 0, 'Turbo starts at 0');
  assert.equal(race.rival(4), 1, 'Turbo moves one cell every 4s');
  assert.equal(race.rival(39), 9, 'Turbo near the end at 39s');
  assert.equal(race.rival(40), 10, 'Turbo caps at the finish');
  assert.equal(race.rival(400), 10, 'Turbo never passes the finish');
  assert.equal(race.child(0), 0, 'no correct answers, no progress');
  assert.equal(race.child(3), 5, '3 of 6 correct is halfway');
  assert.equal(race.child(6), 10, '6 of 6 correct reaches the finish');
});

test('the race screen shows the countdown bar, the track and Turbo', () => {
  const gamesSrc = clientSrc.match(/var GAMES=\[[\s\S]*?\];/)[0];
  const g = eval(stubTopics + helpers + '\n' + revampBlock + '\n'
    + gamesSrc + '\n'
    + grabLine('esc') + '\n' + grabLine('ic') + '\n' + grabLine('fmtPlaySecs') + '\n' + grabLine('streakChipHTML') + '\n'
    + grab('playElapsedSecs') + '\n' + raceHelpers + '\n' + grab('raceTrackHTML') + '\n'
    + 'var PRAISE=["Great!"]; var ENCOURAGE=["Try again!"];\n'
    + 'function pipSVG(){ return ""; }\n'
    + 'function ex(){ return {glow:"#ffb020", stars:0, playProgress:{}, face:"🦦"}; }\n'
    + 'var gState=null;\n'
    + grab('genRound') + '\n' + grab('gameOptsHTML') + '\n' + grab('gameHTML') + '\n'
    + ';({ setState:function(s){ gState=s; }, html:function(){ return gameHTML(); } })'); // eslint-disable-line no-eval
  g.setState({ id: 'race', idx: 0, score: 0, picked: null, answered: false, rounds: 6, seed: 777, tier: 'mid', raceDeadline: Date.now() + 9000, answerSecs: 0, startedAt: Date.now() });
  const html = g.html();
  assert.ok(html.includes('id="raceBarFill"'), 'countdown bar renders');
  assert.ok(html.includes('id="raceSecs"'), 'countdown seconds render');
  assert.ok(html.includes('id="raceRival"'), 'the rival renders on the track');
  assert.ok(html.includes('Turbo'), 'the rival has a name');
  assert.ok(html.includes('beat Turbo'), 'the race has a goal');
  assert.ok(html.includes('class="optbtn'), 'race answers are still tap-to-answer buttons');
});

test('raceTick: the countdown drains, ticks at 3s, and times out the round at 0', () => {
  const fns = eval(grab('playElapsedSecs') + '\n' + grab('raceSecsLeft') + '\n' + grab('raceRivalPos') + '\n' + grab('raceTick') + '\n'
    + 'var gState=null, route="game";\n'
    + 'var bar={style:{width:""}};\n'
    + 'var secs={textContent:""};\n'
    + 'var rival={style:{left:""}};\n'
    + 'var document={getElementById:function(id){ if(id==="raceBarFill")return bar; if(id==="raceSecs")return secs; if(id==="raceRival")return rival; return null; }};\n'
    + 'var ticked=[];\n'
    + 'function sndTick(n){ ticked.push(n); }\n'
    + 'var wronged=0;\n'
    + 'function sndWrong(){ wronged++; }\n'
    + 'var paused=0;\n'
    + 'function pausePlayTimer(){ paused++; }\n'
    + 'var saved=0;\n'
    + 'function saveGameProgress(){ saved++; }\n'
    + 'var rendered=0;\n'
    + 'function render(){ rendered++; }\n'
    + ';({setState:function(s){ gState=s; },getState:function(){ return gState; },tick:function(){ raceTick(); },bar:function(){ return bar; },secs:function(){ return secs; },rival:function(){ return rival; },ticked:function(){ return ticked; },wronged:function(){ return wronged; },paused:function(){ return paused; },saved:function(){ return saved; },rendered:function(){ return rendered; }})'); // eslint-disable-line no-eval
  const realNow = Date.now;
  try {
    let now = 1000000000000;
    Date.now = function () { return now; };
    // 10s left: bar full, no tick, no timeout.
    fns.setState({ id: 'race', idx: 0, score: 0, answered: false, raceDeadline: now + 10000, answerSecs: 0, startedAt: now });
    fns.tick();
    assert.equal(fns.bar().style.width, '100%', 'bar starts full');
    assert.equal(fns.secs().textContent, '10s', '10s shown');
    assert.equal(fns.wronged(), 0, 'no timeout yet');
    // 3s left: bar at 30%, a warning tick sounds.
    now += 7000;
    fns.tick();
    assert.equal(fns.bar().style.width, '30%', 'bar drains with the countdown');
    assert.equal(fns.secs().textContent, '3s', '3s shown');
    assert.ok(fns.ticked().length >= 1, 'a warning tick sounds at 3s');
    // 0s: the round times out — wrong answer, clock paused, saved.
    now += 3000;
    fns.tick();
    const st = fns.getState();
    assert.equal(st.answered, true, 'timeout answers the round');
    assert.equal(st.timedOut, true, 'timeout is flagged for the feedback line');
    assert.equal(st.picked, -1, 'timeout is not the correct answer');
    assert.equal(st.streak, 0, 'timeout breaks the streak');
    assert.equal(st.raceDeadline, null, 'countdown stops after a timeout');
    assert.equal(fns.wronged(), 1, 'the wrong sound plays');
    assert.equal(fns.paused(), 1, 'the answer-only clock pauses');
    assert.equal(fns.saved(), 1, 'progress saves');
    assert.equal(fns.rendered(), 1, 'the feedback screen renders');
  } finally { Date.now = realNow; }
});

test('startGame gives a race a 10s deadline and an engine rev; tickGameTime drives raceTick', () => {
  const startSrc = grab('startGame');
  assert.ok(startSrc.includes("if(id==='race')gState.raceDeadline=(p&&!doneP&&gState.answered)?null:Date.now()+10000;"),
    'each race question gets a fresh 10s countdown');
  assert.ok(startSrc.includes("if(id==='race'&&typeof slide==='function')slide(90,420,0.7,'sawtooth',0.07);"),
    'a race starts with an engine rev');
  const tickSrc = grab('tickGameTime');
  assert.ok(tickSrc.includes("if(gState.id==='race'&&typeof raceTick==='function')raceTick();"),
    'the 1s tick drives the race countdown and rival');
  const bindSrc = grab('bindGame');
  assert.ok(bindSrc.includes("if(gState.id==='race')gState.raceDeadline=null;"),
    'tapping an answer stops the countdown for that question');
  assert.ok(bindSrc.includes("if(gState.id==='race'){ gState.timedOut=false; if(gState.idx<gState.rounds)gState.raceDeadline=Date.now()+10000; }"),
    'Next starts a fresh countdown for the next question');
  const htmlSrc = grab('gameHTML');
  assert.ok(htmlSrc.includes("(gState.timedOut?'⏰ Time’s up! ':'')"),
    'a timed-out round says so in the feedback');
});
