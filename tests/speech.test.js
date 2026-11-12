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
  assert.ok(fn.includes('u.onend=function(){ clearTimeout(stallTimer); say(i+1); };'), 'next sentence starts when the previous ends');
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

test('Chinese never gets an English voice when no Chinese voice is installed', () => {
  // Bryan's iPhone Chrome was silent on Listen: with no zh voice
  // listed, pickVoice fell back to all voices and handed an English
  // voice a Chinese sentence with lang zh-CN — iOS swallows that
  // with no sound and no error. Now it returns null instead.
  // An EMPTY voice list means the voices have not loaded yet, not
  // that none is installed — only a loaded list without zh counts.
  assert.ok(fn.includes("if(isChi){ if(voices.length)noChiVoice=true; return null; }"), 'no zh voice in a loaded list means no voice for Chinese, not an English one');
  assert.ok(fn.includes('noChiVoice'), 'the missing-voice case is tracked');
});

test('speakPip refuses to speak Chinese — and says so — when the phone lists voices but no Chinese one', () => {
  // 2026-11-12: the button's own "say it out loud" toast fired right
  // after speakPip and overwrote the install-path guidance in the
  // same tick (one toast element), so Bryan only ever saw the
  // encouragement and heard nothing. Now speakPip probes first and
  // returns false when it cannot speak, so the button stays quiet
  // and the guidance stays visible.
  assert.ok(fn.includes('var probeVoice=pickVoice();'), 'the voice is probed before speaking');
  assert.ok(fn.includes('if(isChi&&noChiVoice){'), 'the probe gates on the missing-voice flag');
  assert.ok(fn.includes('return false;'), 'speakPip reports it cannot speak');
  assert.ok(fn.includes('return true;'), 'speakPip reports speech will happen otherwise');
});

test('Chinese quests have no Listen button any more; the English spelling Listen still gates its toast', () => {
  // 2026-11-12: Bryan asked for Listen to go from Chinese learning
  // after it stayed silent on his iPhone. The quest Listen button
  // and its handler are gone, and so is the note on Chinese quest
  // cards; spelling Listen survives only for English tests (Chinese
  // tests render no Listen button at all).
  assert.ok(!html.includes('id="qListen"'), 'no quest Listen button');
  assert.ok(!html.includes('🔊 Listen — then say it out loud!'), 'no quest Listen label');
  assert.ok(!html.includes('speakPip(m?m[0]:q.q)'), 'no quest Listen handler');
  assert.ok(!html.includes('🔊 This quest has a Listen button'), 'no Listen note on Chinese quest cards');
  assert.ok(html.includes("if(speakPip(b.getAttribute('data-spelllisten')))"), 'spelling Listen toasts only when speech will happen');
  assert.ok(!html.includes("speakPip(b.getAttribute('data-spelllisten')); toast("), 'no unguarded toast after the spelling Listen call');
});

test('a stalled utterance surfaces the silent-switch hint instead of staying silent', () => {
  // A stalled utterance never fires onend/onerror on iOS. The
  // watchdog cancels it after 3s and says why it may be silent.
  assert.ok(fn.includes('stallTimer=setTimeout(function(){'), 'a start watchdog exists');
  assert.ok(fn.includes('},3000)'), 'the watchdog waits 3s');
  assert.ok(fn.includes('u.onstart=function(){ started=true; clearTimeout(stallTimer); };'), 'a started utterance clears the watchdog');
  assert.ok(fn.includes('iPhones mute read-aloud when silent mode is on'), 'the stall hint names the silent switch');
});

test('a missing Chinese voice tells the user how to add one', () => {
  assert.ok(fn.includes('Settings → Accessibility → Spoken Content → Voices → Chinese'), 'the hint gives the install path');
});
