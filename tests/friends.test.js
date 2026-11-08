// Friends (leaderboard-only) tests — mocked Supabase, no live keys.
// Server tests always run. Client tests read the friends client copy:
//   FRIENDS_CLIENT=/tmp/friends-index.html node --test tests/friends.test.js
// Against the not-yet-integrated public/index.html they skip, because
// the client patches live on the temp copy until integration.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* ================= server: in-memory Supabase mock ================= */

function makeSupabaseMock() {
  const db = { friend_snapshots: new Map(), friend_requests: [] };
  let reqSeq = 0;
  const calls = [];

  function rowsFor(table) {
    return table === 'friend_snapshots'
      ? [...db.friend_snapshots.values()]
      : db.friend_requests.slice();
  }

  function applyFilters(rows, q) {
    return rows.filter((row) => {
      for (const [k, v] of q.entries()) {
        if (k === 'select' || k === 'order' || k === 'on_conflict') continue;
        if (k === 'or') {
          const inner = v.replace(/^\(|\)$/g, '');
          const okCond = inner.split(',').some((c) => {
            const m = c.match(/^(\w+)\.eq\.(.+)$/);
            return m && String(row[m[1]]) === m[2];
          });
          if (!okCond) return false;
          continue;
        }
        if (v.startsWith('eq.')) {
          if (String(row[k]) !== v.slice(3)) return false;
          continue;
        }
        if (v.startsWith('in.(')) {
          const list = v.slice(4, -1).split(',').map((s) => decodeURIComponent(s));
          if (!list.includes(String(row[k]))) return false;
          continue;
        }
      }
      return true;
    });
  }

  async function fetchMock(url, init = {}) {
    calls.push({ url, init });
    const u = new URL(url);
    const table = u.pathname.split('/rest/v1/')[1];
    const method = (init.method || 'GET').toUpperCase();
    const q = u.searchParams;
    const ok = (rows) => ({ ok: true, status: 200, json: async () => rows });
    if (method === 'GET') return ok(applyFilters(rowsFor(table), q));
    if (method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      if (table === 'friend_snapshots') {
        const row = { ...body };
        db.friend_snapshots.set(row.code, row);
        return ok([row]);
      }
      const row = { id: 'req-' + (++reqSeq), created_at: new Date().toISOString(), ...body };
      db.friend_requests.push(row);
      return ok([row]);
    }
    if (method === 'PATCH') {
      const body = JSON.parse(init.body || '{}');
      const matched = applyFilters(rowsFor(table), q);
      matched.forEach((r) => Object.assign(r, body));
      return ok(matched);
    }
    return { ok: false, status: 405, json: async () => ({}) };
  }

  return { db, calls, fetchMock };
}

function mockRes() {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = () => res;
  res.json = (o) => { res.body = o; return res; };
  return res;
}
function mockReq(method, body, query) { return { method, body, query: query || {} }; }

function loadHandler() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  delete require.cache[require.resolve('../api/friends')];
  return require('../api/friends');
}

