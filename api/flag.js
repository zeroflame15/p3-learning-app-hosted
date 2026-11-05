// POST /api/flag — every flag becomes a test.
// Body: { question, pipAnswer, correction?, skillId?, agentId?, live?, code? }
// Always returns the auto-generated regression test case, so the app
// can store it locally even when the server is not configured.
// When Supabase IS configured, the flag is also stored in the flag_log
// table (see supabase/schema.sql) with status 'open'.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only).
'use strict';

const { flagToTest, validateFlag } = require('../lib/flags');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(obj);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); } }
  const err = validateFlag(body || {});
  if (err) return json(res, 400, { error: err });
  let testCase;
  try { testCase = flagToTest(body); } catch (e) { return json(res, 400, { error: e.message }); }

  if (!URL || !KEY) {
    return json(res, 200, { ok: true, configured: false, testCase, note: 'Flag saved on the device only — Supabase is not set up, so it was not stored on the server.' });
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
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed', testCase, configured: true });
    return json(res, 200, { ok: true, configured: true, testCase });
  } catch (e) {
    return json(res, 502, { error: 'supabase_unreachable', testCase, configured: true });
  }
};
