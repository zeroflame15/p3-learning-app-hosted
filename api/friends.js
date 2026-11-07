// /api/friends — cross-family friends, LEADERBOARD-ONLY.
// One endpoint, POST only, ?action=publish|request|inbox|respond|friends.
// A friend code identifies ONE explorer, never a family sync code.
// The public snapshot for an explorer holds only what a friend may
// see on the leaderboard: display name, stars, fastest game times.
// No family sync code, no Ask Pip chats, no full progress — ever.
// A friend appears on a child's leaderboard only after a parent
// accepts the request in the PIN-protected parent page.
// Uses Supabase REST (no SDK), same conventions as /api/progress.
// Without Supabase env vars it answers { configured: false }.
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (server only).

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const SNAPSHOTS = 'friend_snapshots';
const REQUESTS = 'friend_requests';

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

// Friend codes use the same unambiguous alphabet as the family sync
// code (no I/L/O/0/1). Normalised like the sync code (upper-case,
// no spaces/hyphens); anything else is rejected as a bad code.
const FRIEND_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function normCode(v) {
  return String(v || '').toUpperCase().replace(/[\s-]/g, '');
}
function validCode(v) {
  const code = normCode(v);
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(code)) return null;
  return code.split('').every((ch) => FRIEND_ALPHABET.indexOf(ch) >= 0) ? code : null;
}

function cleanName(v) {
  const name = String(v == null ? '' : v).trim().slice(0, 40);
  return name || 'Explorer';
}

function cleanStars(v) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Best times are { gameId: { secs } } for Play games, plus
// { learn-<topicId>: { secs } } for Learn quests — fastest times,
// nothing else. Keys are short ids; values keep the seconds only.
// The cap is 40 keys: 9 games + 14 quests, with headroom.
function cleanBestTimes(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const k of Object.keys(v).slice(0, 40)) {
    if (!/^[a-z0-9_-]{1,20}$/.test(k)) continue;
    const b = v[k];
    const secs = b && Number.isFinite(Number(b.secs)) ? Math.round(Number(b.secs)) : NaN;
    if (Number.isFinite(secs) && secs > 0 && secs <= 3600) out[k] = { secs };
  }
  return out;
}

function publicSnapshot(row) {
  // Only snapshot fields leave the server — never anything else.
  return {
    code: row.code,
    name: row.name,
    stars: row.stars || 0,
    bestTimes: row.best_times || {},
  };
}

