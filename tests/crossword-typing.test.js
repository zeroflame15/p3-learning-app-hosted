// Crossword Quest typing model (requested 2026-11-07): the whole
// 5x5 grid in one session — hint list only, type the word with the
// keyboard, green when right (hint greys out), red when wrong, tap
// the same square again to toggle Across/Down.
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
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}

const XWORDS = eval(grabVar('XWORDS') + '\n;XWORDS');
const helpers = ['xwWordsAt', 'xwCellLocked', 'xwLetterAt', 'xwWordCells',
  'xwUnlockedCells', 'xwWordText', 'xwCheckWord', 'xwApplyTyped', 'xwPattern', 'xwNextUnsolved', 'xwSelectCell']
  .map((n) => fnText('function ' + n + '(')).join('\n');

test('xwWordsAt finds the words covering each square', () => {
  const fns = eval(helpers + '\n;xwWordsAt');
  assert.deepEqual(fns(0, 0), [0, 1], 'top-left corner: CAT across + CAR down');
  assert.deepEqual(fns(2, 0), [0, 2], 'CAT + TIP share the T');
  assert.deepEqual(fns(0, 2), [1, 3], 'CAR + RAT share the R');
  assert.deepEqual(fns(2, 2), [2, 4], 'TIP + PIG share the P');
  assert.deepEqual(fns(4, 2), [4, 5], 'PIG + GUM share the G');
  assert.deepEqual(fns(1, 0), [0], 'A belongs to CAT only');
  assert.deepEqual(fns(4, 4), [5], 'M belongs to GUM only');
  assert.deepEqual(fns(3, 0), [], 'blank square has no word');
  assert.deepEqual(fns(1, 4), [], 'blank square has no word');
});

test('xwSelectCell taps a square to pick its word, same square again toggles direction', () => {
  const fns = eval(helpers + '\n;xwSelectCell');
  // From CAT (across), tap the shared corner (0,0) again: toggles to CAR (down).
  let r = fns(0, 0, 0, { x: 0, y: 0 });
  assert.equal(r.sel, 1, 'same square again: CAT -> CAR');
  r = fns(0, 0, 1, { x: 0, y: 0 });
  assert.equal(r.sel, 0, 'same square once more: CAR -> CAT');
  // A different square in the same word keeps the word.
  r = fns(1, 0, 0, { x: 0, y: 0 });
  assert.equal(r.sel, 0, 'another CAT square keeps CAT');
  // A new square prefers the word in the current direction (Across).
  r = fns(2, 2, 0, { x: 1, y: 0 });
  assert.equal(r.sel, 4, 'PIG square from CAT: Across wins over TIP Down');
  // A square with two Down words picks the first when Across is unavailable.
  r = fns(0, 2, 4, { x: 2, y: 2 });
  assert.equal(r.sel, 1, 'CAR/RAT square: CAR first');
  // A blank square changes nothing.
  r = fns(3, 0, 0, { x: 0, y: 0 });
  assert.equal(r.sel, 0, 'blank square: selection unchanged');
  assert.deepEqual(r.selCell, { x: 0, y: 0 }, 'blank square: last cell unchanged');
  // Tapping a clue's word start then the same square toggles.
  r = fns(2, 0, 2, { x: 2, y: 0 });
  assert.equal(r.sel, 0, 'TIP start square again: TIP -> CAT');
});

test('xwCheckWord judges the whole typed word, and locked letters count', () => {
  const fns = eval(helpers + '\n;({xwWordText, xwCheckWord, xwLetterAt, xwCellLocked})');
  const none = [false, false, false, false, false, false];
  assert.equal(fns.xwCheckWord(0, { '0,0': 'C', '1,0': 'A', '2,0': 'T' }, none), 'ok', 'CAT typed right');
  assert.equal(fns.xwCheckWord(0, { '0,0': 'C', '1,0': 'A', '2,0': 'X' }, none), 'wrong', 'one letter off is wrong');
  assert.equal(fns.xwCheckWord(0, { '0,0': 'C' }, none), 'incomplete', 'a half-typed word is not checked');
  assert.equal(fns.xwCheckWord(0, {}, none), 'incomplete', 'an empty word is not checked');
  // CAT solved locks its letters: CAR then only needs A and R.
  const catSolved = [true, false, false, false, false, false];
  assert.equal(fns.xwLetterAt(0, 0, { '0,0': 'X' }, catSolved), 'C', 'a locked letter beats a typed one');
  assert.equal(fns.xwCellLocked(0, 0, catSolved), true, 'the shared corner is locked');
  assert.equal(fns.xwCellLocked(1, 0, catSolved), true, 'every CAT cell is locked');
  assert.equal(fns.xwCellLocked(0, 1, catSolved), false, 'CAR-only cells stay open');
  assert.equal(fns.xwWordText(1, {}, catSolved), 'C', 'CAR shows its locked C');
  assert.equal(fns.xwCheckWord(1, { '0,1': 'A', '0,2': 'R' }, catSolved), 'ok', 'CAR completes from its locked C');
  assert.equal(fns.xwCheckWord(1, { '0,1': 'A' }, catSolved), 'incomplete', 'CAR still missing its R');
});

