// /api/progress — server-side progress sync, keyed by FAMILY SYNC CODE.
// GET  ?code=<6-letter code>        -> { configured, data|null, updatedAt|null }
// GET  ?code=<...> &check=1         -> { configured, updatedAt|null } (no data)
// POST { code, data }               -> { ok, updatedAt }  (upsert, one row per family)
// Legacy clients that only send `device` (a random per-device id) still
// work: the device id is accepted as the key, so an unlinked device keeps
// syncing its own row. Once a device has a family sync code, the code
// takes precedence and every linked device shares that one row.
// Uses Supabase REST (no SDK needed). Without Supabase env vars it answers
// { configured: false } and the client keeps using device localStorage only.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only, service role).
// The client never sends a child's real name to the server as an identifier:
// the key is a random 6-letter code (or a random device id), never a name.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const TABLE = 'family_progress';

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

// Resolve the server key from a request: family sync code wins, legacy
// device id is the fallback. Codes are normalised (upper-case, no
// spaces/hyphens); anything else is rejected as a bad key.
function resolveKey(q, body) {
  const rawCode = (q && (q.code || q.sync || q.syncCode)) || (body && (body.code || body.sync || body.syncCode)) || '';
  if (typeof rawCode === 'string' && rawCode.trim()) {
    const code = rawCode.toUpperCase().replace(/[\s-]/g, '');
    if (/^[A-Z2-9]{6}$/.test(code)) return code;
    if (code.length > 64) return null;
    // A non-6-letter code-shaped value is not a valid family code;
    // fall through to the device id rather than silently storing
    // under a malformed key — unless it looks like a device id.
    if (!/^D-/.test(code)) return null;
    return code;
  }
  const device = (q && q.device) || (body && body.device) || '';
  if (typeof device === 'string' && device.trim() && device.length <= 64) return device.trim();
  return null;
}

module.exports = async (req, res) => {
  if (!URL || !KEY) return json(res, 200, { configured: false, data: null, updatedAt: null });

  if (req.method === 'GET') {
    const key = resolveKey(req.query || {}, null);
    if (!key) return json(res, 400, { error: 'code required' });
    // Lightweight "has it changed" check (2026-11-09): ?check=1 returns
    // ONLY {configured, updatedAt} — no data field at all. The client
    // calls this before every pull; if the server row has not changed
    // since the client's last sync, it skips downloading the whole
    // family record (~40 KB) and the response is ~100 bytes instead.
    // The Supabase query selects only updated_at, so the data never
    // leaves the database for a check.
    if (req.query && (req.query.check === '1' || req.query.check === 'true')) {
      const r = await sb(`${TABLE}?code=eq.${encodeURIComponent(key)}&select=updated_at`);
      if (!r.ok) return json(res, 502, { error: 'supabase_read_failed' });
      const rows = await r.json();
      if (!rows.length) return json(res, 200, { configured: true, updatedAt: null });
      return json(res, 200, { configured: true, updatedAt: rows[0].updated_at });
    }
    const r = await sb(`${TABLE}?code=eq.${encodeURIComponent(key)}&select=data,updated_at`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed' });
    const rows = await r.json();
    if (!rows.length) return json(res, 200, { configured: true, data: null, updatedAt: null });
    return json(res, 200, { configured: true, data: rows[0].data, updatedAt: rows[0].updated_at });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); } }
    const key = resolveKey(req.query || {}, body || {});
    if (!key || !body || !body.data || typeof body.data !== 'object') {
      return json(res, 400, { error: 'code and data required' });
    }
    // Keep rows small: reject absurd payloads.
    if (JSON.stringify(body.data).length > 500000) return json(res, 413, { error: 'progress too large' });
    // Revision guard for the family schedule (2026-11-09): the client
    // merges before uploading, but a slow pull can still POST a stale
    // plan AFTER a newer plan landed (a GET issued before the newer
    // save, resolving after it). The server is the authority on
    // revision: if the stored plan has a HIGHER familyPlanRev than the
    // incoming one (or the same rev with a later timestamp), keep the
    // stored schedule fields and only save the rest of the incoming
    // record — explorer progress is never lost. The response reports
    // the effective rev so the client can tell its plan write was
    // superseded.
    let writeData = body.data;
    let planPreserved = false;
    try {
      const cur = await sb(`${TABLE}?code=eq.${encodeURIComponent(key)}&select=data`);
      if (cur.ok) {
        const curRows = await cur.json();
        if (curRows.length && curRows[0].data) {
          const stored = curRows[0].data;
          const storedRev = stored.familyPlanRev || 0;
          const incomingRev = body.data.familyPlanRev || 0;
          const storedAt = Date.parse(stored.familyPlanUpdatedAt || '') || 0;
          const incomingAt = Date.parse(body.data.familyPlanUpdatedAt || '') || 0;
          if (storedRev > incomingRev || (storedRev === incomingRev && storedAt > incomingAt)) {
            writeData = Object.assign({}, body.data, {
              familyPlan: stored.familyPlan !== undefined ? stored.familyPlan : body.data.familyPlan,
              familyPlanRev: stored.familyPlanRev,
              familyPlanUpdatedAt: stored.familyPlanUpdatedAt,
              familyEvents: stored.familyEvents !== undefined ? stored.familyEvents : body.data.familyEvents,
              deletedFamilyEvents: stored.deletedFamilyEvents !== undefined ? stored.deletedFamilyEvents : body.data.deletedFamilyEvents,
            });
            planPreserved = true;
          }
        }
      }
    } catch (e) { /* guard is best-effort; a read failure falls through to a plain upsert */ }
    const r = await sb(`${TABLE}?on_conflict=code`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ code: key, data: writeData, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed' });
    const rows = await r.json().catch(() => []);
    return json(res, 200, { ok: true, updatedAt: rows[0]?.updated_at || new Date().toISOString(), familyPlanRev: writeData.familyPlanRev || 0, planPreserved });
  }

  return json(res, 405, { error: 'GET or POST only' });
};
