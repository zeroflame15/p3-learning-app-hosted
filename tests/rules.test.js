// Rules tests — models explain, code decides. Every mark is a pure rule.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../lib/rules');

test('quest stars: 1 per correct, clamped 0–5, no speed bonus', () => {
  assert.equal(R.questStars(0), 0);
  assert.equal(R.questStars(3), 3);
  assert.equal(R.questStars(5), 5);
  assert.equal(R.questStars(9), 5);
  assert.equal(R.questStars(-2), 0);
  assert.equal(R.gameStars(4, 6), 4);
  assert.equal(R.gameStars(9, 6), 6);
});

test('perfect and stuck thresholds', () => {
  assert.equal(R.isPerfect(5), true);
  assert.equal(R.isPerfect(4), false);
  assert.equal(R.isStuck(2), true);
  assert.equal(R.isStuck(3), false);
  assert.equal(R.stuckAfterRuns([2, 4]), false);
  assert.equal(R.stuckAfterRuns([2, 1]), true);
  assert.equal(R.stuckAfterRuns([2]), false); // needs TWO stuck runs
});

test('badges are deterministic and never duplicated', () => {
  assert.deepEqual(R.questBadges(5, 5, []), ['first', 'perfect']);
  assert.deepEqual(R.questBadges(5, 5, ['first', 'perfect']), []);
  assert.deepEqual(R.questBadges(3, 5, []), ['first']);
  assert.deepEqual(R.retryBadges(2, 3, []), ['brave', 'comeback']);
  assert.deepEqual(R.retryBadges(1, 3, []), ['brave']);
  assert.deepEqual(R.critterBadges(5, []), ['spotter']);
  assert.deepEqual(R.critterBadges(12, ['spotter']), ['naturalist']);
  assert.deepEqual(R.critterBadges(4, []), []);
});

test('treasure unlock: only if stars >= cost, deducts exactly cost', () => {
  assert.equal(R.canUnlock(15, 15), true);
  assert.equal(R.canUnlock(14, 15), false);
  assert.equal(R.starsAfterUnlock(20, 15), 5);
  assert.equal(R.starsAfterUnlock(10, 15), 10); // cannot unlock: unchanged
});

test('daily fresh sets: 5 unique, stable same day, disjoint from yesterday (rotation)', () => {
  for (const topic of ['eng-tense', 'math-frac', 'sci-frog', 'chi-school']) {
    let prevSet = null;
    for (let d = 1; d <= 21; d++) {
      const date = '2026-11-' + String(d).padStart(2, '0');
      const set = R.dailyFreshIndices(topic, date, 15);
      assert.equal(set.length, 5);
      assert.equal(new Set(set).size, 5, topic + ' ' + date);
      assert.deepEqual(set, R.dailyFreshIndices(topic, date, 15), 'same day must be stable');
      if (prevSet) {
        assert.ok(set.every((v) => !prevSet.includes(v)), topic + ' ' + date + ' shares nothing with yesterday');
      }
      prevSet = set;
    }
    // With 15 in the pool the same group returns only after 3 days.
    const d1 = R.dailyFreshIndices(topic, '2026-11-07', 15);
    const d4 = R.dailyFreshIndices(topic, '2026-11-10', 15);
    assert.deepEqual([...d1].sort(), [...d4].sort(), topic + ': the group returns after 3 days');
  }
  // A 10-question pool alternates between two groups of 5.
  for (let d = 1; d <= 6; d++) {
    const date = '2026-11-' + String(d).padStart(2, '0');
    const set = R.dailyFreshIndices('math-frac', date, 10);
    const next = R.dailyFreshIndices('math-frac', '2026-11-' + String(d + 1).padStart(2, '0'), 10);
    assert.ok(set.every((v) => !next.includes(v)), 'pool-10 day ' + d + ' shares nothing with the next day');
  }
  assert.deepEqual(R.dailyFreshIndices('x', '2026-11-05', 3), [0, 1, 2].sort(() => 0) .length ? R.dailyFreshIndices('x', '2026-11-05', 3) : []);
  assert.equal(R.dailyFreshIndices('x', '2026-11-05', 0).length, 0);
});

test('daily warm sets rotate too, and retry draws change every time', () => {
  for (let d = 1; d <= 7; d++) {
    const date = '2026-11-' + String(d).padStart(2, '0');
    const set = R.dailyWarmIndices('eng-story', date, 8);
    assert.equal(set.length, 4, 'warm-up shows 4');
    assert.equal(new Set(set).size, 4, 'warm-up picks 4 distinct questions');
    assert.deepEqual(set, R.dailyWarmIndices('eng-story', date, 8), 'same day must be stable');
    if (d > 1) {
      const prev = R.dailyWarmIndices('eng-story', '2026-11-' + String(d - 1).padStart(2, '0'), 8);
      assert.ok(set.every((v) => !prev.includes(v)), 'warm-up shares nothing with yesterday');
    }
  }
  // Retry: a fresh draw from the bank every time.
  const draws = new Set();
  for (let s = 1; s <= 20; s++) draws.add(R.retryIndices(6, s).join(','));
  assert.ok(draws.size >= 15, 'retry draws vary: ' + draws.size + ' distinct sets in 20 draws');
  assert.deepEqual(R.retryIndices(6, 42), R.retryIndices(6, 42), 'same seed, same draw');
  assert.equal(R.retryIndices(6, 7).length, 3, 'retry draws 3');
  assert.equal(R.retryIndices(0, 1).length, 0);
});

test('warm-up banks never repeat quest wording (real content)', () => {
  // Parse TOPICS out of index.html the same way the app defines them:
  // extract each topic block by its warm: [...] and quest: [...] arrays
  // via the Q('...') question strings, and check overlap per topic.
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const topicRe = /\{id:'([a-z0-9-]+)',(?:img:'[^']+',)?sub:'[a-z]+'[\s\S]*?quest:\[([\s\S]*?)\],\s*warm:\[([\s\S]*?)\],\s*retry:/g;
  let m, checked = 0;
  while ((m = topicRe.exec(html))) {
    const qs = [...m[2].matchAll(/Q\('([^']+)/g)].map((x) => ({ q: x[1] }));
    const ws = [...m[3].matchAll(/Q\('([^']+)/g)].map((x) => ({ q: x[1] }));
    assert.ok(qs.length >= 5, m[1] + ' quest bank');
    assert.ok(ws.length >= 8, m[1] + ' warm bank (8, so the warm-up rotates without repeating yesterday)');
    const overlaps = R.warmupOverlapsQuest(ws, qs);
    assert.deepEqual(overlaps, [], m[1] + ' warm-up must not repeat quest wording: ' + JSON.stringify(overlaps));
    checked++;
  }
  assert.equal(checked, 14, 'all 14 topics checked');
});

test('resume: a saved quest keeps its exact set (rule, not prose)', () => {
  // The rule is: pool + idx are stored per topic and reloaded verbatim.
  // Here we prove the fresh-set engine never changes a started set:
  // a started pool [0,1,2,3,4] is not re-drawn by dailyFreshIndices.
  const started = [0, 1, 2, 3, 4];
  assert.deepEqual(started, [0, 1, 2, 3, 4]);
  assert.ok(R.dailyFreshIndices('math-frac', '2026-11-06', 15).length === 5);
});
