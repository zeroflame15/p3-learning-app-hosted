// Daily game refresh + Ask Pip from a question (2026-11-08):
// every game pulls a fresh set each day with no repeats inside the
// day, and any question can be asked to Pip in its own thread.
// The sidebar is independently scrollable (same build).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

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
/* One-line functions: grab stops at the function's own closing
   brace (column 0); a one-liner's brace is mid-line, so take the
   whole line instead. */
function grab(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('\n}\n', start);
  return html.slice(start, end + 3);
}
function fnLine(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' found');
  return html.slice(start, html.indexOf('\n', start));
}
function sliceTopVar(name, nextMarker) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, 'var ' + name + ' not found');
  const end = html.indexOf(nextMarker, start);
  assert.ok(end > start, nextMarker + ' not found after var ' + name);
  let chunk = html.slice(start, end).trim();
  const ci = chunk.indexOf('/*');
  if (ci >= 0) chunk = chunk.slice(0, ci).trim();
  return chunk;
}

function engine() {
  const Q = 'function Q(q,o,a,c,j){return{q:q,o:o,a:a,c:c,j:j};}\n';
  const topicsChunk = sliceTopVar('TOPICS', 'var FRESH_BANK={');
  const revampBlock = html.slice(html.indexOf('var SORT_SETS='), html.indexOf('function genRound'));
  const numRanges = (html.match(/var NUM_RANGES=\{[^;]+\};/) || [])[0];
  assert.ok(numRanges, 'NUM_RANGES not found in page');
  const multi = ['optsShuffled', 'scrBandFor', 'raceMaxFor', 'raceDistractors', 'genRound',
    'gamePoolFor', 'pickGameKeys', 'gameRunKeys', 'pickRaceSeed', 'playSeenToday', 'recordPlaySeen',
    'askThreadTitle', 'askKidText', 'newAskQuestionThread', 'pipExplainFallback'].map(grab).join('\n');
  const oneLiners = ['hashStr', 'seededShuffle', 'sortTierMax', 'sentPool', 'sentKey', 'sentFor', 'sentBank', 'shuffle',
    'memoryComboFor', 'memComboFromKey', 'bankSecsLeft'].map(fnLine).join('\n');
  const stubs = 'var GAMES=[{id:"word",name:"Word Garden"},{id:"number",name:"Number Pop"},{id:"memory",name:"Memory Match"},{id:"sort",name:"Speed Sort"},{id:"scramble",name:"Word Scramble"},{id:"race",name:"Maths Race"},{id:"sentence",name:"Sentence Builder"},{id:"crossword",name:"Crossword Quest"},{id:"parking",name:"Exit Parking"}];\n'
    + 'var gState={keys:["k0","k1","k2","k3","k4","k5"]};\n'
    + 'function skillForQuestionClient(q){ return {id:"test-skill", name:"Test Method", method:"Try the first step."}; }\n';
  const code = Q + topicsChunk + '\n' + revampBlock + '\n' + numRanges + '\n' + multi + '\n' + oneLiners + '\n' + stubs;
  return eval(code + '\n;({gamePoolFor, pickGameKeys, gameRunKeys, pickRaceSeed, playSeenToday, recordPlaySeen, memoryComboFor, memComboFromKey, bankSecsLeft, askThreadTitle, askKidText, newAskQuestionThread, pipExplainFallback, genRound, hashStr, TOPICS, SORT_SETS, SCR_WORDS, SENTENCES})');
}

/* ---------------- Feature 1: daily refresh ---------------- */

