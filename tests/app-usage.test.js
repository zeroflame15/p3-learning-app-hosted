// App usage view on the PIN-protected parent page (2026-11-10).
//   (1) APP_USAGE holds the exact current + 9 Nov baseline figures read
//       from the Vercel, Supabase and Gemini dashboards (current as of
//       10 Nov 2026). The Monday usage check updates ONLY the "current"
//       values and "asOf" — the baseline never changes.
//   (2) appUsageHTML renders all three services with current, cap,
//       percentage (and bar) and baseline for every metric, plus the
//       as-of date and the weekly-refresh note. No billing change, no
//       paid-tier suggestion, no upgrade prompt.
//   (3) The usage section is wired into parentHTML only — it never
//       renders on a child-facing page (Home / Learn).
// The real data object and functions are extracted from
// public/index.html and run in a vm — nothing here re-implements the app.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// Brace-balanced extraction that skips strings and comments (same
// approach as phase2-choice-control.test.js).
function extractBlock(marker) {
  const i = html.indexOf(marker);
  assert.ok(i >= 0, marker + ' must exist in public/index.html');
  let j = html.indexOf('{', i);
  assert.ok(j >= 0, marker + ': no opening brace');
  let depth = 0, inStr = false, strCh = '', esc = false, inLine = false, inBlock = false;
  for (; j < html.length; j++) {
    const ch = html[j], nx = html[j + 1];
    if (inLine) { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && nx === '/') { inBlock = false; j++; } continue; }
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '/' && nx === '/') { inLine = true; continue; }
    if (ch === '/' && nx === '*') { inBlock = true; continue; }
    if (ch === '"' || ch === "'" || ch.charCodeAt(0) === 96) { inStr = true; strCh = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces for ' + marker);
}

// Load APP_USAGE + helpers into a vm context and return it.
function makeCtx() {
  const ctx = vm.createContext({});
  // APP_USAGE object literal (from "var APP_USAGE = {...};").
  const objSrc = extractBlock('var APP_USAGE = {');
  const lit = objSrc.slice(objSrc.indexOf('{'));
  vm.runInContext('APP_USAGE = ' + lit + ';', ctx);
  // Real esc + fmtUsageNum + appUsageHTML.
  vm.runInContext(extractBlock('function esc(s){'), ctx);
  vm.runInContext(extractBlock('function fmtUsageNum(v){'), ctx);
  vm.runInContext(extractBlock('function appUsageHTML(){'), ctx);
  return ctx;
}
function usageHTML() {
  const ctx = makeCtx();
  return vm.runInContext('appUsageHTML()', ctx);
}
function usageData() {
  const ctx = makeCtx();
  return vm.runInContext('APP_USAGE', ctx);
}
function svc(data, name) {
  const s = data.services.find(function (x) { return x.name === name; });
  assert.ok(s, 'service ' + name + ' must exist');
  return s;
}
function metric(s, label) {
  const m = s.metrics.find(function (x) { return x.label === label; });
  assert.ok(m, 'metric ' + label + ' must exist');
  return m;
}

/* ================= (1) exact figures ================= */

