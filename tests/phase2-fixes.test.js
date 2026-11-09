// Phase 2 live-failure fixes (2026-11-10) — regression tests written
// against the ACTUAL failing behaviour, not the flag or the source.
//   F1: "Show me different quests" never changed the board — swapIdx
//       was in the explorer defaults but never merged, so save()
//       silently reverted the increment.
//   F2: a quest completed today vanished from the board instead of
//       showing as a greyed-out done card with Replay.
//   F3: a "Too hard" preference did not change the next quest's
//       questions — the default already swaps only Q1 one level down,
//       so the next quest looked exactly like a fresh control's.
//   F4: the Critter Friend badge never fired live — the stage tap
//       handler pushed to a bind-time explorer reference that save()
//       replaces (stale copy), so only the first tap stuck.
// The real functions are extracted from public/index.html and run in
// a vm — nothing here re-implements the app.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const TODAY = '2026-11-10'; // Tuesday (Term 4)

// Bracket-aware extraction: tracks {} and [] depth, skips strings/comments.
function extractBlock(marker) {
  const i = html.indexOf(marker);
  assert.ok(i >= 0, marker + ' must exist in public/index.html');
  let j = i;
  while (j < html.length && html[j] !== '{' && html[j] !== '[') j++;
  const stack = [];
  let inStr = false, strCh = '', esc = false, inLine = false, inBlock = false;
  for (; j < html.length; j++) {
    const ch = html[j], nx = html[j + 1];
    if (inLine) { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; j++; } continue; }
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '/' && nx === '/') { inLine = true; continue; }
    if (ch === '/' && nx === '*') { inBlock = true; continue; }
    if (ch === '"' || ch === "'" || ch.charCodeAt(0) === 96) { inStr = true; strCh = ch; continue; }
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') { stack.pop(); if (stack.length === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces for ' + marker);
}
function loadInto(ctx, marker) { vm.runInContext(extractBlock(marker), ctx); }
function varText(name) {
  const m = html.match(new RegExp('var ' + name + '=([^;]+);'));
  assert.ok(m, name + ' var not found in index.html');
  return 'var ' + name + '=' + m[1] + ';';
}

/* ================= shared save/load harness (real save() path) ================= */

const LSKEY = 'jiyuna-learning-web-v1';
const SYNC_FNS = [
  'function makeSyncCode(){', 'function syncCodeValid(v){', 'function ensureSyncCode(){',
  'function syncKey(){', 'function drainPendingUpload(){', 'function saveLocal(){',
  'function postToServer(key){', 'function syncToServer(){', 'function uploadAfterPull(){',
  'function unionArr(a,b){', 'function unionObjMax(a,b){', 'function unionObjLatest(a,b){',
  'function mergeThreads(aThreads,bThreads){', 'function pickCritterName(a,b){',
  'function mergeCare(a,b){', 'function mergeExplorer(a,b){',
  'function mergeFamilyDB(local, server){', 'function syncFromServer(opts){',
  'function mergeStoredIntoDB(){', 'function save(){', 'function load(){',
  'function migrateStages(){', 'function newExplorer(name, code, level){',
  'function genFriendCode(){', 'function ex(){', 'function todayKey(){',
];
function makeSaveCtx(extra) {
  const store = {};
  const server = { row: null };
  const sandbox = {
    console, setTimeout, clearTimeout, JSON, Object, Array, Math, Date, Promise,
    DB: null, DEVICE_ID: 'd-phase2-fixes',
    syncPulling: false, syncUploadPending: false, syncTimer: null, postRetryCount: 0,
    lastUploadStatus: 0, lastUploadOk: false, uploadsActive: 0, uploadFinal: false,
    route: 'home',
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    fetch: (url, opts) => {
      if (opts && opts.method === 'POST') {
        const body = JSON.parse(opts.body);
        server.row = { code: body.code, data: JSON.parse(JSON.stringify(body.data)), updatedAt: new Date().toISOString() };
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, updatedAt: server.row.updatedAt }) });
      }
      const m = String(url).match(/code=([^&]*)/);
      const code = m ? decodeURIComponent(m[1]) : null;
      const row = server.row && server.row.code === code ? server.row : null;
      const snap = row ? { configured: true, data: JSON.parse(JSON.stringify(row.data)), updatedAt: row.updatedAt } : { configured: true, data: null, updatedAt: null };
      return Promise.resolve({ ok: true, status: 200, json: async () => snap });
    },
    document: { visibilityState: 'visible', getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], activeElement: null },
    render: () => {}, toast: () => {}, addEventListener: () => {},
  };
  sandbox.window = sandbox;
  Object.assign(sandbox, extra || {});
  const ctx = vm.createContext(sandbox);
  vm.runInContext(varText('LSKEY'), ctx);
  vm.runInContext(varText('SYNC_ALPHABET'), ctx);
  for (const marker of SYNC_FNS) loadInto(ctx, marker);
  return { ctx, store, server, run: (code) => vm.runInContext(code, ctx) };
}