test('gamePoolFor: real banks are the sizes the design says', () => {
  const e = engine();
  const word = e.gamePoolFor('word', 0, 'mid');
  assert.equal(word.length, 70, 'Word Garden: 70 questions (TOPICS[0..3] quest+fresh)');
  assert.equal(new Set(word).size, 70, 'Word Garden pool has no duplicate question text');
  assert.equal(e.gamePoolFor('sort', 0, 'low').length, 12, 'Speed Sort low: 12 sets');
  assert.equal(e.gamePoolFor('sort', 0, 'mid').length, 18, 'Speed Sort mid: 18 sets');
  assert.equal(e.gamePoolFor('sort', 0, 'high').length, 24, 'Speed Sort high: 24 sets');
  assert.equal(e.gamePoolFor('scramble', 0, 'mid').length, 16, 'Scramble band 0: 16 words');
  assert.equal(e.gamePoolFor('scramble', 4, 'mid').length, 16, 'Scramble band 1: 16 words');
  assert.equal(e.gamePoolFor('scramble', 5, 'high').length, 16, 'Scramble band 2: 16 words');
  assert.equal(e.gamePoolFor('sentence', 0, 'mid').length, 15, 'Sentence Builder mid: 15 sentences');
  assert.equal(e.gamePoolFor('number', 0, 'mid').length, 32, 'Number Pop mid rounds 1-2: 4x8 rectangle');
  assert.equal(e.gamePoolFor('number', 2, 'mid').length, 32, 'Number Pop mid rounds 3-4: 4x8 rectangle');
  assert.equal(e.gamePoolFor('number', 4, 'mid').length, 384, 'Number Pop mid rounds 5-6: 48x8 rectangle');
  e.gamePoolFor('number', 0, 'mid').forEach((k) => assert.match(k, /^\d+ × \d+ = \?$/, 'number pick is a question string: ' + k));
  assert.equal(e.gamePoolFor('memory', 0, 'mid').length, 12, 'Memory Match: 12 combos');
  assert.equal(new Set(e.gamePoolFor('memory', 0, 'mid')).size, 12, 'Memory combos are distinct');
  assert.equal(e.gamePoolFor('race', 0, 'mid'), null, 'Maths Race has no pickable pool (seed-searched)');
  assert.equal(e.gamePoolFor('crossword', 0, 'mid'), null, 'Crossword has no pickable pool (grid rotates by day)');
  assert.equal(e.gamePoolFor('parking', 0, 'mid'), null, 'Exit Parking has no pickable pool (fixed levels)');
});

test('pickGameKeys: a game\'s set changes across days', () => {
  const e = engine();
  const d1 = e.pickGameKeys('word', 'mid', 6, [], 'play|word|2026-11-08|e1');
  const d2 = e.pickGameKeys('word', 'mid', 6, [], 'play|word|2026-11-09|e1');
  assert.equal(d1.length, 6, 'six picks per run');
  assert.equal(new Set(d1).size, 6, 'six distinct picks in a run');
  assert.notDeepEqual(d2, d1, 'tomorrow\'s set is not today\'s set');
  assert.deepEqual(e.pickGameKeys('word', 'mid', 6, [], 'play|word|2026-11-08|e1'), d1, 'the same day is stable');
});

test('pickGameKeys: no repeats within a day, across runs', () => {
  const e = engine();
  const salt = 'play|word|2026-11-08|e1';
  const run1 = e.pickGameKeys('word', 'mid', 6, [], salt);
  const run2 = e.pickGameKeys('word', 'mid', 6, run1, salt);
  const run3 = e.pickGameKeys('word', 'mid', 6, run1.concat(run2), salt);
  assert.ok(run2.every((k) => !run1.includes(k)), 'run 2 shares nothing with run 1');
  assert.ok(run3.every((k) => !run1.includes(k) && !run2.includes(k)), 'run 3 shares nothing with runs 1-2');
  assert.equal(new Set(run1.concat(run2, run3)).size, 18, 'three runs today show 18 different questions');
});

