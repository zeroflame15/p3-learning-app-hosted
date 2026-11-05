// POST /api/flag — every flag becomes a test.
// Body: { question, pipAnswer, correction?, skillId?, agentId?, live?, code? }
// Always returns the auto-generated regression test case, so the app
// can store it locally even when the server is not configured.
// When Supabase IS configured, the flag is also stored in the flag_log
// table (see supabase/schema.sql) with status 'open'.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only),
//      MODEL_API_KEY (optional — enables the Reviewer second-model check).
//
// The feedback loop (video, "A continuous eval and feedback loop"):
//   flag (one tap, in the child's own words)
//   -> Reviewer checks: a second model reads the case. When a model
//      key is configured, api/flag runs REVIEWER_PROMPT as a second
//      model pass and returns its verdict; without a key the review
//      is queued, never faked. (Muse Spark Open is the video's
//      Reviewer model; no Spark Open key exists yet, so the second
//      pass runs on the configured model and is labelled as such.)
//   -> Code proves the fix: lib/feedback.js proveFix() — reproduced,
//      re-tested, no regressions. The Judge ships the fix only when
//      the code proves it. The test case is what becomes a test,
//      re-run every night by scripts/run-nightly.js.
'use strict';

const { flagToTest, validateFlag } = require('../lib/flags');
const { REVIEWER_PROMPT, reviewVerdictFromText, reviewFlagLocal, proveFix, judgeFix } = require('../lib/feedback');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const MODEL_KEY = process.env.MODEL_API_KEY;
const MODEL_BASE = process.env.MODEL_API_BASE || 'https://api.meta.ai/v1';
const MODEL_ID = process.env.MODEL_ID || 'muse-spark-1.3';

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(obj);
}

async function reviewerCheck(testCase) {
  if (!MODEL_KEY) {
    return { reviewer: 'reviewer', verdict: 'needs-more-info', checkedBy: 'queued', note: 'No model key configured — the Reviewer second-model check is queued, not faked. A local rule still recorded the flag.' };
  }
  try {
    const r = await fetch(`${MODEL_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${MODEL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: 'system', content: REVIEWER_PROMPT + ' (Second pass on the configured model — Muse Spark Open is not wired yet, so this is a second read by the same engine, not a different model.)' },
          { role: 'user', content: `Question: ${testCase.question}\nPip answered: ${testCase.pipAnswer}\nCorrection given: ${testCase.correction || '(none)'}\nSkill: ${testCase.skillId || '(none)'}` },
        ],
        max_tokens: 120,
        temperature: 0,
      }),
    });
    if (!r.ok) return { reviewer: 'reviewer', verdict: 'needs-more-info', checkedBy: 'second-pass-failed', note: 'Reviewer second-model call failed; the flag is still recorded.' };
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { reviewer: 'reviewer', verdict: reviewVerdictFromText(text), checkedBy: 'second-model-pass', note: text.slice(0, 200) };
  } catch (e) {
    return { reviewer: 'reviewer', verdict: 'needs-more-info', checkedBy: 'second-pass-failed', note: 'Reviewer second-model call failed; the flag is still recorded.' };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); } }
  const err = validateFlag(body || {});
  if (err) return json(res, 400, { error: err });
  let testCase;
  try { testCase = flagToTest(body); } catch (e) { return json(res, 400, { error: e.message }); }

  // Reviewer checks the case (second model when a key exists).
  const review = await reviewerCheck(testCase);
  // Code proves the fix: the correction (when given) is the fixed
  // answer to prove against. Without a correction there is no fixed
  // answer yet, so the fix cannot be proved — Judge holds.
  const fixedAnswer = typeof body?.correction === 'string' ? body.correction : '';
  const proof = proveFix(testCase, fixedAnswer || testCase.pipAnswer);
  // Judge ships only when code proves the fix.
  const judge = judgeFix(review, proof);
  const loop = { review, proof, judge, becomesTest: judge.verdict === 'ship' };

  if (!URL || !KEY) {
    return json(res, 200, { ok: true, configured: false, testCase, loop, note: 'Flag saved on the device only — Supabase is not set up, so it was not stored on the server.' });
  }
  try {
    const r = await fetch(`${URL}/rest/v1/flag_log`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        code: typeof body.code === 'string' ? body.code.slice(0, 64) : null,
        question: testCase.question,
        pip_answer: testCase.pipAnswer,
        correction: testCase.correction,
        skill_id: testCase.skillId,
        test_case: testCase,
        status: 'open',
      }),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed', testCase, loop, configured: true });
    return json(res, 200, { ok: true, configured: true, testCase, loop });
  } catch (e) {
    return json(res, 502, { error: 'supabase_unreachable', testCase, loop, configured: true });
  }
};
