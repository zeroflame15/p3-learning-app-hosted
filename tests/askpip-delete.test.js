// Ask Pip: delete ONE chat (not just clear-all) and unbookmark a saved
// Golden Bookmark answer. The gaps:
//  1. The chat list only offered "Clear all chats" — no per-chat delete.
//  2. The Golden Bookmark list rendered saved answers as plain text
//     with no remove control, and favAnswers only ever grew (merge is
//     a union), so a saved answer could never be removed at all.
// Fixes: per-chat bin button using the deletedThreadIds tombstone
// (same as clear-all); an ✕ per saved answer plus a toggle on the
// 🔖 Save button, both recording the text in a new deletedFavAnswers
// tombstone that the merge unions and filters out of favAnswers — so
// neither a deleted chat nor a removed bookmark can ever come back
// from another device's copy on the next sync.
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
  fnText('function pickCritterName(a,b){') + '\n' +
  fnText('function mergeCare(a,b){') + '\n' +
  '(' + fnText('function mergeExplorer(a,b){') + ')'
);

function explorer(threads, clearedAt, deletedIds, favs, deletedFavs) {
  return {
    stars: 0, critterStage: 0, badges: [], treasures: [], discoveredCritters: [],
    completed: {}, hclMissed: [], favAnswers: favs || [], deletedFavAnswers: deletedFavs || [],
    progress: {}, playProgress: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {},
    threads, threadsClearedAt: clearedAt || null, deletedThreadIds: deletedIds || [],
    flashcards: [], planner: [], critterName: 'Pip',
  };
}

test('delete one chat: the deleted id drops from the merge and never comes back', () => {
  const t1 = { id: 't1000000000000', title: 'Frogs', msgs: [] };
  const t2 = { id: 't2000000000000', title: 'Fractions', msgs: [] };
  const server = explorer([t1, t2]);
  const local = explorer([t2], null, ['t1000000000000']);
  const merged = mergeExplorer(server, local);
  assert.equal(merged.threads.length, 1, 'only the surviving chat should remain');
  assert.equal(merged.threads[0].id, 't2000000000000');
  assert.deepEqual(merged.deletedThreadIds, ['t1000000000000']);
});

test('unbookmark: a removed saved answer does not come back from the server', () => {
  const server = explorer([], null, [], ['Frogs are amphibians.', '7 x 8 = 56.']);
  const local = explorer([], null, [], ['7 x 8 = 56.'], ['Frogs are amphibians.']);
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.favAnswers, ['7 x 8 = 56.'], 'the removed bookmark must stay removed');
  assert.deepEqual(merged.deletedFavAnswers, ['Frogs are amphibians.']);
});

test('favAnswers still union when nothing was removed', () => {
  const server = explorer([], null, [], ['Frogs are amphibians.']);
  const local = explorer([], null, [], ['7 x 8 = 56.']);
  const merged = mergeExplorer(server, local);
  assert.deepEqual(merged.favAnswers.sort(), ['7 x 8 = 56.', 'Frogs are amphibians.']);
});

test('thread row carries a per-chat delete button', () => {
  const b = fnBody('function askHTML(){');
  assert.ok(b.includes('data-delthread'), 'each chat row must have a delete button');
  assert.ok(b.includes('Delete this chat'), 'the delete button must say what it does');
});

test('delete handler confirms first and records the tombstone', () => {
  const b = fnBody("document.querySelectorAll('[data-delthread]')");
  assert.ok(b.includes('window.confirm('), 'deleting a chat must ask for confirmation first');
  assert.ok(b.includes('e.deletedThreadIds=unionArr(e.deletedThreadIds||[],[id])'), 'delete must record the id in deletedThreadIds');
  assert.ok(b.includes('if(activeThread===id)activeThread=null'), 'deleting the open chat must drop back to the list');
  assert.ok(b.includes("toast('Chat deleted"), 'delete must confirm with a toast');
});

test('bookmark list carries a remove button per saved answer', () => {
  const b = fnBody('function askHTML(){');
  assert.ok(b.includes('data-unfav'), 'each saved answer must have a remove button');
  assert.ok(b.includes('Remove from Golden Bookmark'), 'the remove button must say what it does');
});

test('unfav handler removes the answer and records it as deleted', () => {
  const b = fnBody("document.querySelectorAll('[data-unfav]')");
  assert.ok(b.includes('e.favAnswers.splice(fi,1)'), 'unfav must remove the answer from favAnswers');
  assert.ok(b.includes('e.deletedFavAnswers=unionArr(e.deletedFavAnswers||[],[txt])'), 'unfav must record the text in deletedFavAnswers');
});

test('Save button toggles: already-saved answer shows Saved and removes on tap', () => {
  const ask = fnBody('function askHTML(){');
  assert.ok(ask.includes('✓ Saved'), 'an already-saved answer must show Saved, not Save');
  assert.ok(ask.includes('e.favAnswers.indexOf(m.text)>=0'), 'the label must check whether this answer is saved');
  const fav = fnBody("document.querySelectorAll('[data-fav]')");
  assert.ok(fav.includes('e.favAnswers.splice(ix,1)'), 'tapping Save on a saved answer must remove it');
  assert.ok(fav.includes('e.deletedFavAnswers=unionArr(e.deletedFavAnswers||[],[txt])'), 'the toggle-off must record the tombstone too');
  assert.ok(fav.includes('render()'), 'the toggle must re-render so the button label updates');
});