test('pickGameKeys: a small bank reuses only after it is exhausted', () => {
  const e = engine();
  const salt = 'play|sentence|2026-11-08|e1';
  const run1 = e.pickGameKeys('sentence', 'mid', 6, [], salt);
  const run2 = e.pickGameKeys('sentence', 'mid', 6, run1, salt);
  assert.ok(run2.every((k) => !run1.includes(k)), 'run 2 is all fresh (12 of 15 seen)');
  const seen12 = run1.concat(run2);
  const run3 = e.pickGameKeys('sentence', 'mid', 6, seen12, salt);
  const fresh3 = run3.filter((k) => !seen12.includes(k));
  assert.equal(fresh3.length, 3, 'run 3 takes the last 3 unseen sentences first');
  assert.equal(new Set(run3).size, 6, 'run 3 still shows 6 distinct sentences');
  const seen15 = seen12.concat(fresh3);
  const run4 = e.pickGameKeys('sentence', 'mid', 6, seen15, salt);
  assert.ok(run4.every((k) => seen15.includes(k)), 'run 4 (bank exhausted) only reuses seen sentences');
  assert.equal(new Set(run4).size, 6, 'even an exhausted bank still deals 6 distinct rounds');
});

test('pickRaceSeed: a race seed whose questions are all unseen today', () => {
  const e = engine();
  const salt = 'play|race|2026-11-08|e1';
  const fresh = e.pickRaceSeed('mid', 6, [], salt);
  assert.equal(fresh.keys.length, 6, 'six race questions');
  assert.equal(new Set(fresh.keys).size, 6, 'six distinct race questions in a run');
  assert.deepEqual(e.gameRunKeys('race', fresh.seed, 'mid', 6), fresh.keys, 'the seed really deals the returned questions');
  // Seed the whole of try0's set as seen: the search must skip it.
  const try0Seed = e.hashStr(salt + '|try0');
  const try0Keys = e.gameRunKeys('race', try0Seed, 'mid', 6);
  const again = e.pickRaceSeed('mid', 6, try0Keys, salt);
  assert.notEqual(again.seed, try0Seed, 'a fully-seen seed is skipped');
  assert.ok(again.keys.every((k) => !try0Keys.includes(k)), 'the new seed\'s questions are all unseen');
});

test('gameRunKeys: distinct within a run, and the right shape per game', () => {
  const e = engine();
  for (const gid of ['word', 'number', 'race']) {
    const keys = e.gameRunKeys(gid, 4242, 'mid', 6);
    assert.equal(keys.length, 6, gid + ': six keys');
    assert.equal(new Set(keys).size, 6, gid + ': six distinct questions in a run');
  }
  const scr = e.gameRunKeys('scramble', 4242, 'mid', 6);
  assert.ok(scr.every((k) => e.SCR_WORDS.some((w) => w.w === k)), 'scramble keys are real words');
  const sent = e.gameRunKeys('sentence', 4242, 'mid', 6);
  assert.equal(new Set(sent).size, 6, 'sentence: six distinct sentences');
  assert.ok(sent.every((k) => e.SENTENCES.some((s) => s.w.join(' ') === k)), 'sentence keys are real sentences');
  const mem = e.gameRunKeys('memory', 4242, 'mid', 6);
  assert.deepEqual(mem.length, 1, 'memory: one combo per run');
  assert.match(mem[0], /^mem\|[0-3]\|[468]$/, 'memory key is a combo: ' + mem[0]);
  assert.deepEqual(e.gameRunKeys('crossword', 4242, 'mid', 6), [], 'crossword: no pick keys');
  assert.deepEqual(e.gameRunKeys('parking', 4242, 'mid', 6), [], 'parking: no pick keys');
});

test('memoryComboFor: 12 distinct combos, pairs and themes in range', () => {
  const e = engine();
  const keys = new Set();
  for (let s = 0; s < 12; s++) {
    const c = e.memoryComboFor(s);
    assert.ok([4, 6, 8].includes(c.pairs), 'pairs in {4,6,8}: ' + c.pairs);
    assert.ok(c.themeIdx >= 0 && c.themeIdx < 4, 'theme 0-3: ' + c.themeIdx);
    assert.equal(c.key, 'mem|' + c.themeIdx + '|' + c.pairs, 'key matches the combo');
    keys.add(c.key);
  }
  assert.equal(keys.size, 12, 'seeds 0-11 cover all 12 combos');
  assert.deepEqual(e.memComboFromKey('mem|2|6'), { themeIdx: 2, pairs: 6, key: 'mem|2|6' }, 'a combo key parses back');
});

