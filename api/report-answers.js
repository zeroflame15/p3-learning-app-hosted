// POST /api/report-answers — SERVER-BANK PILOT (one topic: math-ntuc).
// The client fires this fire-and-forget when a server-bank quest
// finishes: correct -> mastered (never served again), wrong -> due
// (recycled in a future set, oldest first). A failed report never
// blocks the child — the set is simply served again another day.
// Body: { code, explorerId, topicId, results:[{questionId, correct}] }
// Reply (200): { ok:true, mastered:n, due:n } — counts of rows
//   updated to each status by this call.
// Bad rows are skipped, never fail the batch: a result without a
// valid question id, a non-boolean correct, or an id the bank does
// not know is dropped and the rest still land. Request-level
// problems (wrong topic, missing code/explorerId, bad JSON) are 400;
// Supabase trouble is 502. Never a 500 for a single bad row.
// Uses Supabase REST (no SDK), same pattern as api/progress.js.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only).
'use strict';

const { SB_TOPIC, nextStatus } = require('../lib/server-bank');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.json(obj);
}

function sb(path, init) {
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
  });
}

function isId(v) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 64;
}

module.exports = async (req, res) => {
  if (!URL || !KEY) return json(res, 502, { error: 'server_bank_not_configured', fallback: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only', fallback: true });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json', fallback: true }); } }
  // Pilot gate: exactly one topic.
  if (body?.topicId !== SB_TOPIC) {
    return json(res, 400, { error: 'pilot_topic_only', topicId: SB_TOPIC, fallback: true });
  }
  if (!isId(body?.code) || !isId(body?.explorerId) || !Array.isArray(body?.results)) {
    return json(res, 400, { error: 'code, explorerId and results required', fallback: true });
  }
  const code = body.code.trim();
  const explorerId = body.explorerId.trim();

  // Row-level validation: keep only well-formed results (a real
  // question id + a boolean). Everything else is skipped, never
  // fails the batch.
  const seen = {};
  const valid = [];
  body.results.forEach((r) => {
    if (!r || !isId(r.questionId) || typeof r.correct !== 'boolean') return;
    const id = r.questionId.trim();
    if (seen[id]) return; // one row per question per report
    seen[id] = true;
    valid.push({ questionId: id, correct: r.correct });
  });
  if (!valid.length) return json(res, 200, { ok: true, mastered: 0, due: 0 });

  // The ids must be questions the bank knows — anything else is
  // skipped (a stale client cache, a typo, a forged id).
  let known = {};
  try {
    // Encode each id separately: the commas inside in.(...) must
    // stay literal or PostgREST will not parse the list.
    const inList = valid.map((r) => encodeURIComponent(r.questionId)).join(',');
    const r = await sb(`sb_questions?id=in.(${inList})&select=id`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed', fallback: true });
    (await r.json()).forEach((q) => { known[q.id] = true; });
  } catch (e) {
    return json(res, 502, { error: 'supabase_read_failed', fallback: true });
  }
  const knownResults = valid.filter((r) => known[r.questionId]);
  if (!knownResults.length) return json(res, 200, { ok: true, mastered: 0, due: 0 });

  // Current state, so attempts/correct increment instead of reset.
  let states = [];
  try {
    const inList = knownResults.map((r) => encodeURIComponent(r.questionId)).join(',');
    const r = await sb(`sb_explorer_questions?family_code=eq.${encodeURIComponent(code)}&explorer_id=eq.${encodeURIComponent(explorerId)}&question_id=in.(${inList})&select=question_id,status,attempts,correct`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed', fallback: true });
    states = await r.json();
  } catch (e) {
    return json(res, 502, { error: 'supabase_read_failed', fallback: true });
  }
  const byId = {};
  states.forEach((s) => { byId[s.question_id] = s; });

  const now = new Date().toISOString();
  let mastered = 0, due = 0;
  const rows = knownResults.map((r) => {
    const prev = byId[r.questionId] || {};
    const status = nextStatus({ was: prev.status || 'served', correct: r.correct });
    if (status === 'mastered') mastered++; else due++;
    return {
      family_code: code, explorer_id: explorerId, question_id: r.questionId,
      status, attempts: (prev.attempts || 0) + 1, correct: (prev.correct || 0) + (r.correct ? 1 : 0),
      updated_at: now,
    };
  });
  try {
    const r = await sb('sb_explorer_questions?on_conflict=family_code,explorer_id,question_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed', fallback: true });
  } catch (e) {
    return json(res, 502, { error: 'supabase_write_failed', fallback: true });
  }
  return json(res, 200, { ok: true, mastered, due });
};
