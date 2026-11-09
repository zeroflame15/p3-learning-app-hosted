// SERVER BANK — all topics. Pure selection +
// transition logic: no fetch, no env, no Supabase. The HTTP
// endpoints (api/daily-set.js, api/report-answers.js) are thin
// wrappers around these functions; the client mirrors the cache half
// in public/index.html. "Code decides" (see lib/rules.js): the rules
// below are the tested model — change a rule here AND in the page,
// with tests.
//
// How a set is built (per explorer, per topic, per day):
//   1. Due questions first, oldest first — a question answered wrong
//      comes back before anything new is introduced.
//   2. Then fresh questions in a day-seeded shuffle. The seed uses
//      the same inputs as the page's daily rotation (explorer id +
//      topic id + day), so a lost client cache re-serves the same set
//      for the day.
//   3. Mastered questions never reach this function — the endpoint
//      excludes them. A question answered correctly is done: it is
//      never served again. A question served but never reported stays
//      'served' on the server and is eligible again as fresh — a
//      quit mid-quest simply re-serves it another day.
'use strict';

const SB_TOPIC = 'math-ntuc';
const SB_COUNT = 5;
// Only quest-pool kinds are served as quest questions. Warm/retry
// rows exist in the table (seeded for later use) but are never
// served in the pilot: warm-up stays bank, and warm questions are
// too short (and often have no explanation) to play as a quest.
const SB_SERVABLE_KINDS = ['quest', 'fresh'];

// FILL-IN-THE-BLANK (FIB) QUESTIONS — encoding inside the existing
// columns (NO schema change: `answer` is int NOT NULL and cannot
// hold text, and sub_topic must keep holding the bank kind
// 'quest'/'fresh'/'warm'/'retry').
//   MCQ row: options = ["18","20","24","30"] (jsonb ARRAY of 4
//     strings), answer = the index of the right option (0-3).
//   FIB row: options = {"kind":"fib","answer":"42","accept":[...]}
//     (jsonb OBJECT; "answer" is the expected typed answer as text,
//     "accept" is an optional list of alternate accepted answers),
//     answer = 0 (sentinel — unused, but the column is NOT NULL).
// A row is FIB iff options is a non-array object with kind 'fib'
// and a non-empty string answer; a row is MCQ iff options is an
// array of 4 strings and answer is an int 0-3. Anything else is
// malformed (sbKindOf returns null) and is never served: daily-set
// filters it out of the pool, so one bad row cannot sink a set.
// The client is told the format per question (k:'fib'|'mcq', plus
// ans/accept for FIB) by sbClientQuestion / api/daily-set.js.
function sbKindOf(row) {
  if (!row || typeof row !== 'object') return null;
  var o = row.options;
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    if (o.kind === 'fib' && typeof o.answer === 'string' && o.answer.trim().length > 0) return 'fib';
    return null;
  }
  if (Array.isArray(o) && o.length === 4 && o.every(function (x) { return typeof x === 'string'; })
    && typeof row.answer === 'number' && row.answer >= 0 && row.answer <= 3 && Math.floor(row.answer) === row.answer) return 'mcq';
  return null;
}

// sbFibAnswer(row): the expected typed answer for a FIB row
// (trimmed), or null for an MCQ / malformed row.
function sbFibAnswer(row) {
  if (sbKindOf(row) !== 'fib') return null;
  return row.options.answer.trim();
}

// sbClientQuestion(row): a Supabase sb_questions row -> the client
// question object daily-set returns. MCQ: {id,q,o:[4],a:idx,c,j,
// k:'mcq'}. FIB: {id,q,o:[],a:0,c,j,k:'fib',ans,accept} — o/a are
// unused sentinels (the renderer never reads options for a FIB
// question; the expected answer rides in ans). Malformed rows
// return null and are filtered out by the caller.
function sbClientQuestion(row) {
  var kind = sbKindOf(row);
  if (!kind) return null;
  var out = { id: row.id, q: row.stem, c: row.explanation || '', j: row.joke || '', k: kind };
  if (kind === 'fib') {
    var accept = Array.isArray(row.options.accept)
      ? row.options.accept.filter(function (a) { return typeof a === 'string' && a.trim().length > 0; })
      : [];
    out.o = []; out.a = 0; out.ans = row.options.answer.trim(); out.accept = accept;
    return out;
  }
  out.o = row.options.slice(); out.a = row.answer;
  return out;
}