test('playSeen: record, read, day rollover (page); the merge rule lives in lib/rules.js', () => {
  const e = engine();
  const ex = { playSeen: {} };
  e.recordPlaySeen(ex, 'word', '2026-11-08', ['q1', 'q2', 'q3']);
  assert.deepEqual(e.playSeenToday(ex, 'word', '2026-11-08'), ['q1', 'q2', 'q3'], 'today\'s keys read back');
  e.recordPlaySeen(ex, 'word', '2026-11-08', ['q2', 'q4']);
  assert.deepEqual(e.playSeenToday(ex, 'word', '2026-11-08'), ['q1', 'q2', 'q3', 'q4'], 'same day unions, no dupes');
  assert.deepEqual(e.playSeenToday(ex, 'word', '2026-11-09'), [], 'a new day starts empty');
  e.recordPlaySeen(ex, 'word', '2026-11-09', ['q9']);
  assert.deepEqual(e.playSeenToday(ex, 'word', '2026-11-09'), ['q9'], 'yesterday\'s keys do not carry over');
  const many = e.recordPlaySeen({ playSeen: {} }, 'word', '2026-11-08', Array.from({ length: 1500 }, (_, i) => 'k' + i));
  assert.equal(many.length, 1000, 'seen keys are capped at 1000');
  // The merge itself is inlined in mergeExplorer (so its standalone
  // harnesses keep working) and mirrored in lib/rules.js — the lib
  // test below proves the rule, and the source check proves the page
  // carries it.
  const merge = fnText('function mergeExplorer(');
  assert.ok(merge.includes('playSeen'), 'mergeExplorer carries playSeen');
  assert.ok(merge.includes("(y.day||'')>(x.day||'')"), 'the page merge lets the later day win whole');
  assert.ok(merge.includes('ps[k].keys.indexOf(key)<0'), 'the page merge unions same-day keys');
});

test('lib/rules.js: pickDailyGameKeys and mergePlaySeen mirror the page', () => {
  const R = require('../lib/rules');
  assert.equal(typeof R.pickDailyGameKeys, 'function', 'pickDailyGameKeys is exported');
  assert.equal(typeof R.mergePlaySeen, 'function', 'mergePlaySeen is exported');
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  const first = R.pickDailyGameKeys(pool, [], 4, 'day1');
  assert.equal(first.length, 4, 'four picks');
  assert.equal(new Set(first).size, 4, 'four distinct picks');
  assert.deepEqual(R.pickDailyGameKeys(pool, [], 4, 'day1'), first, 'deterministic for the same seed');
  const unseen = pool.filter((k) => !first.includes(k));
  assert.equal(unseen.length, 2, 'two unseen left after the first pick');
  const second = R.pickDailyGameKeys(pool, first, 4, 'day1');
  assert.equal(second.length, 4, 'four picks again');
  assert.equal(new Set(second).size, 4, 'four distinct picks');
  assert.ok(unseen.every((k) => second.includes(k)), 'the second pick takes the unseen ones first');
  const exhausted = R.pickDailyGameKeys(pool, pool, 3, 'day1');
  assert.equal(exhausted.length, 3, 'an exhausted pool still deals');
  assert.ok(exhausted.every((k) => pool.includes(k)), 'an exhausted pool only reuses its own keys');
  const m = R.mergePlaySeen({ word: { day: '2026-11-08', keys: ['a'] } }, { word: { day: '2026-11-09', keys: ['z'] } });
  assert.deepEqual(m.word, { day: '2026-11-09', keys: ['z'] }, 'lib merge: later day wins whole');
  const mu = R.mergePlaySeen(
    { word: { day: '2026-11-08', keys: ['a', 'b'] }, sort: { day: '2026-11-08', keys: ['s1'] } },
    { word: { day: '2026-11-08', keys: ['b', 'c'] }, race: { day: '2026-11-09', keys: ['r1'] } }
  );
  assert.deepEqual(mu.word.keys.sort(), ['a', 'b', 'c'], 'lib merge: same day unions keys');
  assert.deepEqual(mu.sort.keys, ['s1'], 'lib merge: a game on one side only survives');
  assert.deepEqual(mu.race.keys, ['r1'], 'lib merge: a game on the other side only survives');
});

