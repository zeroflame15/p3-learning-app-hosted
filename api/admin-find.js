// POST /api/admin-find — find a family for a PIN reset (admin only).
// Body: { password, code } OR { password, name }.
//   code: the exact 6-letter family code. If no family has that
//     code, the request tries the explorer's FRIEND code next
//     (also 6 uppercase characters, e.g. "6QHVDY" — the per-explorer
//     shareable code, different from the family sync code), and then
//     falls back to a name search, because an explorer name can
//     itself look like a code — "Remote" is 6 letters, so the client
//     sends it as a code, and without the fallback a name search for
//     it would find nothing.
//   name: an explorer (child's magic) name — case-insensitive
//     SUBSTRING match, because a parent who forgot the code may only
//     remember the name approximately. Names are NOT unique, so a
//     name search may return several families; the admin picks one.
//     A name-shaped query is first tried as an exact friend code,
//     so a pasted friend code finds its family even when it does not
//     look like a family code.
// Lookup order: (1) exact family code, (2) exact friend code
//   (case-insensitive), (3) explorer-name substring.
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

// Case-insensitive substring search over every explorer name.
// Used for an explicit name query AND as the fallback when a
// code-shaped query matches no family code.
async function findByName(needle) {
  const rows = await listFamilies();
  return rows
    .filter((row) => ((row.data && row.data.explorers) || []).some(
      (e) => String(e.name || '').toLowerCase().indexOf(needle) >= 0,
    ))
    .map((row) => summariseFamily(row.code, row.data));
}

// Case-insensitive EXACT match over every explorer's friendCode.
// A friend code is the per-explorer shareable code (e.g. "6QHVDY"),
// different from the 6-letter family sync code. It sits between the
// family-code lookup and the name-substring fallback: a code-shaped
// query that is not a family code is tried as a friend code before
// it falls back to a name search. A friend code identifies one
// explorer, so it returns that explorer's family; if the same friend
// code somehow appears in more than one family, all of them are
// returned (same shape as the name search).
async function findByFriendCode(needle) {
  const rows = await listFamilies();
  const want = String(needle || '').toUpperCase();
  if (!want) return [];
  return rows
    .filter((row) => ((row.data && row.data.explorers) || []).some(
      (e) => String(e.friendCode || '').toUpperCase() === want,
    ))
    .map((row) => summariseFamily(row.code, row.data));
}

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
      if (row) return json(res, 200, { families: [summariseFamily(row.code, row.data)] });
      // No family has that code — it may be an explorer's friend
      // code (also 6 uppercase characters). Try that next: a friend
      // code identifies the explorer's family exactly.
      const byFriend = await findByFriendCode(code);
      if (byFriend.length) return json(res, 200, { families: byFriend });
      // Still nothing — it may be an explorer name that happens to
      // look like a code (e.g. "Remote" is 6 letters). Fall back to
      // a name search so a 6-letter name is found.
      const families = await findByName(code.toLowerCase());
      return json(res, 200, { families });
    }
    const needle = nameRaw.trim().toLowerCase();
    if (needle.length > 64) return json(res, 400, { error: 'name too long' });
    // A name-shaped query may be a friend code pasted in (friend
    // codes are not always 6 code-shaped characters), so try an
    // exact friend-code match before the name substring search.
    const byFriend = await findByFriendCode(needle);
    if (byFriend.length) return json(res, 200, { families: byFriend });
    const families = await findByName(needle);
    return json(res, 200, { families });
  } catch (e) {
    return json(res, 502, { error: 'supabase_read_failed' });
  }
};