test('xwNextUnsolved walks to the next unsolved word and stops at -1', () => {
  const fns = eval(helpers + '\n;xwNextUnsolved');
  assert.equal(fns(-1, [false, false, false, false, false, false]), 0, 'fresh grid starts at CAT');
  assert.equal(fns(0, [true, false, false, false, false, false]), 1, 'after CAT comes CAR');
  assert.equal(fns(4, [true, true, true, true, false, true]), 4, 'skips solved words');
  assert.equal(fns(5, [true, true, true, true, true, false]), 5, 'wraps around to GUM');
  assert.equal(fns(2, [true, true, true, true, true, true]), -1, 'all solved: nothing left');
});

test('xwUnlockedCells counts only the cells a word still needs', () => {
  const fns = eval(helpers + '\n;xwUnlockedCells');
  const none = [false, false, false, false, false, false];
  assert.equal(fns(0, none).length, 3, 'CAT needs all 3 cells at first');
  assert.equal(fns(3, none).length, 3, 'RAT needs all 3 cells at first');
  // Solve CAR and TIP: CAT keeps only its middle A.
  const twoSolved = [false, true, true, false, false, false];
  assert.equal(fns(0, twoSolved).length, 1, 'CAT keeps only the A once CAR and TIP are solved');
  assert.equal(fns(1, twoSolved).length, 0, 'a solved word needs no cells');
});

test('xwApplyTyped lets the child type the whole word — a re-typed given letter is dropped, not stuffed into a blank', () => {
  const fns = eval(helpers + '\n;({xwApplyTyped, xwWordText, xwCheckWord})');
  // Reported live 2026-11-07: with CAT solved, TIP takes 2 letters,
  // but the child typed the whole word TIP — the old code put the T
  // into the first blank (TTI) and the check failed.
  const catSolved = [true, false, false, false, false, false];
  let letters = {};
  assert.equal(fns.xwApplyTyped(2, 'TIP', letters, catSolved), 2, 'two blanks filled');
  assert.deepEqual(letters, { '2,1': 'I', '2,2': 'P' }, 'the re-typed T is dropped, I and P land in the blanks');
  assert.equal(fns.xwWordText(2, letters, catSolved), 'TIP', 'the word reads TIP');
  assert.equal(fns.xwCheckWord(2, letters, catSolved), 'ok', 'the check passes');
  // Typing only the missing letters still works.
  letters = {};
  assert.equal(fns.xwApplyTyped(2, 'IP', letters, catSolved), 2, 'IP alone fills both blanks');
  assert.equal(fns.xwCheckWord(2, letters, catSolved), 'ok', 'IP alone passes too');
  // A given letter in the middle/end of the word: CAT with TIP solved
  // locks the final T — typing CAT drops the T, typing CA also works.
  const tipSolved = [false, false, true, false, false, false];
  letters = {};
  assert.equal(fns.xwApplyTyped(0, 'CAT', letters, tipSolved), 2, 'CAT with the T given fills C and A');
  assert.deepEqual(letters, { '0,0': 'C', '1,0': 'A' }, 'the re-typed T is dropped');
  assert.equal(fns.xwCheckWord(0, letters, tipSolved), 'ok', 'CAT passes');
  letters = {};
  assert.equal(fns.xwApplyTyped(0, 'CA', letters, tipSolved), 2, 'CA alone fills both blanks');
  assert.equal(fns.xwCheckWord(0, letters, tipSolved), 'ok', 'CA alone passes too');
  // Backspacing re-derives the letters: a shorter raw value clears the tail.
  letters = { '2,1': 'I', '2,2': 'P' };
  assert.equal(fns.xwApplyTyped(2, 'I', letters, catSolved), 1, 'back to one letter');
  assert.deepEqual(letters, { '2,1': 'I' }, 'the P is cleared');
  assert.equal(fns.xwCheckWord(2, letters, catSolved), 'incomplete', 'no check on a half word');
  // A wrong guess still fails the check.
  letters = {};
  fns.xwApplyTyped(2, 'TAP', letters, catSolved);
  assert.equal(fns.xwCheckWord(2, letters, catSolved), 'wrong', 'TAP is not TIP');
});

test('xwPattern shows given letters and blanks, and the input takes the whole word', () => {
  const fns = eval(helpers + '\n;({xwPattern})');
  const catSolved = [true, false, false, false, false, false];
  assert.equal(fns.xwPattern(2, {}, catSolved), 'T _ _', 'TIP shows its given T');
  assert.equal(fns.xwPattern(2, { '2,1': 'I' }, catSolved), 'T I _', 'a typed I shows in place');
  assert.equal(fns.xwPattern(0, {}, [false, false, false, false, false, false]), '_ _ _', 'a fresh word is all blanks');
  // The box takes the full word length, not just the missing letters.
  const game = html.slice(html.indexOf("if(gState.id==='crossword'){"), html.indexOf("if(gState.id==='parking'){"));
  assert.ok(game.includes("maxlength=\"'+XWORDS[gState.sel].w.length+'\""), 'maxlength is the word length');
  assert.ok(!game.includes("maxlength=\"'+unlocked.length+'\""), 'no maxlength from the unlocked count left');
  assert.ok(game.includes('xwPattern(gState.sel'), 'the pattern line renders above the box');
  assert.ok(game.includes('already given'), 'the hint says the green letters are given');
});
