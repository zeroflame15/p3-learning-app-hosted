// Ask Pip fix (2026-11-08, live-verified failures): Ask Pip from a
// quest or game question created NO thread, and an in-progress game
// run was lost across the round trip. These tests reproduce both
// failures against the real page functions, plus the explain-prompt
// strengthening (Pip must lead with a hint, not the answer).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');
const LSKEY = 'jiyuna-learning-web-v1';

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in ' + PAGE_PATH);
  // Stop at the next top-level function, regular or async: saveGameProgress
  // is followed by `async function askPipLive`, and a plain '\nfunction '
  // search would swallow it — the real askPipLive would then shadow the
  // test stub and every explain call would go to the live API instead.
  const nextFn = html.indexOf('\nfunction ', start + marker.length);
  const nextAsync = html.indexOf('\nasync function ', start + marker.length);
  const next = [nextFn, nextAsync].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return next != null ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
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

const flush = () => new Promise((r) => setImmediate(r));

function makeExplorer(over) {
  const e = { id: 'e1', name: 'VerifyFix', code: ['🦊', '🐢', '⭐'], level: 'P3', friendCode: 'ABCDEF', friends: [], face: '🐤', glow: '#ffb020', badge: '⭐',
    look: { background: { shape: 'circle', color: 'mint', effect: 'plain', pattern: '' } }, stars: 0, starsEarned: 0, starsSpent: 0, badges: [], completed: {}, completedDay: {}, progress: {},
    playProgress: {}, playFresh: {}, playDoneDay: {}, playDaily: {}, playSeen: {}, critterName: 'Splash', critterNameAt: null, critterStage: 0, care: {}, careGrewDay: null, discoveredCritters: [], theme: 'Frog Pond', themeAt: null, treasures: [],
    threads: [], deletedThreadIds: [], threadSeq: 0, daily: {}, totalMinutes: 0, lastTopic: null, favAnswers: [], deletedFavAnswers: [], swapIdx: 0, hclMissed: [], mood: {}, stuckCount: {}, boost: {},
    flashcards: [], deletedFlashcards: [], deletedPlanner: [], planner: [], flags: [], created: Date.now() };
  return Object.assign(e, over || {});
}
function makeDB(explorer) {
  return { explorers: [explorer], activeId: explorer.id, syncCode: 'ABCDEF', parentPin: '2468', dailyLimit: 30, playLimit: 20, updatedAt: null, flags: [] };
}

/* A live page in miniature: the real askPipAbout / save / merge
   functions, with a stubbed DOM, localStorage, render/go and Pip
   call — so the click-to-thread flow runs exactly as on the page,
   including the save() that replaces the explorer object. */
