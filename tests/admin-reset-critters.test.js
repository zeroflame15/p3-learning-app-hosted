// Admin — reset critters to Egg (api/admin-reset-critters.js) and
// find a family by friend code (api/admin-find.js). Supabase is
// mocked via global.fetch (same style as tests/admin.test.js): no
// live keys, no network. The critter reset must write the Egg
// defaults AND stamp critterResetAt, or the sync merge (max stage +
// union discovered + latest care) would resurrect the old critter
// state from any linked device still holding it.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function mockReq(method, body) { return { method, body }; }
function loadHandler(name) {
  delete require.cache[require.resolve('../api/' + name)];
  delete require.cache[require.resolve('../lib/admin')];
  return require('../api/' + name);
}
function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-secret';
}
function clearEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.ADMIN_PASSWORD;
}
function supabaseMock(routes) {
  return async (url, init) => {
    const method = (init && init.method) || 'GET';
    if (url.indexOf('family_progress?code=eq.') >= 0 && method !== 'POST') {
      const code = decodeURIComponent(url.split('code=eq.')[1].split('&')[0]);
      return { ok: true, json: async () => routes.rows.filter((r) => r.code === code) };
    }
    if (url.indexOf('family_progress?select=code,data') >= 0 && method !== 'POST') {
      return { ok: true, json: async () => routes.rows };
    }
    if (url.indexOf('family_progress?on_conflict=code') >= 0 && method === 'POST') {
      routes.captured = JSON.parse(init.body);
      routes.writes = (routes.writes || 0) + 1;
      return { ok: true, json: async () => [routes.captured] };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
}

// Fake family rows. The ABC2DE explorers both have grown critters
// (stage 3 and stage 1, named, with care + discovered critters) so
// the reset has something to wipe. Friend codes are 6 characters
// from the same alphabet as family codes; River's friendCode is
// deliberately 'ABC2DE' (equal to a family code) to prove a
// family-code match wins over a friend-code match.
function familyRows() {
  return [
    {
      code: 'ABC2DE', data: {
        parentPin: '1111', syncCode: 'ABC2DE',
        explorers: [
          { id: 'e1', name: 'Star', level: 'P3', stars: 42, starsEarned: 50, starsSpent: 8,
            critterName: 'Greg Washington', critterNameAt: '2026-11-01T00:00:00.000Z',
            critterStage: 3, critterStageDays: 5,
            care: { feed: { at: '2026-11-08T10:00:00.000Z', day: '2026-11-08' } },
            careGrewDay: '2026-11-08', discoveredCritters: ['butterfly', 'ladybird'],
            friendCode: 'SHAR2K' },
          { id: 'e2', name: 'Moon', level: 'P4', stars: 10, starsEarned: 10, starsSpent: 0,
            critterName: 'Bubbles', critterNameAt: '2026-10-20T00:00:00.000Z',
            critterStage: 1, critterStageDays: 20,
            care: { clean: { at: '2026-11-07T09:00:00.000Z', day: '2026-11-07' } },
            careGrewDay: '2026-11-07', discoveredCritters: ['duck'],
            friendCode: '6QHVDY' },
        ],
      },
    },
    {
      code: 'FGH3JK', data: {
        parentPin: '2222', syncCode: 'FGH3JK',
        explorers: [
          { id: 'e3', name: 'Starfish', level: 'P2', stars: 5, starsEarned: 5, starsSpent: 0,
            critterName: 'Splash', critterNameAt: null, critterStage: 2, critterStageDays: 1,
            care: {}, careGrewDay: null, discoveredCritters: [],
            friendCode: 'SHAR2K' },
        ],
      },
    },
    {
      code: 'LMN4PQ', data: {
        parentPin: '3333', syncCode: 'LMN4PQ',
        explorers: [
          { id: 'e4', name: 'River', level: 'P5', stars: 7, starsEarned: 7, starsSpent: 0,
            critterName: 'Splash', critterNameAt: null, critterStage: 0, critterStageDays: 0,
            care: {}, careGrewDay: null, discoveredCritters: [],
            friendCode: 'ABC2DE' },
        ],
      },
    },
    {
      code: 'GM4N9E', data: {
        parentPin: '4444', syncCode: 'GM4N9E',
        explorers: [
          { id: 'e5', name: 'Remote', level: 'P3', stars: 3, starsEarned: 3, starsSpent: 0,
            critterName: 'Splash', critterNameAt: null, critterStage: 0, critterStageDays: 0,
            care: {}, careGrewDay: null, discoveredCritters: [],
            friendCode: 'RMT2K3' },
        ],
      },
    },
  ];
}

// --- admin-reset-critters endpoint ---

test('admin-reset-critters: valid code resets EVERY explorer to Egg and stamps critterResetAt', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-critters');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    const res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.code, 'ABC2DE');
    assert.equal(res.body.resetCount, 2, 'two explorers reset');
    assert.deepEqual(res.body.explorers, [
      { name: 'Star', level: 'P3' },
      { name: 'Moon', level: 'P4' },
    ]);
    assert.equal(routes.writes, 1, 'one Supabase write');
    assert.equal(routes.captured.code, 'ABC2DE');
    const saved = routes.captured.data.explorers;
    assert.equal(saved.length, 2);
    for (const e of saved) {
      assert.equal(e.critterName, 'Splash', 'frog name back to Splash');
      assert.equal(e.critterNameAt, null);
      assert.equal(e.critterStage, 0, 'back to Egg');
      assert.equal(e.critterStageDays, 0);
      assert.deepEqual(e.care, {}, 'care cleared');
      assert.equal(e.careGrewDay, null);
      assert.deepEqual(e.discoveredCritters, [], 'discovered critters cleared');
      assert.ok(e.critterResetAt, 'critterResetAt stamped so the merge takes the reset');
      assert.ok(!isNaN(Date.parse(e.critterResetAt)), 'the stamp is a valid timestamp');
    }
    // Nothing else touched: stars, PIN, level, name all intact.
    assert.equal(saved[0].stars, 42);
    assert.equal(saved[0].starsEarned, 50);
    assert.equal(saved[0].level, 'P3');
    assert.equal(saved[0].name, 'Star');
    assert.equal(saved[1].stars, 10);
    assert.equal(routes.captured.data.parentPin, '1111', 'parent PIN untouched');
    // The old critter state is gone from the saved record and the reply.
    const flatSaved = JSON.stringify(routes.captured.data);
    assert.ok(!flatSaved.includes('Greg Washington'), 'old frog name gone');
    assert.ok(!flatSaved.includes('Bubbles'), 'old frog name gone');
    assert.ok(!flatSaved.includes('butterfly') && !flatSaved.includes('ladybird') && !flatSaved.includes('duck'), 'old discovered critters gone');
    assert.ok(!JSON.stringify(res.body).includes('Greg Washington'), 'old critter data not in the reply');
    assert.ok(!JSON.stringify(res.body).includes('1111'), 'PIN not in the reply');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-reset-critters: wrong/missing password -> 401 and nothing is written', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-critters');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    let res = mockRes();
    await reset(mockReq('POST', { password: 'wrong', code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'unauthorized');
    assert.equal(routes.writes, 0);
    res = mockRes();
    await reset(mockReq('POST', { code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(routes.writes, 0, 'no write on a missing password either');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-reset-critters: unknown code -> 404; bad code -> 400; unconfigured -> 503; non-POST -> 405', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const reset = loadHandler('admin-reset-critters');
  const origFetch = global.fetch;
  const routes = { rows: familyRows(), writes: 0, captured: null };
  global.fetch = supabaseMock(routes);
  try {
    let res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ZZZ9ZZ' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'family_not_found');
    res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ABC' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'invalid_code');
    delete process.env.ADMIN_PASSWORD;
    res = mockRes();
    await reset(mockReq('POST', { password: 'master-123', code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'admin_not_configured');
    process.env.ADMIN_PASSWORD = 'master-123';
    res = mockRes();
    await reset(mockReq('GET', null), res);
    assert.equal(res.statusCode, 405);
    assert.equal(routes.writes, 0, 'no write on any rejected request');
  } finally { global.fetch = origFetch; clearEnv(); }
});

// --- admin-find by friend code ---

test('admin-find: a friend code finds its family (case-insensitive)', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    // Moon's friend code, pasted in lower case: still finds ABC2DE.
    let res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: '6qhvdY' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.families.length, 1);
    assert.equal(res.body.families[0].code, 'ABC2DE');
    assert.deepEqual(res.body.families[0].explorers, [
      { name: 'Star', level: 'P3' },
      { name: 'Moon', level: 'P4' },
    ]);
    assert.ok(!JSON.stringify(res.body).includes('1111'), 'no PIN in the reply');
    // The same friend code sent as a name query finds it too.
    res = mockRes();
    await find(mockReq('POST', { password: 'master-123', name: '6qhvdY' }), res);
    assert.equal(res.body.families.length, 1);
    assert.equal(res.body.families[0].code, 'ABC2DE');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: a friend code shared by two families returns both', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    const res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: 'SHAR2K' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.families.length, 2, 'Star and Starfish share the friend code');
    assert.deepEqual(res.body.families.map((f) => f.code).sort(), ['ABC2DE', 'FGH3JK']);
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: a family-code match wins over a friend-code match', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    // River's friendCode is 'ABC2DE', which is also a family code.
    // The family-code match must win: only ABC2DE comes back, not
    // River's family LMN4PQ.
    const res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: 'ABC2DE' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.families.length, 1);
    assert.equal(res.body.families[0].code, 'ABC2DE');
  } finally { global.fetch = origFetch; clearEnv(); }
});

test('admin-find: a friend code with no match falls through to the name search', async () => {
  setEnv();
  process.env.ADMIN_PASSWORD = 'master-123';
  const find = loadHandler('admin-find');
  const origFetch = global.fetch;
  global.fetch = supabaseMock({ rows: familyRows() });
  try {
    // 'STARFI' is no family code and no friend code, but it is a
    // substring of the explorer name 'Starfish' — the name fallback
    // must still find that family.
    let res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: 'STARFI' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.families.length, 1);
    assert.equal(res.body.families[0].code, 'FGH3JK');
    // And a code with no match anywhere still returns empty.
    res = mockRes();
    await find(mockReq('POST', { password: 'master-123', code: 'ZZZ9ZZ' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.families, []);
  } finally { global.fetch = origFetch; clearEnv(); }
});

// --- admin page client: critters button + confirmation + friend-code search ---

function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, 'function ' + name + ' found in index.html');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}

var adminPw = null, adminResults = [], adminMsg = '', adminOk = '', adminResetCode = null, adminCrittersCode = null;
const esc = eval('(' + grabFn('esc(') + ')');
const adminHTML = eval('(' + grabFn('adminHTML(') + ')');

test('adminHTML: each family row has a Reset critters to Egg button next to Reset PIN', () => {
  adminPw = 'master-123';
  adminResults = [
    { code: 'ABC2DE', explorers: [{ name: 'Star', level: 'P3' }, { name: 'Moon', level: 'P4' }] },
    { code: 'FGH3JK', explorers: [{ name: 'Starfish', level: 'P2' }] },
  ];
  adminMsg = ''; adminOk = ''; adminResetCode = null; adminCrittersCode = null;
  const out = adminHTML();
  assert.ok(out.includes('data-admreset="ABC2DE"'), 'Reset PIN button per family');
  assert.ok(out.includes('data-admcritters="ABC2DE"'), 'Reset critters button per family');
  assert.ok(out.includes('data-admcritters="FGH3JK"'), 'Reset critters button on the second family too');
  assert.ok(out.includes('Reset critters to Egg'), 'button names the action');
  assert.ok(!out.includes('Reset critters to Egg for family'), 'no confirmation card until a family is picked');
});

test('adminHTML: the critters confirmation card warns before any reset', () => {
  adminPw = 'master-123';
  adminResults = [{ code: 'ABC2DE', explorers: [{ name: 'Star', level: 'P3' }] }];
  adminMsg = ''; adminOk = ''; adminResetCode = null; adminCrittersCode = 'ABC2DE';
  const out = adminHTML();
  assert.ok(out.includes('Reset critters to Egg for family ABC2DE'), 'card names the family');
  assert.ok(out.includes('ALL explorers'), 'warns every explorer is reset');
  assert.ok(out.includes('Egg (Stage 1'), 'warns it goes back to Egg');
  assert.ok(out.includes('clears discovered critters'), 'warns discovered critters are cleared');
  assert.ok(out.includes('care progress'), 'warns care progress is cleared');
  assert.ok(out.includes('Splash'), 'warns the frog name goes back to Splash');
  assert.ok(out.includes('cannot be undone'), 'warns it cannot be undone');
  assert.ok(out.includes('id="admDoCritters"'), 'confirm button shown');
  assert.ok(out.includes('id="admCancelCritters"'), 'cancel button shown');
  assert.ok(!out.includes('New PIN for family'), 'the PIN form stays closed while the critters card is open');
});

test('adminHTML: search says it takes a family code, friend code, or explorer name', () => {
  adminPw = 'master-123';
  adminResults = []; adminMsg = ''; adminOk = ''; adminResetCode = null; adminCrittersCode = null;
  const out = adminHTML();
  assert.ok(out.includes('Family code, friend code, or explorer name'), 'label names all three');
  assert.ok(out.includes('6QHVDY'), 'placeholder shows a friend-code example');
  assert.ok(out.includes('friend code'), 'help text mentions the friend code');
});

test('bindAdmin: the critters confirm posts to /api/admin-reset-critters, not the PIN endpoint', () => {
  const src = grabFn('bindAdmin(');
  assert.ok(src.includes("'/api/admin-reset-critters'"), 'critters reset goes to /api/admin-reset-critters');
  assert.ok(src.includes('admDoCritters'), 'confirm button is wired');
  assert.ok(src.includes('admCancelCritters'), 'cancel button is wired');
  assert.ok(src.includes('data-admcritters'), 'critters button per family is wired');
  assert.ok(src.includes("'/api/admin-reset-pin'"), 'PIN reset still goes to its own endpoint');
});

// --- merge: a critter reset must win the sync merge ---

function baseExplorer(overrides) {
  const base = {
    id: 'e1', name: 'Star', level: 'P3', levelAt: 0, code: 'ABC2DE', codeAt: null,
    friendCode: 'ABCDEF', friends: [], nameAt: null, lookAt: null,
    face: '🐤', glow: '#ffb020', badge: '⭐', look: {},
    stars: 0, starsEarned: 0, starsSpent: 0, badges: [], completed: {}, completedDay: {}, progress: {},
    playProgress: {}, playFresh: {}, playDoneDay: {}, playDaily: {}, playSeen: {},
    critterName: 'Splash', critterNameAt: null, critterStage: 0, critterStageDays: 0,
    care: {}, careGrewDay: null, discoveredCritters: [], critterResetAt: null,
    theme: 'Frog Pond', themeAt: null, treasures: [],
    threads: [], deletedThreadIds: [], threadSeq: 0, daily: {}, totalMinutes: 0,
    lastTopic: null, favAnswers: [], deletedFavAnswers: [], swapIdx: 0, mood: {}, stuckCount: {}, boost: {},
    flashcards: [], deletedFlashcards: [], deletedPlanner: [], spellingTests: [], deletedSpellingTests: [],
    planner: [], flags: [], created: 0, playBest: {}, learnBest: {},
  };
  return Object.assign(base, overrides || {});
}

test('mergeExplorer: a later critterResetAt makes the reset win over a stale grown critter', () => {
  const unionArr = eval('(' + grabFn('unionArr(') + ')');
  const unionObjMax = eval('(' + grabFn('unionObjMax(') + ')');
  const unionObjLatest = eval('(' + grabFn('unionObjLatest(') + ')');
  const pickCritterName = eval('(' + grabFn('pickCritterName(') + ')');
  const mergeCare = eval('(' + grabFn('mergeCare(') + ')');
  const mergeLetters = eval('(' + grabFn('mergeLetters(') + ')');
  const isThinkingMsg = eval('(' + grabFn('isThinkingMsg(') + ')');
  const mergeThreads = eval('(' + grabFn('mergeThreads(') + ')');
  const mergeExplorer = eval('(' + grabFn('mergeExplorer(') + ')');
  const reset = baseExplorer({ critterResetAt: '2026-11-09T12:00:00.000Z' });
  const stale = baseExplorer({
    critterName: 'Greg Washington', critterNameAt: '2026-11-01T00:00:00.000Z',
    critterStage: 3, critterStageDays: 5,
    care: { feed: { at: '2026-11-08T10:00:00.000Z', day: '2026-11-08' } },
    careGrewDay: '2026-11-08', discoveredCritters: ['butterfly', 'ladybird'],
    critterResetAt: null,
  });
  // Reset on the server side (a), stale on the local side (b).
  let merged = mergeExplorer(reset, stale);
  assert.equal(merged.critterStage, 0, 'reset stage wins over the stale adult');
  assert.equal(merged.critterName, 'Splash', 'reset name wins');
  assert.deepEqual(merged.discoveredCritters, [], 'reset clears discovered critters');
  assert.deepEqual(merged.care, {}, 'reset clears care');
  assert.equal(merged.careGrewDay, null);
  // And the other way round (stale server, reset local) also wins.
  merged = mergeExplorer(stale, reset);
  assert.equal(merged.critterStage, 0, 'reset wins whichever side it is on');
  assert.equal(merged.critterName, 'Splash');
  assert.deepEqual(merged.discoveredCritters, []);
  // Growth after the reset is kept when both sides share the reset time.
  const grown = baseExplorer({
    critterResetAt: '2026-11-09T12:00:00.000Z',
    critterStage: 1, critterStageDays: 3, discoveredCritters: ['duck'],
  });
  merged = mergeExplorer(reset, grown);
  assert.equal(merged.critterStage, 1, 'a care day after the reset still grows the frog');
  assert.deepEqual(merged.discoveredCritters, ['duck'], 'a critter discovered after the reset is kept');
});

test('mergeExplorer: without a reset, the old max-stage and union-discovered rules still apply', () => {
  const unionArr = eval('(' + grabFn('unionArr(') + ')');
  const unionObjMax = eval('(' + grabFn('unionObjMax(') + ')');
  const unionObjLatest = eval('(' + grabFn('unionObjLatest(') + ')');
  const pickCritterName = eval('(' + grabFn('pickCritterName(') + ')');
  const mergeCare = eval('(' + grabFn('mergeCare(') + ')');
  const mergeLetters = eval('(' + grabFn('mergeLetters(') + ')');
  const isThinkingMsg = eval('(' + grabFn('isThinkingMsg(') + ')');
  const mergeThreads = eval('(' + grabFn('mergeThreads(') + ')');
  const mergeExplorer = eval('(' + grabFn('mergeExplorer(') + ')');
  const a = baseExplorer({ critterStage: 1, critterStageDays: 10, discoveredCritters: ['duck'] });
  const b = baseExplorer({ critterStage: 2, critterStageDays: 4, discoveredCritters: ['butterfly'] });
  const merged = mergeExplorer(a, b);
  assert.equal(merged.critterStage, 2, 'higher stage still wins when there is no reset');
  assert.deepEqual(merged.discoveredCritters.sort(), ['butterfly', 'duck'], 'discovered critters still union when there is no reset');
});
