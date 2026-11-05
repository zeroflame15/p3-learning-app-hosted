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

// Deterministic daily fresh set: 5 unique indices from a pool, different
// from yesterday's set for the same topic. Pure — same (topic, date,
// poolSize) always gives the same set, so a test can prove it.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function dailyFreshIndices(topicId, dateStr, poolSize, count = 5) {
  if (poolSize <= 0) return [];
  const n = Math.min(count, poolSize);
  let seed = hashStr(topicId + '#' + dateStr);
  const idx = [];
  const seen = new Set();
  let guard = 0;
  while (idx.length < n && guard++ < 1000) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const v = seed % poolSize;
    if (!seen.has(v)) { seen.add(v); idx.push(v); }
  }
  // If yesterday's set is identical, rotate by one so a finished quest
  // never just repeats yesterday.
  const prev = dailyFreshIndicesRaw(topicId, prevDate(dateStr), poolSize, count);
  if (idx.length === prev.length && idx.every((v, i) => v === prev[i])) {
    return idx.map((v) => (v + 1) % poolSize);
  }
  return idx;
}
function dailyFreshIndicesRaw(topicId, dateStr, poolSize, count = 5) {
  if (poolSize <= 0) return [];
  const n = Math.min(count, poolSize);
  let seed = hashStr(topicId + '#' + dateStr);
  const idx = []; const seen = new Set(); let guard = 0;
  while (idx.length < n && guard++ < 1000) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const v = seed % poolSize;
    if (!seen.has(v)) { seen.add(v); idx.push(v); }
  }
  return idx;
}
function prevDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Warm-up must never repeat a quest question: compare normalised wording.
function normWord(w) { return String(w || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, ''); }
function warmupOverlapsQuest(warmQs, questQs) {
  const questWords = new Set();
  (questQs || []).forEach((q) => String(q.q || q).split(/\s+/).forEach((w) => questWords.add(normWord(w))));
  const overlaps = [];
  (warmQs || []).forEach((q, i) => {
    const words = String(q.q || q).split(/\s+/).map(normWord).filter((w) => w.length > 3);
    const shared = words.filter((w) => questWords.has(w));
    if (shared.length >= 3) overlaps.push({ warmIndex: i, shared: shared.slice(0, 5) });
  });
  return overlaps;
}

module.exports = {
  QUEST_TOTAL, BADGES, questStars, gameStars, isPerfect, isStuck,
  stuckAfterRuns, questBadges, retryBadges, critterBadges,
  canUnlock, starsAfterUnlock, hashStr, dailyFreshIndices, prevDate,
  normWord, warmupOverlapsQuest,
};
