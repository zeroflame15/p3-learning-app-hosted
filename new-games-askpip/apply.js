// Apply the daily game refresh + Ask Pip from a question build
// (2026-11-08), plus the scrollable-sidebar fix, to a copy of the
// learning-app project. Idempotent-safe: refuses cleanly if the
// build is already applied. Run as:
//   node new-games-askpip/apply.js <project-dir>
// (run it on a COPY first, then `npm test` in that copy.)
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node apply.js <project-dir>'); process.exit(2); }
const root = path.resolve(dir);
const pagePath = path.join(root, 'public', 'index.html');
const rulesPath = path.join(root, 'lib', 'rules.js');
const askPipPath = path.join(root, 'api', 'ask-pip.js');
const here = __dirname;

function read(p) { return fs.readFileSync(p, 'utf8'); }
function replaceOnce(src, anchor, replacement, label) {
  const first = src.indexOf(anchor);
  if (first < 0) throw new Error('APPLY FAILED (' + label + '): anchor not found:\n' + anchor.slice(0, 160));
  if (src.indexOf(anchor, first + anchor.length) >= 0) throw new Error('APPLY FAILED (' + label + '): anchor is not unique:\n' + anchor.slice(0, 160));
  return src.slice(0, first) + replacement + src.slice(first + anchor.length);
}

let page = read(pagePath);
if (page.includes('pickGameKeys') || page.includes('askPipAbout') || page.includes('height:100vh;overflow-y:auto;z-index:30')) {
  console.error('APPLY REFUSED: this build (daily game refresh / Ask Pip from a question / scrollable sidebar) looks already applied to ' + pagePath);
  process.exit(3);
}
if (!fs.existsSync(rulesPath)) throw new Error('lib/rules.js not found at ' + rulesPath);
if (!fs.existsSync(askPipPath)) throw new Error('api/ask-pip.js not found at ' + askPipPath);

/* ---------- 1. The new code block (daily refresh + Ask Pip) ---------- */
const newCode = read(path.join(here, 'new-code.js')).trim();
page = replaceOnce(page,
  '/* ---------- Live-generated questions — EXPERIMENT, one topic only ----------',
  newCode + '\n\n/* ---------- Live-generated questions — EXPERIMENT, one topic only ----------',
  'insert new-code.js block');

/* ---------- 2. Sidebar: independently scrollable ---------- */
page = replaceOnce(page,
  '.sidebar{width:228px;flex:0 0 228px;background:var(--nav);color:var(--nav-ink);display:flex;flex-direction:column;padding:18px 14px;position:sticky;top:0;height:100vh;z-index:30}',
  '.sidebar{width:228px;flex:0 0 228px;background:var(--nav);color:var(--nav-ink);display:flex;flex-direction:column;padding:18px 14px;position:sticky;top:0;height:100vh;overflow-y:auto;z-index:30}',
  'sidebar overflow-y:auto');

/* ---------- 3. Sync: carry playSeen across devices ---------- */
/* Seen-questions merge (2026-11-08), inlined here rather than a
   mergePlaySeen() call, so the standalone mergeExplorer test
   harnesses keep working. Same rule as lib/rules.js mergePlaySeen:
   the later day wins whole; the same day unions keys. */
page = replaceOnce(page,
  '  e.playDaily=pd;',
  '  e.playDaily=pd;\n  (function(){ var ps={}, k; Object.keys(a.playSeen||{}).forEach(function(k){ var r=a.playSeen[k]||{}; ps[k]={day:r.day||\'\', keys:(r.keys||[]).slice()}; }); Object.keys(b.playSeen||{}).forEach(function(k){ var x=ps[k], y=b.playSeen[k]||{}; if(!x){ ps[k]={day:y.day||\'\', keys:(y.keys||[]).slice()}; return; } if((y.day||\'\')>(x.day||\'\')){ ps[k]={day:y.day||\'\', keys:(y.keys||[]).slice()}; } else if((y.day||\'\')===(x.day||\'\')){ (y.keys||[]).forEach(function(key){ if(ps[k].keys.indexOf(key)<0)ps[k].keys.push(key); }); if(ps[k].keys.length>1000)ps[k].keys=ps[k].keys.slice(-1000); } }); e.playSeen=ps; })();',
  'mergeExplorer playSeen (inlined)');
page = replaceOnce(page,
  'sent:((x.idx||0)>(y.idx||0)?(x.sent||y.sent):(y.sent||x.sent))}); });',
  'sent:((x.idx||0)>(y.idx||0)?(x.sent||y.sent):(y.sent||x.sent)),keys:((x.idx||0)>(y.idx||0)?(x.keys||y.keys):(y.keys||x.keys)),combo:(x.combo||y.combo)}); });',
  'playProgress merge keys+combo');