function askFlow() {
  const stubs = [
    "var DB=null, route='home', activeThread=null, askReturn=null, askPipPause=null, asking={}, warm=null, cur=null, gState=null, gameTimer=null, syncCalls=0, renderCalls=0;",
    'var goCalls=[], armCalls=[];',
    "var localStorage={_m:{}, getItem:function(k){ return this._m[k]!=null?this._m[k]:null; }, setItem:function(k,v){ this._m[k]=String(v); }, removeItem:function(k){ delete this._m[k]; }};",
    'var document={getElementById:function(){ return null; }};',
    'var setInterval=function(){ return 1; }, clearInterval=function(){};',
    "var GAMES=[{id:'word',name:'Word Garden',rounds:6},{id:'number',name:'Number Pop',rounds:6},{id:'memory',name:'Memory Match',rounds:6},{id:'sort',name:'Speed Sort',rounds:6},{id:'scramble',name:'Word Scramble',rounds:6},{id:'race',name:'Maths Race',rounds:6},{id:'sentence',name:'Sentence Builder',rounds:6},{id:'crossword',name:'Crossword Quest',rounds:6},{id:'parking',name:'Exit Parking',rounds:18}];",
    'function syncToServer(){ syncCalls++; }',
    'function render(){ renderCalls++; }',
    'function go(r){ goCalls.push(r); route=r; render(); }',
    'function ensureSyncCode(){}',
    "function skillForQuestionClient(q){ return {id:'test-skill', name:'Test Method', method:'Try the first step.'}; }",
    'function tickGameTime(){}',
    'function armNumberEscape(s){ armCalls.push(s); }',
    "function askPipLive(text, history, name, opts){ return Promise.resolve({reply:'Hint first: think about what the question asks, then try one small step.', skillName:'', skillId:'', agentName:'', agentId:'', signature:'', hintFirst:true, live:true}); }",
  ].join('\n');
  const fns = [
    fnLine('save'), fnLine('ex'), fnLine('saveLocal'), fnLine('todayKey'), fnLine('bankSecsLeft'),
    fnLine('unionArr'), fnLine('unionObjMax'), fnLine('unionObjLatest'), fnLine('isThinkingMsg'),
    grab('mergeStoredIntoDB'), grab('mergeThreads'), grab('pickCritterName'), grab('mergeLetters'), grab('mergeCare'),
    fnBody('function saveGameProgress('),
    grab('learnElapsedSecs'), grab('pauseLearnTimer'), grab('resumeLearnTimer'),
    grab('playElapsedSecs'), grab('pausePlayTimer'), grab('resumePlayTimer'), grab('persistProgress'),
    grab('askThreadTitle'), grab('askKidText'), grab('newAskQuestionThread'), grab('pipExplainFallback'),
    fnBody('function mergeExplorer('), fnBody('function mergeFamilyDB('),
    fnBody('function askPipAbout('), fnBody('function pipExplainSend('), fnBody('function returnFromAskPip('),
  ].join('\n');
  const api = ';({askPipAbout, returnFromAskPip, save, saveGameProgress, mergeExplorer, mergeFamilyDB, mergeThreads, ex,'
    + ' getDB:function(){return DB;}, setDB:function(v){DB=v;},'
    + ' getRoute:function(){return route;}, goCalls:function(){return goCalls;}, getAskReturn:function(){return askReturn;}, getActiveThread:function(){return activeThread;},'
    + ' setCur:function(v){cur=v;}, getCur:function(){return cur;}, setWarm:function(v){warm=v;}, setGState:function(v){gState=v;}, getGState:function(){return gState;},'
    + ' getRenderCalls:function(){return renderCalls;}, getSyncCalls:function(){return syncCalls;}, getArmCalls:function(){return armCalls;},'
    + ' setLocal:function(k,v){localStorage._m[k]=v;}, getLocal:function(k){return localStorage._m[k];}})';
  return eval(stubs + '\n' + fns + api);
}

/* ---------------- Root cause: save() replaces the explorer ---------------- */

test('save() replaces the explorer object — a captured reference goes stale', () => {
  const h = askFlow();
  h.setDB(makeDB(makeExplorer({ id: 'e1' })));
  h.setLocal(LSKEY, JSON.stringify(h.getDB()));
  const before = h.ex();
  h.save();
  const after = h.ex();
  assert.notEqual(after, before, 'save() replaces the explorer object in DB (mergeStoredIntoDB)');
  assert.deepEqual(after.threads, [], 'the replacement keeps the same data');
  // The bug, in miniature: a thread added through the stale
  // reference never reaches the DB.
  before.threads.unshift({ id: 'tSTALE', title: 'stale', msgs: [] });
  h.save();
  assert.equal(h.ex().threads.length, 0, 'a thread added through the stale reference is silently lost');
  // The fix order: re-fetch after the save, then add.
  const live = h.ex();
  live.threads.unshift({ id: 'tLIVE', title: 'live', msgs: [] });
  h.save();
  assert.equal(h.ex().threads.length, 1, 'a thread added through a re-fetched reference survives');
  assert.equal(h.ex().threads[0].id, 'tLIVE', 'the surviving thread is the new one');
});

/* ---------------- Failure 1: Ask Pip from a quest question ---------------- */