test('APP_USAGE holds the exact current figures (10 Nov 2026)', function () {
  const d = usageData();
  assert.equal(d.asOf, '10 Nov 2026');
  assert.equal(d.baselineDate, '9 Nov 2026');
  assert.equal(d.services.length, 3);
  const v = svc(d, 'Vercel');
  assert.equal(v.plan, 'Hobby');
  assert.equal(metric(v, 'Fast Data Transfer').current, 5.25);
  assert.equal(metric(v, 'Fast Data Transfer').cap, 100);
  assert.equal(metric(v, 'Fast Origin Transfer').current, 2.86);
  assert.equal(metric(v, 'Fast Origin Transfer').cap, 10);
  assert.equal(metric(v, 'Function Invocations').current, 129995);
  assert.equal(metric(v, 'Function Invocations').cap, 1000000);
  assert.equal(metric(v, 'CDN Requests').current, 141643);
  assert.equal(metric(v, 'CDN Requests').cap, 1000000);
  const s = svc(d, 'Supabase');
  assert.equal(metric(s, 'Database size').current, 26.73);
  assert.equal(metric(s, 'Database size').cap, 500);
  assert.equal(metric(s, 'Egress').current, 0.532);
  assert.equal(metric(s, 'Egress').cap, 5);
  assert.equal(metric(s, 'Monthly Active Users').current, 0);
  assert.equal(metric(s, 'Monthly Active Users').cap, 50000);
  assert.equal(metric(s, 'Storage').current, 0);
  assert.equal(metric(s, 'Storage').cap, 1);
  assert.equal(metric(s, 'Log Ingestion').current, 0.159);
  assert.equal(metric(s, 'Log Ingestion').cap, 1);
  const g = svc(d, 'Gemini (AI Studio)');
  assert.equal(metric(g, 'Requests / min (peak)').current, 9);
  assert.equal(metric(g, 'Requests / min (peak)').cap, 15);
  assert.equal(metric(g, 'Tokens / min (peak)').current, 5300);
  assert.equal(metric(g, 'Tokens / min (peak)').cap, 250000);
  assert.equal(metric(g, 'Requests / day (peak)').current, 139);
  assert.equal(metric(g, 'Requests / day (peak)').cap, 500);
});

test('APP_USAGE holds the exact 9 Nov 2026 baseline figures', function () {
  const d = usageData();
  const v = svc(d, 'Vercel');
  assert.equal(metric(v, 'Fast Data Transfer').baseline, 4.12);
  assert.equal(metric(v, 'Fast Origin Transfer').baseline, 1.98);
  assert.equal(metric(v, 'Function Invocations').baseline, 94883);
  assert.equal(metric(v, 'CDN Requests').baseline, 103592);
  const s = svc(d, 'Supabase');
  assert.equal(metric(s, 'Database size').baseline, 25.84);
  assert.equal(metric(s, 'Egress').baseline, 0.287);
  assert.equal(metric(s, 'Monthly Active Users').baseline, 0);
  assert.equal(metric(s, 'Storage').baseline, 0);
  assert.equal(metric(s, 'Log Ingestion').baseline, 0.118);
  const g = svc(d, 'Gemini (AI Studio)');
  assert.equal(metric(g, 'Requests / min (peak)').baseline, 9);
  assert.equal(metric(g, 'Tokens / min (peak)').baseline, 5300);
  assert.equal(metric(g, 'Requests / day (peak)').baseline, 139);
});

test('APP_USAGE carries a window per service', function () {
  const d = usageData();
  assert.ok(svc(d, 'Vercel').window.includes('10 Oct'));
  assert.ok(svc(d, 'Supabase').window.includes('5 Nov'));
  assert.ok(svc(d, 'Gemini (AI Studio)').window.includes('13 Oct'));
});

/* ================= (2) rendering ================= */

test('fmtUsageNum formats thousands with commas and decimals as written', function () {
  const ctx = makeCtx();
  assert.equal(vm.runInContext("fmtUsageNum(129995)", ctx), '129,995');
  assert.equal(vm.runInContext("fmtUsageNum(1000000)", ctx), '1,000,000');
  assert.equal(vm.runInContext("fmtUsageNum(5.25)", ctx), '5.25');
  assert.equal(vm.runInContext("fmtUsageNum(0.532)", ctx), '0.532');
  assert.equal(vm.runInContext("fmtUsageNum(0)", ctx), '0');
});