page = replaceOnce(page,
  'playProgress:{}, playFresh:{}, playDoneDay:{}, playDaily:{}, critterName:',
  'playProgress:{}, playFresh:{}, playDoneDay:{}, playDaily:{}, playSeen:{}, critterName:',
  'newExplorer playSeen default');

/* ---------- 4. go(): leaving Ask Pip by the nav abandons the return ---------- */
page = replaceOnce(page,
  'function go(r){ var _prevRoute=route; route=r;',
  "function go(r){ if(r!=='ask')askReturn=null; var _prevRoute=route; route=r;",
  'go() clears askReturn');

/* ---------- 5. genRound + sentFor: honour a picked question ---------- */
page = replaceOnce(page,
  'function genRound(gameId, idx, seed, tier){',
  'function genRound(gameId, idx, seed, tier, pick){',
  'genRound pick param');
page = replaceOnce(page,
  "    if(!seed)return pool[idx%pool.length];\n    var order=seededShuffle(pool.map(function(_,i){return i;}), hashStr('word|'+seed));\n    return optsShuffled(pool[order[idx%order.length]], hashStr('wo|'+seed+'|'+idx));",
  "    if(pick!=null){ var pi=-1; pool.forEach(function(qq,qi){ if(qq.q===pick)pi=qi; }); if(pi>=0)return optsShuffled(pool[pi], hashStr('wo|'+seed+'|'+idx)); }\n    if(!seed)return pool[idx%pool.length];\n    var order=seededShuffle(pool.map(function(_,i){return i;}), hashStr('word|'+seed));\n    return optsShuffled(pool[order[idx%order.length]], hashStr('wo|'+seed+'|'+idx));",
  'genRound word pick');
page = replaceOnce(page,
  "    if(!seed){ var s0=pool[idx%pool.length]; return {q:s0.q, o:s0.items, a:3, c:s0.why, j:''}; }\n    var sord=seededShuffle(pool.map(function(_,i){return i;}), hashStr('so|'+seed+'|'+tier));",
  "    if(pick!=null){ var si=-1; pool.forEach(function(ss,qi){ if(ss.q===pick)si=qi; }); if(si>=0){ var sp=pool[si]; return optsShuffled({q:sp.q, o:sp.items, a:3, c:sp.why, j:''}, hashStr('so2|'+seed+'|'+idx)); } }\n    if(!seed){ var s0=pool[idx%pool.length]; return {q:s0.q, o:s0.items, a:3, c:s0.why, j:''}; }\n    var sord=seededShuffle(pool.map(function(_,i){return i;}), hashStr('so|'+seed+'|'+tier));",
  'genRound sort pick');
page = replaceOnce(page,
  "    var worder=seededShuffle(wpool.map(function(_,i){return i;}), hashStr('scw|'+seed+'|'+band+'|'+tier));\n    var entry=wpool[worder[idx%wpool.length]];",
  "    var worder=seededShuffle(wpool.map(function(_,i){return i;}), hashStr('scw|'+seed+'|'+band+'|'+tier));\n    var entry=wpool[worder[idx%wpool.length]];\n    if(pick!=null){ var pe=null; SCR_WORDS.forEach(function(w){ if(w.w===pick)pe=w; }); if(pe)entry=pe; }",
  'genRound scramble pick');
/* The number branch keeps its own local RANGES (the standalone
   genRound test harnesses eval it without the new block, so it must
   not depend on NUM_RANGES). gamePoolFor carries the same ranges as
   NUM_RANGES; the test asserts the two stay identical. */
page = replaceOnce(page,
  "  var hs=hashStr('num|'+seed+'|'+idx);\n  if(!seed){ a=rg[0]+((idx*7)%(rg[1]-rg[0]+1)); b=rg[2]+((idx*5)%(rg[3]-rg[2]+1)); }\n  else { a=rg[0]+(hs%(rg[1]-rg[0]+1)); b=rg[2]+((Math.floor(hs/32))%(rg[3]-rg[2]+1)); }",
  "  var hs=hashStr('num|'+seed+'|'+idx);\n  var pm=(pick!=null?String(pick).match(/^(\\d+) × (\\d+) = \\?$/):null);\n  if(pm){ a=+pm[1]; b=+pm[2]; }\n  else if(!seed){ a=rg[0]+((idx*7)%(rg[1]-rg[0]+1)); b=rg[2]+((idx*5)%(rg[3]-rg[2]+1)); }\n  else { a=rg[0]+(hs%(rg[1]-rg[0]+1)); b=rg[2]+((Math.floor(hs/32))%(rg[3]-rg[2]+1)); }",
  'genRound number pick');
