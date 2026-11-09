// Why-box: "Why do you think so?" after an answered quest or
// warm-up question. Pip gives short feedback on the child's
// reasoning via the existing Ask Pip path (askPipLive, plain
// mode). The box is optional and session-only: it never blocks
// Next, the answer-only timer, or star awarding, and the
// reasoning is never stored on the explorer record.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
function fnSrc(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const end = html.indexOf('\n}\n', start);
  assert.ok(end >= 0, marker + ' has no closing brace');
  return html.slice(start, end + 3);
}

const MCQ = { q: 'What is 3 + 4?', o: ['6', '7', '8', '9'], a: 1, c: 'Count on from 3: 4, 5, 6, 7!' };
const FIB = { q: '3 + 4 = ___.', o: [], a: 0, c: 'Count on from 3!', k: 'fib', ans: '7' };

function loadWhyFns() {
  const esc = eval('(' + fnText('function esc(s){') + ')');
  const isFibQuestion = eval('(' + fnText('function isFibQuestion(q){') + ')');
  const whyIsCorrect = eval('(' + fnText('function whyIsCorrect(') + ')');
  const whyPickedText = eval('(' + fnText('function whyPickedText(') + ')');
  const whyPrompt = eval('(' + fnText('function whyPrompt(') + ')');
  const whyFallback = eval('(' + fnText('function whyFallback(') + ')');
  const whyBoxHTML = eval('(' + fnText('function whyBoxHTML(') + ')');
  return { esc, isFibQuestion, whyIsCorrect, whyPickedText, whyPrompt, whyFallback, whyBoxHTML };
}

test('why-box renders after an answer is marked: textarea, Tell Pip, Skip', () => {
  const { whyBoxHTML } = loadWhyFns();
  const st = { answered: true, picked: 1, idx: 0 };
  const out = whyBoxHTML('quest', st);
  assert.ok(out.includes('Why do you think so?'), 'asks why');
  assert.ok(out.includes('id="whyInput"'), 'has a reasoning box');
  assert.ok(out.includes('id="whySend"'), 'has Tell Pip');
  assert.ok(out.includes('id="whySkip"'), 'has Skip');
  assert.ok(out.includes('optional'), 'says it is optional');
  assert.ok(out.includes('never changes your stars'), 'says stars are safe');
});

test('why-box renders nothing before an answer, and nothing after Skip', () => {
  const { whyBoxHTML } = loadWhyFns();
  assert.equal(whyBoxHTML('quest', { answered: false, picked: null }), '', 'unanswered: no box');
  assert.equal(whyBoxHTML('quest', null), '', 'no run: no box');
  assert.equal(whyBoxHTML('quest', { answered: true, picked: 1, whyState: 'skipped' }), '', 'skipped: box goes away');
  assert.equal(whyBoxHTML('warmup', { answered: true, picked: 0, whyState: 'skipped' }), '', 'warm-up skipped: no box');
});

test('why-box thinking state shows Pip thinking; done state shows the reply', () => {
  const { whyBoxHTML } = loadWhyFns();
  const thinking = whyBoxHTML('quest', { answered: true, picked: 1, whyState: 'thinking', whyText: 'because 3 plus 4 is 7' });
  assert.ok(thinking.includes('Pip is thinking'), 'thinking state shows Pip thinking');
  assert.ok(thinking.includes('because 3 plus 4 is 7'), 'thinking state keeps the child’s words');
  assert.ok(!thinking.includes('id="whySend"'), 'thinking state has no second Send');
  const done = whyBoxHTML('quest', { answered: true, picked: 1, whyState: 'done', whyText: 'because I counted on', whyReply: 'Lovely thinking!' });
  assert.ok(done.includes('Lovely thinking!'), 'done state shows Pip’s reply');
  assert.ok(done.includes('because I counted on'), 'done state keeps the child’s words');
});