/* ================= (F1) board shuffle ================= */

const BOARD_TOPICS = [
  { id: 'math-ntuc', sub: 'math', subName: 'Maths', name: 'NTUC FairPrice', moe: false, term: 1 },
  { id: 'eng-story', sub: 'english', subName: 'English', name: 'Story Time', moe: false, term: 1 },
  { id: 'chi-listen', sub: 'chinese', subName: 'Chinese', name: 'Listening', moe: false, term: 1 },
  { id: 'sci-plants', sub: 'science', subName: 'Science', name: 'Plants', moe: false, term: 1 },
  { id: 'math-fractions', sub: 'math', subName: 'Maths', name: 'Fractions', moe: true, term: 4 },
  { id: 'sci-magnets', sub: 'science', subName: 'Science', name: 'Magnets', moe: true, term: 4 },
];
const ALL_SUBS_PLAN = { rest: false, review: false, subs: ['math', 'english', 'chinese', 'science'] };
function boardContext(day) {
  const ctx = vm.createContext({ console });
  ctx._day = day;
  ctx.todayKey = function () { return ctx._day; };
  ctx.TOPICS = BOARD_TOPICS;
  loadInto(ctx, 'function schoolTermOf(dateKey){');
  loadInto(ctx, 'function moeInSeason(tp, todayStr){');
  loadInto(ctx, 'function boardInSeason(t){');
  loadInto(ctx, 'function planTopics(plan){');
  loadInto(ctx, 'function boardPicks(e, todayPlan){');
  return ctx;
}

test('F1: the shuffle increment survives save() and the board changes (the live bug)', () => {
  // The live failure: tapping "Show me different quests" never changed
  // the board, because swapIdx was in the defaults but never merged —
  // save() silently reverted the increment. Drive the REAL save() path.
  const { ctx, store, run } = makeSaveCtx();
  loadInto(ctx, 'function schoolTermOf(dateKey){');
  loadInto(ctx, 'function moeInSeason(tp, todayStr){');
  loadInto(ctx, 'function boardInSeason(t){');
  loadInto(ctx, 'function planTopics(plan){');
  loadInto(ctx, 'function boardPicks(e, todayPlan){');
  run("DB={explorers:[],parentPin:'2468',dailyLimit:90,playLimit:20,activeId:null,syncCode:'8SXU6S',updatedAt:null,flags:[],stageV:2};");
  run("var _e=newExplorer('Shuffle','🦊','P3'); _e.level='P3'; DB.explorers.push(_e); DB.activeId=_e.id; save();");
  run('TOPICS=' + JSON.stringify(BOARD_TOPICS) + ';');
  const before = run('boardPicks(ex(), ' + JSON.stringify(ALL_SUBS_PLAN) + ').map(function(t){return t.id;})');
  assert.equal(before.length, 3, 'three choices before the shuffle');
  // The shuffle handler, verbatim: increment, save, re-render.
  run('ex().swapIdx+=1; save();');
  assert.equal(run('ex().swapIdx'), 1, 'swapIdx is 1 after the shuffle + save (it used to revert to 0)');
  assert.equal(JSON.parse(store[LSKEY]).explorers[0].swapIdx, 1, 'the stored copy holds the increment too');
  const after = run('boardPicks(ex(), ' + JSON.stringify(ALL_SUBS_PLAN) + ').map(function(t){return t.id;})');
  assert.notDeepEqual(after, before, 'the board is a different set after one shuffle: ' + before.join(',') + ' -> ' + after.join(','));
  assert.equal(new Set(after).size, 3, 'the shuffled board is still three distinct topics');
});