test('askPipAbout quest: creates the thread on the live explorer (was: no thread)', async () => {
  const h = askFlow();
  const warmThread = { id: 't1000', title: '❓ Tenses Trek: She ___ her hands before lunch.', msgs: [{ who: 'kid', text: 'Pip, can you help me with this question? “She ___ her hands before lunch.”' }, { who: 'pip', text: 'Hint first!' }], qctx: { src: 'warmup', label: 'Tenses Trek', q: 'She ___ her hands before lunch.' } };
  h.setDB(makeDB(makeExplorer({ id: 'e1', threads: [warmThread] })));
  h.setLocal(LSKEY, JSON.stringify(h.getDB()));
  h.setCur({ topicId: 'eng-tense', phase: 'quest', idx: 0, score: 0, wrong: [], picked: null, answered: false, pool: [0, 1, 2, 3, 4], fresh: false, answerSecs: 0, startedAt: Date.now() });
  h.askPipAbout({ src: 'quest', topicId: 'eng-tense', label: 'Tenses Trek', question: 'Yesterday, we ___ to the zoo by bus.', options: ['go', 'went', 'going', 'goes'], answer: 'went', clue: 'Yesterday — past tense.' });
  await flush();
  const e = h.ex();
  assert.equal(e.threads.length, 2, 'a second thread is created on the live explorer');
  // The new thread is the active one; it lands AFTER the older thread
  // in the list, because save() merges the stored copy (which has no
  // new thread yet) first and mergeThreads appends the new id — the
  // same order the working warm-up path produces. Find it by id.
  const th = e.threads.find((t) => t.id === h.getActiveThread());
  assert.ok(th, 'the new thread is in the live explorer');
  assert.ok(th.title.includes('Yesterday, we ___ to the zoo'), 'the new thread is titled with the quest question');
  assert.equal(h.getActiveThread(), th.id, 'the new thread is active');
  assert.equal(h.getAskReturn().route, 'quiz', 'return route is the quiz');
  assert.equal(h.goCalls().slice(-1)[0], 'ask', 'navigates to Ask Pip');
  assert.equal(th.msgs.length, 2, "Pip's reply lands in the new thread");
  assert.ok(th.msgs[1].text.includes('Hint first'), "the reply is Pip's explanation");
  // The thread survives a stale pull (the server never saw it).
  const stale = JSON.parse(JSON.stringify(h.getDB()));
  stale.explorers[0].threads = [warmThread];
  const merged = h.mergeFamilyDB(JSON.parse(JSON.stringify(h.getDB())), stale);
  assert.equal(merged.explorers[0].threads.length, 2, 'the new thread survives a stale pull');
  // Returning goes back to the quiz with the clock running.
  h.returnFromAskPip();
  assert.equal(h.goCalls().slice(-1)[0], 'quiz', 'back goes to the quiz');
  assert.ok(h.getCur().startedAt, 'the answer-only clock resumes on return');
});

/* ---------------- Failures 2 + 3: Ask Pip from a game question ---------------- */

test('askPipAbout game: creates the thread AND keeps the in-progress run (was: no thread, run lost)', async () => {
  const h = askFlow();
  const run1 = { idx: 6, score: 5, seed: 111, elapsed: 60, answered: true, picked: 0, keys: ['r1k0', 'r1k1', 'r1k2', 'r1k3', 'r1k4', 'r1k5'], at: 1000 };
  const run2keys = ['r2k0', 'r2k1', 'r2k2', 'r2k3', 'r2k4', 'r2k5'];
  h.setDB(makeDB(makeExplorer({ id: 'e1', threads: [], playProgress: { word: run1 } })));
  h.setLocal(LSKEY, JSON.stringify(h.getDB()));
  const beforeAsk = JSON.stringify(h.getDB());
  // Word Garden run 2, round 2, unanswered — in memory only so far.
  h.setGState({ id: 'word', idx: 1, score: 0, seed: 222, keys: run2keys, answered: false, picked: null, startedAt: Date.now(), answerSecs: 10, rounds: 6, tier: 'mid' });
  h.askPipAbout({ src: 'game', gameId: 'word', label: 'Word Garden', question: 'Sara loves to read... Which sentence is FALSE?', options: ['A', 'B', 'C', 'D'], answer: 'B', clue: '' });
  await flush();
  const e = h.ex();
  assert.equal(e.threads.length, 1, 'a thread is created on the live explorer');
  assert.ok(e.threads[0].title.includes('Sara loves to read'), 'the thread is titled with the game question');
  assert.equal(h.getAskReturn().route, 'game', 'return route is the game');
  // The in-progress run survives the save — the old max-idx merge
  // resurrected run 1's idx=6 here, so the run looked finished.
  assert.equal(e.playProgress.word.idx, 1, 'the saved progress is run 2 (round 2), not run 1 (finished)');
  assert.deepEqual(e.playProgress.word.keys, run2keys, "the saved keys are run 2's");
  assert.equal(e.playProgress.word.seed, 222, "the saved seed is run 2's");
  assert.ok(e.playProgress.word.at > 1000, 'the saved record carries the newer run time');
  // A later save against a stale stored copy (still run 1) does not
  // resurrect run 1 either.
  h.setLocal(LSKEY, beforeAsk);
  h.save();
  assert.equal(h.ex().playProgress.word.idx, 1, 'a later save against a stale copy still keeps run 2');
  assert.equal(h.ex().threads.length, 1, 'the thread survives that save too');
  // Returning goes back to the same round, clock running.
  h.returnFromAskPip();
  assert.equal(h.goCalls().slice(-1)[0], 'game', 'back goes to the game');
  assert.equal(h.getGState().idx, 1, 'the game resumes at round 2, not round 1');
  assert.ok(h.getGState().startedAt, 'the answer-only clock resumes on return');
});

