// Tests for the simplified Ask Pip: a plain chatbot, no skill
// routing, no "how one agent thinks" machinery.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const askPipSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'ask-pip.js'), 'utf8');
const clientSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('ask-pip no longer routes through think()/skill pack', () => {
  assert.ok(!askPipSrc.includes("require('../lib/think')"), 'must not import think');
  assert.ok(!askPipSrc.includes("require('../lib/skills')"), 'must not import skills');
  assert.ok(!askPipSrc.includes('think('), 'must not call think()');
});

test('ask-pip prompt forbids $ and LaTeX, and demands direct answers', () => {
  assert.ok(askPipSrc.includes('Never use the $ character'), 'prompt forbids $');
  assert.ok(askPipSrc.includes('never deflect'), 'prompt forbids deflection');
  assert.ok(askPipSrc.includes('Answer the question directly'), 'prompt demands a direct answer');
});

test('ask-pip uses the code-decided sum as a fact', () => {
  assert.ok(askPipSrc.includes("require('../lib/arithmetic')"), 'imports arithmetic');
  assert.ok(askPipSrc.includes('extractSimpleSum'), 'extracts the sum');
  assert.ok(askPipSrc.includes('worked out exactly'), 'hands the model the fact');
});

test('ask-pip strips LaTeX from replies', () => {
  assert.ok(askPipSrc.includes('cleanReply'), 'has a cleaner');
  assert.ok(askPipSrc.includes("replace(/\\\\times/g, 'x')"), 'converts \\times');
});

test('client replaces the placeholder by index, not by last message', () => {
  assert.ok(clientSrc.includes('var phIdx=th.msgs.length;'), 'captures placeholder index');
  assert.ok(clientSrc.includes('var last=th2.msgs[phIdx];'), 'updates that exact placeholder');
});

test('offline fallback answers plant, butterfly and verb questions for real', () => {
  const plant = clientSrc.match(/if\(s\.indexOf\('plant'\)>=0[^;]*return '([^']*)'/);
  assert.ok(plant && plant[1].includes('seed'), 'plant fallback gives the life cycle');
  assert.ok(clientSrc.includes('metamorphosis'), 'butterfly fallback gives metamorphosis');
  assert.ok(clientSrc.includes('action word'), 'verb fallback defines a verb');
});

/* --- Ask Pip wedge hardening (seen live 2026-11-05) -----------------
   A plant question hung on "Pip is thinking…" for 7+ minutes and
   wedged the whole Ask Pip screen (new chats and Clear all chats
   went inert) while Gemini returned 503s. The call must never
   reject and never hang. */

test('askPipLive never rejects and never hangs: hard race timeout plus abort', () => {
  const start = clientSrc.indexOf('async function askPipLive(');
  assert.ok(start >= 0, 'askPipLive found');
  const fn = clientSrc.slice(start, clientSrc.indexOf('\nfunction pipReply(', start));
  assert.ok(fn.includes('Promise.race([work, hardTimeout(25000)])'), '25s hard race bounds the call');
  assert.ok(fn.includes('function hardTimeout(ms)'), 'race timeout helper exists');
  assert.ok(fn.indexOf('skillForQuestionClient(text)') > fn.indexOf('try{'), 'skill lookup is inside the try');
  assert.ok(fn.includes('catch(e){ return null; }'), 'failures resolve to null, never reject');
});

test('doSend always clears the placeholder, even if the reply path throws', () => {
  assert.ok(clientSrc.includes('}).catch(function(){'), 'doSend has a catch on the reply promise');
  const afterCatch = clientSrc.slice(clientSrc.indexOf('}).catch(function(){'));
  assert.ok(afterCatch.includes("m.text=pipReply(v)"), 'catch replaces the placeholder with the built-in answer');
  assert.ok(afterCatch.includes('save(); render();'), 'catch still re-renders so the screen never wedges');
});

test('server retries once on a transient model failure', () => {
  assert.ok(askPipSrc.includes('for (let attempt = 0; attempt < 2; attempt++)'), 'two attempts');
  assert.ok(askPipSrc.includes('[502, 503, 504].includes(r.status)'), 'retries only transient statuses');
  assert.ok(askPipSrc.includes('await sleep(1500)'), 'waits 1.5s between attempts');
});

test('the app shell is never served from a stale cache', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const noCache = (vercel.headers || []).filter((h) =>
    (h.source === '/' || h.source === '/index.html') &&
    (h.headers || []).some((x) => x.key === 'Cache-Control' && x.value.includes('no-cache') && x.value.includes('no-store')));
  assert.equal(noCache.length, 2, 'both / and /index.html send no-cache, no-store');
});
