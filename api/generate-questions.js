// POST /api/generate-questions — LIVE-GENERATED QUESTIONS, EXPERIMENT.
// One topic only (math-ntuc, NTUC Totals). The client asks for a fresh
// 5-question quest set; this endpoint asks the model, then VALIDATES
// every question in code before returning anything (see
// lib/live-gen.js): 4 distinct numeric options, valid answer index,
// explanation with working, no duplicate of the bank, and — the
// honest check for a Maths topic — the correct answer must recompute
// from the numbers in the stem. If ANY question fails, the whole set
// is rejected with 502 + reasons and the client falls back silently
// to the pre-written bank. The model never grades its own work and
// the key never leaves the server (same env as /api/ask-pip:
// MODEL_API_KEY, MODEL_ID, MODEL_API_BASE — on Vercel these point at
// the Gemini free tier).
// Body: { topicId: 'math-ntuc', level: 1-6, count?: 5, day?: 'YYYY-MM-DD',
//         bankStems: [normalised bank stems], examples?: [{q,o,a}] }
// Reply (200): { live:true, topicId, level, day, questions, generatedMs, validated:true, source:'live' }
// Errors: 400 bad topic/body, 405 POST only, 502 model/validation
// failure (client falls back), 503 live_pip_not_configured.
'use strict';

const {
  LIVE_GEN_TOPIC, LIVE_GEN_COUNT, validateLiveGenSet, buildLiveGenPrompt,
  parseLiveGenReply, liveGenNormStem,
} = require('../lib/live-gen');

const BASE = process.env.MODEL_API_BASE || 'https://api.meta.ai/v1';
const MODEL = process.env.MODEL_ID || 'muse-spark-1.3';

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(obj);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only', fallback: true });
  const key = process.env.MODEL_API_KEY;
  if (!key) return json(res, 503, { error: 'live_pip_not_configured', live: false, fallback: true });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json', fallback: true }); } }
  // Experiment gate: exactly one topic, nothing else may generate.
  if (body?.topicId !== LIVE_GEN_TOPIC) {
    return json(res, 400, { error: 'experiment_topic_only', topicId: LIVE_GEN_TOPIC, fallback: true });
  }
  const level = (typeof body?.level === 'number' && body.level >= 1 && body.level <= 6) ? Math.floor(body.level) : 3;
  const day = typeof body?.day === 'string' ? body.day.slice(0, 10) : '';
  const bankStems = Array.isArray(body?.bankStems) ? body.bankStems.map(liveGenNormStem) : null;
  if (!bankStems || !bankStems.length) {
    return json(res, 400, { error: 'bankStems required', fallback: true });
  }
  const examples = Array.isArray(body?.examples) ? body.examples.filter((e) => e && typeof e.q === 'string' && Array.isArray(e.o)) : [];

  const startedAt = Date.now();
  const prompt = buildLiveGenPrompt('NTUC Totals', level, LIVE_GEN_COUNT, examples);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let r = null;
  let lastStatus = 0;
  let lastText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 20000);
    try {
      r = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1200,
          temperature: 0.7,
        }),
      });
      clearTimeout(timer);
      if (r.ok) break;
      lastStatus = r.status;
      lastText = await r.text().catch(() => '');
      if (![502, 503, 504].includes(r.status)) break;
      if (attempt === 0) await sleep(1500);
    } catch (e) {
      clearTimeout(timer);
      console.error('generate-questions model fetch failed', e && e.name);
      if (attempt === 0) { await sleep(1500); continue; }
      return json(res, 502, { error: 'model_api_unreachable', live: false, fallback: true });
    }
  }
  if (!r || !r.ok) {
    console.error('generate-questions model api error', lastStatus, String(lastText).slice(0, 200));
    return json(res, 502, { error: 'model_api_error', status: lastStatus, live: false, fallback: true });
  }
  let raw = '';
  try {
    const data = await r.json();
    raw = data?.choices?.[0]?.message?.content || '';
  } catch (e) {
    return json(res, 502, { error: 'model_api_unreachable', live: false, fallback: true });
  }
  const parsed = parseLiveGenReply(raw);
  if (parsed.error) {
    return json(res, 502, { error: parsed.error, live: false, fallback: true, rawPreview: String(raw).slice(0, 200) });
  }
  const check = validateLiveGenSet(parsed.questions, bankStems);
  if (!check.ok) {
    return json(res, 502, { error: 'generated_set_invalid', live: false, fallback: true, reasons: check.reasons });
  }
  return json(res, 200, {
    live: true, source: 'live', topicId: LIVE_GEN_TOPIC, level, day,
    questions: parsed.questions, generatedMs: Date.now() - startedAt, validated: true,
  });
};