test('why-box escapes the child’s reasoning (no HTML injection)', () => {
  const { whyBoxHTML } = loadWhyFns();
  const out = whyBoxHTML('quest', { answered: true, picked: 1, whyState: 'done', whyText: '<script>alert(1)</script>', whyReply: '<b>bold</b>' });
  assert.ok(!out.includes('<script>'), 'reasoning is escaped');
  assert.ok(out.includes('&lt;script&gt;'), 'escaped reasoning is visible as text');
  assert.ok(!out.includes('<b>bold</b>'), 'Pip reply is escaped too');
});

test('whyIsCorrect / whyPickedText handle MCQ and fill-in-the-blank', () => {
  const { whyIsCorrect, whyPickedText } = loadWhyFns();
  assert.equal(whyIsCorrect('quest', { picked: 1 }, MCQ), true, 'MCQ right pick is correct');
  assert.equal(whyIsCorrect('quest', { picked: 0 }, MCQ), false, 'MCQ wrong pick is not');
  assert.equal(whyPickedText('quest', { picked: 1 }, MCQ), '7', 'MCQ picked text is the option');
  assert.equal(whyIsCorrect('quest', { fibCorrect: true, fibTyped: '7' }, FIB), true, 'FIB right typing is correct');
  assert.equal(whyIsCorrect('quest', { fibCorrect: false, fibTyped: '6' }, FIB), false, 'FIB wrong typing is not');
  assert.equal(whyPickedText('quest', { fibCorrect: false, fibTyped: '6' }, FIB), '6', 'FIB picked text is what was typed');
  assert.equal(whyIsCorrect('warmup', { picked: 0 }, MCQ), false, 'warm-up uses the MCQ rule');
});

test('whyPrompt hands Pip the question, the right answer, the pick and the reasoning', () => {
  const { whyPrompt } = loadWhyFns();
  const p = whyPrompt(MCQ, true, '7', 'I counted on from 3', '7', 'Addition');
  assert.ok(p.includes('What is 3 + 4?'), 'prompt has the question');
  assert.ok(p.includes('The right answer is "7"'), 'prompt has the right answer');
  assert.ok(p.includes('I picked "7"'), 'prompt has the pick');
  assert.ok(p.includes('I counted on from 3'), 'prompt has the reasoning');
  assert.ok(p.includes('Was my thinking right?'), 'prompt asks Pip to judge the thinking');
  assert.ok(p.includes('2 short sentences'), 'prompt keeps Pip short');
});

test('whyFallback is encouraging, and uses the clue when the thinking was wrong', () => {
  const { whyFallback } = loadWhyFns();
  assert.ok(whyFallback(true, '').includes('Lovely thinking'), 'right thinking gets praise');
  const wrong = whyFallback(false, 'Count on from 3: 4, 5, 6, 7!');
  assert.ok(wrong.includes('Good brave thinking'), 'wrong thinking is still encouraged');
  assert.ok(wrong.includes('Count on from 3'), 'wrong thinking gets the clue, gently');
  assert.ok(whyFallback(false, '').includes('Have another look'), 'no clue: still a gentle nudge, never a bare error');
});

test('quest feedback shows the Why-box above the Next button', () => {
  const quizSrc = fnSrc('function quizHTML(){');
  const iWhy = quizSrc.indexOf("whyBoxHTML('quest',cur)");
  assert.ok(iWhy >= 0, 'quizHTML calls whyBoxHTML');
  const iNext = quizSrc.indexOf("id=\"qNext\"");
  assert.ok(iNext > iWhy, 'Why-box comes before the Next button');
});

test('warm-up feedback shows the Why-box above the Next button', () => {
  const warmSrc = fnSrc('function warmupHTML(){');
  const iWhy = warmSrc.indexOf("whyBoxHTML('warmup',warm)");
  assert.ok(iWhy >= 0, 'warmupHTML calls whyBoxHTML');
  const iNext = warmSrc.indexOf('id="wuNext"');
  assert.ok(iNext > iWhy, 'Why-box comes before the warm-up Next button');
});

