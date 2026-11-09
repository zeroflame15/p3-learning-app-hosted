// POST /api/daily-set — SERVER BANK (all topics).
// Serves one day's quest set (5 questions) from Supabase: due
// questions first (oldest first), then fresh ones in a day-seeded
// shuffle; mastered questions are never served. The client falls
// back to the bank on ANY failure, so this endpoint must never crash
// the quest: bad input -> 400, Supabase trouble or an empty bank ->
// 502 (the client silently uses the bank instead).
// Body: { code, explorerId, topicId, level, count?, day? }
// Reply (200): { source:'server', topicId, level, day,
//   questions:[{id,q,o,a,c,j}], served, due, fresh }
//   served = picked questions that were already 'served' (played but
//     never reported — e.g. a quit mid-quest); due = picked questions
//     that were due; fresh = picked questions never served before
//     (marked 'served' by this call). served+due+fresh = count.
// Uses Supabase REST (no SDK), same pattern as api/progress.js.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only).
// The client never sends a child's name — only the random 6-letter
// family code (or a device id for an unlinked device) + explorer id.
'use strict';

const {
  SB_COUNT,
  SB_SERVABLE_KINDS,
  sbDaySeed,
  pickSet,
} = require('../lib/server-bank');

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
  if (!URL || !KEY) return json(res, 502, { error: 'server_bank_not_configured', live: false, fallback: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only', fallback: true });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json', fallback: true }); } }
  if (!isId(body?.code) || !isId(body?.explorerId) || !isId(body?.topicId)) {
    return json(res, 400, { error: 'code, explorerId and topicId required', fallback: true });
  }
  const level = (typeof body?.level === 'number' && body.level >= 1 && body.level <= 6) ? Math.floor(body.level) : 3;
  const count = (typeof body?.count === 'number' && body.count >= 1 && body.count <= SB_COUNT) ? Math.floor(body.count) : SB_COUNT;
  const day = (typeof body?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day)) ? body.day : new Date().toISOString().slice(0, 10);
  const code = body.code.trim();
  const explorerId = body.explorerId.trim();
  const topicId = body.topicId.trim();

  // 1. The servable pool: this topic + level, quest-pool kinds only.
  // Warm/retry rows exist in the table but are never served as a
  // quest (warm-up stays bank in the pilot).
  let pool;
  try {
    const r = await sb(`sb_questions?topic=eq.${encodeURIComponent(topicId)}&level=eq.${level}&select=id,stem,options,answer,explanation,joke,sub_topic`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed', fallback: true });
    pool = (await r.json()).filter((q) => SB_SERVABLE_KINDS.indexOf(q.sub_topic) >= 0);
  } catch (e) {
    return json(res, 502, { error: 'supabase_read_failed', fallback: true });
  }
  if (!pool.length) return json(res, 502, { error: 'not-seeded', fallback: true });

  // 2. This explorer's mastery state for the pool.
  let states = [];
  try {
    const r = await sb(`sb_explorer_questions?family_code=eq.${encodeURIComponent(code)}&explorer_id=eq.${encodeURIComponent(explorerId)}&select=question_id,status,updated_at`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed', fallback: true });
    states = await r.json();
  } catch (e) {
    return json(res, 502, { error: 'supabase_read_failed', fallback: true });
  }
  const byId = {};
  states.forEach((s) => { byId[s.question_id] = s; });
  const due = pool
    .filter((q) => byId[q.id] && byId[q.id].status === 'due')
    .sort((a, b) => String(byId[a.id].updated_at || '').localeCompare(String(byId[b.id].updated_at || '')));
  const fresh = pool
    .filter((q) => !byId[q.id] || byId[q.id].status === 'served')
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  // Mastered questions are excluded by construction: they are in
  // neither list (status 'mastered' matches neither filter).

  // 3. Pick: due first (oldest first), then fresh in a day-seeded
  // shuffle — the same seed inputs as the page's daily rotation, so
  // a lost client cache re-serves the same set for the day.
  const picked = pickSet({ due, fresh, count, seed: sbDaySeed(explorerId, topicId, day) });
  const questions = picked.questions.map((q) => ({
    id: q.id, q: q.stem, o: q.options, a: q.answer, c: q.explanation || '', j: q.joke || '',
  }));
  const dueCount = picked.dueCount;
  const freshCount = picked.questions.filter((q) => !byId[q.id]).length;
  const servedCount = picked.questions.length - dueCount - freshCount;

  // 4. Mark the newly-picked fresh questions 'served'. Due rows are
  // left alone (they stay 'due' until reported) and already-served
  // rows are left alone. Best effort: if this write fails, the set
  // is still returned — the questions simply stay unmarked and may
  // be served again another day, which is safe by design.
  const toMark = picked.questions.filter((q) => !byId[q.id]);
  if (toMark.length) {
    try {
      await sb('sb_explorer_questions?on_conflict=family_code,explorer_id,question_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(toMark.map((q) => ({
          family_code: code, explorer_id: explorerId, question_id: q.id, status: 'served',
        }))),
      });
    } catch (e) { console.error('daily-set mark-served failed', e && e.name); }
  }

  return json(res, 200, {
    source: 'server', topicId: topicId, level, day,
    questions, served: servedCount, due: dueCount, fresh: freshCount,
  });
};