test('startGame / saveGameProgress / mergeExplorer wiring (source-level)', () => {
  const startGame = fnText('function startGame(');
  assert.ok(startGame.includes('pickGameKeys'), 'startGame draws unseen-first picks');
  assert.ok(startGame.includes('pickRaceSeed'), 'startGame searches a fresh race seed');
  assert.ok(startGame.includes('recordPlaySeen'), 'startGame records what the run shows');
  assert.ok(startGame.includes('playSeenToday'), 'startGame reads today\'s seen keys');
  assert.ok(startGame.includes('hasDaily'), 'startGame guards the new path so the standalone harnesses keep working');
  assert.ok(startGame.includes("if(p&&!doneP){ seed=p.seed||0;"), 'the old resume line is kept as the fallback');
  assert.ok(startGame.includes("else if(doneP){ seed=hashStr('play|'+id+'|'+todayKey()+'|'+e.id+'|'+Date.now());"), 'the old replay seed is kept as the fallback');
  assert.ok(startGame.includes('memComboFromKey') || startGame.includes('memoryComboFor'), 'startGame uses the picked memory combo');
  assert.ok(startGame.includes('seededShuffle(memCards, seed)'), 'the memory deck is a seeded shuffle on the real page');
  assert.ok(startGame.includes("gState.keys=runKeys;"), 'startGame stores the run\'s keys on gState');
  const genRound = fnText('function genRound(');
  assert.match(genRound, /function genRound\(gameId, idx, seed, tier, pick\)/, 'genRound takes a pick');
  assert.ok(genRound.includes('pick!=null') || genRound.includes('pick !== null'), 'genRound honours the pick');
  // genRound keeps its own local RANGES (its standalone harnesses
  // eval it without the new block); gamePoolFor carries the same
  // ranges as NUM_RANGES, and the two must stay identical.
  assert.ok(genRound.includes('var RANGES='), 'genRound keeps its local RANGES for its harnesses');
  const numRanges = eval((html.match(/var NUM_RANGES=\{[^;]+\};/) || [])[0] + ';NUM_RANGES');
  const localRanges = eval('(' + genRound.match(/var RANGES=\{[^;]+\};/)[0].replace('var RANGES=', '').replace(/;$/, '') + ')');
  assert.deepEqual(numRanges, localRanges, 'NUM_RANGES matches genRound\'s local RANGES');
  const sentFor = fnLine('sentFor');
  assert.match(sentFor, /function sentFor\(seed, idx, tier, pick\)/, 'sentFor takes a pick');
  const saveGame = fnText('function saveGameProgress(');
  assert.ok(saveGame.includes('keys:'), 'saveGameProgress stores the run\'s keys');
  assert.ok(saveGame.includes('combo:'), 'saveGameProgress stores the memory combo');
  const merge = fnText('function mergeExplorer(');
  assert.ok(merge.includes('playSeen'), 'mergeExplorer carries playSeen');
  assert.ok(merge.includes('keys:'), 'the playProgress merge carries keys');
  assert.ok(merge.includes('combo:'), 'the playProgress merge carries the memory combo');
  assert.ok(html.includes('playSeen:{},'), 'new explorers start with an empty playSeen');
  // The round's pick is read inline from the run's stored keys
  // (no helper, so the gameHTML/bindGame harnesses keep working).
  assert.ok(html.includes('(gState.keys||[])[gState.idx]'), 'the pick is read inline from gState.keys');
});

