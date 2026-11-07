// Tests for Revamp Batch C: Sentence Builder (tap-to-build),
// Crossword Quest (6 rotating grids, partial credit, reveal,
// typing ticks, input above the clues, progress dots) and
// Exit Parking (12 levels, sliding cars, no fallback, undo/reset,
// level overlay).
// Reads the page from PAGE_PATH when set, so it can run against a
// patched temp copy before the patch lands in public/index.html.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(pagePath, 'utf8');

const HAS_XWGRIDS = html.includes('var XWGRIDS=');
const HAS_SENT = html.includes('var SENTENCES=');
const HAS_PARK12 = html.includes('var PARKLEVELS=') && html.includes('rounds:12');

function grab(name, endMarker) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf(endMarker || '\n}\n', start);
  assert.ok(end > start, name + ' has its end marker');
  return html.slice(start, end + (endMarker || '\n}\n').length);
}
function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}

const helpers = ['hashStr', 'seededShuffle', 'optsShuffled'].map((n) => grab(n)).join('\n');
const XWORDS = html.includes('var XWORDS=') ? eval(grabVar('XWORDS') + '\n;XWORDS') : null;
const XWGRIDS = HAS_XWGRIDS ? eval(grabVar('XWGRIDS') + '\n;XWGRIDS') : null;
const XWTHEMES = HAS_XWGRIDS ? eval(grabVar('XWTHEMES') + '\n;XWTHEMES') : null;

function gameHTMLSrc() { return html.slice(html.indexOf('function gameHTML(){'), html.indexOf('function bindGame(){')); }
function bindGameSrc() { return html.slice(html.indexOf('function bindGame(){'), html.indexOf('function saveGameProgress(){')); }

/* ---------------- Sentence Builder ---------------- */

test('sentence: gameHTML renders tiles, strip, punctuation row and Next', { skip: !HAS_SENT }, () => {
  const game = gameHTMLSrc();
  const sen = game.slice(game.indexOf("if(gState.id==='sentence')"), game.indexOf('var q=genRound'));
  assert.ok(sen.includes('data-sbtile'), 'word tiles render');
  assert.ok(sen.includes('data-sbslot'), 'build strip slots render');
  assert.ok(sen.includes('data-sbp'), 'a punctuation row renders for tier 3');
  assert.ok(sen.includes('sbstrip'), 'the build strip container renders');
  assert.ok(sen.includes('sbbank'), 'the word bank renders');
  assert.ok(sen.includes('id="gNext"'), 'a Next button renders when the sentence is solved');
  assert.ok(sen.includes('id="sbReset"'), 'a Start over button renders');
  assert.ok(sen.includes('sentLocked'), 'locked tiles are computed for the render');
  assert.ok(sen.indexOf('data-gopt') < 0, 'no multiple-choice options in the sentence branch');
});

test('sentence: bindGame binds tiles, slots, punctuation and its own Next', { skip: !HAS_SENT }, () => {
  const bind = bindGameSrc();
  const sen = bind.slice(bind.indexOf("if(gState.id==='sentence')"), bind.indexOf("if(gState.id==='scramble')"));
  assert.ok(sen.includes('data-sbtile'), 'tile taps are bound');
  assert.ok(sen.includes('data-sbslot'), 'slot taps are bound');
  assert.ok(sen.includes('data-sbp'), 'punctuation taps are bound');
  assert.ok(sen.includes('senSolve'), 'solving goes through senSolve');
  assert.ok(sen.includes('sndTick'), 'tile taps play a rising tick');
  assert.ok(sen.includes('sentLocked'), 'locks recompute after every placement');
  assert.ok(sen.includes("recordPlayBest(live,'sentence')"), 'completion records the best on the live explorer');
  assert.ok(sen.includes("earnStars(live,Math.min(gState.score,gState.rounds))"), 'the award is capped at the round count');
  assert.ok(sen.includes('sbReset'), 'Start over clears the unlocked tiles');
});