page = replaceOnce(page,
  "function sentFor(seed, idx, tier){ var pool=sentPool(tier); var order=seededShuffle(pool.map(function(_,i){return i;}), hashStr('sb|'+seed)); return pool[order[idx%pool.length]]; }",
  "function sentFor(seed, idx, tier, pick){ var pool=sentPool(tier); if(pick!=null){ var pi=-1; pool.forEach(function(s,qi){ if(sentKey(s)===pick)pi=qi; }); if(pi>=0)return pool[pi]; } var order=seededShuffle(pool.map(function(_,i){return i;}), hashStr('sb|'+seed)); return pool[order[idx%pool.length]]; }",
  'sentFor pick param');

/* ---------- 6. askPipLive: mode + explain to the server ---------- */
page = replaceOnce(page,
  'async function askPipLive(text, history, name){',
  'async function askPipLive(text, history, name, opts){',
  'askPipLive opts param');
page = replaceOnce(page,
  "body:JSON.stringify({question:text,history:history||[],name:name||'',fixFlag:false,skillId:sk?sk.id:'',flags:(DB.flags||[]).slice(0,10)})}",
  "body:JSON.stringify({question:text,history:history||[],name:name||'',fixFlag:false,skillId:sk?sk.id:'',flags:(DB.flags||[]).slice(0,10),mode:(opts&&opts.mode)||'',explain:(opts&&opts.explain)||null})}",
  'askPipLive mode+explain body');

/* ---------- 7. startGame: daily-refresh seed selection ---------- */
page = replaceOnce(page,
  "  var seed;\n  if(p&&!doneP){ seed=p.seed||0; /* unfinished game: keep its rounds exactly as they were */ }\n  else if(doneP){ seed=hashStr('play|'+id+'|'+todayKey()+'|'+e.id+'|'+Date.now()); /* replay: a fresh seed every time, so replays are never the same 6 rounds */ }\n  else { var rec=e.playFresh[id]; if(!rec||rec.day!==todayKey()){ rec={day:todayKey(), seed:hashStr('play|'+id+'|'+todayKey()+'|'+e.id)}; e.playFresh[id]=rec; save(); } seed=rec.seed; }",
  "  /* Daily refresh (2026-11-08): a fresh run draws a set that avoids\n     every question this explorer already saw today (e.playSeen);\n     a replay is a fresh set too, never yesterday's and never the\n     run just played. An unfinished game keeps its rounds exactly\n     as they were — resume must never be re-rolled. The hasDaily\n     guard keeps the old seed selection as a fallback: the standalone\n     startGame test harnesses eval it without the new helpers, and\n     they must keep working. On the real page the helpers are always\n     defined, so the new path always runs. */\n  var seed, runKeys=null, runCombo=null;\n  var day=todayKey();\n  var hasDaily=(typeof pickGameKeys==='function'&&typeof playSeenToday==='function'&&typeof recordPlaySeen==='function'&&typeof gameRunKeys==='function'&&typeof pickRaceSeed==='function'&&typeof memoryComboFor==='function'&&typeof memComboFromKey==='function');\n  if(p&&!doneP){ seed=p.seed||0; /* unfinished game: keep its rounds exactly as they were */ if(hasDaily){ runKeys=(p.keys&&p.keys.length)?p.keys.slice():gameRunKeys(id, seed, (typeof levelTier==='function'?levelTier(e):'mid'), gDef.rounds); if(id==='memory'&&p.combo)runCombo=p.combo.key||null; if(runKeys&&runKeys.length)recordPlaySeen(e, id, day, runKeys); } }\n  else if(hasDaily){\n    var seenToday=playSeenToday(e, id, day);\n    var salt='play|'+id+'|'+day+'|'+e.id;\n    var tierNow=(typeof levelTier==='function'?levelTier(e):'mid');\n    if(id==='race'){ var rp=pickRaceSeed(tierNow, gDef.rounds, seenToday, salt); seed=rp.seed; runKeys=rp.keys; }\n    else if(id==='memory'){ var mp=pickGameKeys('memory', tierNow, 1, seenToday, salt); runCombo=mp[0]||null; seed=hashStr(salt+'|'+(runCombo||'mem')); runKeys=runCombo?[runCombo]:[]; }\n    else if(id==='crossword'||id==='parking'){ seed=hashStr(salt+'|run'); runKeys=[]; }\n    else { runKeys=pickGameKeys(id, tierNow, gDef.rounds, seenToday, salt); seed=hashStr(salt+'|run|'+(runKeys[0]||'')); }\n    if(runKeys&&runKeys.length)recordPlaySeen(e, id, day, runKeys);\n    save();\n  }\n  else if(doneP){ seed=hashStr('play|'+id+'|'+todayKey()+'|'+e.id+'|'+Date.now()); /* replay: a fresh seed every time, so replays are never the same 6 rounds */ }\n  else { var rec=e.playFresh[id]; if(!rec||rec.day!==todayKey()){ rec={day:todayKey(), seed:hashStr('play|'+id+'|'+todayKey()+'|'+e.id)}; e.playFresh[id]=rec; save(); } seed=rec.seed; }",
  'startGame daily-refresh seed selection');