module.exports = async (req, res) => {
  if (!URL || !KEY) return json(res, 200, { configured: false });

  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
  }
  body = body || {};
  if (JSON.stringify(body).length > 10000) return json(res, 413, { error: 'request too large' });

  const action = (req.query && req.query.action) || body.action || '';

  // publish { code, name, stars, bestTimes } — upsert my snapshot.
  if (action === 'publish') {
    const code = validCode(body.code);
    if (!code) return json(res, 400, { error: 'bad friend code' });
    const r = await sb(`${SNAPSHOTS}?on_conflict=code`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        code,
        name: cleanName(body.name),
        stars: cleanStars(body.stars),
        best_times: cleanBestTimes(body.bestTimes),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed' });
    return json(res, 200, { configured: true, ok: true });
  }

  // request { fromCode, fromName, toCode } — send a friend request.
  if (action === 'request') {
    const fromCode = validCode(body.fromCode);
    const toCode = validCode(body.toCode);
    if (!fromCode || !toCode) return json(res, 400, { error: 'bad friend code' });
    if (fromCode === toCode) return json(res, 400, { error: 'cannot_add_self' });
    // The other explorer must exist (i.e. have published a snapshot).
    const known = await sb(`${SNAPSHOTS}?code=eq.${encodeURIComponent(toCode)}&select=code`);
    if (!known.ok) return json(res, 502, { error: 'supabase_read_failed' });
    if (!(await known.json()).length) return json(res, 404, { error: 'unknown_friend_code' });
    // No duplicate pending request in this direction.
    const dup = await sb(`${REQUESTS}?from_code=eq.${encodeURIComponent(fromCode)}&to_code=eq.${encodeURIComponent(toCode)}&status=eq.pending&select=id`);
    if (!dup.ok) return json(res, 502, { error: 'supabase_read_failed' });
    if ((await dup.json()).length) return json(res, 409, { error: 'request_already_pending' });
    // No second request once already friends (either direction).
    const fwd = await sb(`${REQUESTS}?from_code=eq.${encodeURIComponent(fromCode)}&to_code=eq.${encodeURIComponent(toCode)}&status=eq.accepted&select=id`);
    const rev = await sb(`${REQUESTS}?from_code=eq.${encodeURIComponent(toCode)}&to_code=eq.${encodeURIComponent(fromCode)}&status=eq.accepted&select=id`);
    if (!fwd.ok || !rev.ok) return json(res, 502, { error: 'supabase_read_failed' });
    if ((await fwd.json()).length || (await rev.json()).length) {
      return json(res, 409, { error: 'already_friends' });
    }
    const r = await sb(REQUESTS, {
      method: 'POST',
      body: JSON.stringify({
        from_code: fromCode,
        to_code: toCode,
        from_name: cleanName(body.fromName),
        status: 'pending',
      }),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed' });
    const rows = await r.json().catch(() => []);
    return json(res, 200, { configured: true, ok: true, id: rows[0]?.id || null });
  }

  // inbox { code } — pending requests addressed to this code.
  // Only the request id, the sender's code and display name come
  // back: no family data, no progress, no chats.
  if (action === 'inbox') {
    const code = validCode(body.code);
    if (!code) return json(res, 400, { error: 'bad friend code' });
    const r = await sb(`${REQUESTS}?to_code=eq.${encodeURIComponent(code)}&status=eq.pending&select=id,from_code,from_name,created_at&order=created_at.asc`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed' });
    const rows = await r.json();
    return json(res, 200, {
      configured: true,
      requests: rows.map((row) => ({
        id: row.id,
        fromCode: row.from_code,
        fromName: row.from_name,
        createdAt: row.created_at,
      })),
    });
  }

  // respond { id, code, accept } — accept/decline a request.
  // Only the explorer the request was addressed to may answer it.
  if (action === 'respond') {
    const code = validCode(body.code);
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!code) return json(res, 400, { error: 'bad friend code' });
    if (!id || id.length > 64) return json(res, 400, { error: 'request id required' });
    const found = await sb(`${REQUESTS}?id=eq.${encodeURIComponent(id)}&select=id,from_code,to_code,status`);
    if (!found.ok) return json(res, 502, { error: 'supabase_read_failed' });
    const rows = await found.json();
    if (!rows.length) return json(res, 404, { error: 'request_not_found' });
    const row = rows[0];
    if (row.to_code !== code) return json(res, 403, { error: 'not_addressed_to_you' });
    if (row.status !== 'pending') return json(res, 409, { error: 'request_already_answered' });
    const status = body.accept ? 'accepted' : 'declined';
    const r = await sb(`${REQUESTS}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!r.ok) return json(res, 502, { error: 'supabase_write_failed' });
    return json(res, 200, { configured: true, ok: true, status });
  }

  // friends { code } — accepted friends' snapshots. For every
  // accepted request where I am either side, return the OTHER
  // side's snapshot, and only its public fields.
  if (action === 'friends') {
    const code = validCode(body.code);
    if (!code) return json(res, 400, { error: 'bad friend code' });
    const r = await sb(`${REQUESTS}?status=eq.accepted&or=(from_code.eq.${encodeURIComponent(code)},to_code.eq.${encodeURIComponent(code)})&select=from_code,to_code`);
    if (!r.ok) return json(res, 502, { error: 'supabase_read_failed' });
    const rows = await r.json();
    const other = [];
    for (const row of rows) {
      const c = row.from_code === code ? row.to_code : row.from_code;
      if (c && c !== code && other.indexOf(c) < 0) other.push(c);
    }
    if (!other.length) return json(res, 200, { configured: true, friends: [] });
    const snaps = await sb(`${SNAPSHOTS}?code=in.(${other.map(encodeURIComponent).join(',')})&select=code,name,stars,best_times`);
    if (!snaps.ok) return json(res, 502, { error: 'supabase_read_failed' });
    const snapRows = await snaps.json();
    // Only explorers with a published snapshot appear; a friend who
    // never opened the arcade has nothing to show yet.
    return json(res, 200, { configured: true, friends: snapRows.map(publicSnapshot) });
  }

  return json(res, 400, { error: 'unknown action' });
};
