// Apply the Ask Pip fix (2026-11-08, live-verified failures) ON TOP of
// the already-applied daily game refresh + Ask Pip build (repo 234).
// Run as:
//   node new-games-askpip/apply-fix.js <project-dir>
// (run it on a COPY first, then `npm test` in that copy.)
// Idempotent-safe: refuses cleanly (exit 3) if the fix is already
// applied, and refuses (exit 4) if the base build is not present.
//
// What it fixes:
//  1. Ask Pip from a quest or game question created NO thread: the
//     child landed on an empty Ask Pip home. Root cause: askPipAbout
//     captured `e=ex()` at the top, then persistProgress() /
//     saveGameProgress() saved — and every save() replaces the
//     explorer object in DB (mergeStoredIntoDB) — so the captured
//     `e` was detached by the time the thread was added through it.
//     Fix: re-fetch the explorer after the save steps, right before
//     creating the thread.
//  2. An in-progress game run was LOST across the Ask Pip round trip
//     (Replay restarted at Round 1). Root cause: the playProgress
//     merge took Math.max(idx), so a finished run 1 (idx=6) always
//     beat an unfinished run 2 (idx=1) — the new run's progress was
//     erased on every save. Fix: runs are told apart by seed; the
//     newer run (later `at`, the last saveGameProgress write) wins
//     whole. saveGameProgress now stamps `at` on every record.
//  3. Pip stated the answer first in the warm-up case, despite the
//     hint-first prompt. Fix: the explain prompt in api/ask-pip.js
//     now leads with a hard first-sentence rule and moves the answer
//     into a REFERENCE ONLY block at the end.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node apply-fix.js <project-dir>'); process.exit(2); }
const root = path.resolve(dir);
const pagePath = path.join(root, 'public', 'index.html');
const askPipPath = path.join(root, 'api', 'ask-pip.js');
const oldTestPath = path.join(root, 'tests', 'games-daily-askpip.test.js');
const here = __dirname;

function read(p) { return fs.readFileSync(p, 'utf8'); }
function replaceOnce(src, anchor, replacement, label) {
  const first = src.indexOf(anchor);
  if (first < 0) throw new Error('APPLY-FIX FAILED (' + label + '): anchor not found:\n' + anchor.slice(0, 160));
  if (src.indexOf(anchor, first + anchor.length) >= 0) throw new Error('APPLY-FIX FAILED (' + label + '): anchor is not unique:\n' + anchor.slice(0, 160));
  return src.slice(0, first) + replacement + src.slice(first + anchor.length);
}

let page = read(pagePath);
if (!page.includes('askPipAbout') || !page.includes('pickGameKeys')) {
  console.error('APPLY-FIX REFUSED: the base build (daily game refresh / Ask Pip from a question) is not applied to ' + pagePath + ' — run apply.js first.');
  process.exit(4);
}
if (page.includes('e=ex(); if(!e)return;\n  var th=newAskQuestionThread(ctx);') || (page.match(/at:Date\.now\(\)/g) || []).length >= 5) {
  console.error('APPLY-FIX REFUSED: this fix looks already applied to ' + pagePath);
  process.exit(3);
}
if (!fs.existsSync(askPipPath)) throw new Error('api/ask-pip.js not found at ' + askPipPath);
if (!fs.existsSync(oldTestPath)) throw new Error('tests/games-daily-askpip.test.js not found at ' + oldTestPath);

/* ---------- 1. askPipAbout: re-fetch the explorer before creating the thread ---------- */
page = replaceOnce(page,
  '  var th=newAskQuestionThread(ctx);\n  e.threads.unshift(th); activeThread=th.id;',
  '  /* Re-fetch the explorer: persistProgress()/saveGameProgress() saved\n     above, and every save() replaces the explorer object in DB\n     (mergeStoredIntoDB) — the `e` captured at the top is detached\n     by now, and a thread added through it is silently lost (seen\n     live 2026-11-08: Ask Pip from a quest or game question created\n     no thread, and the child landed on an empty Ask Pip home). */\n  e=ex(); if(!e)return;\n  var th=newAskQuestionThread(ctx);\n  e.threads.unshift(th); activeThread=th.id;',
  'askPipAbout re-fetch');

/* ---------- 2. saveGameProgress: stamp `at` on every record ---------- */
page = replaceOnce(page,
  'open:gState.open.slice(), elapsed:elapsed}',
  'open:gState.open.slice(), elapsed:elapsed, at:Date.now()}',
  'saveGameProgress memory at');
page = replaceOnce(page,
  'starDay:gState.starDay||null, cars:gState.cars.map(function(c){ return {id:c.id,e:c.e,o:c.o,x:c.x,y:c.y,len:c.len,bg:c.bg}; })};',
  'starDay:gState.starDay||null, cars:gState.cars.map(function(c){ return {id:c.id,e:c.e,o:c.o,x:c.x,y:c.y,len:c.len,bg:c.bg}; }), at:Date.now()};',
  'saveGameProgress parking at');
page = replaceOnce(page,
  'letters:Object.assign({},gState.letters||{})}',
  'letters:Object.assign({},gState.letters||{}), at:Date.now()}',
  'saveGameProgress crossword at');
page = replaceOnce(page,
  "sent:gState.sent||'', keys:(gState.keys?gState.keys.slice():[])}",
  "sent:gState.sent||'', keys:(gState.keys?gState.keys.slice():[]), at:Date.now()}",
  'saveGameProgress sentence at');