/* ---------- 8. startGame: memory uses the picked combo, seeded deck ---------- */
/* (Three short anchors — the MEMDECKS emoji line is left untouched.) */
page = replaceOnce(page,
  'var memPairs=[4,6,8][(((seed||0)%3)+3)%3]; var memTheme=MEMDECKS[Math.floor((seed||0)/3)%4];',
  'var memCombo; if(runCombo&&typeof memComboFromKey===\'function\')memCombo=memComboFromKey(runCombo); else if(p&&p.combo)memCombo=p.combo; else if(typeof memoryComboFor===\'function\')memCombo=memoryComboFor(seed); else memCombo={pairs:[4,6,8][(((seed||0)%3)+3)%3], themeIdx:Math.floor((seed||0)/3)%4}; var memTheme=MEMDECKS[memCombo.themeIdx];',
  'startGame memory picked combo');
page = replaceOnce(page,
  'memTheme.slice(0,memPairs).forEach',
  'memTheme.slice(0,memCombo.pairs).forEach',
  'startGame memory combo pairs');
page = replaceOnce(page,
  'deck:shuffle(memCards), open:(p&&p.open?p.open.slice():[]), matched:(p?p.matched:[]), lock:false, moves:(p?p.moves:0), won:false}; }',
  'deck:((typeof seededShuffle===\'function\')?seededShuffle(memCards, seed):shuffle(memCards)), open:(p&&p.open?p.open.slice():[]), matched:(p?p.matched:[]), lock:false, moves:(p?p.moves:0), won:false, memCombo:memCombo}; }',
  'startGame memory seeded deck + memCombo');

/* ---------- 9. startGame: store the run's keys; scramble/sentence inits use the pick ---------- */
page = replaceOnce(page,
  '  gState.seed=seed;',
  '  gState.seed=seed;\n  gState.keys=runKeys;',
  'gState.keys assignment');
page = replaceOnce(page,
  "    var rq=genRound('scramble', gState.idx, gState.seed, gState.tier);",
  "    var rq=genRound('scramble', gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx]);",
  'startGame scramble init pick');
page = replaceOnce(page,
  '    var ss=sentFor(gState.seed, gState.idx, gState.tier);',
  '    var ss=sentFor(gState.seed, gState.idx, gState.tier, (gState.keys||[])[gState.idx]);',
  'startGame sentence init pick');

/* ---------- 10. saveGameProgress: store keys + memory combo ---------- */
page = replaceOnce(page,
  'e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, open:gState.open.slice(), elapsed:elapsed}',
  'e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, combo:gState.memCombo||null, open:gState.open.slice(), elapsed:elapsed}',
  'saveGameProgress memory combo');
page = replaceOnce(page,
  "sent:gState.sent||''}; else e.playProgress[gState.id]={idx:gState.idx, score:gState.score, seed:gState.seed, elapsed:elapsed, answered:!!gState.answered, picked:(gState.picked!=null?gState.picked:null)};",
  "sent:gState.sent||'', keys:(gState.keys?gState.keys.slice():[])}; else e.playProgress[gState.id]={idx:gState.idx, score:gState.score, seed:gState.seed, elapsed:elapsed, answered:!!gState.answered, picked:(gState.picked!=null?gState.picked:null), keys:(gState.keys?gState.keys.slice():[])};",
  'saveGameProgress keys (sentence + generic)');

/* ---------- 11. Ask Pip buttons in the question screens ---------- */
page = replaceOnce(page,
  "   +'<div id=\"wuFb\">'+",
  "   +'<div style=\"margin-top:10px\"><button class=\"btn ghost\" id=\"wuAskPip\">🦦 Ask Pip about this question</button></div>'\n   +'<div id=\"wuFb\">'+",
  'warmupHTML Ask Pip button');
page = replaceOnce(page,
  "   +'<div id=\"qFb\">'+fb+'</div>'",
  "   +'<div style=\"margin-top:10px\"><button class=\"btn ghost\" id=\"qAskPip\">🦦 Ask Pip about this question</button></div>'\n   +'<div id=\"qFb\">'+fb+'</div>'",
  'quizHTML Ask Pip button');
page = replaceOnce(page,
  '   + gameOptsHTML(q)\n',
  "   + gameOptsHTML(q)\n   +'<div style=\"margin-top:10px\"><button class=\"btn ghost\" id=\"gAskPip\">🦦 Ask Pip about this question</button></div>'\n",
  'gameHTML generic Ask Pip button');
