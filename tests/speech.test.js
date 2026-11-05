// Pip read-aloud on iPhone Chrome: the speaker was silent.
// iOS quirks fixed here: getVoices() can stay empty and
// voiceschanged may never fire (old code waited forever);
// cancel() then speak() in the same tick swallows the utterance;
// queued utterances stall (sentences must chain via onend).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const start = html.indexOf('function speakPip(text){');
assert.ok(start >= 0, 'speakPip not found');
const fn = html.slice(start, html.indexOf('\nif(\'speechSynthesis\' in window)', start));

test('speakPip never waits for voices: it speaks with the system default when none are listed', () => {
  assert.ok(!fn.includes('onvoiceschanged=once'), 'no voiceschanged wait loop');
  assert.ok(!fn.includes('setTimeout(function(){ if(speechSynthesis.onvoiceschanged'), 'no 1200ms voice wait');
  assert.ok(fn.includes('return ok[0]||vs[0]||null'), 'no voice found means null, not a wait');
  assert.ok(fn.includes('if(v)u.voice=v'), 'voice is only set when one was picked');
});

test('speakPip never cancels and speaks in the same tick', () => {
  assert.ok(fn.includes('setTimeout(function(){ say(0); },150)'), 'speak starts 150ms after a cancel');
  assert.ok(!fn.includes('speechSynthesis.cancel();\n  var voices'), 'no immediate cancel-then-speak');
});

test('speakPip chains sentences via onend instead of queueing them all at once', () => {
  assert.ok(fn.includes('u.onend=function(){ say(i+1); };'), 'next sentence starts when the previous ends');
  assert.ok(!fn.includes('parts.forEach(function(p){'), 'sentences are not all queued in a loop');
});

test('speakPip tells the user to check volume and the silent switch when speech errors', () => {
  assert.ok(fn.includes('silent switch'), 'error hint mentions the silent switch');
  assert.ok(fn.includes("ev.error!=='canceled'"), 'a user cancel is not treated as an error');
});

test('Chinese picks a Chinese voice first', () => {
  assert.ok(fn.includes("isChi?['xiaoxiao','tingting','meijia','google']"), 'Chinese voice list first for Chinese text');
  assert.ok(fn.includes("u.lang=isChi?'zh-CN':'en-SG'"), 'utterance language matches the text');
});
