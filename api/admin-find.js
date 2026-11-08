// POST /api/admin-find — find a family for a PIN reset (admin only).
// Body: { password, code } OR { password, name }.
//   code: the exact 6-letter family code.
//   name: an explorer (child's magic) name — case-insensitive
//     SUBSTRING match, because a parent who forgot the code may only
//     remember the name approximately. Names are NOT unique, so a
//     name search may return several families; the admin picks one.
// Reply (200): { families: [{ code, explorers: [{name, level}] }] }.
//   The reply carries ONLY what identifies a family — never the
//   parent PIN, progress, or chats.
// Errors: 503 admin_not_configured (no ADMIN_PASSWORD set),
//   401 unauthorized (wrong/missing password), 400 (bad input),
//   502 supabase failure.
'use strict';

const {
  json,
  adminAuthError,
  supabaseConfigured,
  normaliseCode,
  isCode,
  summariseFamily,
  loadFamily,
  listFamilies,
} = require('../lib/admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return json(res, 400, { error: 'bad json' }); }
  }
  const auth = adminAuthError(body || {});
  if (auth) return json(res, auth.status, auth.body);
  if (!supabaseConfigured()) return json(res, 502, { error: 'supabase_not_configured' });

  const codeRaw = body && typeof body.code === 'string' ? body.code : '';
  const nameRaw = body && typeof body.name === 'string' ? body.name : '';
  if (!codeRaw.trim() && !nameRaw.trim()) return json(res, 400, { error: 'code or name required' });

  try {
    if (codeRaw.trim()) {
      const code = normaliseCode(codeRaw);
      if (!isCode(code)) return json(res, 400, { error: 'invalid_code' });
      const row = await loadFamily(code);
      if (!row) return json(res, 200, { families: [] });
      return json(res, 200, { families: [summariseFamily(row.code, row.data)] });
    }
    const needle = nameRaw.trim().toLowerCase();
    if (needle.length > 64) return json(res, 400, { error: 'name too long' });
    const rows = await listFamilies();
    const families = rows
      .filter((row) => ((row.data && row.data.explorers) || []).some(
        (e) => String(e.name || '').toLowerCase().indexOf(needle) >= 0,
      ))
      .map((row) => summariseFamily(row.code, row.data));
    return json(res, 200, { families });
  } catch (e) {
    return json(res, 502, { error: 'supabase_read_failed' });
  }
};