page = replaceOnce(page,
  "     +fb\n     +'<button class=\"btn ghost\" id=\"gQuit\" style=\"margin-top:8px\">Save &amp; quit — resume later</button></div>';",
  "     +fb\n     +'<div style=\"margin-top:10px\"><button class=\"btn ghost\" id=\"gAskPip\">🦦 Ask Pip about this question</button></div>'\n     +'<button class=\"btn ghost\" id=\"gQuit\" style=\"margin-top:8px\">Save &amp; quit — resume later</button></div>';",
  'gameHTML sentence Ask Pip button');
page = replaceOnce(page,
  "     +'<p class=\"small muted\" style=\"font-weight:700;margin:8px 0 0\">Type with your keyboard — green means it fits! ✔ A correct word turns green and its hint greys out.</p>'\n     +'<button class=\"btn ghost\" id=\"gBack\" style=\"margin-top:8px\">Back to Play 🎮</button><button class=\"btn ghost\" id=\"gQuit\" style=\"margin-top:8px\">Save &amp; quit — resume later</button></div>';",
  "     +'<p class=\"small muted\" style=\"font-weight:700;margin:8px 0 0\">Type with your keyboard — green means it fits! ✔ A correct word turns green and its hint greys out.</p>'\n     +'<div style=\"margin-top:10px\"><button class=\"btn ghost\" id=\"gAskPip\">🦦 Ask Pip about this question</button></div>'\n     +'<button class=\"btn ghost\" id=\"gBack\" style=\"margin-top:8px\">Back to Play 🎮</button><button class=\"btn ghost\" id=\"gQuit\" style=\"margin-top:8px\">Save &amp; quit — resume later</button></div>';",
  'gameHTML crossword Ask Pip button');

/* ---------- 12. gameHTML + bindGame: pass the pick through ---------- */
page = replaceOnce(page,
  "  var q=genRound(gState.id, gState.idx, gState.seed, gState.tier);\n  /* Word Garden:",
  "  var q=genRound(gState.id, gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx]);\n  /* Word Garden:",
  'gameHTML generic genRound pick');
page = replaceOnce(page,
  "    var s=gState.sbSent||sentFor(gState.seed, gState.idx, gState.tier);\n    var bank=gState.sentBank||sentBank(s, gState.seed, gState.idx);\n    var locked=sentLocked(gState.built, bank);",
  "    var s=gState.sbSent||sentFor(gState.seed, gState.idx, gState.tier, (gState.keys||[])[gState.idx]);\n    var bank=gState.sentBank||sentBank(s, gState.seed, gState.idx);\n    var locked=sentLocked(gState.built, bank);",
  'gameHTML sentence sentFor pick');
page = replaceOnce(page,
  "    var s=gState.sbSent||sentFor(gState.seed, gState.idx, gState.tier);\n    var bank=gState.sentBank||sentBank(s, gState.seed, gState.idx);\n    /* Scoring a finished sentence:",
  "    var s=gState.sbSent||sentFor(gState.seed, gState.idx, gState.tier, (gState.keys||[])[gState.idx]);\n    var bank=gState.sentBank||sentBank(s, gState.seed, gState.idx);\n    /* Ask Pip about this sentence: Pip explains it in a new thread,\n       and the answer-only clock pauses while the child is away. */\n    var gaSen=document.getElementById('gAskPip'); if(gaSen)gaSen.onclick=function(){ askPipAbout({src:'game', gameId:'sentence', label:'Sentence Builder', question:'Put these words in the right order: '+bank.map(function(wi){ return s.w[wi]; }).join(', ')+'.', answer:s.w.join(' ')+(s.p||'.'), clue:s.c}); };\n    /* Scoring a finished sentence:",
  'bindGame sentence sentFor pick + Ask Pip wiring');
page = replaceOnce(page,
  '      var ns=sentFor(gState.seed, gState.idx, gState.tier);',
  '      var ns=sentFor(gState.seed, gState.idx, gState.tier, (gState.keys||[])[gState.idx]);',
  'bindGame sentence Next sentFor pick');
page = replaceOnce(page,
  "    var sq=genRound('scramble', gState.idx, gState.seed, gState.tier);",
  "    var sq=genRound('scramble', gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx]);\n    /* Ask Pip about this scramble: Pip explains the word in a new thread,\n       and the answer-only clock pauses while the child is away. */\n    var gaScr=document.getElementById('gAskPip'); if(gaScr)gaScr.onclick=function(){ askPipAbout({src:'game', gameId:'scramble', label:'Word Scramble', question:'Unscramble these letters to make a word: '+sq.scr.split('').join(' ')+'. Hint: '+sq.c, answer:sq.word, clue:sq.c}); };",
  'bindGame scramble genRound pick + Ask Pip wiring');