test('Next resets the Why-box state (fresh box per question) and still resumes the timer', () => {
  const bindQuiz = fnText('function bindQuiz(){');
  assert.ok(bindQuiz.includes("cur.whyState='idle'"), 'qNext resets whyState');
  assert.ok(bindQuiz.includes("cur.whyText=''"), 'qNext clears the typed reasoning');
  assert.ok(bindQuiz.includes('resumeLearnTimer()'), 'qNext still resumes the answer-only timer');
  const bindWarmup = fnText('function bindWarmup(){');
  assert.ok(bindWarmup.includes("warm.whyState='idle'"), 'wuNext resets whyState');
  assert.ok(bindWarmup.includes("warm.whyText=''"), 'wuNext clears the typed reasoning');
});

test('Next is never gated on the Why-box: no why check guards either Next handler', () => {
  const bindQuiz = fnText('function bindQuiz(){');
  const qNextStart = bindQuiz.indexOf("getElementById('qNext')");
  const qNext = bindQuiz.slice(qNextStart, bindQuiz.indexOf('\n  };', qNextStart));
  assert.ok(!/if\s*\([^)]*why/i.test(qNext), 'qNext handler has no if() on why state');
  assert.ok(!qNext.includes('whySend'), 'qNext handler never waits on Tell Pip');
  assert.ok(qNext.includes("cur.whyState='idle'"), 'qNext only resets the box, unconditionally');
  const bindWarmup = fnText('function bindWarmup(){');
  const wuStart = bindWarmup.indexOf("getElementById('wuNext')");
  const wuNext = bindWarmup.slice(wuStart, bindWarmup.indexOf('};', wuStart));
  assert.ok(!/if\s*\([^)]*why/i.test(wuNext), 'wuNext handler has no if() on why state');
  assert.ok(!wuNext.includes('whySend'), 'wuNext handler never waits on Tell Pip');
  assert.ok(wuNext.includes("warm.whyState='idle'"), 'wuNext only resets the box, unconditionally');
});

test('the Why-box buttons are bound in both flows', () => {
  const bindQuiz = fnText('function bindQuiz(){');
  assert.ok(bindQuiz.includes("bindWhyBox('quest',cur)"), 'bindQuiz binds the Why-box');
  const bindWarmup = fnText('function bindWarmup(){');
  assert.ok(bindWarmup.includes("bindWhyBox('warmup',warm)"), 'bindWarmup binds the Why-box');
  const bindWhy = fnText('function bindWhyBox(');
  assert.ok(bindWhy.includes("getElementById('whySend')"), 'bindWhyBox wires Tell Pip');
  assert.ok(bindWhy.includes("getElementById('whySkip')"), 'bindWhyBox wires Skip');
  assert.ok(bindWhy.includes("st.whyState='skipped'"), 'Skip hides the box');
});

test('answering still pauses the timer and stars still come only from finishRound', () => {
  const bindQuiz = fnText('function bindQuiz(){');
  assert.ok(bindQuiz.includes('pauseLearnTimer();'), 'answering pauses the answer-only timer');
  const finishSrc = fnText('function finishRound(');
  assert.ok(!/why(Box|Fallback|Prompt|IsCorrect|PickedText|CurrentQuestion)|askWhyPip/.test(finishSrc), 'finishRound never touches the Why-box (the only bare "why" in it is a pre-existing trivia hint)');
  assert.ok(finishSrc.includes('earnStars'), 'stars are still awarded in finishRound');
  const whySrc = fnText('function askWhyPip(') + fnText('function whyBoxHTML(') + fnText('function bindWhyBox(');
  assert.ok(!whySrc.includes('earnStars'), 'Why-box code never awards stars');
  assert.ok(!whySrc.includes('pauseLearnTimer') && !whySrc.includes('resumeLearnTimer'), 'Why-box code never touches the timer');
});

