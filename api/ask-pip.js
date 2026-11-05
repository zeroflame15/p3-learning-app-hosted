// POST /api/ask-pip — live AI Pip tutor (server only).
// Calls the Meta Model API (OpenAI-compatible Chat Completions) with
// MODEL_API_KEY. No key configured -> 503, and the client falls back to
// its built-in canned answers, so the app still works offline.
// Env: MODEL_API_KEY (required for live answers), MODEL_ID (default muse-spark-1.3),
//      MODEL_API_BASE (default https://api.meta.ai/v1).
// Body: { question: string (max 500), history: [{role:'kid'|'pip', text}], name?: string, fixFlag?: boolean, skillId?: string }
// Reply: { reply: string, live: true, agent: string, skillId: string|null, skillVersion: string }
// — always under 90 words, P3 level.
// Skills, not search: the question is routed to ONE specialist agent
// (lib/agents.js), which opens the EXACT skill method from the versioned
// skill pack (lib/skills.js). The skill method is injected into the
// system prompt, and the reply cites which agent + skill were used.
// Models explain; code decides — this function never marks anything.

const { SKILL_PACK_VERSION, skillById, skillForQuestion } = require('../lib/skills');
const { routeQuestion } = require('../lib/agents');

const BASE = process.env.MODEL_API_BASE || 'https://api.meta.ai/v1';
const MODEL = process.env.MODEL_ID || 'muse-spark-1.3';
const MAX_HISTORY = 8;

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(obj);
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
  // Route first: one specialist agent + the exact skill method.
  const routed = routeQuestion(question);
  const skill = (typeof body?.skillId === 'string' && skillById(body.skillId)) || routed.skill || skillForQuestion(question);
  const agent = routed.agent;
  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY).filter(
    (h) => h && (h.role === 'kid' || h.role === 'pip') && typeof h.text === 'string'
  ) : [];
  const historyText = history.map((h) => `${h.role === 'kid' ? name : 'Pip'}: ${h.text.slice(0, 1000)}`).join('\n');

  const skillMethod = skill
    ? `Use this exact method (${SKILL_PACK_VERSION} — ${skill.name}): ${skill.method} Steps: ${skill.steps.join(' ')} Example: ${skill.example} Watch out: ${skill.watchOut}`
    : 'No exact skill matches this question — answer simply at P3 level and say which topic it is, so a skill can be added for it.';
  const system = fixFlag
    ? 'You are Pip, a friendly otter tutor for a Singapore Primary 3 student (age 8-9). The student flagged your earlier reply as possibly wrong. Re-check it carefully, admit the mistake warmly if there was one, and give the corrected answer simply. Never be defensive. Keep it under 90 words, simple language, encouraging. ' + skillMethod
    : `You are Pip, a friendly otter tutor for ${name}, a Singapore Primary 3 student (age 8-9). You are the ${agent.name} specialist. Answer in simple, warm language they can read themself. Keep replies under 90 words. Use Singapore P3 level ideas (English, Math, Science, Chinese). Show working for maths in short steps. If they ask in Chinese, reply in Chinese with a little pinyin help. End with one tiny follow-up question or encouragement sometimes. Never mention being an AI model. ${skillMethod}`;
  const user = fixFlag
    ? `${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}The flagged reply was about: ${question}`
    : `${historyText ? `Conversation so far:\n${historyText}\n\n` : ''}${name} asks: ${question}`;

  try {
    const r = await fetch(`${BASE}/chat/completions`, {
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
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('model api error', r.status, text.slice(0, 200));
      return json(res, 502, { error: 'model_api_error', status: r.status, live: false });
    }
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return json(res, 502, { error: 'empty_reply', live: false });
    return json(res, 200, { reply: reply.slice(0, 1200), live: true, agent: agent.id, agentName: agent.name, skillId: skill ? skill.id : null, skillName: skill ? skill.name : null, skillVersion: SKILL_PACK_VERSION });
  } catch (e) {
    console.error('model api fetch failed', e);
    return json(res, 502, { error: 'model_api_unreachable', live: false });
  }
};