page = replaceOnce(page,
  "        var nq=genRound('scramble', gState.idx, gState.seed, gState.tier);",
  "        var nq=genRound('scramble', gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx]);",
  'bindGame scramble Next genRound pick');
page = replaceOnce(page,
  "  var q=genRound(gState.id, gState.idx, gState.seed, gState.tier);\n  document.querySelectorAll('[data-gopt]')",
  "  var q=genRound(gState.id, gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx]);\n  /* Ask Pip about this question: Pip explains it in a new thread,\n     and the answer-only clock pauses while the child is away. */\n  var ga=document.getElementById('gAskPip'); if(ga)ga.onclick=function(){ askPipAbout({src:'game', gameId:gState.id, label:(GAMES.find(function(x){return x.id===gState.id;})||{}).name||gState.id, question:q.q, options:q.o.slice(), answer:q.o[q.a], clue:q.c||''}); };\n  document.querySelectorAll('[data-gopt]')",
  'bindGame generic genRound pick + Ask Pip wiring');

/* ---------- 13. bindGame: Number Pop escape arming becomes armNumberEscape ---------- */
page = replaceOnce(page,
  "  if(gState.id==='number'&&!gState.answered){\n    var escSecs=Math.max(4,((gState.tier==='low')?12:((gState.tier==='high')?8:10))-gState.idx);\n    var escId=setTimeout(function(){\n      if(!gState||gState.id!=='number'||gState.answered||gState.escapeTimer!==escId)return;\n      gState.escapeTimer=null; gState.picked=null; gState.answered=true; gState.streak=0; sndWrong(); pausePlayTimer(); saveGameProgress(); render();\n    }, escSecs*1000);\n    gState.escapeTimer=escId;\n  }",
  "  if(gState.id==='number'&&!gState.answered){\n    armNumberEscape(Math.max(4,((gState.tier==='low')?12:((gState.tier==='high')?8:10))-gState.idx));\n  }",
  'bindGame escape arming via armNumberEscape');

/* ---------- 14. bindGame: crossword Ask Pip wiring ---------- */
page = replaceOnce(page,
  "    var input=document.getElementById('xwInput');\n    var checkBtn=document.getElementById('xwCheck');",
  "    var input=document.getElementById('xwInput');\n    var checkBtn=document.getElementById('xwCheck');\n    /* Ask Pip about the selected crossword clue: Pip explains it in\n       a new thread, and the answer-only clock pauses while away. */\n    var gaXw=document.getElementById('gAskPip'); if(gaXw)gaXw.onclick=function(){ var wd=XWORDS[gState.sel]; askPipAbout({src:'game', gameId:'crossword', label:'Crossword Quest', question:'Crossword clue '+wd.num+' '+wd.dir+': '+wd.clue+' ('+wd.w.length+' letters)', answer:wd.w, clue:''}); };",
  'bindGame crossword Ask Pip wiring');

/* ---------- 15. bindWarmup / bindQuiz: Ask Pip wiring ---------- */
page = replaceOnce(page,
  "  var sk=document.getElementById('wuSkip'); if(sk)sk.onclick=function(){ if(warm.timer)clearInterval(warm.timer); beginQuest(warm.topicId); };",
  "  var sk=document.getElementById('wuSkip'); if(sk)sk.onclick=function(){ if(warm.timer)clearInterval(warm.timer); beginQuest(warm.topicId); };\n  /* Ask Pip about this warm-up question: Pip explains it in a new\n     thread, and the 60s countdown pauses while the child is away. */\n  var wa=document.getElementById('wuAskPip'); if(wa)wa.onclick=function(){ var wq=bankFor(topicById(warm.topicId),'warm',levelNum(ex()))[warm.order[warm.idx]]; askPipAbout({src:'warmup', topicId:warm.topicId, label:topicById(warm.topicId).name, question:wq.q, options:wq.o.slice(), answer:wq.o[wq.a], clue:wq.c||''}); };",
  'bindWarmup Ask Pip wiring');
page = replaceOnce(page,
  "speakPip(m?m[0]:q.q); toast('Listen… now say it out loud like Pip!'); };",
  "speakPip(m?m[0]:q.q); toast('Listen… now say it out loud like Pip!'); };\n  /* Ask Pip about this quest question: Pip explains it in a new\n     thread, and the answer-only clock pauses while the child is away. */\n  var qa=document.getElementById('qAskPip'); if(qa)qa.onclick=function(){ askPipAbout({src:'quest', topicId:cur.topicId, label:t.name, question:q.q, options:q.o.slice(), answer:q.o[q.a], clue:q.c||''}); };",
  'bindQuiz Ask Pip wiring');