test('F1: mergeExplorer carries swapIdx (max wins) and never invents it on a legacy explorer', () => {
  const { ctx, run } = makeSaveCtx();
  const merged = run(`mergeExplorer(
    {name:'A', completed:{}, completedDay:{}, progress:{}, swapIdx:0},
    {name:'A', completed:{}, completedDay:{}, progress:{}, swapIdx:3})`);
  assert.equal(merged.swapIdx, 3, 'the higher rotation wins the merge');
  const legacy = run(`mergeExplorer(
    {name:'A', completed:{}, completedDay:{}, progress:{}},
    {name:'A', completed:{}, completedDay:{}, progress:{}})`);
  assert.equal(legacy.swapIdx, undefined, 'a merge of two legacy explorers invents no swapIdx (no-change invariant)');
});

/* ================= (F2) completed quest stays on the board ================= */

test('F2: a quest completed today stays on the board as a done card with Replay', () => {
  const ctx = boardContext(TODAY);
  loadInto(ctx, 'function questState(e, topicId, dayKey){');
  // esc/ic are trivial one-liners; the esc regex contains a quote that
  // breaks brace extraction, so define them inline instead.
  vm.runInContext("function esc(s){ return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];}); }", ctx);
  vm.runInContext("function ic(src,emo,cls){ return src?'<img class=\"'+(cls||'ic-sm')+'\" src=\"'+src+'\" alt=\"\">':emo; }", ctx);
  loadInto(ctx, 'function boardCardHTML(e, t, isPick, todayPlan){');
  const e = { id: 'e-f2', completed: {}, completedDay: {}, progress: {}, swapIdx: 0 };
  const before = ctx.boardPicks(e, ALL_SUBS_PLAN).map(function (t) { return t.id; });
  assert.equal(before.length, 3, 'three choices before completing anything');
  const first = before[0];
  // Complete the first board quest today (5/5), exactly as the live check did.
  e.completed[first] = 1;
  e.completedDay[first] = TODAY;
  const after = ctx.boardPicks(e, ALL_SUBS_PLAN).map(function (t) { return t.id; });
  assert.ok(after.indexOf(first) >= 0, 'the just-finished quest is STILL on the board: ' + after.join(','));
  assert.equal(after.length, 3, 'the board is still three cards');
  assert.equal(new Set(after).size, 3, 'the three cards are distinct');
  // The rendered card for it is the greyed-out done card with Replay.
  const topic = BOARD_TOPICS.find(function (t) { return t.id === first; });
  const card = ctx.boardCardHTML(e, topic, false, ALL_SUBS_PLAN);
  assert.ok(card.includes('✔ Done today'), 'the card says Done today');
  assert.ok(card.includes('streak safe'), 'the card says the streak is safe');
  assert.ok(card.includes('↻ Replay this quest'), 'the card offers Replay');
  assert.ok(card.includes('data-quest="' + first + '"'), 'the Replay button starts the same quest');
  assert.ok(card.includes('5 / 5'), 'the card shows 5 / 5');
});

test('F2: a quest finished on a PREVIOUS day leaves the board (fresh set lives in Learn)', () => {
  const ctx = boardContext(TODAY);
  const e = { id: 'e-f2b', completed: {}, completedDay: {}, progress: {}, swapIdx: 0 };
  const first = ctx.boardPicks(e, ALL_SUBS_PLAN)[0].id;
  e.completed[first] = 1;
  e.completedDay[first] = '2026-11-09'; // yesterday
  const picks = ctx.boardPicks(e, ALL_SUBS_PLAN).map(function (t) { return t.id; });
  assert.ok(picks.indexOf(first) < 0, 'a yesterday-finished quest is not on today\'s board');
  assert.equal(picks.length, 3, 'the board still offers three choices');
});