test('Pip is asked through the existing askPipLive path, in plain mode (no new pipeline)', () => {
  const askWhy = fnText('function askWhyPip(');
  assert.ok(askWhy.includes('askPipLive(prompt, [],'), 'reuses askPipLive');
  assert.ok(askWhy.includes("e?e.name:''"), 'passes the explorer name like Ask Pip does');
  assert.ok(!askWhy.includes("mode:'explain'"), 'NOT explain mode: its hint-first swap would hide Pip’s feedback');
  assert.ok(!askWhy.includes('/api/'), 'no new fetch: askPipLive already calls /api/ask-pip');
  assert.ok(askWhy.includes('whyFallback('), 'a failed live call falls back locally');
});

test('reasoning is session-only: no why field is persisted or merged', () => {
  const persistSrc = fnText('function persistProgress(){');
  assert.ok(!/why(Text|State|Reply|Key)/.test(persistSrc), 'persistProgress saves no why field');
  const mergeStart = html.indexOf('function mergeExplorer(');
  assert.ok(mergeStart >= 0, 'mergeExplorer found');
  const mergeSrc = html.slice(mergeStart, html.indexOf('\nfunction mergeFamilyDB(', mergeStart));
  assert.ok(!/why(Text|State|Reply|Key)/.test(mergeSrc), 'mergeExplorer carries no why field');
  const saveSrc = html.slice(html.indexOf('function save(){'), html.indexOf('function save(){') + 2000);
  assert.ok(!/why(Text|State|Reply|Key)/.test(saveSrc), 'save() stores no why field');
});

/* --- Live behaviour of askWhyPip, with the network stubbed -------- */
function loadAskWhyPip(stubs) {
  const fns = loadWhyFns();
  const isFibQuestion = fns.isFibQuestion;
  const whyIsCorrect = fns.whyIsCorrect;
  const whyPickedText = fns.whyPickedText;
  const whyPrompt = fns.whyPrompt;
  const whyFallback = fns.whyFallback;
  const questAnswerText = stubs.questAnswerText;
  const toast = stubs.toast;
  const ex = stubs.ex;
  const render = stubs.render;
  const askPipLive = stubs.askPipLive;
  const document = stubs.document;
  var cur = stubs.cur; // eslint-disable-line no-unused-vars
  var warm = stubs.warm; // eslint-disable-line no-unused-vars
  const askWhyPip = eval('(' + fnText('function askWhyPip(') + ')');
  return { askWhyPip, fns };
}

function tick() { return new Promise(function (res) { setImmediate(res); }); }

test('askWhyPip: Tell Pip sends one short live call and shows Pip’s reply', async () => {
  const calls = [];
  let resolveLive;
  const renders = [];
  const st = { topicId: 'math-add', idx: 2, answered: true, picked: 1, whyState: 'idle' };
  const stubs = {
    questAnswerText: function () { return '7'; },
    toast: function () { throw new Error('toast must not fire on a real reason'); },
    ex: function () { return { name: 'Jiyuna' }; },
    render: function () { renders.push(1); },
    askPipLive: function (prompt, hist, name, opts) {
      calls.push({ prompt, hist, name, opts });
      return new Promise(function (res) { resolveLive = res; });
    },
    document: { getElementById: function (id) { return id === 'whyInput' ? { value: 'I counted on from 3' } : null; } },
    cur: st, warm: null,
  };
  const { askWhyPip } = loadAskWhyPip(stubs);
  askWhyPip('quest', st, MCQ, { name: 'Addition' });
  assert.equal(st.whyState, 'thinking', 'state is thinking while Pip thinks');
  assert.equal(calls.length, 1, 'exactly one live call per Tell Pip');
  assert.ok(calls[0].prompt.includes('I counted on from 3'), 'the call carries the reasoning');
  assert.ok(calls[0].prompt.includes('What is 3 + 4?'), 'the call carries the question');
  assert.deepEqual(calls[0].opts, {}, 'plain mode: no explain-mode options');
  assert.equal(calls[0].name, 'Jiyuna', 'the call names the explorer');
  resolveLive({ reply: 'Great counting! You spotted the trick.' });
  await tick(); await tick();
  assert.equal(st.whyState, 'done', 'reply lands and the box shows it');
  assert.equal(st.whyReply, 'Great counting! You spotted the trick.', 'live reply is shown verbatim');
  assert.ok(renders.length >= 2, 're-rendered for thinking and for the reply');
});