/* ---------- 16. askHTML: Back to my question button; bindAsk wires it ---------- */
page = replaceOnce(page,
  "  return '<button class=\"btn ghost\" id=\"askBack\">← All chats</button>'",
  "  return '<button class=\"btn ghost\" id=\"askBack\">← All chats</button>'\n   +(askReturn&&askReturn.threadId===th.id?'<button class=\"btn\" id=\"askReturnBtn\" style=\"margin-top:8px;margin-left:8px\">← Back to my question</button>':'')",
  'askHTML return button');
page = replaceOnce(page,
  "  var back=document.getElementById('askBack'); if(back)back.onclick=function(){ activeThread=null; render(); };",
  "  var back=document.getElementById('askBack'); if(back)back.onclick=function(){ activeThread=null; render(); };\n  var rb=document.getElementById('askReturnBtn'); if(rb)rb.onclick=function(){ returnFromAskPip(); };",
  'bindAsk return button wiring');

fs.writeFileSync(pagePath, page);

/* ---------- 17. lib/rules.js: pickDailyGameKeys + mergePlaySeen ---------- */
let rules = read(rulesPath);
if (rules.includes('pickDailyGameKeys') || rules.includes('mergePlaySeen')) {
  console.error('APPLY REFUSED: lib/rules.js already carries pickDailyGameKeys / mergePlaySeen');
  process.exit(3);
}
rules = replaceOnce(rules,
  'module.exports = {',
  "// Daily game refresh (2026-11-08): every game draws a fresh set\n// each day, and a question never repeats within the same day.\n// From a pool, pick `count` keys: unseen first (seeded shuffle),\n// then seen only when the pool is exhausted. Deterministic per\n// seedStr, so a test can prove it. The page carries the same rule\n// (pickGameKeys) — change both.\nfunction pickDailyGameKeys(pool, seen, count, seedStr) {\n  const all = (pool || []).slice();\n  if (all.length === 0) return [];\n  const take = Math.min(count, all.length);\n  const seenSet = new Set(seen || []);\n  const unseen = shuffleWith(all.filter((k) => !seenSet.has(k)), (seedStr || '') + '|unseen');\n  const used = shuffleWith(all.filter((k) => seenSet.has(k)), (seedStr || '') + '|seen');\n  return unseen.concat(used).slice(0, take);\n}\n// Seen-questions store, merged across devices: the later day wins\n// whole; the same day unions keys. Mirrored in the page\n// (mergePlaySeen) — change both.\nfunction mergePlaySeen(a, b) {\n  const out = {};\n  for (const k of Object.keys(a || {})) { const r = a[k] || {}; out[k] = { day: r.day || '', keys: (r.keys || []).slice() }; }\n  for (const k of Object.keys(b || {})) {\n    const x = out[k], y = b[k] || {};\n    if (!x) { out[k] = { day: y.day || '', keys: (y.keys || []).slice() }; continue; }\n    if ((y.day || '') > (x.day || '')) out[k] = { day: y.day || '', keys: (y.keys || []).slice() };\n    else if ((y.day || '') === (x.day || '')) { for (const key of (y.keys || [])) if (!out[k].keys.includes(key)) out[k].keys.push(key); if (out[k].keys.length > 1000) out[k].keys = out[k].keys.slice(-1000); }\n  }\n  return out;\n}\n\nmodule.exports = {",
  'lib/rules.js daily refresh rules');
rules = replaceOnce(rules,
  '  canUnlock, starsAfterUnlock, hashStr, dailyFreshIndices, dailyWarmIndices, retryIndices, prevDate,',
  '  canUnlock, starsAfterUnlock, hashStr, dailyFreshIndices, dailyWarmIndices, retryIndices, prevDate,\n  pickDailyGameKeys, mergePlaySeen,',
  'lib/rules.js exports');
fs.writeFileSync(rulesPath, rules);

/* ---------- 18. api/ask-pip.js: explain mode ---------- */
let askPip = read(askPipPath);
if (askPip.includes("mode === 'explain'")) {
  console.error('APPLY REFUSED: api/ask-pip.js already carries explain mode');
  process.exit(3);
}
const explainPatch = read(path.join(here, 'ask-pip-patch.txt')).replace(/\n$/, '');
askPip = replaceOnce(askPip, '  const system = fixFlag', explainPatch, 'api/ask-pip.js explain mode');
fs.writeFileSync(askPipPath, askPip);

/* ---------- 19. Tests ---------- */
const testSrc = read(path.join(here, 'tests-games-daily-askpip.test.js'));
const testDest = path.join(root, 'tests', 'games-daily-askpip.test.js');
if (fs.existsSync(testDest)) throw new Error('tests/games-daily-askpip.test.js already exists — refusing to overwrite');
fs.writeFileSync(testDest, testSrc);

