// POST /api/ask-pip — Pip as a SIMPLE chatbot.
// Ask Pip used to route every question through the skill pack and
// the 19-agent "how one agent thinks" machinery. That machinery
// caused more harm than good in practice: a butterfly question got
// the frog skill's facts, a small model fumbled "3 x 4" into
// "3 + 3 + 3 = 7", and it wrote LaTeX ($3 \times 4$) that the app
// shows literally as dollar signs. So Ask Pip is now a plain
// chatbot, like Gemini or ChatGPT: one direct call, one simple
// prompt, answer anything at P3 level. Two hard rules stay in code,
// not in the model:
//   1. Simple sums are worked out by lib/arithmetic.js first and
//      handed to the model as a fact it must not change — code
//      decides the number, the model only explains it.
//   2. Replies are cleaned of LaTeX ($, \times, \frac, ...) before
//      they are sent, so maths can never come back garbled.
// Env: MODEL_API_KEY (required for live answers), MODEL_ID,
//      MODEL_API_BASE (default https://api.meta.ai/v1).
// Body: { question: string (max 500), history: [{role:'kid'|'pip', text}], name?: string, fixFlag?: boolean }
// Reply: { reply, live: true, agent, agentName, signature, traceId }
// — always under 90 words, P3 level, plain text only.
'use strict';

const { extractSimpleSum } = require('../lib/arithmetic');

const BASE = process.env.MODEL_API_BASE || 'https://api.meta.ai/v1';
const MODEL = process.env.MODEL_ID || 'muse-spark-1.3';
const MAX_HISTORY = 8;

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(obj);
}

function traceId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Strip LaTeX / maths formatting the model sometimes slips in, so a
// child never sees "$3 \times 4$" on screen. Money is written out
// in words by the prompt, so a stray $ is always formatting, never
// a price.
function cleanReply(text) {
  let out = String(text || '');
  out = out.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
  out = out.replace(/\\times/g, 'x').replace(/\\div/g, '÷').replace(/\\cdot/g, 'x');
  out = out.replace(/\$/g, '');
  out = out.replace(/\\\(/g, '').replace(/\\\)/g, '').replace(/\\\[/g, '').replace(/\\\]/g, '');
  /* The app renders replies as plain text, so markdown leaks through
     literally (a child saw **seed** in a plant answer). Strip bold /
     italic markers, inline code ticks and # headings; keep the words. */
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
  out = out.replace(/`([^`]+)`/g, '$1');
  out = out.replace(/(^|\n)#{1,6}\s+/g, '$1');
  return out.trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const key = process.env.MODEL_API_KEY;
  if (!key) return json(res, 503, { error: 'live_pip_not_configured', live: false });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); } }
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 500) return json(res, 400, { error: 'question required (max 500 chars)' });
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : 'the student';
  const fixFlag = body?.fixFlag === true;
  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY).filter(
    (h) => h && (h.role === 'kid' || h.role === 'pip') && typeof h.text === 'string'
  ) : [];
  const historyText = history.map((h) => `${h.role === 'kid' ? name : 'Pip'}: ${h.text.slice(0, 1000)}`).join('\n');

  // Code decides the number for a plain sum; the model only explains it.
  const sum = extractSimpleSum(question);
  const factLine = sum
    ? `FACT — worked out exactly, use it and do not change it: ${sum.expression}. Working: ${sum.working}.`
    : '';

  const system = fixFlag
    ? `You are Pip, a friendly otter tutor for a Singapore Primary 3 student (age 8-9). The student flagged your earlier reply as possibly wrong. Re-check it carefully, admit the mistake warmly if there was one, and give the corrected answer simply. Never be defensive. Keep it under 90 words, simple language, encouraging. ${factLine} Never use the $ character, LaTeX, maths formatting like \\times or \\frac, or markdown like **bold** or # headings — write maths in plain text, for example 3 x 4 = 12, and plain words otherwise. Never mention being an AI model.`
    : `You are Pip, a friendly otter tutor for ${name}, a Singapore Primary 3 student (age 8-9). Answer the question directly and simply, in warm language they can read themself. Keep replies under 90 words. Use Singapore P3 level ideas (English, Math, Science, Chinese). If it is a maths question, show one short working step, then the answer. If they ask in Chinese, reply in Chinese with a little pinyin help. End with one tiny follow-up question or encouragement sometimes. Never ask the child to tell you more first, and never deflect with "tell me more" — always try to answer. ${factLine} Never use the $ character, LaTeX, maths formatting like \\times or \\frac, or markdown like **bold** or # headings — write maths in plain text, for example 3 x 4 = 12, and plain words otherwise. Never mention being an AI model.`;
  const user = `${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}${name} asks: ${question}`;

  // One retry on a transient model failure (503 "high demand" was
  // seen live): the free tier recovers quickly, and a single retry
  // still fits inside the client's 25s hard timeout.
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let r = null;
  let lastStatus = 0;
  let lastText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });
      if (r.ok) break;
      lastStatus = r.status;
      lastText = await r.text().catch(() => '');
      if (![502, 503, 504].includes(r.status)) break;
      if (attempt === 0) await sleep(1500);
    } catch (e) {
      console.error('model api fetch failed', e);
      if (attempt === 0) { await sleep(1500); continue; }
      return json(res, 502, { error: 'model_api_unreachable', live: false });
    }
  }
  try {
    if (!r || !r.ok) {
      console.error('model api error', lastStatus, String(lastText).slice(0, 200));
      return json(res, 502, { error: 'model_api_error', status: lastStatus, live: false });
    }
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return json(res, 502, { error: 'empty_reply', live: false });
    const reply = cleanReply(raw).slice(0, 1200);
    if (!reply) return json(res, 502, { error: 'empty_reply', live: false });
    const trace = traceId();
    return json(res, 200, {
      reply, live: true,
      agent: 'ask-kix', agentName: 'Ask Kix',
      skillId: null, skillName: null,
      skillVersion: 'skills-v1',
      signature: `pip:ask-kix:simple:${trace}`, traceId: trace,
      hintFirst: false, lessonsApplied: 0,
    });
  } catch (e) {
    console.error('model api fetch failed', e);
    return json(res, 502, { error: 'model_api_unreachable', live: false });
  }
};
