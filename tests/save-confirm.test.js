'use strict';
// Save-confirmation regression (seen live 2026-11-09): every timetable
// save ended with the failure toast "Couldn't confirm the timetable
// saved to the server", even though the server demonstrably held each
// new value afterwards. Root cause: the server stores the plan in a
// JSONB column, and PostgreSQL JSONB reorders object keys (by key
// length, then bytewise), so confirmPlanSaved's JSON.stringify
// comparison never matched the round-tripped plan even when the
// content was identical. Fix: confirmPlanSaved now compares with
// plansEqual (field-by-field, order-insensitive) and still requires
// the revision read from the GET's data.familyPlanRev to match.
// These tests drive the REAL confirmPlanSaved from public/index.html
// in a vm sandbox against a mock server.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnText(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const lineEnd = html.indexOf('\n', start);
  const line = html.slice(start, lineEnd);
  let depth = 0;
  for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
  if (depth === 0 && line.trimEnd().endsWith('}')) return line;
  const end = html.indexOf('\n}\n', start);
  assert.ok(end >= 0, marker + ' body never closes');
  return html.slice(start, end + 3);
}

// Postgres JSONB key order: sort object keys by length, then bytewise.
function jsonbNormalize(v) {
  if (Array.isArray(v)) return v.map(jsonbNormalize);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0))
      .forEach((k) => { out[k] = jsonbNormalize(v[k]); });
    return out;
  }
  return v;
}

// A realistic plan exactly as readFamilyPlanFromForm builds it
// (key order: label, subs, study, note, rest, review, light).
const LOCAL_PLAN = {
  0: { label: 'Review day', subs: [], study: '30–45 min gentle review', note: 'Recap the week.', rest: false, review: true, light: false },
  1: { label: 'English + Maths + Science', subs: ['eng', 'math', 'sci'], study: 'Study 5:00–6:00pm VERIFY', note: '', rest: false, review: false, light: false },
  2: { label: 'Science + Chinese', subs: ['sci', 'chi'], study: 'Study 3:00–4:30pm', note: '', rest: false, review: false, light: false },
  3: { label: 'Chinese', subs: ['chi'], study: 'Light study 3:00–4:00pm', note: 'Higher Chinese 5:00–7:00pm', rest: false, review: false, light: true },
  4: { label: 'Maths + Science', subs: ['math', 'sci'], study: 'Study 3:00–4:30pm', note: '', rest: false, review: false, light: false },
  5: { label: 'English + Chinese', subs: ['eng', 'chi'], study: 'Study 3:00–4:30pm', note: '', rest: false, review: false, light: false },
  6: { label: 'Rest day', subs: [], study: '', note: 'Dance 12:00–1:00pm · Art 1:30–3:00pm', rest: true, review: false, light: false },
};
const OLD_PLAN = JSON.parse(JSON.stringify(LOCAL_PLAN));
OLD_PLAN[1] = { label: 'English + Science', subs: ['eng', 'sci'], study: 'Study 4:00–5:00pm TEST', note: '', rest: false, review: false, light: false };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run the real confirmPlanSaved against a mock server. `stored` is the
// family record the GET returns (already JSONB-normalised by the
// caller where relevant). Resolves with { ok, getCalls, syncCalls }.
function runConfirm(expectedRev, expectedPlan, stored) {
  const calls = { get: 0, sync: 0 };
  const sandbox = {
    console, setTimeout, clearTimeout, JSON, Object, Array, Math, Date, Promise,
    syncKey: () => '8SXU6S',
    syncToServer: () => { calls.sync++; },
    fetch: (url) => {
      calls.get++;
      const m = String(url).match(/code=([^&]*)/);
      const code = m ? decodeURIComponent(m[1]) : null;
      const data = code === '8SXU6S' ? stored : null;
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ configured: true, data, updatedAt: '2026-11-09T05:20:00.000Z' }) });
    },
    __plan: expectedPlan,
    __result: null,
  };
  vm.createContext(sandbox);
  vm.runInContext(fnText('function planDayEqual('), sandbox);
  vm.runInContext(fnText('function plansEqual('), sandbox);
  vm.runInContext(fnText('function confirmPlanSaved('), sandbox);
  vm.runInContext(`confirmPlanSaved(${expectedRev}, __plan, function(ok){ __result = ok; });`, sandbox);
  return sleep(4500).then(() => ({ ok: sandbox.__result, getCalls: calls.get, syncCalls: calls.sync }));
}

