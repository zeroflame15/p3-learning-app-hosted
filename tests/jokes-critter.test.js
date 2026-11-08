// Classroom Jokes sidebar section (requested 2026-11-08): a break
// for a good laugh — one joke at a time, punchline on tap. Friends
// sits at the bottom of the sidebar. And the Critter Lab detail
// card now shows right where the child tapped, not up at the top.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAGE_PATH = process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html');
const html = fs.readFileSync(PAGE_PATH, 'utf8');

function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}

test('Jokes is in the sidebar and Vibe is the last item', () => {
  const NAV = eval(grabVar('NAV') + '\n;NAV');
  assert.equal(NAV.length, 11, '11 nav items, got ' + NAV.length);
  const jokes = NAV.find(function (n) { return n[0] === 'jokes'; });
  assert.ok(jokes, 'Jokes in NAV');
  assert.equal(jokes[1], '😂', 'Jokes uses the laughing emoji');
  assert.equal(jokes[2], 'Jokes', 'Jokes label');
  assert.equal(jokes[3], '', 'Jokes has no custom icon file yet — emoji fallback via ic()');
  const idx = {};
  NAV.forEach(function (n, i) { idx[n[0]] = i; });
  assert.ok(idx.vibe > idx.jokes, 'Vibe sits last, after Jokes');
  assert.ok(idx.jokes < idx.friends, 'Jokes comes before Friends');
  assert.equal(NAV[NAV.length - 2][0], 'friends', 'Friends is second-to-last');
  assert.equal(NAV[NAV.length - 1][0], 'vibe', 'Vibe is the last sidebar item');
  assert.ok(html.includes("jokes:'Classroom Jokes'"), 'Jokes page title');
  assert.ok(html.includes("else if(route==='jokes')c.innerHTML=jokesHTML(),bindJokes();"), 'jokes route renders jokesHTML');
});

test('CLASS_JOKES bank: 24 clean classroom jokes, setup + punchline, no repeats', () => {
  const JOKES = eval(grabVar('CLASS_JOKES') + '\n;CLASS_JOKES');
  assert.equal(JOKES.length, 24, '24 jokes, got ' + JOKES.length);
  const setups = new Set();
  for (const j of JOKES) {
    assert.ok(typeof j.q === 'string' && j.q.length > 10, 'a real setup: ' + j.q);
    assert.ok(typeof j.a === 'string' && j.a.length > 2, 'a real punchline: ' + j.q);
    assert.ok(!j.q.includes(j.a), 'the punchline is not spoiled inside the setup: ' + j.q);
    setups.add(j.q);
  }
  assert.equal(setups.size, JOKES.length, 'no duplicated setups');
});

test('jokeOrder shuffles the full bank, and the card hides the punchline until tapped', () => {
  const JOKES = eval(grabVar('CLASS_JOKES') + '\n;CLASS_JOKES');
  // jokeOrder builds an index list and shuffles it with the global shuffle.
  const orderFn = html.slice(html.indexOf('function jokeOrder(){'), html.indexOf('function jokesHTML(){'));
  const shuffleStub = 'var shuffle=function(a){ return a.slice(); };';
  const order = eval(shuffleStub + '\nvar CLASS_JOKES=' + JSON.stringify(JOKES) + ';\n' + orderFn + '\njokeOrder()');
  assert.deepEqual(order, JOKES.map(function (j, i) { return i; }), 'with an identity shuffle the order is the full index list');
  // jokesHTML: setup shown, punchline hidden until the reveal tap.
  const htmlFn = html.slice(html.indexOf('function jokesHTML(){'), html.indexOf('function bindJokes(){'));
  const stub = 'var pageHero=function(){ return "HERO"; }; var esc=function(s){ return s; }; var shuffle=function(a){ return a.slice(); }; var jokeState=null;';
  const out = eval(stub + '\nvar CLASS_JOKES=' + JSON.stringify(JOKES) + ';\n' + orderFn + '\n' + htmlFn + '\njokesHTML()');
  assert.ok(out.includes(JOKES[0].q), 'the first joke setup is shown');
  assert.ok(out.includes('id="jkShow"'), 'a Show the punchline button is offered');
  assert.ok(!out.includes(JOKES[0].a), 'the punchline stays hidden until tapped');
  assert.ok(out.includes('Show the punchline'), 'the button says what it does');
  const out2 = eval(stub + '\nvar CLASS_JOKES=' + JSON.stringify(JOKES) + ';\n' + orderFn + '\n' + htmlFn + '\njokeState={order:[0], idx:0, revealed:true, seen:0}; jokesHTML()');
  assert.ok(out2.includes(JOKES[0].a), 'after the tap the punchline shows');
  assert.ok(out2.includes('id="jkNext"'), 'a Tell me another button follows');
  assert.ok(html.includes('if(jokeState.idx>=jokeState.order.length){ jokeState.order=jokeOrder(); jokeState.idx=0; }'), 'the order reshuffles once all jokes are told');
});

test('critter detail shows where the child tapped — inline under its category, scrolled into view', () => {
  // The detail card carries an id so the tap handler can scroll to it.
  assert.ok(html.includes('id="critterDetail"'), 'the detail card has an id');
  // It renders inline in the collection, directly under the grid of
  // the category the selected critter belongs to.
  assert.ok(html.includes("+(sel&&sel.cat===cat.id?detail:'')"), 'detail is appended after its own category grid');
  // The old fixed-position render (after Visiting, before the whole
  // collection) is gone — that was the scroll-to-the-top problem.
  assert.ok(!html.includes('+ visitingHTML + detail'), 'no fixed-position detail render above the collection');
  assert.ok(html.includes('   + visitingHTML'), 'Visiting still renders in its place');
  // The tap handler brings the card into view after the re-render.
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function placeFrog(){') >= 0 ? html.indexOf('function placeFrog(){') : html.indexOf('function bindCritter(){') + 8000);
  assert.ok(bind.includes("document.getElementById('critterDetail')"), 'the tap handler finds the detail card');
  assert.ok(bind.includes("scrollIntoView({behavior:'smooth',block:'nearest'})"), 'the tap handler scrolls it into view');
});