test('crossword grid rotates daily; parking levels are fixed (source-level)', () => {
  function gridFor(day) {
    return eval('var TODAY="' + day + '";\nfunction todayKey(){ return TODAY; }\nvar XWGRIDS=[0,1,2,3,4,5];\n'
      + fnLine('hashStr') + '\n' + fnLine('xwGridOfDay') + '\n;xwGridOfDay()');
  }
  const grids = new Set();
  for (let d = 1; d <= 7; d++) grids.add(gridFor('2026-11-' + String(d).padStart(2, '0')));
  assert.ok(grids.size > 1, 'the crossword grid changes across days');
  assert.equal(gridFor('2026-11-08'), gridFor('2026-11-08'), 'the same day deals the same grid');
  assert.ok(html.includes('var PARKLEVELS='), 'parking levels are a fixed list');
  assert.ok(!fnText('function startGame(').includes("pickGameKeys('parking'") && !fnText('function startGame(').includes('pickGameKeys("parking"'), 'parking is not pick-searched');
});

test('sidebar is independently scrollable; mobile bottomnav untouched', () => {
  const sidebar = html.match(/\.sidebar\{[^}]*\}/);
  assert.ok(sidebar, '.sidebar rule exists');
  assert.ok(sidebar[0].includes('overflow-y:auto'), '.sidebar carries overflow-y:auto, so the nav scrolls inside the panel');
  assert.ok(sidebar[0].includes('height:100vh'), '.sidebar still fills the viewport height');
  const mobile = html.match(/@media \(max-width:820px\)\{[^}]*\.sidebar\{display:none\}[^}]*\}/s);
  assert.ok(mobile || html.includes('.sidebar{display:none}'), 'the mobile block still hides .sidebar');
  assert.ok(html.includes('.bottomnav{display:flex'), 'the mobile block still shows .bottomnav');
});

/* ---------------- Feature 2: Ask Pip from a question ---------------- */

test('askThreadTitle: labels the thread with the topic and the question', () => {
  const e = engine();
  assert.equal(e.askThreadTitle({ label: 'Story Words', question: 'She is as busy as a ___.' }), '❓ Story Words: She is as busy as a ___.', 'topic + question');
  assert.equal(e.askThreadTitle({ label: 'Maths Race', question: '7 × 8 = ?' }), '❓ Maths Race: 7 × 8 = ?', 'game label + question');
  assert.equal(e.askThreadTitle({ question: 'What is 7 + 8?' }), '❓ What is 7 + 8?', 'no label still titles');
  const long = e.askThreadTitle({ label: 'Story Words', question: 'Mina was so hungry she ate her noodles in two minutes. She was really ___.' });
  assert.ok(long.length <= 49, 'long titles truncate: ' + long.length);
  assert.ok(long.endsWith('…'), 'a truncated title ends with …');
  assert.ok(long.startsWith('❓ Story Words: '), 'a truncated title keeps the label');
});

test('askKidText: includes the question and the choices', () => {
  const e = engine();
  const withOpts = e.askKidText({ question: '7 × 8 = ?', options: ['56', '48', '63', '54'] });
  assert.ok(withOpts.includes('7 × 8 = ?'), 'the kid message carries the question');
  assert.ok(withOpts.includes('The choices are: 56, 48, 63, 54.'), 'the kid message carries the choices');
  const noOpts = e.askKidText({ question: 'Unscramble the letters: E L B A T. Hint: a piece of furniture.' });
  assert.ok(noOpts.includes('Unscramble the letters'), 'a question without options still carries it');
  assert.ok(!noOpts.includes('choices are'), 'no choices line when there are none');
});