// Two explorers with published snapshots, ready for requests.
async function seedPair(handler, fetchMock) {
  const origFetch = global.fetch;
  global.fetch = fetchMock;
  try {
    let res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', name: 'Jiyuna', stars: 42, bestTimes: { word: { secs: 38 }, number: { secs: 25 } } }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200, 'seed publish A');
    res = mockRes();
    await handler(mockReq('POST', { code: 'XYZ789', name: 'Kai', stars: 30, bestTimes: { word: { secs: 50 } } }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200, 'seed publish B');
  } finally { global.fetch = origFetch; }
}

test('friends: unconfigured server answers {configured:false}', async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete require.cache[require.resolve('../api/friends')];
  const friends = require('../api/friends');
  const res = mockRes();
  await friends(mockReq('POST', { code: 'ABC2DE' }, { action: 'publish' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.configured, false);
  const res2 = mockRes();
  await friends(mockReq('POST', { code: 'ABC2DE' }, { action: 'inbox' }), res2);
  assert.equal(res2.body.configured, false);
});

test('friends: bad friend codes are rejected (format validation)', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    for (const bad of ['ABC12', 'ABC2DEF', 'ABC12I', 'ABC12O', 'ABC121', 'ABC12L', '', null]) {
      const res = mockRes();
      await handler(mockReq('POST', { code: bad, name: 'Jiyuna', stars: 1 }, { action: 'publish' }), res);
      assert.equal(res.statusCode, 400, 'publish rejects ' + JSON.stringify(bad));
      assert.equal(res.body.error, 'bad friend code');
    }
    // Lower-case is normalised, like the family sync code.
    const res = mockRes();
    await handler(mockReq('POST', { code: 'abc2de', name: 'Jiyuna', stars: 1 }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200, 'lower-case code is normalised and accepted');
    assert.ok(mock.db.friend_snapshots.has('ABC2DE'), 'stored under the normalised code');
    // Bad codes are rejected on the read actions too.
    for (const action of ['inbox', 'friends']) {
      const r2 = mockRes();
      await handler(mockReq('POST', { code: 'ZZZZZI' }, { action }), r2);
      assert.equal(r2.statusCode, 400, action + ' rejects a bad code');
    }
  } finally { global.fetch = origFetch; }
});

test('friends: publish upserts the snapshot and sanitises it', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    let res = mockRes();
    await handler(mockReq('POST', {
      code: 'ABC2DE',
      name: '  Jiyuna with a very very very very very long name that must be cut  ',
      stars: -5,
      bestTimes: { word: { secs: 38 }, number: { secs: 0 }, sort: { secs: 'fast' }, 'bad key!': { secs: 9 }, memory: { secs: 12, day: '2026-11-07' } },
    }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    const snap = mock.db.friend_snapshots.get('ABC2DE');
    assert.equal(snap.name.length <= 40, true, 'name is capped at 40 chars');
    assert.equal(snap.stars, 0, 'negative stars become 0');
    assert.deepEqual(snap.best_times, { word: { secs: 38 }, memory: { secs: 12 } }, 'only sane {secs} entries survive');
    // A second publish overwrites the first (upsert, not a duplicate row).
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', name: 'Jiyuna', stars: 50, bestTimes: { word: { secs: 30 } } }, { action: 'publish' }), res);
    assert.equal(mock.db.friend_snapshots.size, 1, 'still one snapshot row');
    assert.equal(mock.db.friend_snapshots.get('ABC2DE').stars, 50, 'stars updated');
  } finally { global.fetch = origFetch; }
});

test('friends: publish keeps all 9 game times plus all 14 Learn quest times', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    // A child who has timed every game and every quest publishes 23
    // keys — the old 20-key cap silently dropped the last three.
    const bestTimes = {};
    for (const g of ['word', 'number', 'memory', 'sort', 'scramble', 'race', 'sentence', 'crossword', 'parking']) bestTimes[g] = { secs: 40 };
    for (const t of ['eng-story', 'eng-tense', 'eng-story2', 'eng-punct', 'math-mrt', 'math-hawker', 'math-ntuc', 'math-frac', 'sci-frog', 'sci-magnet', 'sci-plants', 'chi-listen', 'chi-family', 'chi-school']) bestTimes['learn-' + t] = { secs: 60 };
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', name: 'Jiyuna', stars: 10, bestTimes }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200);
    const snap = mock.db.friend_snapshots.get('ABC2DE');
    assert.equal(Object.keys(snap.best_times).length, 23, 'all 23 best times stored, got ' + Object.keys(snap.best_times).length);
    assert.equal(snap.best_times['learn-chi-school'].secs, 60, 'the last Learn quest time survives');
  } finally { global.fetch = origFetch; }
});

test('friends: self-request rejected, unknown code rejected, duplicate pending rejected', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  await seedPair(handler, mock.fetchMock);
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    let res = mockRes();
    await handler(mockReq('POST', { fromCode: 'ABC2DE', fromName: 'Jiyuna', toCode: 'ABC2DE' }, { action: 'request' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'cannot_add_self');

    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'ABC2DE', fromName: 'Jiyuna', toCode: 'QQQ222' }, { action: 'request' }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'unknown_friend_code');

    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'ABC2DE', fromName: 'Jiyuna', toCode: 'XYZ789' }, { action: 'request' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.id, 'request id returned');

    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'ABC2DE', fromName: 'Jiyuna', toCode: 'XYZ789' }, { action: 'request' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, 'request_already_pending');
  } finally { global.fetch = origFetch; }
});