/* ================= (F3) difficulty preference shapes the next quest ================= */

// A topic with genuinely different P3 and P4 banks (the app only splits
// levels at P4). Uses the REAL sci-magnet banks from public/index.html,
// so the test proves the content changes, not just a flag.
function diffQuestContext() {
  const S = { _day: TODAY, _explorer: null, goCalls: [], persisted: 0 };
  const sandbox = {
    console, setTimeout, clearTimeout, JSON, Object, Array, Math, Date, Promise,
    todayKey: function () { return S._day; },
    SB_COUNT: 5, LIVE_GEN_COUNT: 5, LIVE_GEN_TOPIC: '__none__', diffBankCache: {},
    liveGenFetchState: { status: 'idle', reason: null },
    ex: function () { return S._explorer; },
    levelNum: function (e) { return (e && e.level) ? parseInt(String(e.level).replace('P', ''), 10) : 3; },
    toast: function () {}, render: function () {}, save: function () {},
    go: function (r) { S.goCalls.push(r); },
    persistProgress: function () {
      S.persisted++;
      const c = vm.runInContext('cur', ctx);
      const e = S._explorer;
      if (!e || !c || c.phase !== 'quest') return;
      e.progress[c.topicId] = { idx: c.idx, score: c.score, wrong: c.wrong, picked: c.picked, answered: c.answered, pool: c.pool, fresh: !!c.fresh, elapsed: 0, diffSwap: (c.diffSwap || {}) };
    },
    sbUsable: function () { return { source: 'bank' }; },
    fetchServerBankQuestions: function () { return null; },
    liveGenUsable: function () { return { source: 'none' }; },
    recordLiveGenStat: function () {},
    fetch: function () { return Promise.resolve({ ok: false, json: async () => null }); },
    syncKey: function () { return 'ABCDEF'; },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  loadInto(ctx, 'function Q(q,o,a,c,j){');
  loadInto(ctx, 'var TOPICS=[');
  vm.runInContext('function topicById(id){ return TOPICS.find(function(t){return t.id===id;})||null; }', ctx);
  [
    'function bankFor(t, kind, level){', 'function isFibQuestion(q){',
    'function fibExpected(q){', 'function fibAccepts(q){',
    'function sbNormalizeQuestion(q){', 'function sbShapeOk(questions){',
    'function diffQuestionId(q){', 'function diffIsExcluded(q, excludeIds){',
    'function diffQuestionFor(t, level, shift, excludeIds){',
    'function diffSwapAt(c, t, level, idx, shift){',
    'function diffSwapNext(c, t, level){',
    'function questListFor(t, c, level){',
    'function hashStr(s){', 'function seededShuffle(',
    'function poolQuestions(t,', 'function optsShuffled(q, seed){',
    'function rotateIndices(n, dayStr, salt, take){',
    'function dailyPoolIndices(t, dayStr, salt, level){',
    'function beginQuest(topicId){',
  ].forEach(function (m) { try { loadInto(ctx, m); } catch (e) { /* poolQuestions is loaded twice on purpose (two markers) */ } });
  return { ctx, S };
}
function beginQuestIn(dq, level, diffPref, topicId) {
  const { ctx, S } = dq;
  S._explorer = { id: 'e-f3', level: level, diffPref: diffPref, diffPrefAt: diffPref ? '2026-11-10T00:00:00.000Z' : null, progress: {}, completed: {}, completedDay: {} };
  vm.runInContext("beginQuest('" + topicId + "')", ctx);
  const cur = vm.runInContext('cur', ctx);
  const list = vm.runInContext("questListFor(TOPICS.find(function(t){return t.id==='" + topicId + "';}), cur, " + level + ")", ctx);
  return { cur, q: list.slice(0, 3).map(function (x) { return x.q; }) };
}

test('F3: a quest started after "Too hard" draws easier questions (real beginQuest)', () => {
  const dq = diffQuestContext();
  const topic = vm.runInContext("TOPICS.find(function(t){return t.id==='sci-magnet';})", dq.ctx);
  const p3Bank = topic.quest.map(function (q) { return q.q; });
  const p4Bank = topic.p4quest.map(function (q) { return q.q; });
  // Control: a P4 quest with no preference — only Q1 is gentler (P3), Q2/Q3 stay P4.
  const ctrl = beginQuestIn(dq, 4, 0, 'sci-magnet');
  assert.ok(p3Bank.indexOf(ctrl.q[0]) >= 0, 'control Q1 is the gentle P3 opener');
  assert.ok(p4Bank.indexOf(ctrl.q[1]) >= 0 && p4Bank.indexOf(ctrl.q[2]) >= 0, 'control Q2/Q3 are the normal P4 questions');
  // After "Too hard": the first three questions are all from the P3 bank.
  const hard = beginQuestIn(dq, 4, -1, 'sci-magnet');
  assert.equal(hard.cur.diffShift, -1, 'the quest runs one level easier');
  assert.equal(hard.cur.hintForIdx, 0, 'Pip hints first on Q1 when starting easier');
  hard.q.forEach(function (text, i) {
    assert.ok(p3Bank.indexOf(text) >= 0, 'question ' + (i + 1) + ' is an easier P3 question: ' + text);
  });
  assert.ok(hard.q[1] !== ctrl.q[1] && hard.q[2] !== ctrl.q[2], 'Q2 and Q3 genuinely differ from the control (the live failure was Q1–Q3 identical)');
  assert.equal(Object.keys(hard.cur.diffSwap).length, 3, 'three questions were swapped, not just the first');
});

test('F3: a quest started after "Too easy" draws harder questions (real beginQuest)', () => {
  const dq = diffQuestContext();
  const topic = vm.runInContext("TOPICS.find(function(t){return t.id==='sci-magnet';})", dq.ctx);
  const p3Bank = topic.quest.map(function (q) { return q.q; });
  const p4Bank = topic.p4quest.map(function (q) { return q.q; });
  const ctrl = beginQuestIn(dq, 3, 0, 'sci-magnet');
  ctrl.q.forEach(function (text, i) {
    assert.ok(p3Bank.indexOf(text) >= 0, 'control P3 question ' + (i + 1) + ' is a P3 question');
  });
  const easy = beginQuestIn(dq, 3, 1, 'sci-magnet');
  assert.equal(easy.cur.diffShift, 1, 'the quest runs one level harder');
  assert.equal(easy.cur.hintForIdx, null, 'no forced hint on a harder start');
  easy.q.forEach(function (text, i) {
    assert.ok(p4Bank.indexOf(text) >= 0, 'question ' + (i + 1) + ' is a harder P4 question: ' + text);
  });
  assert.ok(easy.q[0] !== ctrl.q[0] && easy.q[1] !== ctrl.q[1], 'the harder quest differs from the control from Q1 on');
});

/* ================= (F4) Critter Friend badge — full save→reload cycle ================= */

function critterContext() {
  // Fake stage buttons: bindCritter attaches onclick handlers to them,
  // exactly as the real page does. render() is a NO-OP here on purpose —
  // the test proves the handler works even when bindCritter is NOT
  // re-run between taps (the live failure: only the first tap stuck).
  const stageButtons = [0, 1, 2, 3].map(function (i) {
    return {
      _stage: String(i), onclick: null,
      getAttribute: function (name) { return name === 'data-stage' ? this._stage : null; },
    };
  });
  const toasts = [];
  const extra = {
    critterView: null, critterViewFor: null, careMsg: null, careFx: null, selCritter: null,
    route: 'critter',
    // bindCritter's frog-drag / idle-timer globals (line ~13723) — the
    // test never drags the frog, but bindCritter wires the handlers up.
    frogPos: { x: 50, y: 56 }, pondMode: null, dirtLeft: null, playTimer: null,
    playPointerHandler: null, frogTimer: null, frogBubbleTimer: null,
    frogDragging: false, frogDragMoved: false, frogDownX: 0, frogDownY: 0,
    frogPausedUntil: 0, frogDragHandler: null, frogDragUpHandler: null, frogHover: false,
    setInterval: function () { return 0; }, clearInterval: function () {},
    placeFrog: function () {}, spawnDirt: function () {}, startPlayMode: function () {}, frogTap: function () {},
    document: {
      visibilityState: 'visible', activeElement: null,
      addEventListener: function () {}, removeEventListener: function () {},
      getElementById: () => null,
      querySelectorAll: (sel) => (sel === '[data-stage]' ? stageButtons : []),
    },
    render: () => {},
    toast: (m) => { toasts.push(m); },
    sndPop: () => {}, sndCorrect: () => {}, sndWrong: () => {},
    confettiStars: () => {},
  };
  const made = makeSaveCtx(extra);
  const { ctx, run } = made;
  // bindCritter's own globals + the badge award path.
  loadInto(ctx, 'function awardBadge(id,label){');
  loadInto(ctx, 'function bindCritter(){');
  return { ctx, store: made.store, server: made.server, run, stageButtons, toasts };
}

test('F4: tapping all four stages awards the badge AND it survives a reload (real bindCritter)', () => {
  const cc = critterContext();
  const { ctx, store, run, stageButtons, toasts } = cc;
  run("DB={explorers:[],parentPin:'2468',dailyLimit:90,playLimit:20,activeId:null,syncCode:'8SXU6S',updatedAt:null,flags:[],stageV:2};");
  run("var _e=newExplorer('Badge','🦊','P3'); _e.level='P3'; DB.explorers.push(_e); DB.activeId=_e.id; save();");
  run('bindCritter();');
  // Tap all four stages, one at a time, WITHOUT re-binding between taps.
  stageButtons.forEach(function (b, i) {
    assert.equal(typeof b.onclick, 'function', 'stage button ' + i + ' has a handler');
    b.onclick();
    const stored = JSON.parse(store[LSKEY]).explorers[0];
    assert.deepEqual(stored.visitedStages.slice().sort(), [0, 1, 2, 3].slice(0, i + 1).sort(), 'after tap ' + i + ' the stored visitedStages hold every stage tapped so far');
  });
  assert.deepEqual(run('ex().visitedStages.slice().sort()'), [0, 1, 2, 3], 'all four stages are recorded in memory');
  assert.ok(run("ex().badges.indexOf('critter')>=0"), 'the 🐸 Critter Friend badge is awarded');
  assert.ok(toasts.some(function (m) { return m.indexOf('Critter Friend') >= 0; }), 'a badge toast fired: ' + toasts.join(' | '));
  // Reload: re-read from localStorage, exactly as the app does on reopen.
  run('load();');
  assert.deepEqual(run('ex().visitedStages.slice().sort()'), [0, 1, 2, 3], 'visitedStages survive the reload');
  assert.ok(run("ex().badges.indexOf('critter')>=0"), 'the badge survives the reload');
});

test('F4: the badge re-check awards it when the visits already persisted', () => {
  const cc = critterContext();
  const { run } = cc;
  run("DB={explorers:[],parentPin:'2468',dailyLimit:90,playLimit:20,activeId:null,syncCode:'8SXU6S',updatedAt:null,flags:[],stageV:2};");
  run("var _e=newExplorer('Recheck','🦊','P3'); _e.level='P3'; _e.visitedStages=[0,1,2,3]; DB.explorers.push(_e); DB.activeId=_e.id; save();");
  assert.ok(run("ex().badges.indexOf('critter')<0"), 'no badge yet (the visits persisted but the award never fired)');
  run('bindCritter();');
  assert.ok(run("ex().badges.indexOf('critter')>=0"), 'opening Critter Lab awards the badge for the already-complete set');
  assert.ok(cc.toasts.some(function (m) { return m.indexOf('Critter Friend') >= 0; }), 'the badge toast fires on the re-check');
});

test('F4: Critter Lab shows visited stages (source check on the render)', () => {
  const src = extractBlock('function critterHTML(){');
  assert.ok(src.includes('visitedStages'), 'Critter Lab reads visitedStages when rendering');
  assert.ok(src.includes("✔"), 'visited stages are marked with a tick');
  assert.ok(src.includes('Visited ') && src.includes('of 4 stages'), 'the lab shows how many stages have been visited');
  assert.ok(src.includes('Critter Friend badge earned'), 'the lab celebrates the completed set');
});