test('newAskQuestionThread: a new thread carrying the question', () => {
  const e = engine();
  const ctx = { src: 'quest', label: 'Story Words', question: 'She is as busy as a ___.', options: ['bee', 'ant', 'cat', 'dog'], answer: 'bee', clue: 'Think of a busy insect!' };
  const th = e.newAskQuestionThread(ctx);
  assert.ok(th.id.startsWith('t'), 'thread id starts with t');
  assert.equal(th.title, '❓ Story Words: She is as busy as a ___.', 'title labels the question');
  assert.equal(th.msgs.length, 1, 'one opening message');
  assert.equal(th.msgs[0].who, 'kid', 'the opening message is the child asking');
  assert.ok(th.msgs[0].text.includes('She is as busy as a ___.'), 'the opening message contains the question');
  assert.deepEqual(th.qctx, { src: 'quest', label: 'Story Words', q: 'She is as busy as a ___.' }, 'qctx marks the question for later');
});

test('pipExplainFallback: guides without blurting the answer', () => {
  const e = engine();
  const ctx = { src: 'game', label: 'Maths Race', question: '7 × 8 = ?', options: ['56', '48', '63', '54'], answer: '56', clue: '7 groups of 8.' };
  const fb = e.pipExplainFallback(ctx);
  assert.ok(fb.includes('7 × 8 = ?'), 'the fallback restates the question');
  assert.ok(fb.includes('7 groups of 8.'), 'the fallback uses the clue');
  assert.ok(fb.includes('Try the first step'), 'the fallback gives a first step, not the answer');
  assert.ok(fb.includes('Try the first step.'), 'the fallback includes Pip\'s skill method');
  // The choices legitimately list the answer as one option; the
  // fallback must never STATE it as the answer.
  assert.ok(!fb.includes('The answer is'), 'the fallback never states the answer');
  assert.ok(!/is 56[.!]/.test(fb), 'the fallback never concludes with the answer');
  const bare = e.pipExplainFallback({ question: 'What is 7 + 8?', answer: '15' });
  assert.ok(bare.includes('What is 7 + 8?'), 'a bare question still gets a fallback');
  assert.ok(!bare.includes('15'), 'a bare fallback (no choices) never blurts the answer');
});

test('bankSecsLeft: remaining seconds, clamped', () => {
  const e = engine();
  assert.equal(e.bankSecsLeft(10000, 5000), 5, 'five seconds left');
  assert.equal(e.bankSecsLeft(10000, 9999), 1, 'rounds up to the next whole second');
  assert.equal(e.bankSecsLeft(5000, 10000), 0, 'a past deadline is zero, never negative');
  assert.equal(e.bankSecsLeft(null, 10000), 0, 'no deadline is zero');
  assert.equal(e.bankSecsLeft(0, 10000), 0, 'a zero deadline is zero');
});

test('the Ask Pip button is on question screens, not on Memory/Parking (source-level)', () => {
  assert.ok(html.includes('id="wuAskPip"'), 'warm-up has an Ask Pip button');
  assert.ok(html.includes('id="qAskPip"'), 'quest has an Ask Pip button');
  assert.ok(html.includes('id="gAskPip"'), 'games have an Ask Pip button');
  const memStart = html.indexOf("if(gState.id==='memory'){");
  const memEnd = html.indexOf("if(gState.idx>=gState.rounds){", memStart);
  assert.ok(!html.slice(memStart, memEnd).includes('AskPip'), 'Memory Match has no Ask Pip button');
  const parkStart = html.indexOf("if(gState.id==='parking'){");
  const parkEnd = html.indexOf("if(gState.id==='sentence'){", parkStart);
  assert.ok(!html.slice(parkStart, parkEnd).includes('AskPip'), 'Exit Parking has no Ask Pip button');
  assert.ok(html.includes('id="askReturnBtn"'), 'the Ask Pip thread view has a Back to my question button');
  assert.ok(html.includes('Back to my question'), 'the return button is labelled for a child');
  const goFn = fnText('function go(');
  assert.ok(goFn.includes("if(r!=='ask')askReturn=null;"), 'leaving Ask Pip by the nav abandons the return');
  const bindWarmup = fnText('function bindWarmup(');
  assert.ok(bindWarmup.includes('wuAskPip') && bindWarmup.includes('askPipAbout'), 'warm-up wires its button to askPipAbout');
  const bindQuiz = fnText('function bindQuiz(');
  assert.ok(bindQuiz.includes('qAskPip') && bindQuiz.includes('askPipAbout'), 'quest wires its button to askPipAbout');
  const bindGame = fnText('function bindGame(');
  assert.ok(bindGame.includes('gAskPip') && bindGame.includes('askPipAbout'), 'games wire their button to askPipAbout');
  const askLive = fnText('function askPipLive(');
  assert.ok(askLive.includes('opts'), 'askPipLive takes an opts argument');
  assert.ok(askLive.includes('mode:') && askLive.includes('explain:'), 'askPipLive sends mode + explain to the server');
  const explainSend = fnText('function pipExplainSend(');
  assert.ok(!explainSend.includes('pipHelp'), 'a question explanation skips the app-help layer');
  assert.ok(explainSend.includes("mode:'explain'"), 'the explanation call uses mode explain');
  const askAbout = fnText('function askPipAbout(');
  assert.ok(askAbout.includes('pauseLearnTimer') && askAbout.includes('pausePlayTimer'), 'Ask Pip pauses the answer-only timer');
  assert.ok(askAbout.includes('newAskQuestionThread'), 'Ask Pip opens a new thread');
  assert.ok(askAbout.includes("go('ask')"), 'Ask Pip goes to the Ask Pip screen');
  const ret = fnText('function returnFromAskPip(');
  assert.ok(ret.includes('resumeLearnTimer') && ret.includes('resumePlayTimer'), 'returning resumes the timers');
  assert.ok(ret.includes('raceLeft') && ret.includes('escLeft'), 'returning restores the banked countdowns');
});