test('sentence: startGame and saveGameProgress carry the build fields', { skip: !HAS_SENT }, () => {
  const start = html.slice(html.indexOf('function startGame(id){'), html.indexOf('function gameOptsHTML'));
  assert.ok(start.includes("else if(id==='sentence')"), 'startGame has a sentence branch');
  assert.ok(start.includes('sentFor(gState.seed'), 'the sentence board derives from the run seed');
  assert.ok(start.includes('p.sent===sk'), 'a saved build restores only for its own sentence');
  assert.ok(start.includes('sentBank(ss'), 'the tile order derives from the run seed');
  const save = html.slice(html.indexOf('function saveGameProgress(){'), html.indexOf('/* ============================================================ ASK PIP'));
  assert.ok(save.includes("else if(gState.id==='sentence')"), 'save has a sentence branch');
  assert.ok(save.includes('built:(gState.built||[])'), 'the build is saved');
  assert.ok(save.includes('locked:(gState.locked||[])'), 'the locks are saved');
  assert.ok(save.includes('sent:gState.sent'), 'the sentence key is saved');
  assert.ok(save.includes('punct:gState.punct'), 'the chosen end mark is saved');
  assert.ok(save.includes('done:!!gState.done'), 'the solved flag is saved');
});

/* ---------------- Crossword Quest ---------------- */

test('crossword: six themed grids, each a legal 5x5 grid', { skip: !HAS_XWGRIDS }, () => {
  assert.equal(XWGRIDS.length, 6, 'six grids, one per theme');
  assert.deepEqual(XWTHEMES, ['Animals', 'Food', 'Home', 'School', 'Nature', 'Transport'], 'themes in order');
  assert.deepEqual(XWGRIDS[0], XWORDS, 'grid 0 is the original Animals grid, unchanged');
  XWGRIDS.forEach((grid, gi) => {
    assert.equal(grid.length, 6, 'grid ' + gi + ' (' + XWTHEMES[gi] + ') has six words');
    const cell = {};
    const occupants = {};
    const words = new Set();
    grid.forEach((wd) => {
      assert.ok(wd.w.length >= 3 && wd.w.length <= 5, 'grid ' + gi + ': ' + wd.w + ' is 3-5 letters');
      assert.ok(wd.clue && wd.clue.length > 5, 'grid ' + gi + ': ' + wd.w + ' has a real clue');
      assert.ok(wd.dir === 'Across' || wd.dir === 'Down', 'grid ' + gi + ': ' + wd.w + ' has a direction');
      assert.ok(!words.has(wd.w), 'grid ' + gi + ': no duplicate word ' + wd.w);
      words.add(wd.w);
      for (let k = 0; k < wd.w.length; k++) {
        const key = (wd.x + wd.dx * k) + ',' + (wd.y + wd.dy * k);
        const x = wd.x + wd.dx * k, y = wd.y + wd.dy * k;
        assert.ok(x >= 0 && x < 5 && y >= 0 && y < 5, 'grid ' + gi + ': ' + wd.w + ' stays in the 5x5 grid');
        if (cell[key]) assert.equal(cell[key], wd.w[k], 'grid ' + gi + ': crossing at ' + key + ' must agree (' + wd.w + ')');
        cell[key] = wd.w[k];
        occupants[key] = (occupants[key] || 0) + 1;
      }
    });
    grid.forEach((wd) => {
      let shared = 0;
      for (let k = 0; k < wd.w.length; k++) {
        if (occupants[(wd.x + wd.dx * k) + ',' + (wd.y + wd.dy * k)] > 1) shared++;
      }
      assert.ok(shared >= 1, 'grid ' + gi + ': ' + wd.w + ' crosses at least one other word');
    });
    const long = grid.filter((wd) => wd.w.length >= 4).length;
    // Grid 0 is the legacy Animals grid (all 3-letter words, kept
    // exactly as-is); the length rule applies to the five new grids.
    if (gi > 0) assert.ok(long >= 2, 'grid ' + gi + ': at least 2 words of 4+ letters, got ' + long);
    // Clue numbers follow reading order: sorted by (row, col) of the
    // word start, the numbers never decrease, and each distinct start
    // cell has exactly one number.
    const starts = {};
    grid.forEach((wd) => { starts[wd.x + ',' + wd.y] = wd.num; });
    const ordered = grid.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const nums = ordered.map((wd) => wd.num);
    for (let i = 1; i < nums.length; i++) assert.ok(nums[i] >= nums[i - 1], 'grid ' + gi + ': clue numbers follow reading order');
    assert.equal(new Set(Object.values(starts)).size, Object.keys(starts).length, 'grid ' + gi + ': one number per start cell');
  });
});

