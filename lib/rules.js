// Models explain, code decides — plain, tested scoring rules.
// NOTHING here calls a model. Pip explains; these functions decide
// every mark, star and badge. If a rule changes, change it here and
// add a test in tests/rules.test.js — never hide scoring in prose.
'use strict';

const QUEST_TOTAL = 5;
const BADGES = {
  first: '🌟 First Quest',
  perfect: '💯 Perfect Quest',
  brave: '🦁 Brave Tryer',
  comeback: '🏆 Comeback Kid',
  critter: '🐸 Critter Friend',
  player: '🎮 Arcade Star',
  spotter: '🔍 Critter Spotter',
  naturalist: '🌿 Young Naturalist',
};

function clampInt(n, lo, hi) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(lo, Math.min(hi, v));
}

// 1 star per correct answer in a 5-question quest. No partial credit,
// no model judgement, no bonus stars for speed.
function questStars(score, total = QUEST_TOTAL) {
  return clampInt(score, 0, total);
}
function gameStars(score, rounds) {
  return clampInt(score, 0, rounds || 6);
}
// Exit Parking: 3 stars at par, 2 at par+2, 1 beyond — the same
// rule the page's parkLevelStars uses.
function parkLevelStars(moves, par) {
  return moves <= par ? 3 : (moves <= par + 2 ? 2 : 1);
}
// A level's stars bank once per level per day. Levels are won in
// order, so one counter (starBanked = levels banked today) is
// enough; a new day resets it. A same-day replay banks nothing
// extra. The page carries the same function — change both.
function parkStarsToBank(levelIdx, moves, par, starDay, starBanked, today) {
  const stars = parkLevelStars(moves, par);
  const banked = starDay === today ? (starBanked || 0) : 0;
  if (levelIdx < banked) return { bank: 0, starBanked: banked, starDay: today };
  return { bank: stars, starBanked: levelIdx + 1, starDay: today };
}
function isPerfect(score, total = QUEST_TOTAL) {
  return clampInt(score, 0, total) === total && total > 0;
}
function isStuck(score, total = QUEST_TOTAL) {
  return clampInt(score, 0, total) < 3; // under 3/5 counts as stuck
}
// A topic only counts as stuck after TWO separate stuck runs.
function stuckAfterRuns(runs) {
  return (runs || []).filter((s) => isStuck(s)).length >= 2;
}
// Pip's Boost retakes (2026-11-08): a Maths topic may be drilled
// again the same day until the flag clears — each retake draws fresh
// questions, so it is real practice, not memory. Every other subject
// gets one drill per topic per day: the child waits until tomorrow.
// The page carries the same function — change both.
function boostRetakeAllowed(isMaths, lastBoostDay, today) {
  if (isMaths) return true;
  return (lastBoostDay || '') !== today;
}
// How many boost drills this explorer has finished on this topic
// today (0 when the counter is from another day or missing). The
// count seeds the bank draw, so a same-day Maths retake draws
// different questions. The page carries the same function.
function boostTriesToday(rec, today) {
  if (!rec || rec.triesDay !== today) return 0;
  return rec.tries || 0;
}

// Badges a quest finish earns, given the badges already held.
// Pure function: same inputs always give the same badges.
function questBadges(score, total, held) {
  const have = new Set(held || []);
  const out = [];
  if (!have.has('first')) out.push('first');
  if (isPerfect(score, total) && !have.has('perfect')) out.push('perfect');
  return out;
}
function retryBadges(retryScore, retryTotal, held) {
  const have = new Set(held || []);
  const out = [];
  if (!have.has('brave')) out.push('brave'); // starting Second Chance
  if (retryScore >= Math.ceil((retryTotal || 3) / 2) && !have.has('comeback')) out.push('comeback');
  return out;
}
function critterBadges(discoveredCount, held) {
  const have = new Set(held || []);
  const out = [];
  if (discoveredCount >= 5 && !have.has('spotter')) out.push('spotter');
  if (discoveredCount >= 12 && !have.has('naturalist')) out.push('naturalist');
  return out;
}

// Treasure: unlock only if stars >= cost; unlocking deducts exactly cost.
function canUnlock(stars, cost) { return stars >= cost; }
function starsAfterUnlock(stars, cost) { return canUnlock(stars, cost) ? stars - cost : stars; }

// Daily rotation (requested 2026-11-07): a finished quest must NOT
// repeat yesterday's questions. The old rule drew 5 at random from
// the pool, so two days in a row shared ~2 questions — and a topic
// with only 5 questions in its pool repeated all 5, every day.
// The rule now splits the pool into fixed groups and rotates one
// group per day: consecutive days are always disjoint, and with a
// 15-question pool the same group only returns after 3 days.
// Same (topic, date, poolSize) always gives the same set, so a
// test can prove it. A pool that holds exactly one set cannot
// rotate — its order still varies by day, and the bank must grow.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function dayNumber(dateStr) {
  const p = String(dateStr).split('-');
  return Math.floor(Date.UTC(+p[0], (+p[1] || 1) - 1, +p[2] || 1) / 86400000);
}
function shuffleWith(arr, seedStr) {
  const a = arr.slice();
  let seed = hashStr(seedStr);
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function rotateIndices(n, dateStr, salt, count) {
  if (n <= 0) return [];
  const take = Math.min(count, n);
  const all = [];
  for (let i = 0; i < n; i++) all.push(i);
  if (n <= take) return shuffleWith(all, salt + '|' + dateStr).slice(0, take);
  const order = shuffleWith(all, salt + '|pool');
  const groups = Math.ceil(n / take);
  const g = dayNumber(dateStr) % groups;
  let set = order.slice(g * take, g * take + take);
  if (set.length < take) set = set.concat(order.slice(0, take - set.length));
  return shuffleWith(set, salt + '|' + dateStr);
}
function dailyFreshIndices(topicId, dateStr, poolSize, count = 5) {
  return rotateIndices(poolSize, dateStr, topicId, count);
}
function dailyWarmIndices(topicId, dateStr, warmSize, count = 4) {
  return rotateIndices(warmSize, dateStr, topicId + '|warm', count);
}
// Second Chance (retry): a fresh random draw from the retry bank
// every time, so no retry repeats the last one. Seeded by the
// caller (Date.now() in the app) — same seed, same draw.
function retryIndices(retrySize, seed, count = 3) {
  if (retrySize <= 0) return [];
  const take = Math.min(count, retrySize);
  const all = [];
  for (let i = 0; i < retrySize; i++) all.push(i);
  return shuffleWith(all, 'retry|' + seed).slice(0, take);
}
function prevDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  QUEST_TOTAL, BADGES, questStars, gameStars, isPerfect, isStuck,
  stuckAfterRuns, boostRetakeAllowed, boostTriesToday, questBadges, retryBadges, critterBadges, parkLevelStars, parkStarsToBank,
  canUnlock, starsAfterUnlock, hashStr, dailyFreshIndices, dailyWarmIndices, retryIndices, prevDate,
};