/* ---------------- Warm-up still works (regression) ---------------- */

test('askPipAbout warm-up still works (regression)', async () => {
  const h = askFlow();
  h.setDB(makeDB(makeExplorer({ id: 'e1' })));
  h.setLocal(LSKEY, JSON.stringify(h.getDB()));
  h.setWarm({ topicId: 'eng-tense', order: [0], idx: 0, timer: null });
  h.askPipAbout({ src: 'warmup', topicId: 'eng-tense', label: 'Tenses Trek', question: 'She ___ her hands before lunch.', options: ['wash', 'washes', 'washing', 'washed'], answer: 'washes', clue: 'She is one person.' });
  await flush();
  const e = h.ex();
  assert.equal(e.threads.length, 1, 'warm-up Ask Pip still creates a thread');
  assert.equal(h.getAskReturn().route, 'warmup', 'return route is the warm-up');
  assert.equal(h.goCalls().slice(-1)[0], 'ask', 'navigates to Ask Pip');
});

/* ---------------- The playProgress merge rule ---------------- */

test('mergeExplorer playProgress: a newer run wins whole; the same run still merges by max', () => {
  const h = askFlow();
  const run1 = { idx: 6, score: 5, seed: 111, elapsed: 60, answered: true, picked: 0, keys: ['a', 'b'], at: 1000 };
  const run2 = { idx: 1, score: 0, seed: 222, elapsed: 10, answered: false, picked: null, keys: ['c', 'd'], at: 2000 };
  const m = h.mergeExplorer(makeExplorer({ id: 'e1', playProgress: { word: run1 } }), makeExplorer({ id: 'e1', playProgress: { word: run2 } }));
  assert.equal(m.playProgress.word.idx, 1, 'different seeds: the newer run wins, idx is run 2\'s');
  assert.deepEqual(m.playProgress.word.keys, ['c', 'd'], 'different seeds: the newer run\'s keys win');
  assert.equal(m.playProgress.word.seed, 222, 'different seeds: the newer run\'s seed wins');
  const m2 = h.mergeExplorer(makeExplorer({ id: 'e1', playProgress: { word: run2 } }), makeExplorer({ id: 'e1', playProgress: { word: run1 } }));
  assert.equal(m2.playProgress.word.idx, 1, 'argument order does not resurrect the finished run');
  // Same run on two devices: the further round still wins.
  const s1 = { idx: 2, score: 1, seed: 222, elapsed: 20, answered: false, picked: null, keys: ['c', 'd'], at: 2000 };
  const s2 = { idx: 4, score: 3, seed: 222, elapsed: 40, answered: false, picked: 1, keys: ['c', 'd'], at: 3000 };
  const m3 = h.mergeExplorer(makeExplorer({ id: 'e1', playProgress: { word: s1 } }), makeExplorer({ id: 'e1', playProgress: { word: s2 } }));
  assert.equal(m3.playProgress.word.idx, 4, 'same seed: the further round wins');
  assert.equal(m3.playProgress.word.score, 3, 'same seed: the higher score wins');
  assert.equal(m3.playProgress.word.at, 3000, 'same seed: the later time travels with the record');
  // Legacy records with no seed fall through to the old merge.
  const l1 = { idx: 6, score: 5, elapsed: 60, answered: true, picked: 0, keys: ['a'] };
  const l2 = { idx: 1, score: 0, elapsed: 10, answered: false, picked: null, keys: ['c'] };
  const m4 = h.mergeExplorer(makeExplorer({ id: 'e1', playProgress: { word: l1 } }), makeExplorer({ id: 'e1', playProgress: { word: l2 } }));
  assert.equal(m4.playProgress.word.idx, 6, 'no seed on either side: the old max-idx merge still applies');
});

