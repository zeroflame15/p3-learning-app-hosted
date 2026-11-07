// SERVER BANK — PILOT (one topic: math-ntuc). Pure selection +
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
// shuffle. Returns {questions, dueCount, freshCount}; questions is
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
  if (need > 0) picked = picked.concat(sbShuffle(fresh, seed).slice(0, need));
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
};