test('crossword: xwGridOfDay is day-seeded and stable within a day', { skip: !HAS_XWGRIDS }, () => {
  let DAY = '2026-11-07';
  const day = eval(helpers + '\nvar XWGRIDS=' + JSON.stringify(XWGRIDS) + ';\nvar todayKey=function(){ return DAY; };\n' + grab('xwGridOfDay') + '\n;xwGridOfDay'); // eslint-disable-line no-eval
  const first = day();
  assert.ok(first >= 0 && first < 6, 'the day grid is a valid grid id: ' + first);
  assert.equal(day(), first, 'the same day always picks the same grid');
  DAY = '2026-11-08';
  assert.ok(day() >= 0 && day() < 6, 'the next day also picks a valid grid');
  const seen = new Set();
  for (let d = 1; d <= 14; d++) {
    DAY = '2026-11-' + String(d).padStart(2, '0');
    seen.add(day());
  }
  assert.ok(seen.size > 1, 'the grid rotates across days, got ' + [...seen].join(','));
});

test('crossword: input above the clues, dots, theme chip, reveal button', { skip: !HAS_XWGRIDS }, () => {
  const game = gameHTMLSrc();
  const xw = game.slice(game.indexOf("if(gState.id==='crossword')"), game.indexOf("if(gState.id==='parking')"));
  assert.ok(xw.indexOf('id="xwInput"') < xw.indexOf('class="xwclues"'), 'the input sits above the clues');
  assert.ok(xw.includes('xwdots'), 'progress dots render');
  assert.ok(xw.includes('Theme: '), 'a theme chip shows the grid theme');
  assert.ok(xw.includes('id="xwReveal"'), 'a reveal button renders');
  assert.ok(xw.includes('⭐2'), 'the reveal costs 2 stars');
  // The given-letter fix is intact.
  assert.ok(xw.includes('xwPattern(gState.sel'), 'the pattern line is still there');
  assert.ok(xw.includes('XWORDS[gState.sel].w.length'), 'the box takes the full word length');
  assert.ok(xw.includes('already given'), 'the already-given hint is still there');
  const bind = bindGameSrc();
  const xwb = bind.slice(bind.indexOf("if(gState.id==='crossword')"), bind.indexOf("if(gState.id==='sentence')"));
  assert.ok(xwb.includes('xwPrevLen'), 'typing ticks track the typed length');
  assert.ok(xwb.includes('sndTick'), 'typing plays a tick');
  assert.ok(xwb.includes('xwReveal'), 'the reveal button is bound');
  assert.ok(xwb.includes('spendStars(live,2)'), 'the reveal costs 2 stars via spendStars');
  // Partial credit: the wrong branch compares each letter to the
  // answer and deletes only the wrong ones.
  assert.ok(xwb.includes('var want=wd.w[wd.dir'), 'the wrong branch compares each letter to the answer');
  assert.ok(xwb.includes('delete gState.letters'), 'wrong letters are deleted');
});

