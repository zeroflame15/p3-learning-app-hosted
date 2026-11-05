// Ask Pip chats: clear-all must stick, and a new chat must survive sync.
// Root causes fixed here:
//  1. Clear set threads=[] locally, but the next pull-then-upload
//     union-merged the server's old threads straight back in, so the
//     chats reappeared ~800ms later (and on every 30s auto-pull).
//  2. Threads merged by TITLE, so a fresh "New chat 1" collided with
//     an old "New chat 1" on the server and was silently dropped —
//     then Ask did nothing, because the active thread id was gone.
// Fixes: threads merge by id; a threadsClearedAt tombstone drops any
// thread created at or before the clear; Ask guards a missing thread
// and aborts a hung model call after 20s so the canned fallback shows.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function fnBody(marker) {
  const start = html.indexOf(marker);
  assert.ok(start >= 0, marker + ' not found in index.html');
  const next = html.indexOf('\nfunction ', start + marker.length);
  return next >= 0 ? html.slice(start, next) : html.slice(start);
}

// mergeExplorer lives inline in the page; eval it in isolation with
// its small helpers (unionArr, unionObjMax, mergeThreads) for real tests.
function fnText(marker) {
  const b = fnBody(marker);
  return b.endsWith('\n') ? b.slice(0, -1) : b;
}
const mergeExplorer = eval(
  fnText('function unionArr(a,b){') + '\n' +
  fnText('function unionObjMax(a,b){') + '\n' +
  fnText('function unionObjLatest(a,b){') + '\n' +
  fnText('function isThinkingMsg(m){') + '\n' +
  fnText('function mergeThreads(aThreads,bThreads){') + '\n' +
  '(' + fnText('function mergeExplorer(a,b){') + ')'
);

function explorer(threads, clearedAt, deletedIds) {
  return {
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, hclMissed: [], favAnswers: [], progress: {}, playProgress: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads, threadsClearedAt: clearedAt || null, deletedThreadIds: deletedIds || [],
    flashcards: [], planner: [], critterName: 'Pip',
  };
}

test('clear tombstone: server threads older than the clear are dropped', () => {
  const clearedAt = new Date('2026-11-05T18:20:00+08:00').toISOString();
  const server = explorer([{ id: 't1000000000000', title: 'Old chat', msgs: [] }]);
  const local = explorer([], clearedAt);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 0, 'cleared threads must not come back from the server');
  assert.equal(merged.threadsClearedAt, clearedAt, 'tombstone must survive the merge');
});

test('threads created after the clear survive the merge', () => {
  const clearedAt = new Date('2026-11-05T18:20:00+08:00').toISOString();
  const server = explorer([{ id: 't1000000000000', title: 'Old chat', msgs: [] }]);
  const local = explorer([{ id: 't' + (Date.parse(clearedAt) + 60000), title: 'New chat 5', msgs: [] }], clearedAt);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 1, 'only the post-clear thread should remain');
  assert.equal(merged.threads[0].title, 'New chat 5');
});

test('threads merge by id, not title: same title, different ids both kept', () => {
  const server = explorer([{ id: 't1000000000000', title: 'New chat 1', msgs: [] }]);
  const local = explorer([{ id: 't2000000000000', title: 'New chat 1', msgs: [] }]);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 2, 'title collision must not drop the newer chat');
  assert.deepEqual(merged.threads.map((t) => t.id), ['t1000000000000', 't2000000000000']);
});

test('clear handler records the tombstone and keeps threadSeq', () => {
  const b = fnBody('var ct=document.getElementById(\'clearThreads\')');
  assert.ok(b.includes('e.threadsClearedAt=new Date().toISOString()'), 'clear must set the tombstone');
  assert.ok(b.includes('e.deletedThreadIds=unionArr(e.deletedThreadIds||[], e.threads.map('), 'clear must record the exact deleted thread ids');
  assert.ok(!b.includes('e.threadSeq=0'), 'clear must not reset threadSeq (duplicate "New chat N" titles)');
  assert.ok(b.includes('window.confirm('), 'clear must ask for confirmation first');
});

test('deleted thread ids drop wherever they show up, even with no timestamp', () => {
  const server = explorer([{ id: 't1000000000000', title: 'Old chat', msgs: [] }]);
  const local = explorer([], null, ['t1000000000000']);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 0, 'a deleted id must never come back');
  assert.deepEqual(merged.deletedThreadIds, ['t1000000000000']);
});

test('timestamp backstop has a 10s grace: a chat made just before the clear survives', () => {
  const clearedAt = new Date('2026-11-05T18:25:00+08:00').toISOString();
  const justBefore = 't' + (Date.parse(clearedAt) - 5000);
  const server = explorer([{ id: justBefore, title: 'Just made', msgs: [] }]);
  const local = explorer([], clearedAt);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 1, 'a chat made within 10s of the clear (e.g. clock skew between devices) must survive');
  const longBefore = 't' + (Date.parse(clearedAt) - 60000);
  const merged2 = mergeExplorer(explorer([{ id: longBefore, title: 'Old', msgs: [] }]), explorer([], clearedAt));
  assert.equal(merged2.threads.length, 0, 'a chat made well before the clear must still be dropped by the backstop');
});

test('Ask guards a missing active thread instead of crashing silently', () => {
  const b = fnBody('function doSend(){');
  assert.ok(b.includes("if(!th){"), 'doSend must guard a missing thread');
  assert.ok(b.includes('activeThread=null'), 'guard must reset the stale active thread');
});

test('shared thread keeps BOTH sides messages: server greeting-only must not wipe local questions', () => {
  const greet = { who: 'pip', text: 'Hi! What shall we explore?' };
  const q = { who: 'kid', text: 'the life cycle of butterfly' };
  const a = { who: 'pip', text: 'Egg → caterpillar → chrysalis → butterfly.' };
  const server = explorer([{ id: 't1000000000000', title: 'New chat 1', msgs: [greet] }]);
  const local = explorer([{ id: 't1000000000000', title: 'the life cycle of butterfly', msgs: [greet, q, a] }]);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 1);
  assert.deepEqual(merged.threads[0].msgs, [greet, q, a], 'the newer local messages must survive the merge');
  assert.equal(merged.threads[0].title, 'the life cycle of butterfly', 'the real question title must win over the placeholder');
});

test('shared thread: messages from two devices both survive', () => {
  const greet = { who: 'pip', text: 'Hi!' };
  const server = explorer([{ id: 't1000000000000', title: 'Chat', msgs: [greet, { who: 'kid', text: 'What is 7 x 8?' }] }]);
  const local = explorer([{ id: 't1000000000000', title: 'Chat', msgs: [greet, { who: 'kid', text: 'Why can\u2019t Pip hop?' }] }]);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads[0].msgs.length, 3, 'both devices\u2019 questions must be kept');
});

test('askPipLive aborts a hung model call so the fallback can show', () => {
  const b = fnBody('async function askPipLive(');
  assert.ok(b.includes('AbortController'), 'askPipLive must use an AbortController');
  assert.ok(b.includes('20000'), 'askPipLive must time out after 20s');
  assert.ok(b.includes('opts.signal=ctrl.signal'), 'abort signal must reach the fetch');
});
