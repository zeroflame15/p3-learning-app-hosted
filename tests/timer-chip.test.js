// Game timer chip: readable contrast + ticks from game start.
// The plain .chip inherits the Play route's cream text (#f5f1e6) on
// its pale-mint pill, which was nearly invisible in screenshots, and
// the chip sat at 0s until the first tap because it only re-rendered
// on an interaction (both seen live 2026-11-07).
'use strict';
const { test } = require('node:test');
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
function hexLum(hex) {
  if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a, b) {
  const la = hexLum(a), lb = hexLum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

test('timer chip has dark ink on a solid light pill (WCAG AA)', function () {
  const m = html.match(/\.timechip\{([^}]*)\}/);
  assert.ok(m, '.timechip rule not found');
  const rule = m[1];
  const fg = (rule.match(/color:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  const bg = (rule.match(/background:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  assert.ok(fg, 'timechip needs an explicit text colour');
  assert.ok(bg, 'timechip needs an explicit background');
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= 4.5, 'timechip contrast ' + ratio.toFixed(2) + ':1 is below WCAG AA 4.5:1 (' + fg + ' on ' + bg + ')');
});

test('all four game-hero timer chips use .timechip with id gameTime', function () {
  const chips = html.match(/<span class="chip timechip" id="gameTime"/g) || [];
  assert.equal(chips.length, 4, 'expected 4 game timer chips, found ' + chips.length);
  // The Learn warm-up chip is a different chip and must stay untouched.
  assert.ok(html.includes('id="wuTime"'), 'warm-up chip (wuTime) must still exist');
  assert.ok(!html.includes('chip timechip" id="wuTime"'), 'warm-up chip must not become a timechip');
});

test('startGame starts a 1s tick and clears any previous game timer', function () {
  const body = fnBody('function startGame(');
  assert.ok(body.includes('setInterval(tickGameTime,1000)'), 'startGame must start tickGameTime every second');
  assert.ok(body.includes('clearInterval(gameTimer)'), 'startGame must clear a previous gameTimer first');
});

test('every pill on the Play route is dark-on-white (the header and leaderboard pills too)', function () {
  const m = html.match(/\.app\.route-play \.chip\{([^}]*)\}/);
  assert.ok(m, '.app.route-play .chip rule not found');
  const rule = m[1];
  const fg = (rule.match(/color:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  const bg = (rule.match(/background:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  assert.ok(fg && bg, 'route-play chip rule needs an explicit text colour and background');
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= 4.5, 'route-play chip contrast ' + ratio.toFixed(2) + ':1 is below WCAG AA 4.5:1 (' + fg + ' on ' + bg + ')');
  // The pale pills the live check flagged are plain .chip spans, so
  // this one rule covers them all — parking Level/Moves/stars,
  // crossword Round/stars, the generic Round pill, and the arcade
  // leaderboard best-time pill.
  assert.ok(html.includes('<span class="chip">Level '), 'parking header still uses plain .chip (covered by the route rule)');
  assert.ok(html.includes('<span class="chip">Round '), 'crossword/generic header still uses plain .chip (covered by the route rule)');
});

test('sidebar critter card uses full ink, not the muted soft ink', function () {
  const start = html.indexOf('Critter stage');
  assert.ok(start >= 0, 'critter card markup not found');
  const line = html.slice(html.lastIndexOf('\n', start) + 1, html.indexOf('\n', start));
  assert.ok(!line.includes('color:var(--ink-soft)'), 'critter card must not use the pale --ink-soft text');
  assert.ok(line.includes('color:var(--ink)'), 'critter card text must use full --ink');
  // The critter name line had NO colour at all, so it inherited the
  // sidebar's cream text — pale cream on the white card. It needs
  // the explicit ink too.
  assert.ok(line.includes("margin-top:2px;color:var(--ink)"), 'critter name line must set an explicit ink colour');
});

test('feedback banners use dark ink on their pale backgrounds', function () {
  const greenSoft = (html.match(/--green-soft:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  const coralSoft = (html.match(/--coral-soft:\s*(#[0-9a-f]{3,6})/i) || [])[1];
  assert.ok(greenSoft && coralSoft, 'soft background variables must exist');
  [['ok', greenSoft], ['no', coralSoft]].forEach(function (pair) {
    const kind = pair[0], bg = pair[1];
    const m = html.match(new RegExp('\\.feedback\\.' + kind + '\\{([^}]*)\\}'));
    assert.ok(m, '.feedback.' + kind + ' rule not found');
    const fg = (m[1].match(/color:\s*(#[0-9a-f]{3,6})/i) || [])[1];
    assert.ok(fg, '.feedback.' + kind + ' needs an explicit dark text colour (it inherits cream on the Play route)');
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= 4.5, '.feedback.' + kind + ' contrast ' + ratio.toFixed(2) + ':1 is below WCAG AA 4.5:1 (' + fg + ' on ' + bg + ')');
  });
});

test('tickGameTime writes the elapsed time and self-clears when the chip is gone', function () {
  const fmtBody = fnBody('function fmtPlaySecs(');
  const tickBody = fnBody('function tickGameTime(){');
  var el = { textContent: '' };
  var document = { getElementById: function () { return el; } };
  var gState = { startedAt: Date.now() - 65000 };
  var gameTimer = 7;
  var cleared = [];
  function clearInterval(id) { cleared.push(id); }
  // Strict-mode eval keeps declarations in its own scope, so capture
  // the functions from the eval's return value instead.
  var fmtPlaySecs = eval(fmtBody + '; fmtPlaySecs;');
  var tickGameTime = eval(tickBody + '; tickGameTime;');
  tickGameTime();
  assert.equal(el.textContent, '⏱ 1m 05s');
  assert.equal(cleared.length, 0, 'timer must keep running while the chip is on screen');
  // Chip gone (game finished / Back pressed): the interval clears itself.
  el = null;
  document = { getElementById: function () { return null; } };
  tickGameTime();
  assert.deepEqual(cleared, [7], 'timer must clear itself once the chip disappears');
});
