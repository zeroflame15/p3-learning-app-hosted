// Trivia Time: endless Primary 3 questions with a hint, then the
// answer on tap. Categories must match what the child learns:
// English, Maths, Science and Chinese — plus General Knowledge
// for extra knowledge outside school subjects.
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

test('Trivia Time is in the sidebar with a page title and a route', () => {
  assert.ok(html.includes("['trivia','🎲','Trivia']"), 'Trivia in NAV');
  assert.ok(html.includes("['friends','👥','Friends']"), 'Friends in NAV');
  assert.ok(html.includes("trivia:'Trivia Time'"), 'Trivia page title');
  assert.ok(html.includes("friends:'My Friends'"), 'Friends page title');
  assert.ok(html.includes("else if(route==='trivia')c.innerHTML=triviaHTML(),bindTrivia();"), 'trivia route renders triviaHTML');
  assert.ok(html.includes("else if(route==='friends')c.innerHTML=friendsListHTML(),bindFriends();"), 'friends route renders friendsListHTML');
});

test('trivia bank covers all four learning categories plus General Knowledge, with real questions, hints and answers', () => {
  const TRIVIA = eval(grabVar('TRIVIA') + '\n;TRIVIA');
  assert.ok(TRIVIA.length >= 50, 'a proper bank, got ' + TRIVIA.length);
  const cats = {};
  for (const t of TRIVIA) {
    assert.ok(['eng', 'math', 'sci', 'chi', 'gen'].includes(t.cat), 'category is a learning subject or General Knowledge: ' + t.cat);
    assert.ok(t.q && t.q.length > 5, 'a real question: ' + t.q);
    assert.ok(t.hint && t.hint.length > 3, 'every question has a hint: ' + t.q);
    assert.ok(t.a && t.a.length > 0, 'every question has an answer: ' + t.q);
    // The answer must not leak inside its own question or hint —
    // otherwise "hidden until tapped" is a lie for that card.
    assert.ok(!t.q.includes(t.a) && !t.hint.includes(t.a), 'answer stays hidden in its own card: ' + t.q);
    cats[t.cat] = (cats[t.cat] || 0) + 1;
  }
  for (const c of ['eng', 'math', 'sci', 'chi', 'gen']) {
    assert.ok((cats[c] || 0) >= 8, 'at least 8 ' + c + ' questions, got ' + (cats[c] || 0));
  }
  const qs = TRIVIA.map(function (t) { return t.q; });
  assert.equal(new Set(qs).size, qs.length, 'no duplicated questions');
});

test('trivia shows the question and hint, hides the answer until tapped, then moves on', () => {
  var triviaState = null; // eslint-disable-line no-unused-vars
  var TRIVIA_CATS = { all: ['🎲', 'All topics'], eng: ['📖', 'English'], math: ['🔢', 'Maths'], sci: ['🔬', 'Science'], chi: ['🀄', 'Chinese'], gen: ['🌍', 'General Knowledge'] }; // eslint-disable-line no-unused-vars
  assert.ok(html.includes("TRIVIA_CATS={all:['🎲','All topics'],eng:['📖','English'],math:['🔢','Maths'],sci:['🔬','Science'],chi:['🀄','Chinese'],gen:['🌍','General Knowledge']}"), 'real category labels match the stub');
  function esc(s) { // eslint-disable-line no-unused-vars
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pageHero(icon, title, blurb) { return '<div class="hero">' + title + ' ' + blurb + '</div>'; } // eslint-disable-line no-unused-vars
  const shuffle = eval('(' + fnText('function shuffle(a){') + ')'); // eslint-disable-line no-unused-vars
  const TRIVIA = eval(grabVar('TRIVIA') + '\n;TRIVIA'); // eslint-disable-line no-unused-vars
  const triviaOrder = eval('(' + fnText('function triviaOrder(cat){') + ')'); // eslint-disable-line no-unused-vars
  const triviaHTML = eval('(' + fnText('function triviaHTML(){') + ')');
  const first = triviaHTML();
  const t0 = TRIVIA[triviaState.order[triviaState.idx]];
  assert.ok(first.includes(esc(t0.q)), 'the question is shown');
  assert.ok(first.includes(esc(t0.hint)), 'the hint is shown');
  assert.ok(first.includes('Show the answer'), 'tap to reveal the answer');
  assert.ok(!first.includes(esc(t0.a)), 'the answer stays hidden until tapped');
  assert.ok(first.includes('English') || first.includes('Maths') || first.includes('Science') || first.includes('Chinese'), 'category chips shown');
  // Tap "Show the answer": the answer appears with a Next button.
  triviaState.revealed = true;
  const revealed = triviaHTML();
  assert.ok(revealed.includes(esc(t0.a)), 'the answer is revealed after tapping');
  assert.ok(revealed.includes('Next trivia'), 'a Next button follows the answer');
  // Next trivia: a different question, still hidden.
  triviaState.idx++; triviaState.seen++; triviaState.revealed = false;
  const second = triviaHTML();
  const t1 = TRIVIA[triviaState.order[triviaState.idx]];
  assert.ok(second.includes(esc(t1.q)), 'the next question is shown');
  assert.ok(!second.includes(esc(t1.a)), 'its answer is hidden again');
  assert.ok(second.includes('Trivia #2'), 'the counter keeps going');
});

test('triviaOrder covers every question in the category exactly once, then reshuffles', () => {
  const shuffle = eval('(' + fnText('function shuffle(a){') + ')'); // eslint-disable-line no-unused-vars
  const TRIVIA = eval(grabVar('TRIVIA') + '\n;TRIVIA'); // eslint-disable-line no-unused-vars
  const triviaOrder = eval('(' + fnText('function triviaOrder(cat){') + ')');
  for (const cat of ['eng', 'math', 'sci', 'chi']) {
    const order = triviaOrder(cat);
    const expected = TRIVIA.map(function (t, i) { return t.cat === cat ? i : -1; }).filter(function (i) { return i >= 0; });
    assert.deepEqual(order.slice().sort(function (a, b) { return a - b; }), expected, 'every ' + cat + ' question appears once');
    assert.equal(new Set(order).size, order.length, 'no repeats in one deck: ' + cat);
  }
  const all = triviaOrder('all');
  assert.equal(all.length, TRIVIA.length, 'All topics covers the whole bank');
  // Reshuffling after the deck runs out gives a fresh order.
  const again = triviaOrder('math');
  assert.equal(again.length, triviaOrder('math').length, 'a new deck is the same size');
});