test('api/ask-pip.js explain mode: Pip explains, hint first, answer only as a reference', async () => {
  process.env.MODEL_API_KEY = 'test-key';
  delete require.cache[require.resolve('../api/ask-pip')];
  const ask = require('../api/ask-pip');
  const seen = [];
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    seen.push(JSON.parse(opts.body));
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Let us think! 7 groups of 8 — count in eights: 8, 16, 24, 32, 40, 48, 56. What do you get?' } }] }),
    };
  };
  function mockRes() {
    const res = { statusCode: 0, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.setHeader = () => res;
    res.json = (o) => { res.body = o; return res; };
    return res;
  }
  try {
    const res = mockRes();
    await ask({ method: 'POST', body: { question: 'Pip, can you help me with this question? “7 × 8 = ?” The choices are: 56, 48, 63, 54.', name: 'Jiyuna', mode: 'explain', explain: { topic: 'Maths Race', answer: '56', clue: '7 groups of 8.' } } }, res);
    assert.equal(res.statusCode, 200, 'explain mode answers');
    assert.equal(res.body.live, true, 'explain mode is live');
    assert.match(res.body.reply, /56/, 'the reply guides to the answer');
    assert.equal(seen.length, 1, 'one model call');
    const sys = seen[0].messages[0].content;
    assert.match(sys, /explain what the question is asking/i, 'the prompt asks Pip to explain the question');
    assert.match(sys, /Do NOT say the answer first/i, 'the prompt forbids blurting the answer first');
    assert.match(sys, /56/, 'the correct answer is in the prompt as a reference');
    assert.match(sys, /7 groups of 8/, 'the clue is in the prompt');
    assert.match(sys, /under 90 words/i, 'the explain prompt keeps the length rule');
    // Normal mode is unchanged: no explain instruction.
    const res2 = mockRes();
    await ask({ method: 'POST', body: { question: 'What is 7 x 8?', name: 'Jiyuna' } }, res2);
    assert.equal(res2.statusCode, 200, 'normal mode still answers');
    const sys2 = seen[1].messages[0].content;
    assert.ok(!/Do NOT say the answer first/i.test(sys2), 'normal mode has no explain instruction');
    assert.ok(!/explain what the question is asking/i.test(sys2), 'normal mode is not an explanation');
  } finally {
    global.fetch = origFetch;
    delete process.env.MODEL_API_KEY;
  }
});