/* ---------- 20. Existing tests that assert the old source text ----------
   Three tests pin the exact old text this build deliberately moves:
   - revamp-b-scramble: the scramble init now passes the run's pick.
   - revamp-a: the memory save now carries the picked combo (not a
     pairs/level field), and the Number Pop escape timeout now lives
     in armNumberEscape (so the Ask Pip return path can re-arm it).
   - answer-timer: the escape pause now lives in armNumberEscape too.
   Each patch keeps the test's intent and only moves its anchor. */
function patchTest(rel, anchor, replacement, label) {
  const p = path.join(root, 'tests', rel);
  let t = read(p);
  t = replaceOnce(t, anchor, replacement, label);
  fs.writeFileSync(p, t);
}
patchTest('revamp-b-scramble.test.js',
  'const scrAt = startSrc.indexOf("genRound(\'scramble\', gState.idx, gState.seed, gState.tier)");',
  'const scrAt = startSrc.indexOf("genRound(\'scramble\', gState.idx, gState.seed, gState.tier, (gState.keys||[])[gState.idx])");',
  'revamp-b-scramble scramble init pick');
patchTest('revamp-a.test.js',
  "  assert.ok(saveSrc.includes('e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, open:gState.open.slice(), elapsed:elapsed}'),\n    'the memory save still carries exactly the old fields — no pairs/level field was added');",
  "  assert.ok(saveSrc.includes('e.playProgress.memory={matched:gState.matched, moves:gState.moves, won:gState.won, seed:gState.seed, deck:gState.deck, combo:gState.memCombo||null, open:gState.open.slice(), elapsed:elapsed}'),\n    'the memory save carries the picked combo (so a resume rebuilds the exact board) — still no pairs/level field');",
  'revamp-a memory save combo');
patchTest('revamp-a.test.js',
  "  assert.ok(mergeSrc.includes('deck:x.deck||y.deck'), 'the merge still carries the deck');",
  "  assert.ok(mergeSrc.includes('deck:x.deck||y.deck'), 'the merge still carries the deck');\n  assert.ok(mergeSrc.includes('combo:'), 'the merge still carries the memory combo');",
  'revamp-a memory merge combo');
patchTest('revamp-a.test.js',
  "  assert.ok(bindSrc.includes('gState.escapeTimer!==escId'), 'a stale timer can never mark the wrong round');\n  assert.ok(bindSrc.includes('gState.picked=null; gState.answered=true; gState.streak=0; sndWrong();'),\n    'an escaped round counts as a miss with no pick, streak reset, answer revealed');",
  "  assert.ok(bindSrc.includes(\"armNumberEscape(\"), 'bindGame arms the escape through armNumberEscape');\n  const armSrc = fnText('function armNumberEscape(');\n  assert.ok(armSrc.includes('gState.escapeTimer!==escId'), 'a stale timer can never mark the wrong round');\n  assert.ok(armSrc.includes('gState.picked=null; gState.answered=true; gState.streak=0; sndWrong();'),\n    'an escaped round counts as a miss with no pick, streak reset, answer revealed');",
  'revamp-a escape wiring via armNumberEscape');
patchTest('answer-timer.test.js',
  "  const bindSrc = fnText('function bindGame(){');\n  const pauses = (bindSrc.match(/pausePlayTimer\\(\\); saveGameProgress\\(\\); render\\(\\);/g) || []).length;",
  "  const bindSrc = fnText('function bindGame(){');\n  const armSrc = fnText('function armNumberEscape(');\n  const pauses = ((bindSrc.match(/pausePlayTimer\\(\\); saveGameProgress\\(\\); render\\(\\);/g) || []).length) + ((armSrc.match(/pausePlayTimer\\(\\); saveGameProgress\\(\\); render\\(\\);/g) || []).length);",
  'answer-timer pauses across bindGame + armNumberEscape');
patchTest('answer-timer.test.js',
  "  const pauseCalls = (bindSrc.match(/pausePlayTimer\\(\\)/g) || []).length;",
  "  const pauseCalls = ((bindSrc.match(/pausePlayTimer\\(\\)/g) || []).length) + ((armSrc.match(/pausePlayTimer\\(\\)/g) || []).length);",
  'answer-timer pauseCalls across bindGame + armNumberEscape');

console.log('APPLY OK — daily game refresh + Ask Pip from a question + scrollable sidebar');
console.log('  patched: public/index.html, lib/rules.js, api/ask-pip.js');
console.log('  added:   tests/games-daily-askpip.test.js');
console.log('Next: cd <project-copy> && npm test');
