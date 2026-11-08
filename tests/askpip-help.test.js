// Ask Pip app help (2026-11-08, Bryan): Pip can explain how to use
// the app — add friends, change my avatar, where is my family code,
// and the rest. pipHelp(text) is checked in doSend BEFORE the live
// call, so a how-to question is answered instantly from a verified
// map — no API call, always correct. Every step in every answer was
// checked against the real menu names, button labels and flows in
// public/index.html. Matching is by whole-word sets, never a bare
// keyword: a Maths question that happens to say "star" must still
// go live. The avatar answer never mentions hair, so it stays true
// for the current UI and the round-2 redesign alike.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

const pipHelp = eval('(' + fnBody('function pipHelp(text){') + ')');

function ans(q) { return pipHelp(q); }

// --- The three questions Bryan asked ---

test('help: where is my family code?', () => {
  const a = ans('where is my family code?');
  assert.ok(a, 'should answer');
  assert.ok(a.indexOf('Family sync') >= 0, 'points at the Family sync card');
  assert.ok(a.indexOf('Copy code') >= 0, 'mentions the Copy code button');
});

test('help: how do I add a friend?', () => {
  const a = ans('how do I add a friend?');
  assert.ok(a, 'should answer');
  assert.ok(a.indexOf('Add a friend') >= 0, 'names the Add a friend button');
  assert.ok(a.indexOf('Send request') >= 0, 'names the Send request button');
});

test('help: how do I change my avatar?', () => {
  const a = ans('how do I change my avatar?');
  assert.ok(a, 'should answer');
  assert.ok(a.indexOf('Change my name') >= 0, 'names the Change my name & look menu item');
  assert.ok(a.toLowerCase().indexOf('hair') < 0, 'never mentions hair');
});

// --- The other topics ---

test('help: picture code', () => {
  assert.ok(ans('I forgot my picture code').indexOf('Reset picture code') >= 0);
  assert.ok(ans('how do I change my picture code').indexOf('Reset picture code') >= 0);
});

test('help: parent PIN', () => {
  assert.ok(ans('how do I change the parent pin').indexOf('Change PIN') >= 0);
  assert.ok(ans('I forgot my pin').indexOf('Change PIN') >= 0);
});

test('help: grown-ups page', () => {
  assert.ok(ans('where is the grown-ups page').indexOf('Grown-ups') >= 0);
  assert.ok(ans('how do I get to the parent page').indexOf('Grown-ups') >= 0);
});

test('help: friend code', () => {
  const a = ans('what is my friend code');
  assert.ok(a.toLowerCase().indexOf('friend code') >= 0, 'names the friend code');
  assert.ok(a.toLowerCase().indexOf('copy') >= 0, 'says tap to copy');
});

test('help: add another explorer', () => {
  assert.ok(ans('how do I add another explorer').indexOf('Add another explorer') >= 0);
  assert.ok(ans('how do I add a child').indexOf('Add another explorer') >= 0);
});

test('help: link a new device', () => {
  const a = ans('how do I link a new device');
  assert.ok(a.indexOf('Link this device') >= 0, 'names the link button');
  assert.ok(ans('how do I play on another device').indexOf('Link this device') >= 0);
});

test('help: golden bookmark', () => {
  const a = ans('how do I use the golden bookmark');
  assert.ok(a.indexOf('40') >= 0, 'states the 40-star cost');
  assert.ok(a.indexOf('Save') >= 0, 'names the Save button');
  assert.ok(ans('how do I save an answer').indexOf('Golden Bookmark') >= 0);
  assert.ok(ans('how do I unbookmark an answer') !== null, 'unbookmark is covered');
});

test('help: delete one chat', () => {
  const a = ans('how do I delete one chat');
  assert.ok(a.indexOf('All chats') >= 0, 'points at the chat list');
  assert.ok(ans('how do I delete a chat with Pip') !== null);
});

test('help: play limit', () => {
  const a = ans('what is the play limit');
  assert.ok(a.indexOf('20') >= 0, 'states the 20-minute limit');
  assert.ok(ans('how long can I play').indexOf('20') >= 0);
});

test('help: primary level', () => {
  const a = ans('how do I change my primary level');
  assert.ok(a.indexOf('P1') >= 0, 'names the levels');
  assert.ok(ans('what level am I').indexOf('level') >= 0);
});

test('help: stars and progress', () => {
  assert.ok(ans('how many stars do I have').toLowerCase().indexOf('star') >= 0);
  assert.ok(ans('how do I check my progress').toLowerCase().indexOf('progress') >= 0);
  assert.ok(ans('how am I doing') !== null, 'how am I doing is a progress question');
});

test('help: how to use the app', () => {
  const a = ans('how do I use this app');
  assert.ok(a.indexOf('add a friend') >= 0, 'lists example questions');
  assert.ok(ans('what can you do').indexOf('family code') >= 0);
});

// --- Near misses must still go live, never hijacked ---

test('help: near misses return null (go live)', () => {
  assert.equal(ans('how many stars are in the sky'), null);
  assert.equal(ans('what is 20 minutes in seconds'), null);
  assert.equal(ans('my friend has 5 apples and gives away 2'), null);
  assert.equal(ans('what is a bookmark in a book'), null);
  assert.equal(ans('tell me about the star fish'), null);
  assert.equal(ans('how do magnets work'), null);
  assert.equal(ans('what is 7 times 8'), null);
  assert.equal(ans(''), null);
  assert.equal(ans(null), null);
});

// --- Wiring: help is checked before the live call, and in the fallback ---

test('help: doSend checks pipHelp before the live call', () => {
  const start = html.indexOf('function doSend(){');
  assert.ok(start >= 0, 'doSend not found');
  const body = html.slice(start, html.indexOf('\nfunction ', start + 1) >= 0 ? html.indexOf('\nfunction ', start + 1) : undefined);
  const helpAt = body.indexOf('pipHelp(');
  const liveAt = body.indexOf('askPipLive(');
  assert.ok(helpAt >= 0, 'doSend must call pipHelp');
  assert.ok(liveAt >= 0, 'doSend must call askPipLive');
  assert.ok(helpAt < liveAt, 'help check must come before the live call');
});

test('help: pipReply also answers help questions (offline fallback)', () => {
  const start = html.indexOf('function pipReply(text){');
  assert.ok(start >= 0, 'pipReply not found');
  const body = html.slice(start, html.indexOf('\nfunction ', start + 1) >= 0 ? html.indexOf('\nfunction ', start + 1) : undefined);
  assert.ok(body.indexOf('pipHelp(') >= 0, 'pipReply must check pipHelp first');
});

// --- Answers stay short ---

test('help: answers are short enough to read', () => {
  const qs = ['where is my family code?', 'how do I add a friend?', 'how do I change my avatar?', 'how do I use the golden bookmark', 'what is the play limit', 'how do I link a new device'];
  for (const q of qs) {
    const a = ans(q);
    assert.ok(a && a.length < 650, q + ' answer too long: ' + (a ? a.length : 0));
  }
});
