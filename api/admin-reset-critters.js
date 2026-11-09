// POST /api/admin-reset-critters — reset a family's critters to Egg (admin only).
// Body: { password, code }.
//   code: the family code. The admin acts on a CODE, never on a
//     name — a name search may match several families, so the admin
//     picks one and resets that family's code.
// Every explorer in the family is reset to the new-explorer critter
// defaults: critterName 'Splash', critterNameAt null, critterStage 0
// (Egg/Frogspawn), critterStageDays 0, care {}, careGrewDay null,
// discoveredCritters []. A critterResetAt timestamp is stamped so the
// reset wins the sync merge on every linked device: mergeExplorer
// takes the later critterResetAt for the critter fields (the same
// later-timestamp-wins rule as levelAt/themeAt/codeAt). Without it
// the merge's max-stage + union-discovered + latest-care would
// resurrect the old critter state from any device still holding it.
// Nothing else is touched (stars, quests, badges, treasures,
// spelling tests, schedule, PIN, level, name, look). The old critter
// data is never returned. Reply (200):
//   { ok:true, code, resetCount, explorers:[{name,level}] }.
// Errors: 503 admin_not_configured, 401 unauthorized, 400 (bad code),
//   404 family_not_found, 502 supabase failure.
'use strict';

const {
  json,
  adminAuthError,
  supabaseConfigured,
  normaliseCode,
  isCode,
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

  try {
    const row = await loadFamily(code);
    if (!row) return json(res, 404, { error: 'family_not_found' });
    const data = row.data || {};
    const now = new Date().toISOString();
    (data.explorers || []).forEach(function (e) {
      e.critterName = 'Splash';
      e.critterNameAt = null;
      e.critterStage = 0;
      e.critterStageDays = 0;
      e.care = {};
      e.careGrewDay = null;
      e.discoveredCritters = [];
      e.critterResetAt = now;
    });
    await saveFamily(code, data);
    return json(res, 200, Object.assign(
      { ok: true, resetCount: (data.explorers || []).length },
      summariseFamily(code, data),
    ));
  } catch (e) {
    return json(res, 502, { error: 'supabase_write_failed' });
  }
};