test('friends: inbox returns only requests addressed to this code', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  await seedPair(handler, mock.fetchMock);
  // A third explorer, so requests can point at two different codes.
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    let res = mockRes();
    await handler(mockReq('POST', { code: 'MNP456', name: 'Mei', stars: 5, bestTimes: {} }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200);
    for (const [from, to, name] of [['ABC2DE', 'XYZ789', 'Jiyuna'], ['ABC2DE', 'MNP456', 'Jiyuna'], ['MNP456', 'XYZ789', 'Mei']]) {
      res = mockRes();
      await handler(mockReq('POST', { fromCode: from, fromName: name, toCode: to }, { action: 'request' }), res);
      assert.equal(res.statusCode, 200, 'request ' + from + '->' + to);
    }
    res = mockRes();
    await handler(mockReq('POST', { code: 'XYZ789' }, { action: 'inbox' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.requests.length, 2, 'Kai has two requests');
    assert.deepEqual(res.body.requests.map((r) => r.fromCode).sort(), ['ABC2DE', 'MNP456']);
    // Inbox rows carry from_name only — no family data, no progress.
    assert.deepEqual(Object.keys(res.body.requests[0]).sort(), ['createdAt', 'fromCode', 'fromName', 'id']);
    res = mockRes();
    await handler(mockReq('POST', { code: 'MNP456' }, { action: 'inbox' }), res);
    assert.equal(res.body.requests.length, 1, 'Mei has one request');
    assert.equal(res.body.requests[0].fromCode, 'ABC2DE');
  } finally { global.fetch = origFetch; }
});

test('friends: respond only by the addressed code; friends list is accepted-only, other-side-only, snapshot-fields-only', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  await seedPair(handler, mock.fetchMock);
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    let res = mockRes();
    await handler(mockReq('POST', { code: 'MNP456', name: 'Mei', stars: 5, bestTimes: { sort: { secs: 44 } } }, { action: 'publish' }), res);
    // A -> B (accepted), A -> C (stays pending), C -> A (declined).
    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'ABC2DE', fromName: 'Jiyuna', toCode: 'XYZ789' }, { action: 'request' }), res);
    const idAB = res.body.id;
    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'ABC2DE', fromName: 'Jiyuna', toCode: 'MNP456' }, { action: 'request' }), res);
    const idAC = res.body.id;
    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'MNP456', fromName: 'Mei', toCode: 'ABC2DE' }, { action: 'request' }), res);
    const idCA = res.body.id;

    // The sender may not answer their own request.
    res = mockRes();
    await handler(mockReq('POST', { id: idAB, code: 'ABC2DE', accept: true }, { action: 'respond' }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'not_addressed_to_you');
    // A stranger may not answer it either.
    res = mockRes();
    await handler(mockReq('POST', { id: idAB, code: 'MNP456', accept: true }, { action: 'respond' }), res);
    assert.equal(res.statusCode, 403);
    // Unknown request id.
    res = mockRes();
    await handler(mockReq('POST', { id: 'req-999', code: 'XYZ789', accept: true }, { action: 'respond' }), res);
    assert.equal(res.statusCode, 404);
    // The addressed explorer accepts; a second answer is rejected.
    res = mockRes();
    await handler(mockReq('POST', { id: idAB, code: 'XYZ789', accept: true }, { action: 'respond' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'accepted');
    res = mockRes();
    await handler(mockReq('POST', { id: idAB, code: 'XYZ789', accept: false }, { action: 'respond' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, 'request_already_answered');
    // Decline the C -> A request.
    res = mockRes();
    await handler(mockReq('POST', { id: idCA, code: 'ABC2DE', accept: false }, { action: 'respond' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'declined');

    // Jiyuna's friends: only Kai (accepted). Not Mei (pending out,
    // declined in). Only the other side's snapshot, public fields only.
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE' }, { action: 'friends' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.friends.length, 1);
    assert.deepEqual(Object.keys(res.body.friends[0]).sort(), ['bestTimes', 'code', 'name', 'stars']);
    assert.equal(res.body.friends[0].code, 'XYZ789');
    assert.equal(res.body.friends[0].name, 'Kai');
    assert.equal(res.body.friends[0].stars, 30);
    assert.deepEqual(res.body.friends[0].bestTimes, { word: { secs: 50 } });
    // Kai's friends: only Jiyuna (the other side).
    res = mockRes();
    await handler(mockReq('POST', { code: 'XYZ789' }, { action: 'friends' }), res);
    assert.equal(res.body.friends.length, 1);
    assert.equal(res.body.friends[0].code, 'ABC2DE');
    // Mei has no accepted friends yet.
    res = mockRes();
    await handler(mockReq('POST', { code: 'MNP456' }, { action: 'friends' }), res);
    assert.deepEqual(res.body.friends, []);
    // A second request now that they are friends is rejected.
    res = mockRes();
    await handler(mockReq('POST', { fromCode: 'XYZ789', fromName: 'Kai', toCode: 'ABC2DE' }, { action: 'request' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, 'already_friends');
    assert.ok(idAC, 'pending request id exists (unused here)');
  } finally { global.fetch = origFetch; }
});

test('friends: an accepted friend with no snapshot yet does not appear', async () => {
  const mock = makeSupabaseMock();
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = mock.fetchMock;
  try {
    // Only A publishes. B never opens the arcade, so B has no snapshot.
    let res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', name: 'Jiyuna', stars: 1, bestTimes: {} }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 200);
    // Seed B's snapshot directly in the mock store, then delete it to
    // simulate "request exists, snapshot never published": simpler —
    // insert the request row straight into the mock tables.
    mock.db.friend_requests.push({ id: 'req-77', from_code: 'ABC2DE', to_code: 'XYZ789', from_name: 'Jiyuna', status: 'accepted', created_at: new Date().toISOString() });
    res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE' }, { action: 'friends' }), res);
    assert.deepEqual(res.body.friends, [], 'no snapshot yet means nothing to show');
  } finally { global.fetch = origFetch; }
});

test('friends: a failed Supabase call is a 502, not a crash', async () => {
  const handler = loadHandler();
  const origFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  try {
    const res = mockRes();
    await handler(mockReq('POST', { code: 'ABC2DE', name: 'Jiyuna', stars: 1 }, { action: 'publish' }), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'supabase_write_failed');
  } finally { global.fetch = origFetch; }
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
});

/* ================= client (temp copy until integration) ================= */

const clientPath = process.env.FRIENDS_CLIENT || path.join(__dirname, '..', 'public', 'index.html');
const clientSrc = fs.readFileSync(clientPath, 'utf8');
const hasFriends = clientSrc.includes('function genFriendCode');
const skipIfNotIntegrated = { skip: !hasFriends };

function grab(name) {
  const start = clientSrc.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = clientSrc.indexOf('\n}\n', start);
  assert.ok(end > start, name + ' has a closing brace');
  return clientSrc.slice(start, end + 3);
}

// Stubs the grabbed client functions need (mirrors the page's own
// helpers and state, cut down to what friends code touches).
// ic() is the page's real icon helper, grabbed verbatim — the boards
// it renders call it, so the eval'd code needs it in scope.
const icFn = clientSrc.slice(clientSrc.indexOf('function ic(src,emo,cls){'), clientSrc.indexOf('\n', clientSrc.indexOf('function ic(src,emo,cls){')));
function clientPrelude() {
  return 'var SYNC_ALPHABET=\'ABCDEFGHJKMNPQRSTUVWXYZ23456789\';\n'
    + icFn + '\n'
    + 'var DB={explorers:[{id:\'e1\',name:\'Jiyuna\',friendCode:\'ABC2DE\',friends:[\'XYZ789\'],stars:10,playBest:{word:{secs:42,day:\'2026-11-07\'},number:{secs:30,day:\'2026-11-07\'}}}],activeId:\'e1\'};\n'
    + 'var saveLocalCalls=0; function saveLocal(){ saveLocalCalls++; }\n'
    + 'function syncCodeValid(v){ return /^[A-Z2-9]{6}$/.test(String(v||\'\')) && String(v).split(\'\').every(function(ch){ return SYNC_ALPHABET.indexOf(ch)>=0; }); }\n'
    + 'function ex(){ return DB.explorers.find(function(e){return e.id===DB.activeId;})||null; }\n'
    + 'function esc(s){ return String(s==null?\'\':s).replace(/[&<>"\']/g,function(c){return{\'&\':\'&amp;\',\'<\':\'&lt;\',\'>\':\'&gt;\',\'"\':\'&quot;\' ,"\'":\'&#39;\' }[c];}); }\n'
    + 'function fmtPlaySecs(s){ s=Math.max(0,Math.round(s||0)); return s<60?s+\'s\':Math.floor(s/60)+\'m \'+String(s%60).padStart(2,\'0\')+\'s\'; }\n'
    + 'var GAMES=[{id:\'word\',name:\'Word Garden\'},{id:\'number\',name:\'Number Pop\'},{id:\'memory\',name:\'Memory Match\'},{id:\'sort\',name:\'Speed Sort\'}];\n'
    + 'var friendsCache=null; var friendsUnconfigured=false;\n'
    + 'var pendingReqCount=0;\n'
    + 'var frErrMsg=\'\';\n'
    + 'var toastCalls=[]; function toast(m){ toastCalls.push(m); }\n';
}

test('client: new explorers get a friend code and an empty friends list', skipIfNotIntegrated, () => {
  const src = clientSrc.slice(clientSrc.indexOf('function newExplorer'), clientSrc.indexOf('function ex()'));
  assert.ok(src.includes('friendCode:genFriendCode()'), 'creation sets friendCode');
  assert.ok(src.includes('friends:[]'), 'creation sets an empty friends list');
  // Run it: a fresh explorer really carries a valid code.
  const fn = eval(clientPrelude() + grab('genFriendCode') + '\n' + grab('friendCodeValid') + '\n' + grab('newExplorer') + '\n;newExplorer');
  const e = fn('Jiyuna', ['🦦', '🐸', '🌸']);
  assert.ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(e.friendCode), 'code format: ' + e.friendCode);
  assert.deepEqual(e.friends, []);
});

test('client: genFriendCode makes 6-char codes from the unambiguous alphabet only', skipIfNotIntegrated, () => {
  const fn = eval(clientPrelude() + grab('genFriendCode') + '\n' + grab('friendCodeValid') + '\n;genFriendCode');
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const c = fn();
    assert.equal(c.length, 6, '6 chars');
    assert.ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(c), 'alphabet only: ' + c);
    assert.ok(!/[ILOl01]/.test(c), 'no ambiguous I/L/O/0/1 in ' + c);
    seen.add(c);
  }
  assert.ok(seen.size > 150, 'codes vary (random)');
});

test('client: ensureFriendCode lazily codes legacy explorers and never replaces a valid one', skipIfNotIntegrated, () => {
  const run = eval(clientPrelude() + grab('genFriendCode') + '\n' + grab('friendCodeValid') + '\n' + grab('ensureFriendCode')
    + '\n;function probe(){ var before=saveLocalCalls; var legacy={id:\'e2\',name:\'Kai\'}; DB.explorers.push(legacy); var c=ensureFriendCode(legacy); var afterFirst=saveLocalCalls; var c2=ensureFriendCode(legacy); return {c:c, c2:c2, saved: afterFirst-before, savedAgain: saveLocalCalls-afterFirst, kept: ex().friendCode}; } probe()');
  assert.ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(run.c), 'legacy explorer gets a code');
  assert.equal(run.c2, run.c, 'second call keeps the same code');
  assert.equal(run.saved, 1, 'persisted once');
  assert.equal(run.savedAgain, 0, 'not re-saved when already valid');
  assert.equal(run.kept, 'ABC2DE', 'the active explorer keeps its own valid code');
  const none = eval(clientPrelude() + grab('genFriendCode') + '\n' + grab('friendCodeValid') + '\n' + grab('ensureFriendCode') + '\n;DB.explorers=[]; ensureFriendCode()');
  assert.equal(none, null, 'no explorer means no code, no crash');
});

test('client: friendBestTimes reads playBest defensively', skipIfNotIntegrated, () => {
  const fn = eval(clientPrelude() + grab('friendBestTimes') + '\n;friendBestTimes');
  assert.deepEqual(fn({}), {}, 'no playBest at all -> empty');
  assert.deepEqual(fn({ playBest: null }), {}, 'null playBest -> empty');
  assert.deepEqual(
    fn({ playBest: { word: { secs: 42 }, number: { secs: 0 }, sort: { secs: -3 }, memory: { secs: 'fast' }, bad: {} } }),
    { word: { secs: 42 } },
    'only sane positive seconds survive',
  );
  // Learn quest times travel as learn-<topicId> keys in the same map.
  assert.deepEqual(
    fn({ playBest: { word: { secs: 42 } }, learnBest: { 'eng-story': { secs: 65 }, 'math-mrt': { secs: 0 }, bad: {} } }),
    { word: { secs: 42 }, 'learn-eng-story': { secs: 65 } },
    'quest times publish under learn- keys, junk dropped',
  );
});

test('client: friends list page shows every friend, my code and the add row', skipIfNotIntegrated, () => {
  const prelude = clientPrelude()
    + 'friendsCache=[{code:\'XYZ789\',name:\'Kai\',stars:30,bestTimes:{word:{secs:50},number:{secs:25}}},{code:\'MNP456\',name:\'Mei\',stars:5,bestTimes:{sort:{secs:44}}}];\n'
    + 'function pageHero(art, emo, title, sub, stat){ return title + " " + (stat || ""); }\n';
  const html = eval(prelude + grab('friendFastest') + '\n' + grab('friendsListHTML') + '\n;friendsListHTML()');
  assert.ok(html.includes('My Friends'), 'friends list heading');
  assert.ok(html.includes('Your friend code: ABC2DE'), 'my own code shown so I can share it');
  assert.ok(html.includes('Kai'), 'approved friend shown');
  assert.ok(html.includes('Mei'), 'server-accepted friend shown');
  assert.ok(html.includes('⭐ 30'), 'stars shown');
  assert.ok(html.includes('Fastest: Number Pop 25s'), 'fastest Play time shown per friend');
  assert.ok(html.includes('id="frCode"') && html.includes('id="frSend"'), 'add-a-friend row on the list page');
  assert.ok(html.includes('id="frErr"'), 'persistent error element on the list page');
  const empty = eval(clientPrelude() + 'friendsCache=[];\n' + 'DB.explorers[0].friends=[];\n' + 'function pageHero(art, emo, title, sub, stat){ return title + " " + (stat || ""); }\n'
    + grab('friendFastest') + '\n' + grab('friendsListHTML') + '\n;friendsListHTML()');
  assert.ok(empty.includes('0 friends'), 'empty list says 0 friends');
  assert.ok(empty.includes('No friends yet'), 'empty list invites the first request');
});

test('client: board renders gracefully when the server is unconfigured', skipIfNotIntegrated, () => {
  const html = eval(clientPrelude() + 'friendsUnconfigured=true;\n' + grab('playBoardHTML') + '\n;playBoardHTML()');
  assert.ok(html.includes('Friends need a quick grown-up setup'), 'setup line, not a crash or raw error');
  assert.ok(html.includes('never your chats or full progress'), 'privacy note still shown');
  // The explorer's own code appears nowhere except the static
  // "e.g. ABC2DE" example in the input placeholder — the board
  // never displays the child's own code.
  assert.equal(html.split('ABC2DE').length - 1, 1, 'own code appears only in the placeholder example');
  assert.ok(html.includes('id="frCode"') && html.includes('id="frSend"'), 'add-a-friend row still offered');
});

test('client: board shows only parent-approved friends, with per-game fastest times', skipIfNotIntegrated, () => {
  const prelude = clientPrelude()
    + 'friendsCache=[{code:\'XYZ789\',name:\'Kai\',stars:30,bestTimes:{word:{secs:50},number:{secs:25}}},{code:\'MNP456\',name:\'Mei\',stars:5,bestTimes:{sort:{secs:44}}}];\n';
  const html = eval(prelude + grab('playBoardHTML') + '\n;playBoardHTML()');
  assert.ok(html.includes('Kai'), 'approved friend shown');
  assert.ok(!html.includes('⭐ 30'), 'no star counts on board rows — the board ranks by time');
  assert.ok(html.includes('Fastest time wins'), 'ranked by time, one board per game');
  // Kai's times land on their own game boards, fastest first.
  assert.ok(html.includes('Number Pop'), 'a board for Number Pop');
  const iNum = html.indexOf('Number Pop');
  const iSort = html.indexOf('Speed Sort');
  const numBoard = iSort >= 0 ? html.slice(iNum, iSort) : html.slice(iNum);
  assert.ok(numBoard.indexOf('Kai') >= 0, 'Kai appears on the Number Pop board');
  assert.ok(numBoard.indexOf('⏱ 25s') >= 0, 'Kai fastest Number Pop time shown');
  assert.ok(html.includes('Speed Sort'), 'a board for Speed Sort');
  assert.ok(html.includes('⏱ 44s'), 'Mei fastest Speed Sort time shown');
  /* The server only returns ACCEPTED friendships, so a friend in
     friendsCache is parent-approved even when this device's local
     list has not recorded them yet (the requester's side, whose
     parent never accepted — the OTHER parent did). They show.
     Only a removed friend stays hidden. */
  assert.ok(html.includes('Mei'), 'server-accepted friend shows even without a local list entry');
  assert.ok(html.includes('Friends see only your stars and fastest times'), 'privacy note present');
  const removed = eval(clientPrelude()
    + 'friendsCache=[{code:\'XYZ789\',name:\'Kai\',stars:30,bestTimes:{}}];\n'
    + 'DB.explorers[0].deletedFriends=[\'XYZ789\'];\n'
    + grab('playBoardHTML') + '\n;playBoardHTML()');
  assert.ok(!removed.includes('Kai'), 'a removed friend is hidden');
  const localOnly = eval(clientPrelude()
    + 'friendsCache=[];\n'
    + grab('playBoardHTML') + '\n;playBoardHTML()');
  assert.ok(localOnly.includes('Friend XYZ789'), 'a locally approved friend shows even before their snapshot arrives');
  // A name with markup is escaped, never injected.
  const evil = eval(clientPrelude()
    + 'friendsCache=[{code:\'XYZ789\',name:\'<script>alert(1)</script>\',stars:1,bestTimes:{}}];\n'
    + grab('playBoardHTML') + '\n;playBoardHTML()');
  assert.ok(!evil.includes('<script>alert'), 'friend name is escaped');
  assert.ok(evil.includes('&lt;script&gt;'), 'escaped form shown');
});

/* --- Accept/display fix (seen live 2026-11-07) ----------------------
   A accepted B's request (toast ok), but after a reload BOTH arcades
   and the Grown-ups list still said "No friends yet" — even though
   the server had recorded the friendship ("already friends" on
   re-send). Two defects: the boards gated on the local friends list
   (the requester's side never gets an entry), and the accept pushed
   to the captured sel, which the 30s auto-pull merge had detached.
   The boards now union the local list with the server's accepted
   list (the server only ever returns accepted friendships), the
   accept/remove resolve the live explorer, and an unknown code
   leaves a persistent error on the page, not just a 2.6s toast. */
test('client: accept resolves the live explorer; boards show server-accepted friends; unknown code errors persist', skipIfNotIntegrated, () => {
  const bindSrc = grab('bindFriendPanelButtons');
  assert.ok(bindSrc.includes('DB.explorers.find(function(x){return x.id===sel.id;})'), 'accept/remove resolve the live explorer, not the captured sel');
  assert.ok(bindSrc.includes('live.friends'), 'accept writes to the live explorer');
  const boardSrc = grab('playBoardHTML');
  assert.ok(boardSrc.includes('friendsCache'), 'arcade board reads the server list, not just the local list');
  assert.ok(boardSrc.indexOf('deletedFriends') >= 0, 'arcade board hides removed friends');
  const parentSrc = grab('renderParentFriends');
  assert.ok(parentSrc.indexOf('deletedFriends') >= 0, 'parent Friends list hides removed friends');
  assert.ok(parentSrc.indexOf('mine.indexOf(f.code)>=0') < 0, 'parent list no longer gates on the local friends list');
  const sendSrc = grab('sendFriendRequest');
  assert.ok(sendSrc.includes("getElementById('frErr')"), 'unknown-code error is written to a persistent page element');
  assert.ok(sendSrc.includes('No explorer has that code'), 'unknown-code message is clear');
  assert.ok(sendSrc.indexOf("showErr('')") >= 0 && sendSrc.indexOf("showErr('')") < sendSrc.indexOf("friendsApi('request'"), 'a new send clears the last attempt\'s error before the request goes out');
  assert.ok(clientSrc.includes('id="frErr"'), 'the error element exists on the friends board');
});

test('client: loadFriends caches snapshots and flags an unreachable server', skipIfNotIntegrated, async () => {
  const origFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ configured: true, friends: [{ code: 'XYZ789', name: 'Kai', stars: 30, bestTimes: {} }] }) });
    const first = eval(clientPrelude() + grab('genFriendCode') + '\n' + grab('friendCodeValid') + '\n' + grab('ensureFriendCode') + '\n' + grab('friendsApi') + '\n' + grab('loadFriends')
      + '\n;(async function(){ await loadFriends(); return {cache: friendsCache, unconfigured: friendsUnconfigured}; })()');
    const got = await first;
    assert.equal(got.unconfigured, false);
    assert.equal(got.cache.length, 1);
    assert.equal(got.cache[0].code, 'XYZ789');

    global.fetch = async () => { throw new Error('offline'); };
    const second = eval(clientPrelude() + grab('genFriendCode') + '\n' + grab('friendCodeValid') + '\n' + grab('ensureFriendCode') + '\n' + grab('friendsApi') + '\n' + grab('loadFriends')
      + '\n;(async function(){ await loadFriends(); return {cache: friendsCache, unconfigured: friendsUnconfigured}; })()');
    const lost = await second;
    assert.equal(lost.cache, null, 'failed load clears the cache');
    assert.equal(lost.unconfigured, true, 'failed load flags unconfigured so the board shows the setup line');
  } finally { global.fetch = origFetch; }
});