page = replaceOnce(page,
  'picked:(gState.picked!=null?gState.picked:null), keys:(gState.keys?gState.keys.slice():[])}',
  'picked:(gState.picked!=null?gState.picked:null), keys:(gState.keys?gState.keys.slice():[]), at:Date.now()}',
  'saveGameProgress generic at');

/* ---------- 3. playProgress merge: a newer run wins whole ---------- */
/* The merge itself stays ONE line: tests/games-custom.test.js finds
   the line containing the playProgress merge and checks it still
   carries cars/filled/open/gridId/built/sent/v/starTotal/starBanked/
   starDay. The explanation lives in the comment above it. */
page = replaceOnce(page,
  'Object.keys(b.playProgress||{}).forEach(function(k){ var x=play[k], y=b.playProgress[k]; play[k]=(!x?y:{',
  '  /* A new run resets idx to 0: the old max-idx merge resurrected the finished run and lost an unfinished second run (seen live 2026-11-08: Word Garden run 2 was lost; Replay restarted at Round 1). Runs are told apart by seed; the newer run (later at, the last saveGameProgress write) wins whole. Same seed — one run on two devices — or no seed keeps the field-by-field merge below. */\n  Object.keys(b.playProgress||{}).forEach(function(k){ var x=play[k], y=b.playProgress[k]; if(!x){ play[k]=y; return; } if(x.seed!=null&&y.seed!=null&&x.seed!==y.seed){ play[k]=((y.at||0)>=(x.at||0))?JSON.parse(JSON.stringify(y)):JSON.parse(JSON.stringify(x)); return; } play[k]={',
  'playProgress merge run-identity');
page = replaceOnce(page,
  'combo:(x.combo||y.combo)}); });',
  'combo:(x.combo||y.combo),at:Math.max(x.at||0,y.at||0)}; });',
  'playProgress merge carries at');

/* ---------- 4. api/ask-pip.js: strengthen the explain prompt ---------- */
let askPip = read(askPipPath);
if (askPip.includes('FIRST sentence must be a hint')) {
  console.error('APPLY-FIX REFUSED: the explain-prompt fix looks already applied to ' + askPipPath);
  process.exit(3);
}
askPip = replaceOnce(askPip,
  "Give a hint, not the answer first — guide the child to find it themself. The correct answer is ${explainAnswer} — this is for your reference only, so you never guide them wrong. Do NOT say the answer first. Only say it if the child finds it, or if they ask you directly for it. ${explainClue ? 'The question comes with this clue you may use: ' + explainClue + '.' : ''} Keep it under 90 words, simple language, encouraging. ${factLine}",
  "RULE — read this first: your FIRST sentence must be a hint or a guiding question. NEVER start your reply with the answer, and never open with \"The answer is ...\" — the child must find it themself, with your help. Explain what the question is asking, the idea behind it, and how to work it out, step by step, with a hint. ${explainClue ? 'The question comes with this clue you may use: ' + explainClue + '.' : ''} Keep it under 90 words, simple language, encouraging. ${factLine} REFERENCE ONLY — the correct answer is ${explainAnswer}. This is for you only, so you never guide the child wrong. NEVER write it in your reply. Only say it if the child finds it first, or asks you directly for it.",
  'explain prompt hint-first');
fs.writeFileSync(askPipPath, askPip);

/* ---------- 5. Update the old explain-prompt assertion to the new wording ---------- */
let oldTest = read(oldTestPath);
oldTest = replaceOnce(oldTest,
  "    assert.match(sys, /Do NOT say the answer first/i, 'the prompt forbids blurting the answer first');",
  "    assert.match(sys, /FIRST sentence must be a hint/i, 'the prompt leads with the hint-first rule');\n    assert.match(sys, /REFERENCE ONLY/i, 'the answer lives in a reference-only block');\n    assert.ok(sys.indexOf('FIRST sentence') < sys.indexOf('REFERENCE ONLY'), 'the hint-first rule comes before the answer reference');",
  'old explain-prompt assertion');
fs.writeFileSync(oldTestPath, oldTest);

/* ---------- 6. Add the new fix test file ---------- */
const fixTestSrc = path.join(here, 'tests-askpip-fix.test.js');
if (!fs.existsSync(fixTestSrc)) throw new Error('tests-askpip-fix.test.js not found in ' + here);
fs.writeFileSync(path.join(root, 'tests', 'askpip-fix.test.js'), read(fixTestSrc));

/* ---------- 7. tests/revamp-a.test.js pins the exact memory save shape ----------
   The `at` stamp on the memory record (step 2) is deliberate merge
   metadata, not game state — the pin still forbids any pairs/level
   field, it just now expects the `at` timestamp too. */
const revampTestPath = path.join(root, 'tests', 'revamp-a.test.js');
let revampTest = read(revampTestPath);
revampTest = replaceOnce(revampTest,
  'e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, combo:gState.memCombo||null, open:gState.open.slice(), elapsed:elapsed}',
  'e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, combo:gState.memCombo||null, open:gState.open.slice(), elapsed:elapsed, at:Date.now()}',
  'revamp-a memory-shape pin');
fs.writeFileSync(revampTestPath, revampTest);

fs.writeFileSync(pagePath, page);
console.log('APPLY-FIX DONE: askPipAbout re-fetch, saveGameProgress at stamps, playProgress merge run-identity, explain prompt, old test assertion + revamp-a memory-shape pin updated, tests/askpip-fix.test.js added.');