test('crossword: startGame swaps in the day grid and keeps gridId', { skip: !HAS_XWGRIDS }, () => {
  const start = html.slice(html.indexOf('function startGame(id){'), html.indexOf('function gameOptsHTML'));
  assert.ok(start.includes('XWORDS=XWGRIDS[gid]'), 'startGame swaps in the day grid');
  assert.ok(start.includes('gridId:gid'), 'the grid id is kept in gState');
  assert.ok(start.includes('xwGridOfDay()'), 'a fresh run takes today\'s grid');
  const save = html.slice(html.indexOf('function saveGameProgress(){'), html.indexOf('/* ============================================================ ASK PIP'));
  assert.ok(save.includes('gridId:gState.gridId'), 'the grid id is saved');
});

/* ---------------- Exit Parking ---------------- */

test('parking: no opposite-direction fallback, blocked moves thunk + shake', { skip: !HAS_PARK12 }, () => {
  const bind = bindGameSrc();
  const park = bind.slice(bind.indexOf("if(gState.id==='parking')"), bind.indexOf("if(gState.id==='memory')"));
  assert.ok(park.indexOf('var opp=') < 0, 'the opposite-direction fallback is gone');
  assert.ok(park.indexOf('sndThunk()') >= 0, 'a blocked move plays the thunk');
  assert.ok(park.indexOf('parkshake') >= 0, 'a blocked move shakes the car');
  assert.ok(park.indexOf('getBoundingClientRect') >= 0, 'direction comes from the tap position on the car');
  assert.ok(park.indexOf("getAttribute('data-cx')") < 0, 'no stale data-cx direction read');
  assert.ok(park.indexOf("getAttribute('data-cy')") < 0, 'no stale data-cy direction read');
});

test('parking: cars slide (no full re-render on a move), undo/reset, level overlay', { skip: !HAS_PARK12 }, () => {
  const game = gameHTMLSrc();
  const park = game.slice(game.indexOf("if(gState.id==='parking')"), game.indexOf("if(gState.id==='sentence')"));
  assert.ok(park.includes('parkUndo'), 'an Undo button renders');
  assert.ok(park.includes('parkReset'), 'a Reset button renders');
  assert.ok(park.includes('gParkNext'), 'the level overlay has a Next button');
  assert.ok(park.includes('parkMoves'), 'a moves chip renders');
  assert.ok(park.includes('Par '), 'a par chip renders');
  assert.ok(park.includes('Pack '), 'a pack label renders');
  assert.ok(park.includes('style="left:'), 'cars are absolutely positioned with left/top');
  assert.ok(park.indexOf('data-cx') < 0, 'no data-cx/data-cy in the lot');
  const bind = bindGameSrc();
  const parkBind = bind.slice(bind.indexOf("if(gState.id==='parking')"), bind.indexOf("if(gState.id==='memory')"));
  assert.ok(parkBind.includes('parkHist'), 'undo history is kept (session-only)');
  assert.ok(parkBind.includes('parkUndo'), 'Undo is bound');
  assert.ok(parkBind.includes('parkReset'), 'Reset is bound');
  assert.ok(parkBind.includes('levelWon'), 'a level-complete overlay is shown');
  assert.ok(parkBind.includes('parkWinToken'), 'the win delay is guarded by a token');
  assert.ok(parkBind.includes('b.style.left'), 'a move slides the car element (no full re-render)');
  assert.ok(parkBind.includes('sndSlide()'), 'a move plays the slide whoosh');
  const css = html.slice(0, html.indexOf('</style>'));
  assert.ok(css.includes('transition:left'), 'the car CSS transitions left/top');
  assert.ok(css.includes('.parkshake'), 'the shake CSS exists');
  assert.ok(css.includes('@keyframes parkshake'), 'the shake keyframes exist');
});

test('parking: sounds exist and respect mute through slide()', { skip: !HAS_PARK12 }, () => {
  assert.ok(html.includes('function sndThunk(){'), 'sndThunk exists');
  assert.ok(html.includes('function sndSlide(){'), 'sndSlide exists');
  assert.ok(html.includes('slide(160,70'), 'the thunk is a low slide');
  const slide = grab('slide');
  assert.ok(slide.includes('isMuted()'), 'slide() respects the mute toggle');
});