test('client: the friends block never mentions the family sync code', skipIfNotIntegrated, () => {
  const start = clientSrc.indexOf('/* ============================================================ FRIENDS');
  const end = clientSrc.indexOf('/* Rounds are generated from a seed.');
  assert.ok(start >= 0 && end > start, 'friends block found');
  const block = clientSrc.slice(start, end);
  assert.ok(!block.includes('syncCode'), 'no family sync code in the friends code');
  assert.ok(block.includes('never your chats or full progress'), 'privacy note in the board');
  assert.ok(block.includes('publishFriendSnapshot'), 'publish helper present');
  assert.ok(block.includes('renderParentFriends'), 'parent panel helper present');
});

test('client: render() ensures a friend code; bindPlay publishes and wires Add-a-friend; parent page has the requests card', skipIfNotIntegrated, () => {
  const renderFn = clientSrc.slice(clientSrc.indexOf('function render(){', 0), clientSrc.indexOf('function render(){') + 200);
  assert.ok(renderFn.includes('ensureFriendCode()'), 'render() calls ensureFriendCode()');
  const bindPlay = grab('bindPlay');
  assert.ok(bindPlay.includes('publishFriendSnapshot()'), 'entering the arcade publishes our snapshot');
  assert.ok(bindPlay.includes("getElementById('frSend')"), 'Add-a-friend button is wired in bindPlay');
  assert.ok(bindPlay.includes('loadFriends()'), 'entering the arcade refreshes friends');
  const parent = clientSrc.slice(clientSrc.indexOf('function parentHTML'), clientSrc.indexOf('function bindParent(){'));
  assert.ok(parent.includes('friendRequestsCardHTML(sel)'), 'parent page renders the Friend requests card');
  assert.ok(parent.includes('ensureFriendCode(sel)'), 'parent page ensures the selected explorer has a code');
  assert.ok(clientSrc.includes('function friendRequestsCardHTML'), 'card helper defined');
  assert.ok(clientSrc.includes('renderParentFriends(sel)'), 'bindParent fills the card');
  const bindParent = clientSrc.slice(clientSrc.indexOf('function bindParent(){'), clientSrc.indexOf('/* ============================================================ BOOT'));
  assert.ok(bindParent.includes('renderParentFriends(sel)'), 'bindParent calls renderParentFriends');
  const card = grab('friendRequestsCardHTML');
  assert.ok(card.includes('friend code'), 'card shows the explorer’s friend code for sharing');
  assert.ok(!card.includes('syncCode'), 'card never shows the family sync code');
});
