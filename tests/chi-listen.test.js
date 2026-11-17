// Chinese Listen button in Learn quests (2026-11-17).
// Bryan asked for a Listen button on every P3 Chinese question in
// Learn so Jiyuna can hear the question read aloud. The read-aloud
// engine (speakPip) already handles Chinese — it detects Chinese
// text, picks a Chinese voice, and tells the child how to add one
// if the phone has none — so this wires that engine into the quest
// and warm-up screens for Chinese topics. The November 12 removal
// of Listen from Chinese SPELLING tests is untouched: spelling
// stays listen-free, quests gain the button.
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

test('listenTextFor strips only a leading "Listen:" prompt, nothing else', () => {
  const listenTextFor = eval('(' + fnText('function listenTextFor(q){') + ')');
  assert.equal(listenTextFor({ q: 'Listen: mā ma（妈妈）means…' }), 'mā ma（妈妈）means…', 'the prompt prefix is skipped when speaking');
  assert.equal(listenTextFor({ q: 'Listen:今天早上，小华和妈妈去巴刹买菜。' }), '今天早上，小华和妈妈去巴刹买菜。', 'prefix without a space is stripped too');
  assert.equal(listenTextFor({ q: '漂亮 (piào liang) means…' }), '漂亮 (piào liang) means…', 'a stem with no prefix is read as-is');
  assert.equal(listenTextFor({ q: '小朋友认真地听爷爷讲故事。' }), '小朋友认真地听爷爷讲故事。', 'Chinese with no prefix is read as-is');
  assert.equal(listenTextFor({ q: 'Please listen carefully, then choose.' }), 'Please listen carefully, then choose.', '"listen" mid-sentence is part of the question and stays');
  assert.equal(listenTextFor({ q: '' }), '', 'an empty question reads as empty');
  assert.equal(listenTextFor({}), '', 'a question with no text reads as empty');
});

test('quest questions show a Listen button for Chinese topics only', () => {
  const quizSrc = fnText('function quizHTML(){');
  assert.ok(quizSrc.indexOf("var _listen=(t.sub==='chi')") >= 0, 'the button is gated on the topic being Chinese');
  assert.ok(quizSrc.indexOf('id="qListen"') >= 0, 'the quest screen has a qListen button');
  assert.ok(quizSrc.indexOf('🔊 Listen to the question') >= 0, 'the button says what it does');
  assert.ok(quizSrc.indexOf("+'</h3>'+_hint+_listen") >= 0, 'the button sits right under the question, before the options');
  const bindSrc = fnText('function bindQuiz(){');
  assert.ok(bindSrc.indexOf("getElementById('qListen')") >= 0, 'bindQuiz wires the button');
  assert.ok(bindSrc.indexOf('speakPip(listenTextFor(q))') >= 0, 'tapping it reads the current question aloud');
});

test('warm-up questions show the same Listen button for Chinese topics', () => {
  const warmSrc = fnText('function warmupHTML(){');
  assert.ok(warmSrc.indexOf("var _wListen=(t.sub==='chi')") >= 0, 'the warm-up button is gated on the topic being Chinese');
  assert.ok(warmSrc.indexOf('id="wuListen"') >= 0, 'the warm-up screen has a wuListen button');
  const bindSrc = fnText('function bindWarmup(){');
  assert.ok(bindSrc.indexOf("getElementById('wuListen')") >= 0, 'bindWarmup wires the button');
  assert.ok(bindSrc.indexOf('speakPip(listenTextFor(wq))') >= 0, 'tapping it reads the current warm-up question aloud');
});

test('speakPip reads Chinese with a Chinese voice, never an English one', () => {
  const speakSrc = fnText('function speakPip(text){');
  assert.ok(speakSrc.indexOf("var isChi=/[\\u4e00-\\u9fff]/.test(text)") >= 0, 'Chinese text is detected by its characters');
  assert.ok(speakSrc.indexOf("u.lang=isChi?'zh-CN':'en-SG'") >= 0, 'Chinese is spoken with a zh-CN voice');
  assert.ok(speakSrc.indexOf('No Chinese voice on this phone yet') >= 0, 'a phone with no Chinese voice gets guidance instead of silence');
});

test('Chinese spelling tests still have no Listen button (Nov 12 removal stands)', () => {
  const spellSrc = fnText('function spellTestHTML(){');
  assert.ok(spellSrc.indexOf("(isChiSp?'':'<button class=\"btn teal\" data-spelllisten") >= 0, 'Chinese spelling practice keeps no Listen button — only quests gain one');
});