/* ---------------- Source-level pins ---------------- */

test('saveGameProgress stamps at on every record (source-level)', () => {
  const sg = fnBody('function saveGameProgress(');
  const count = (sg.match(/at:Date\.now\(\)/g) || []).length;
  assert.equal(count, 5, 'all five record shapes (memory, parking, crossword, sentence, generic) stamp at: ' + count);
});

test('askPipAbout re-fetches the explorer after the save steps (source-level)', () => {
  const fn = fnText('function askPipAbout(');
  // The re-fetch is the exact statement right before the thread is
  // created; indexOf('e=ex();') alone would match the top capture
  // inside 'var e=ex();', so anchor on the full re-fetch statement.
  const refetch = fn.indexOf('e=ex(); if(!e)return;\n  var th=newAskQuestionThread(ctx);');
  assert.ok(refetch > 0, 'the explorer is re-fetched right before the thread is created');
  assert.ok(fn.indexOf('persistProgress()') < refetch, 'the re-fetch comes after persistProgress');
  assert.ok(fn.indexOf('saveGameProgress()') < refetch, 'the re-fetch comes after saveGameProgress');
});

test('mergeExplorer carries the run-identity rule (source-level)', () => {
  const merge = fnText('function mergeExplorer(');
  assert.ok(merge.includes('x.seed!==y.seed'), 'the merge tells runs apart by seed');
  assert.ok(merge.includes('JSON.parse(JSON.stringify(y))'), 'the newer run wins whole');
  assert.ok(merge.includes('at:Math.max(x.at||0,y.at||0)'), 'the same-run merge carries at');
});

/* ---------------- The explain prompt: hint first, answer withheld ---------------- */

test('api/ask-pip.js explain mode: Pip hints first, and the answer is not in the prompt', async () => {
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
    assert.equal(res.body.hintEnforced, false, 'a hint reply passes through unswapped');
    const sys = seen[0].messages[0].content;
    assert.match(sys, /FIRST sentence must be a hint/i, 'the prompt leads with the hint-first rule');
    assert.match(sys, /NEVER start your reply with the answer/i, 'the prompt forbids leading with the answer');
    assert.ok(!/REFERENCE ONLY/i.test(sys), 'no reference-only block');
    assert.ok(!/The correct answer is/i.test(sys), 'the correct answer is not in the prompt');
    assert.ok(!sys.includes('56'), 'the answer itself is not in the system prompt');
    assert.match(sys, /7 groups of 8/, 'the clue is still in the prompt');
    assert.match(sys, /under 90 words/i, 'the explain prompt keeps the length rule');
    // Normal mode is unchanged: no explain instruction.
    const res2 = mockRes();
    await ask({ method: 'POST', body: { question: 'What is 7 x 8?', name: 'Jiyuna' } }, res2);
    assert.equal(res2.statusCode, 200, 'normal mode still answers');
    const sys2 = seen[1].messages[0].content;
    assert.ok(!/FIRST sentence must be a hint/i.test(sys2), 'normal mode has no hint-first rule');
    assert.ok(!/The correct answer is/i.test(sys2), 'normal mode has no answer reference');
  } finally {
    global.fetch = origFetch;
    delete process.env.MODEL_API_KEY;
  }
});