// sbKindOfAny(item): the format of a question in EITHER shape — a
// raw Supabase row (.options), a client question (.k, or a raw
// {kind:'fib'} .o object), or a plain MCQ object. Unknown shapes
// default to 'mcq': only an explicit FIB marker makes a FIB.
function sbKindOfAny(item) {
  if (!item || typeof item !== 'object') return 'mcq';
  if (item.k === 'fib') return 'fib';
  if (item.k === 'mcq') return 'mcq';
  if (item.options !== undefined) { var k = sbKindOf(item); return k || 'mcq'; }
  if (item.o && typeof item.o === 'object' && !Array.isArray(item.o) && item.o.kind === 'fib') return 'fib';
  return 'mcq';
}

// sbInterleaveKinds(arr): merge a shuffled list so FIB and MCQ
// alternate instead of grouping — the longer kind goes first, then
// they strictly alternate until one kind runs out (the tail is
// unavoidably one kind). Order inside each kind is preserved.
function sbInterleaveKinds(arr) {
  var mcq = [], fib = [];
  (arr || []).forEach(function (item) { (sbKindOfAny(item) === 'fib' ? fib : mcq).push(item); });
  var out = [], takeFib = fib.length >= mcq.length;
  while (mcq.length || fib.length) {
    if (takeFib && fib.length) out.push(fib.shift());
    else if (!takeFib && mcq.length) out.push(mcq.shift());
    else if (fib.length) out.push(fib.shift());
    else out.push(mcq.shift());
    takeFib = !takeFib;
  }
  return out;
}

// Same FNV-1a hash + LCG shuffle as the page's hashStr /
// seededShuffle, copied so the server picks deterministically
// without the page. Pinned by tests/server-bank.test.js, which runs
// the same vectors against the page's own functions.
function sbHash(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function sbShuffle(arr, seed) {
  var a = arr.slice(), s = (seed >>> 0) || 1;
  function rnd() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
  return a;
}

// sbDaySeed(explorerId, topicId, day): the shuffle seed for a day's
// fresh draw — the same inputs as the page's daily rotation
// (rotateIndices salts with explorerId|topicId and the day).
function sbDaySeed(explorerId, topicId, day) {
  return sbHash(String(explorerId) + '|' + String(topicId) + '|' + String(day));
}

// pickSet({due, fresh, count, seed}): due first, in the order given
// (the caller sorts oldest-due first), then fresh in a day-seeded
// shuffle, interleaved by format (FIB/MCQ alternate). Returns {questions, dueCount, freshCount}; questions is
// at most count long, fewer if the pool is short. Due + fresh are
// never mutated.
function pickSet(input) {
  var due = Array.isArray(input && input.due) ? input.due.slice() : [];
  var fresh = Array.isArray(input && input.fresh) ? input.fresh.slice() : [];
  var count = (input && typeof input.count === 'number' && input.count > 0) ? Math.floor(input.count) : SB_COUNT;
  var seed = (input && typeof input.seed === 'number') ? input.seed : 1;
  var picked = due.slice(0, count);
  var dueCount = picked.length;
  var need = count - picked.length;
  // The fresh draw is interleaved by format (FIB/MCQ alternating)
  // after the day-seeded shuffle, so a mixed pool serves a mixed
  // set instead of all-MCQ-then-all-FIB. Due questions keep their
  // place first (oldest first) — due-first outranks interleaving,
  // so a set that is all-due of one kind is still grouped.
  if (need > 0) picked = picked.concat(sbInterleaveKinds(sbShuffle(fresh, seed)).slice(0, need));
  return { questions: picked, dueCount: dueCount, freshCount: picked.length - dueCount };
}

// nextStatus({was, correct}): the only transitions. Correct ->
// 'mastered' (done, never served again); wrong -> 'due' (recycled
// in a future set, oldest first). `was` is accepted for symmetry
// with the stored record but does not change the outcome: even a
// question that was somehow mastered and then answered wrong
// re-opens as due — a wrong answer is never ignored.
function nextStatus(input) {
  return (input && input.correct) ? 'mastered' : 'due';
}

module.exports = {
  SB_TOPIC,
  SB_COUNT,
  SB_SERVABLE_KINDS,
  sbHash,
  sbShuffle,
  sbDaySeed,
  pickSet,
  nextStatus,
  sbKindOf,
  sbFibAnswer,
  sbClientQuestion,
  sbKindOfAny,
  sbInterleaveKinds,
};