test('confirm succeeds when the server holds the new plan (JSONB-reordered keys)', async () => {
  // The server round-trips the plan through JSONB, so the stored keys
  // come back in a different order — content identical. This is the
  // live failure: it must report success, not cry wolf.
  const stored = {
    familyPlan: jsonbNormalize(JSON.parse(JSON.stringify(LOCAL_PLAN))),
    familyPlanRev: 7,
    familyPlanUpdatedAt: '2026-11-09T05:20:00.000Z',
    explorers: [],
  };
  const r = await runConfirm(7, JSON.parse(JSON.stringify(LOCAL_PLAN)), stored);
  assert.equal(r.ok, true, 'confirm must succeed when the server holds the new plan at the expected rev');
  assert.equal(r.getCalls, 1, 'success on the first check — no retry needed');
});

test('confirm fails (and retries once) when the server still holds the old plan', async () => {
  const stored = {
    familyPlan: jsonbNormalize(JSON.parse(JSON.stringify(OLD_PLAN))),
    familyPlanRev: 6,
    familyPlanUpdatedAt: '2026-11-09T05:19:00.000Z',
    explorers: [],
  };
  const r = await runConfirm(7, JSON.parse(JSON.stringify(LOCAL_PLAN)), stored);
  assert.equal(r.ok, false, 'confirm must fail when the server still holds the old plan');
  assert.equal(r.getCalls, 2, 'it retries the GET once before giving up');
  assert.equal(r.syncCalls, 1, 'it re-triggers an upload before the retry');
});

test('confirm fails when the plan matches but the revision is stale', async () => {
  // Proves the revision is read from the GET's data.familyPlanRev:
  // same content, older rev -> not confirmed.
  const stored = {
    familyPlan: jsonbNormalize(JSON.parse(JSON.stringify(LOCAL_PLAN))),
    familyPlanRev: 6,
    familyPlanUpdatedAt: '2026-11-09T05:20:00.000Z',
    explorers: [],
  };
  const r = await runConfirm(7, JSON.parse(JSON.stringify(LOCAL_PLAN)), stored);
  assert.equal(r.ok, false, 'a stale revision must not confirm, even with matching content');
});

test('confirm fails when the revision matches but the plan content differs', async () => {
  const other = JSON.parse(JSON.stringify(LOCAL_PLAN));
  other[1].study = 'Study 6:00–7:00pm SOMETHING ELSE';
  other[1].label = 'English + Maths + Science';
  const stored = {
    familyPlan: jsonbNormalize(other),
    familyPlanRev: 7,
    familyPlanUpdatedAt: '2026-11-09T05:20:00.000Z',
    explorers: [],
  };
  const r = await runConfirm(7, JSON.parse(JSON.stringify(LOCAL_PLAN)), stored);
  assert.equal(r.ok, false, 'a different plan at the same revision must not confirm');
});

test('confirm succeeds for a reset (null plan) when the server holds null at the expected rev', async () => {
  const stored = {
    familyPlan: null,
    familyPlanRev: 8,
    familyPlanUpdatedAt: '2026-11-09T05:21:00.000Z',
    explorers: [],
  };
  const r = await runConfirm(8, null, stored);
  assert.equal(r.ok, true, 'a reset must confirm when the server holds null at the expected rev');
});

test('plansEqual ignores key order but not content', () => {
  const sandbox = { console, JSON, Object, Array, Math, Date, Promise };
  vm.createContext(sandbox);
  vm.runInContext(fnText('function planDayEqual('), sandbox);
  vm.runInContext(fnText('function plansEqual('), sandbox);
  const reordered = jsonbNormalize(JSON.parse(JSON.stringify(LOCAL_PLAN)));
  assert.equal(vm.runInContext('plansEqual(__a, __b)', Object.assign(sandbox, { __a: LOCAL_PLAN, __b: reordered })), true, 'JSONB-reordered plan must equal the local plan');
  const changed = JSON.parse(JSON.stringify(LOCAL_PLAN));
  changed[6].note = 'Swim class';
  assert.equal(vm.runInContext('plansEqual(__a, __b)', Object.assign(sandbox, { __a: LOCAL_PLAN, __b: changed })), false, 'a changed note must not equal');
  assert.equal(vm.runInContext('plansEqual(null, null)', sandbox), true, 'null equals null');
  assert.equal(vm.runInContext('plansEqual(__a, null)', Object.assign(sandbox, { __a: LOCAL_PLAN })), false, 'a plan does not equal null');
});