test('usage section renders all three services with current, cap and %', function () {
  const h = usageHTML();
  assert.ok(h.includes('📊 App usage — against the free caps'), 'heading');
  assert.ok(h.includes('As of'), 'as-of date label');
  assert.ok(h.includes('10 Nov 2026'), 'as-of date value');
  for (const name of ['Vercel', 'Supabase', 'Gemini (AI Studio)']) {
    assert.ok(h.includes(name), 'service ' + name + ' rendered');
  }
  // Vercel
  assert.ok(h.includes('5.25 GB of 100 GB · 5%'), 'Vercel transfer current/cap/%');
  assert.ok(h.includes('2.86 GB of 10 GB · 29%'), 'Vercel origin current/cap/%');
  assert.ok(h.includes('129,995 of 1,000,000 · 13%'), 'Vercel invocations current/cap/%');
  assert.ok(h.includes('141,643 of 1,000,000 · 14%'), 'Vercel CDN current/cap/%');
  assert.ok(h.includes('11 timeouts'), 'invocations timeout note');
  // Supabase
  assert.ok(h.includes('26.73 MB of 500 MB · 5%'), 'Supabase DB current/cap/%');
  assert.ok(h.includes('0.532 GB of 5 GB · 11%'), 'Supabase egress current/cap/%');
  assert.ok(h.includes('0 of 50,000 · 0%'), 'Supabase MAU current/cap/%');
  assert.ok(h.includes('0 GB of 1 GB · 0%'), 'Supabase storage current/cap/%');
  assert.ok(h.includes('0.159 GB of 1 GB · 16%'), 'Supabase log current/cap/%');
  // Gemini
  assert.ok(h.includes('9 of 15 · 60%'), 'Gemini req/min current/cap/%');
  assert.ok(h.includes('5,300 of 250,000 · 2%'), 'Gemini tokens/min current/cap/%');
  assert.ok(h.includes('139 of 500 · 28%'), 'Gemini req/day current/cap/%');
});

test('usage section shows the 9 Nov baseline beside every metric', function () {
  const h = usageHTML();
  for (const b of ['4.12 GB on 9 Nov', '1.98 GB on 9 Nov', '94,883 on 9 Nov', '103,592 on 9 Nov',
    '25.84 MB on 9 Nov', '0.287 GB on 9 Nov', '0 on 9 Nov', '0 GB on 9 Nov', '0.118 GB on 9 Nov',
    '9 on 9 Nov', '5,300 on 9 Nov', '139 on 9 Nov']) {
    assert.ok(h.includes(b), 'baseline shown: ' + b);
  }
});

test('usage section shows a bar per metric and the weekly-refresh note', function () {
  const h = usageHTML();
  // One bar per metric: 12 metrics -> 12 width:% bars.
  const bars = (h.match(/width:\d+%/g) || []).length;
  assert.equal(bars, 12, 'expected 12 usage bars, got ' + bars);
  assert.ok(h.includes('width:29%'), 'origin bar at 29%');
  assert.ok(h.includes('width:60%'), 'Gemini req/min bar at 60%');
  assert.ok(h.includes('Figures refresh weekly (Mondays)'), 'weekly refresh note');
  assert.ok(h.includes('nothing here changes billing'), 'no billing change');
  assert.ok(h.includes('nothing to upgrade'), 'no upgrade prompt');
  assert.ok(!h.includes('href='), 'no links (no billing/upgrade page)');
});

test('appUsageHTML returns empty when APP_USAGE is missing', function () {
  const ctx = vm.createContext({});
  vm.runInContext(extractBlock('function esc(s){'), ctx);
  vm.runInContext(extractBlock('function fmtUsageNum(v){'), ctx);
  vm.runInContext(extractBlock('function appUsageHTML(){'), ctx);
  assert.equal(vm.runInContext('appUsageHTML()', ctx), '');
});

/* ================= (3) parent-only wiring ================= */

test('usage section is wired into parentHTML only, never a child page', function () {
  // Exactly two mentions of the function name in the whole file: the
  // definition and the single call site inside parentHTML.
  assert.equal(html.split('appUsageHTML').length - 1, 2, 'appUsageHTML must appear exactly twice');
  const parentSrc = extractBlock('function parentHTML(){');
  assert.ok(parentSrc.includes('+appUsageHTML()'), 'parentHTML calls appUsageHTML()');
  const homeSrc = extractBlock('function homeHTML(){');
  assert.ok(!homeSrc.includes('appUsageHTML') && !homeSrc.includes('App usage'), 'Home must not render usage');
  const learnSrc = extractBlock('function learnHTML(){');
  assert.ok(!learnSrc.includes('appUsageHTML') && !learnSrc.includes('App usage'), 'Learn must not render usage');
});
