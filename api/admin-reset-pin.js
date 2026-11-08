// POST /api/admin-reset-pin — reset a family's parent PIN (admin only).
// Body: { password, code, newPin }.
//   code: the family code. The admin acts on a CODE, never on a
//     name — a name search may match several families, so the admin
//     picks one and resets that family's code.
//   newPin: exactly 4 digits.
// The family's record is loaded and saved back through the same
// server-side upsert the sync uses, so the new PIN propagates to
// the family's devices on their next pull. The old PIN is never
// returned. Reply (200): { ok:true, code, explorers:[{name,level}] }.
// Errors: 503 admin_not_configured, 401 unauthorized, 400 (bad code
//   or bad newPin), 404 family_not_found, 502 supabase failure.
'use strict';

const {
  json,
  adminAuthError,
  supabaseConfigured,
  normaliseCode,
  isCode,
  isPin,
  summariseFamily,
  loadFamily,
  saveFamily,
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

  const code = normaliseCode(body && body.code);
  if (!isCode(code)) return json(res, 400, { error: 'invalid_code' });
  const newPin = typeof body.newPin === 'string' ? body.newPin.trim() : '';
  if (!isPin(newPin)) {
    return json(res, 400, { error: 'invalid_pin', message: 'The new PIN must be exactly 4 digits.' });
  }

  try {
    const row = await loadFamily(code);
    if (!row) return json(res, 404, { error: 'family_not_found' });
    const data = row.data || {};
    data.parentPin = newPin;
    // Stamp the change: the merge takes the later parentPinUpdatedAt,
    // so the admin reset propagates to every linked device instead of
    // a stale local PIN winning it back.
    data.parentPinUpdatedAt = new Date().toISOString();
    await saveFamily(code, data);
    return json(res, 200, Object.assign({ ok: true }, summariseFamily(code, data)));
  } catch (e) {
    return json(res, 502, { error: 'supabase_write_failed' });
  }
};
