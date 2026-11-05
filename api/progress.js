// /api/progress — server-side progress sync (per device/family).
// GET  ?device=<uuid>           -> { configured, data|null, updatedAt|null }
// POST { device, data }         -> { ok, updatedAt }  (upsert, one row per device)
// Uses Supabase REST (no SDK needed). Without Supabase env vars it answers
// { configured: false } and the client keeps using device localStorage only.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only, service role).
// The client never sends a child's real name to the server in the device id:
// the device id is a random UUID stored in that browser's localStorage.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const TABLE = 'device_progress';

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

module.exports = async (req, res) => {
  if (!URL || !KEY) return json(res, 200, { configured: false, data: null, updatedAt: null });

  if (req.method === 'GET') {
    const device = typeof req.query?.device === 'string' ? req.query.device : '';
    if (!device || device.length > 64) return json(res, 400, { error: 'device required' });
    const r = await sb(`${TABLE}?device=eq.${encodeURIComponent(device)}&select=data,updated_at`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed' });
    const rows = await r.json();
    if (!rows.length) return json(res, 200, { configured: true, data: null, updatedAt: null });
    return json(res, 200, { configured: true, data: rows[0].data, updatedAt: rows[0].updated_at });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); } }
    const device = typeof body?.device === 'string' ? body.device : '';
    if (!device || device.length > 64 || !body?.data || typeof body.data !== 'object') {
      return json(res, 400, { error: 'device and data required' });
    }
    // Keep rows small: reject absurd payloads.
    if (JSON.stringify(body.data).length > 500000) return json(res, 413, { error: 'progress too large' });
    const r = await sb(`${TABLE}?on_conflict=device`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ device, data: body.data, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed' });
    const rows = await r.json().catch(() => []);
    return json(res, 200, { ok: true, updatedAt: rows[0]?.updated_at || new Date().toISOString() });
  }

  return json(res, 405, { error: 'GET or POST only' });
};
