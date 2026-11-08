// Apply the Ask Pip per-chat delete + unbookmark diff to a copy of
// the learning-app project. Usage:
//   node new-askpip-delete/apply.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-askpip-delete/askpip-delete-diff.md.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const NEW_TEST_SRC = path.join(__dirname, 'tests-askpip-delete.test.js');
const NEW_TEST_DST = path.join(root, 'tests', 'askpip-delete.test.js');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

let page = fs.readFileSync(PAGE, 'utf8');

// A — thread list: each row gets its own delete button.
page = replaceOnce(page,
  `e.threads.map(function(t){ return '<button class="threadrow" data-thread="'+t.id+'"><span>💬 '+esc(t.title)+'</span><span class="small muted">'+t.msgs.length+' messages</span></button>'; }).join('')`,
  `e.threads.map(function(t){ return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><button class="threadrow" style="flex:1;margin-bottom:0" data-thread="'+t.id+'"><span>💬 '+esc(t.title)+'</span><span class="small muted">'+t.msgs.length+' messages</span></button><button class="btn ghost" style="padding:8px 12px;flex:none" data-delthread="'+t.id+'" title="Delete this chat">🗑</button></div>'; }).join('')`,
  'thread list rows');

// B — Golden Bookmark list: each saved answer gets a remove button.
page = replaceOnce(page,
  `e.favAnswers.map(function(f){return '<div class="feedback ok" style="font-weight:700">'+esc(f)+'</div>';}).join('')`,
  `e.favAnswers.map(function(f,fi){return '<div class="feedback ok" style="font-weight:700;display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><span>'+esc(f)+'</span><button class="btn ghost" style="padding:4px 10px;flex:none" data-unfav="'+fi+'" title="Remove from Golden Bookmark">✕</button></div>';}).join('')`,
  'bookmark list rows');

// C — Save button shows its state: ✓ Saved when already saved.
page = replaceOnce(page,
  `(e.treasures.indexOf('bookmark')>=0?' <button class="btn ghost" style="padding:5px 12px;font-size:.8rem;margin-top:6px" data-fav="'+mi+'">🔖 Save</button>':'')`,
  `(e.treasures.indexOf('bookmark')>=0?' <button class="btn ghost" style="padding:5px 12px;font-size:.8rem;margin-top:6px" data-fav="'+mi+'">'+(e.favAnswers.indexOf(m.text)>=0?'✓ Saved':'🔖 Save')+'</button>':'')`,
  'save button label');

// D — fav handler becomes a toggle (save / un-save).
page = replaceOnce(page,
  `document.querySelectorAll('[data-fav]').forEach(function(b){ b.onclick=function(){ var th=e.threads.find(function(t){return t.id===activeThread;}); var txt=th.msgs[parseInt(b.getAttribute('data-fav'),10)].text; if(e.favAnswers.indexOf(txt)<0)e.favAnswers.push(txt); save(); toast('Saved to your Golden Bookmark! 🔖'); }; });`,
  `document.querySelectorAll('[data-fav]').forEach(function(b){ b.onclick=function(){ var th=e.threads.find(function(t){return t.id===activeThread;}); var txt=th.msgs[parseInt(b.getAttribute('data-fav'),10)].text; var ix=e.favAnswers.indexOf(txt); if(ix>=0){ e.favAnswers.splice(ix,1); e.deletedFavAnswers=unionArr(e.deletedFavAnswers||[],[txt]); save(); render(); toast('Removed from your Golden Bookmark'); } else { e.favAnswers.push(txt); save(); render(); toast('Saved to your Golden Bookmark! 🔖'); } }; });`,
  'fav toggle handler');

// E — new handlers: delete one chat, remove one saved answer.
page = replaceOnce(page,
  `document.querySelectorAll('[data-thread]').forEach(function(b){ b.onclick=function(){ activeThread=b.getAttribute('data-thread'); render(); }; });`,
  `document.querySelectorAll('[data-thread]').forEach(function(b){ b.onclick=function(){ activeThread=b.getAttribute('data-thread'); render(); }; });
  /* Delete ONE chat (2026-11-08, Bryan): the list used to offer only
     "Clear all chats". A per-chat bin uses the same deletedThreadIds
     tombstone as clear-all, so the deleted chat can never come back
     from another device's copy on the next sync. */
  document.querySelectorAll('[data-delthread]').forEach(function(b){ b.onclick=function(){ var id=b.getAttribute('data-delthread'); var th=e.threads.find(function(t){return t.id===id;}); if(!window.confirm('Delete this chat with Pip? “'+(th?th.title:'')+'” will be deleted on all linked devices. Your saved Golden Bookmark answers stay.'))return; e.deletedThreadIds=unionArr(e.deletedThreadIds||[],[id]); e.threads=e.threads.filter(function(t){ return t.id!==id; }); if(activeThread===id)activeThread=null; save(); render(); toast('Chat deleted 🗑'); }; });
  /* Unbookmark one saved answer (2026-11-08, Bryan): the Golden
     Bookmark list had no way to remove an answer. The text goes on
     deletedFavAnswers so the merge can never resurrect it. */
  document.querySelectorAll('[data-unfav]').forEach(function(b){ b.onclick=function(){ var fi=parseInt(b.getAttribute('data-unfav'),10); var txt=e.favAnswers[fi]; if(txt==null)return; e.favAnswers.splice(fi,1); e.deletedFavAnswers=unionArr(e.deletedFavAnswers||[],[txt]); save(); render(); toast('Removed from your Golden Bookmark'); }; });`,
  'delthread + unfav handlers');

// F — merge: a removed bookmark must stay removed.
page = replaceOnce(page,
  `  e.favAnswers=unionArr(a.favAnswers,b.favAnswers);`,
  `  e.favAnswers=unionArr(a.favAnswers,b.favAnswers);
  /* A removed bookmark must stay removed: without a tombstone the
     union above would resurrect it from any other device's copy
     on the next sync — the same trap clear-all had with threads. */
  e.deletedFavAnswers=unionArr(a.deletedFavAnswers||[],b.deletedFavAnswers||[]);
  if(e.deletedFavAnswers.length)e.favAnswers=e.favAnswers.filter(function(f){ return e.deletedFavAnswers.indexOf(f)<0; });`,
  'merge deletedFavAnswers');

// G — new-explorer defaults carry the tombstone list.
page = replaceOnce(page,
  `lastTopic:null, favAnswers:[], swapIdx:0,`,
  `lastTopic:null, favAnswers:[], deletedFavAnswers:[], swapIdx:0,`,
  'explorer defaults deletedFavAnswers');

fs.writeFileSync(PAGE, page);
fs.copyFileSync(NEW_TEST_SRC, NEW_TEST_DST);
console.log('applied askpip-delete to ' + root);