test('askWhyPip: empty reasoning toasts and never calls Pip', () => {
  let toasted = '';
  let called = 0;
  const st = { topicId: 'math-add', idx: 0, answered: true, picked: 1, whyState: 'idle' };
  const stubs = {
    questAnswerText: function () { return '7'; },
    toast: function (m) { toasted = m; },
    ex: function () { return { name: 'Jiyuna' }; },
    render: function () { throw new Error('no render on empty input'); },
    askPipLive: function () { called++; return Promise.resolve(null); },
    document: { getElementById: function (id) { return id === 'whyInput' ? { value: '   ' } : null; } },
    cur: st, warm: null,
  };
  const { askWhyPip } = loadAskWhyPip(stubs);
  askWhyPip('quest', st, MCQ, { name: 'Addition' });
  assert.ok(toasted.includes('Type a little thinking first'), 'child is nudged to type or skip');
  assert.equal(called, 0, 'no Pip call for an empty box');
  assert.equal(st.whyState, 'idle', 'state stays idle');
});

test('askWhyPip: a failed live call falls back locally instead of hanging', async () => {
  const st = { topicId: 'math-add', idx: 0, answered: true, picked: 0, whyState: 'idle' };
  const stubs = {
    questAnswerText: function () { return '7'; },
    toast: function () { throw new Error('no toast expected'); },
    ex: function () { return { name: 'Jiyuna' }; },
    render: function () {},
    askPipLive: function () { return Promise.resolve(null); },
    document: { getElementById: function (id) { return id === 'whyInput' ? { value: 'I guessed 6' } : null; } },
    cur: st, warm: null,
  };
  const { askWhyPip } = loadAskWhyPip(stubs);
  askWhyPip('quest', st, MCQ, { name: 'Addition' });
  await tick(); await tick();
  assert.equal(st.whyState, 'done', 'fallback still completes the box');
  assert.ok(st.whyReply.includes('Good brave thinking'), 'fallback encourages a wrong answer');
  assert.ok(st.whyReply.includes('Count on from 3'), 'fallback uses the question clue');
});

test('askWhyPip: a reply that lands after Next is dropped, never shown on the new question', async () => {
  let resolveLive;
  const st = { topicId: 'math-add', idx: 2, answered: true, picked: 1, whyState: 'idle' };
  const stubs = {
    questAnswerText: function () { return '7'; },
    toast: function () {},
    ex: function () { return { name: 'Jiyuna' }; },
    render: function () {},
    askPipLive: function () { return new Promise(function (res) { resolveLive = res; }); },
    document: { getElementById: function (id) { return id === 'whyInput' ? { value: 'I counted on' } : null; } },
    cur: st, warm: null,
  };
  const { askWhyPip } = loadAskWhyPip(stubs);
  askWhyPip('quest', st, MCQ, { name: 'Addition' });
  assert.equal(st.whyState, 'thinking', 'thinking while Pip thinks');
  // The child taps Next: exactly what the qNext handler does.
  st.idx++; st.picked = null; st.answered = false;
  st.whyText = ''; st.whyState = 'idle'; st.whyReply = ''; st.whyKey = '';
  resolveLive({ reply: 'This belongs to the old question.' });
  await tick(); await tick();
  assert.equal(st.whyState, 'idle', 'stale reply never flips the new question to done');
  assert.equal(st.whyReply, '', 'stale reply is dropped, not shown');
});
