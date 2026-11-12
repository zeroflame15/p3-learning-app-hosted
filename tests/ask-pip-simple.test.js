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

test('the thinking bubble is never stored as a message (supersedes placeholder-by-index)', () => {
  const start = clientSrc.indexOf('function doSend(){');
  assert.ok(start >= 0, 'doSend found');
  const fn = clientSrc.slice(start, clientSrc.indexOf('\n  }\n', start));
  assert.ok(!fn.includes('phIdx'), 'no placeholder index: nothing is stored to replace');
  assert.ok(fn.includes('asking[th.id]=v'), 'the bubble is tracked in memory only');
  assert.ok(fn.includes('th2.msgs.push({who:\'pip\''), 'the reply is appended when it lands');
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

test('doSend always delivers an answer, even if the reply path throws', () => {
  assert.ok(clientSrc.includes('}).catch(function(){'), 'doSend has a catch on the reply promise');
  const afterCatch = clientSrc.slice(clientSrc.indexOf('}).catch(function(){'));
  assert.ok(afterCatch.includes("th3.msgs.push({who:'pip', text:pipReply(v)"), 'catch appends the built-in answer as a real message');
  assert.ok(afterCatch.includes('delete asking[th.id]'), 'catch clears the thinking bubble');
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

/* --- Root cause of the wedge (found 2026-11-05, after the 25s
   timeout failed to rescue a live hang) ---------------------------
   The "Pip is thinking…" placeholder was stored as a real message
   and synced to the server. On merge, the server's placeholder was
   unioned back alongside the fallback reply, so the thinking bubble
   stayed on screen forever — the timeout worked, the merge undid
   it. The bubble is now UI state only (asking[threadId]) and merges
   drop it. */

test('mergeThreads drops thinking placeholders instead of resurrecting them', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  function fnText(marker) {
    const s = html.indexOf(marker);
    assert.ok(s >= 0, marker + ' not found');
    const n = html.indexOf('\nfunction ', s + marker.length);
    const b = n >= 0 ? html.slice(s, n) : html.slice(s);
    return b.endsWith('\n') ? b.slice(0, -1) : b;
  }
  const mergeThreads = eval(
    fnText('function isThinkingMsg(m){') + '\n' +
    '(' + fnText('function mergeThreads(aThreads,bThreads){') + ')'
  );
  const local = [{ id: 't1', title: 'what is 3 x 4', msgs: [
    { who: 'pip', text: 'Hi!' },
    { who: 'kid', text: 'what is 3 x 4' },
    { who: 'pip', text: 'Hello! 3 added 4 times is 3 + 3 + 3 + 3 = 12.' },
  ]}];
  const server = [{ id: 't1', title: 'what is 3 x 4', msgs: [
    { who: 'pip', text: 'Hi!' },
    { who: 'kid', text: 'what is 3 x 4' },
    { who: 'pip', text: 'Pip is thinking… 🦦' },
  ]}];
  const merged = mergeThreads(local, server);
  assert.equal(merged[0].msgs.length, 3, 'no resurrected thinking bubble');
  assert.ok(!merged[0].msgs.some((m) => m.text.indexOf('Pip is thinking') === 0), 'thinking placeholder is gone');
  assert.ok(merged[0].msgs.some((m) => m.text.indexOf('3 + 3 + 3 + 3 = 12') >= 0), 'the real reply survives');
  const mergedNew = mergeThreads([], server);
  assert.equal(mergedNew[0].msgs.length, 2, 'a thread that is only a thinking bubble is cleaned too');
});

test('doSend never stores a thinking message; the bubble is UI state only', () => {
  const start = clientSrc.indexOf('function doSend(){');
  assert.ok(start >= 0, 'doSend found');
  const fn = clientSrc.slice(start, clientSrc.indexOf('\n  }\n', start));
  assert.ok(!fn.includes("text:'Pip is thinking"), 'no thinking message is pushed into the thread');
  assert.ok(fn.includes('asking[th.id]=v'), 'the in-flight ask is tracked per thread');
  assert.ok(fn.includes('th2.msgs.push({who:\'pip\''), 'the reply is appended as a real message on settle');
  assert.ok(fn.includes('delete asking[th.id]'), 'the bubble is cleared when the reply lands');
});

test('the Ask page renders the thinking bubble from asking state and filters old ones', () => {
  const ask = clientSrc.slice(clientSrc.indexOf('function askHTML(){'), clientSrc.indexOf('function bindAsk(){'));
  assert.ok(ask.includes("asking[th.id]?'<div class=\"msg pip\">Pip is thinking"), 'bubble renders from asking state');
  assert.ok(ask.includes('filter(function(m){ return !isThinkingMsg(m); })'), 'stored thinking placeholders are filtered out of the chat log');
});

/* --- Vanishing first send (seen live three times, 2026-11-05) ----
   A sync merge REPLACES the DB object, but the old code never
   re-rendered after it — so Ask Pip's send handler kept holding
   the old detached explorer. A question (and its reply) written
   through that stale reference was silently lost when save()
   serialised the new DB, and the chat fell back to its greeting.
   The send must resolve the thread from the live database. */

test('doSend resolves the thread from the live database, not the rendered explorer', () => {
  const start = clientSrc.indexOf('function doSend(){');
  assert.ok(start >= 0, 'doSend found');
  const fn = clientSrc.slice(start, clientSrc.indexOf('\n  }\n', start));
  assert.ok(fn.includes('var eNow=ex();'), 'send resolves a fresh explorer');
  assert.ok(fn.includes('eNow.threads.find'), 'thread is found in the fresh explorer');
  assert.ok(fn.includes('var eLive=ex();'), 'the reply path resolves a fresh explorer too');
  assert.ok(fn.includes('var eLive2=ex();'), 'the catch path resolves a fresh explorer too');
});

test('ask-pip strips markdown so a child never sees literal **bold**', () => {
  const start = askPipSrc.indexOf('function cleanReply(text) {');
  assert.ok(start >= 0, 'cleanReply found');
  const end = askPipSrc.indexOf('\n}\n', start);
  const cleanReply = eval('(' + askPipSrc.slice(start, end + 2) + ')');
  assert.equal(
    cleanReply('A plant starts as a tiny **seed**. It **germinates** into a **seedling**.'),
    'A plant starts as a tiny seed. It germinates into a seedling.',
    'bold markers are stripped, words kept'
  );
  assert.equal(cleanReply('# Plants\nWater the `seed` daily.'), 'Plants\nWater the seed daily.', 'headings and code ticks are stripped');
  assert.equal(cleanReply('3 x 4 = 12 and 7 × 8 = 56'), '3 x 4 = 12 and 7 × 8 = 56', 'plain maths is untouched');
  assert.ok(askPipSrc.includes('markdown like **bold**'), 'the prompt tells the model not to use markdown');
});

test('the reply signature is hidden from the child chat view but still stored', () => {
  const ask = clientSrc.slice(clientSrc.indexOf('function askHTML(){'), clientSrc.indexOf('function bindAsk(){'));
  assert.ok(!ask.includes('Signed:'), 'no Signed line is rendered in the chat');
  assert.ok(!ask.includes('m.signature'), 'the signature is not shown in the chat view');
  assert.ok(ask.includes('Method:'), 'the Method line still shows (it names the topic, not the machinery)');
  assert.ok(clientSrc.includes("signature:live.signature||''"), 'the signature is still stored on the message for tracing');
});

test('Ask Pip replies have no Listen button (the device voice does not sound nice)', () => {
  const ask = clientSrc.slice(clientSrc.indexOf('function askHTML(){'), clientSrc.indexOf('function bindAsk(){'));
  assert.ok(!ask.includes('data-listen'), 'no Listen button is rendered under Pip replies');
  assert.ok(!ask.includes('🔊 Listen'), 'no Listen label in the chat view');
  assert.ok(ask.includes('data-flag'), 'Flag this is still there');
  assert.ok(clientSrc.includes('function speakPip'), 'speakPip still exists for the English spelling Listen buttons in Learn');
});
