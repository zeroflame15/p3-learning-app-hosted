// Admin helpers (server-side only) — shared by api/admin-find.js and
// api/admin-reset-pin.js. The master admin password is checked
// against the ADMIN_PASSWORD env var (Vercel) on EVERY request; it
// is never hardcoded and never stored in the repo. If ADMIN_PASSWORD
// is not set, the admin endpoints refuse with 'admin_not_configured'
// (never a bypass). Uses Supabase REST (no SDK), same pattern as
// api/progress.js. Env: NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SECRET_KEY (server only), ADMIN_PASSWORD.
'use strict';

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

// The admin password is read per request (not cached at module load),
// so a rotated env var takes effect without a code redeploy.
function adminPassword() { return process.env.ADMIN_PASSWORD || ''; }

// Returns null when the request is authorised, otherwise the error
// to send ({ status, body }). A missing/unset ADMIN_PASSWORD is a
// configuration error, never a bypass.
function adminAuthError(body) {
  const pw = adminPassword();
  if (!pw) {
    return {
      status: 503,
      body: {
        error: 'admin_not_configured',
        message: 'Admin is not set up yet — set the ADMIN_PASSWORD env var on the server and redeploy.',
      },
    };
  }
  const given = body && typeof body.password === 'string' ? body.password : '';
  if (!given || given !== pw) return { status: 401, body: { error: 'unauthorized' } };
  return null;
}

function supabaseConfigured() { return Boolean(URL && KEY); }

function normaliseCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[\s-]/g, '');
}
function isCode(v) { return /^[A-Z2-9]{6}$/.test(v); }
function isPin(v) { return /^\d{4}$/.test(v); }

// Primary level as the 'P3' string the app uses (levelNum twin).
function levelStr(e) {
  const n = parseInt(String((e && e.level) || '').replace(/[^0-9]/g, ''), 10);
  return 'P' + ((n >= 1 && n <= 6) ? n : 3);
}

// The minimum needed to identify a family — code, explorer names
// and levels only. NEVER the parent PIN, progress, chats, or
// anything else.
function summariseFamily(code, data) {
  const explorers = ((data && data.explorers) || []).map((e) => ({
    name: String(e.name || ''),
    level: levelStr(e),
  }));
  return { code, explorers };
}

async function loadFamily(code) {
  const r = await sb(`${TABLE}?code=eq.${encodeURIComponent(code)}&select=code,data`);
  if (!r.ok) throw new Error('supabase_read_failed');
  const rows = await r.json();
  if (!rows.length) return null;
  return rows[0];
}

// All family rows (code + data). Used only for a name search, which
// cannot be expressed as a single Supabase filter over the nested
// explorer names. Fine at this scale (a handful of families); if
// the app ever has hundreds of families this should become a
// server-side search instead of fetching every row.
async function listFamilies() {
  const r = await sb(`${TABLE}?select=code,data`);
  if (!r.ok) throw new Error('supabase_read_failed');
  return r.json();
}

// Save a family's record back through the same upsert the sync
// uses, so the change propagates to the family's devices on their
// next pull.
async function saveFamily(code, data) {
  const r = await sb(`${TABLE}?on_conflict=code`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ code, data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('supabase_write_failed');
  return r.json().catch(() => []);
}

module.exports = {
  json,
  sb,
  adminPassword,
  adminAuthError,
  supabaseConfigured,
  normaliseCode,
  isCode,
  isPin,
  levelStr,
  summariseFamily,
  loadFamily,
  listFamilies,
  saveFamily,
  TABLE,
};
