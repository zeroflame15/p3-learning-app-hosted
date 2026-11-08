/* ---------- Daily game refresh + Ask Pip from a question (2026-11-08) ----------
   Feature 1 — every game pulls a FRESH set each day, with no repeated
   question inside the same day. How it works, per game:
     * Word Garden / Speed Sort / Word Scramble / Sentence Builder /
       Number Pop: each round is PICKED (not seeded) from that round's
       pool, unseen first. e.playSeen[gameId] = {day, keys:[...]}
       records every question the explorer has seen today; a run
       takes the first pick in the day's seeded shuffle that is
       neither seen today nor already picked this run. A small bank
       degrades gracefully — a round whose pool is exhausted reuses
       that round's first pick for the day, never the same question
       twice in one day while the bank still has unseen ones.
     * Maths Race: rounds are generated from a seed, not picked from
       a bank, so the seed is SEARCHED (pickRaceSeed): the first of
       24 candidate seeds whose 6 questions are all unseen today
       (and distinct within the run) wins; a nearly-exhausted bank
       takes the least-colliding seed.
     * Memory Match: the 12 combos (3 pair-counts x 4 themes) are
       picked the same unseen-first way; the deck is built from the
       picked combo with a seeded shuffle (no more Math.random).
     * Crossword Quest: the grid already rotates daily (xwGridOfDay)
       — one grid per day, family-wide — so nothing changes; a
       same-day replay replays today's grid.
     * Exit Parking: 18 fixed levels in order, each played once —
       no repeats are possible, so nothing changes.
   Feature 2 — Ask Pip from a question: see askPipAbout() below. The
   child opens a NEW Ask Pip thread with the question, Pip explains
   it there (hint first, never the answer first), and "Back to my
   question" returns them to the exact question with the answer-only
   timer paused while they were away.
   The rules that must match lib/rules.js live there too
   (pickDailyGameKeys / mergePlaySeen) — change both. */

/* Number Pop's (a,b) ranges, hoisted out of genRound (same values)
   so the daily picker can enumerate a round's pool. */
var NUM_RANGES={low:[[2,3,2,5],[4,5,2,9],[2,5,2,9]],mid:[[2,5,2,9],[6,9,2,9],[12,59,2,9]],high:[[6,9,2,9],[12,59,2,9],[12,99,3,9]]};

/* Memory Match combos: 3 pair-counts x 4 themes = 12 boards.
   Pure arithmetic on the seed, so a run's combo is reproducible. */
function memoryComboFor(seed){ var pairs=[4,6,8][(((seed||0)%3)+3)%3]; var themeIdx=Math.floor((seed||0)/3)%4; return {pairs:pairs, themeIdx:themeIdx, key:'mem|'+themeIdx+'|'+pairs}; }
function memComboFromKey(key){ var p=String(key||'').split('|'); return {themeIdx:+p[1]||0, pairs:+p[2]||4, key:key}; }

/* A round's pool: the pick-strings one round of a game may draw from.
   Returns null for games with no pickable pool (race is seed-searched,
   crossword's grid rotates by day already, parking's levels are fixed).
   A "pick" is the question's identity: the question text for word /
   sort / number / race, the word for scramble, the sentence text for
   sentence, the combo key for memory. */
function gamePoolFor(gameId, idx, tier){
  tier=tier||'mid';
  if(gameId==='word'){ var pool=[]; [0,1,2,3].forEach(function(ti){ var t=TOPICS[ti]; if(t)pool=pool.concat(t.quest||[],t.fresh||[]); }); return pool.map(function(q){ return q.q; }); }
  if(gameId==='sort'){ var maxT=sortTierMax(tier); return SORT_SETS.filter(function(s){ return s.t<=maxT; }).map(function(s){ return s.q; }); }
  if(gameId==='scramble'){ var band=scrBandFor(idx, tier); return SCR_WORDS.filter(function(w){ return w.b===band; }).map(function(w){ return w.w; }); }
  if(gameId==='sentence'){ return sentPool(tier).map(function(s){ return sentKey(s); }); }
  if(gameId==='number'){ var rg=(NUM_RANGES[tier]||NUM_RANGES.mid)[idx<2?0:(idx<4?1:2)]; var out=[]; for(var a=rg[0];a<=rg[1];a++){ for(var b=rg[2];b<=rg[3];b++){ out.push(a+' × '+b+' = ?'); } } return out; }
  if(gameId==='memory'){ var combos=[]; for(var th=0;th<4;th++){ [4,6,8].forEach(function(p){ combos.push('mem|'+th+'|'+p); }); } return combos; }
  return null;
}

/* Pick one round's content per round, unseen first: for each round,
   shuffle that round's pool with the day's seed and take the first
   pick that is neither seen today nor already picked this run. When
   a round's pool is exhausted (every pick seen), reuse the day's
   first pick for that round that this run has not shown yet — a
   small bank still plays, and a run never shows the same question
   twice. Deterministic: the same (game, day, salt, seen) always
   gives the same run. */
function pickGameKeys(gameId, tier, rounds, seenKeys, salt){
  var seen={}; (seenKeys||[]).forEach(function(k){ seen[k]=1; });
  var taken={}, picked=[];
  for(var i=0;i<rounds;i++){
    var pool=gamePoolFor(gameId, i, tier);
    if(!pool||!pool.length){ picked.push(null); continue; }
    var order=seededShuffle(pool, hashStr(salt+'|round'+i));
    var choice=null;
    for(var j=0;j<order.length;j++){ if(!seen[order[j]]&&!taken[order[j]]){ choice=order[j]; break; } }
    if(choice==null){ for(var k=0;k<order.length;k++){ if(!taken[order[k]]){ choice=order[k]; break; } } }
    if(choice==null)choice=order[0];
    picked.push(choice); taken[choice]=1;
  }
  return picked;
}

/* The questions one run asks, as pick-strings, for a given seed —
   used to record what a run showed (and to score candidate seeds
   for Maths Race). For the pick-based games the run's keys ARE the
   picks; for race the seed decides them; for memory it is the combo. */
function gameRunKeys(gameId, seed, tier, rounds){
  rounds=rounds||6; tier=tier||'mid';
  if(gameId==='sentence'){ var out=[]; for(var i=0;i<rounds;i++){ out.push(sentKey(sentFor(seed,i,tier))); } return out; }
  if(gameId==='memory'){ return [memoryComboFor(seed).key]; }
  if(gameId==='crossword'||gameId==='parking')return [];
  var keys=[];
  for(var i=0;i<rounds;i++){
    var q=genRound(gameId,i,seed,tier);
    if(gameId==='scramble')keys.push(q.word||q.q);
    else keys.push(q.q);
  }
  return keys;
}

/* Maths Race is the one game whose rounds are not picked from a
   bank — they are generated from a seed, and the generation logic
   (add/sub/mul/missing-number kinds) is too tangled to enumerate
   as a pool. So race keeps a seed, but the seed is searched: try
   candidate seeds and keep the first whose questions are all
   unseen today (and distinct within the run). The sum-space is
   large, so a clean seed is found in a try or two; when the bank
   is exhausted the least-colliding seed wins. */
function pickRaceSeed(tier, rounds, seenKeys, salt){
  var seen={}; (seenKeys||[]).forEach(function(k){ seen[k]=1; });
  var best=null, bestScore=1e9;
  for(var k=0;k<24;k++){
    var seed=hashStr(salt+'|try'+k);
    var keys=gameRunKeys('race', seed, tier, rounds);
    var score=0, inRun={};
    keys.forEach(function(key){ if(seen[key])score++; if(inRun[key])score++; inRun[key]=1; });
    if(score===0)return {seed:seed, keys:keys};
    if(score<bestScore){ bestScore=score; best={seed:seed, keys:keys}; }
  }
  return best;
}

/* Seen-questions store: e.playSeen[gameId] = {day, keys:[...]}.
   Record a run's keys (union, today only); read today's keys.
   The merge of two playSeen records lives in mergeExplorer (inlined
   there, so the standalone mergeExplorer test harnesses keep working)
   and in lib/rules.js (mergePlaySeen) — same rule, change both. */
function playSeenToday(e, gameId, day){
  var rec=(e&&e.playSeen&&e.playSeen[gameId])||null;
  if(!rec||rec.day!==day)return [];
  return (rec.keys||[]).slice();
}
function recordPlaySeen(e, gameId, day, keys){
  if(!e.playSeen)e.playSeen={};
  var rec=e.playSeen[gameId];
  if(!rec||rec.day!==day)rec=e.playSeen[gameId]={day:day, keys:[]};
  (keys||[]).forEach(function(k){ if(k!=null&&rec.keys.indexOf(k)<0)rec.keys.push(k); });
  if(rec.keys.length>1000)rec.keys=rec.keys.slice(-1000);
  return rec.keys;
}

/* Number Pop's balloon-escape countdown, armed as a named function
   so the Ask Pip return path can re-arm it with the banked seconds.
   Sets gState.escapeDeadline too (the banked remaining time). */
function armNumberEscape(secs){
  if(!gState||gState.id!=='number'||gState.answered)return;
  if(gState.escapeTimer){ clearTimeout(gState.escapeTimer); gState.escapeTimer=null; }
  var s=secs||10;
  var escId=setTimeout(function(){
    if(!gState||gState.id!=='number'||gState.answered||gState.escapeTimer!==escId)return;
    gState.escapeTimer=null; gState.escapeDeadline=null; gState.picked=null; gState.answered=true; gState.streak=0; sndWrong(); pausePlayTimer(); saveGameProgress(); render();
  }, s*1000);
  gState.escapeTimer=escId;
  gState.escapeDeadline=Date.now()+s*1000;
}

/* ---------- Ask Pip from a question (2026-11-08) ---------- */
/* Where the child came from when they opened Ask Pip from a
   question, so the "Back to my question" button can take them
   back to the exact question. Session-only, never saved. */
var askReturn=null;
/* Paused countdowns banked while the child is with Pip (race
   seconds left, Number Pop escape seconds left). Session-only. */
var askPipPause=null;
function bankSecsLeft(deadline, now){ if(!deadline)return 0; return Math.max(0, Math.ceil((deadline-(now||Date.now()))/1000)); }

/* The thread title carries the topic/game and the question, so the
   child and the parent can find it again in the chat list. */
function askThreadTitle(ctx){
  var label=(ctx&&ctx.label)||'';
  var q=(ctx&&ctx.question)||'';
  var t='❓ '+(label?label+': ':'')+q;
  return t.length>48?t.slice(0,48)+'…':t;
}
function askKidText(ctx){
  var q=(ctx&&ctx.question)||'';
  var opts=(ctx&&ctx.options&&ctx.options.length)?' The choices are: '+ctx.options.join(', ')+'.':'';
  return 'Pip, can you help me with this question? “'+q+'”'+opts;
}
/* Build a new Ask Pip thread for one question. Pure (no DOM):
   the caller pauses timers, saves, and navigates. */
function newAskQuestionThread(ctx){
  var kid=askKidText(ctx);
  var th={id:'t'+Date.now(), title:askThreadTitle(ctx), msgs:[{who:'kid', text:kid}], qctx:{src:(ctx&&ctx.src)||'', label:(ctx&&ctx.label)||'', q:(ctx&&ctx.question)||''}};
  return th;
}
/* Offline fallback for a question explanation: guide with the
   question's own clue and Pip's skill method — never the bare
   answer. Used when the live call fails, so the child still gets
   help and the question is never lost. */
function pipExplainFallback(ctx){
  var q=(ctx&&ctx.question)||'this question';
  var parts=['Let’s think about this one together! 🦦'];
  parts.push('The question is: “'+q+'”');
  if(ctx&&ctx.options&&ctx.options.length)parts.push('Your choices are: '+ctx.options.join(', ')+'.');
  if(ctx&&ctx.clue)parts.push('Here is a clue: '+ctx.clue);
  var sk=skillForQuestionClient(q);
  if(sk)parts.push('Pip’s method: '+sk.method);
  parts.push('Try the first step, then tell me what you get — I am right here!');
  return parts.join(' ');
}
/* Send one question-explanation to Pip in a thread. Mirrors
   doSend's pipeline: live call, "Pip is thinking…" is UI-only,
   offline fallback, and the reply lands in the thread it was
   asked in even if the child switched chats. Skips pipHelp on
   purpose — this is a curriculum question, not an app-help one. */
function pipExplainSend(th, ctx){
  var kidText=th.msgs.length?th.msgs[th.msgs.length-1].text:askKidText(ctx);
  var hist=th.msgs.slice(-8).map(function(m){ return {role:m.who, text:m.text}; });
  var eNow=ex(); if(!eNow)return;
  asking[th.id]=kidText;
  save(); render();
  var log=document.getElementById('chatlog'); if(log)log.scrollTop=log.scrollHeight;
  askPipLive(kidText, hist, eNow.name, {mode:'explain', explain:{topic:(ctx&&ctx.label)||'', answer:(ctx&&ctx.answer)||'', clue:(ctx&&ctx.clue)||''}}).then(function(live){
    delete asking[th.id];
    var eLive=ex(); var th2=eLive?eLive.threads.find(function(t){ return t.id===th.id; }):null;
    if(!th2){ save(); render(); return; }
    if(live){ th2.msgs.push({who:'pip', text:live.reply, skill:live.skillName||'', skillId:live.skillId||'', agent:live.agentName||'', agentId:live.agentId||'', signature:live.signature||'', hintFirst:!!live.hintFirst, live:true}); }
    else { var sk2=skillForQuestionClient(kidText); th2.msgs.push({who:'pip', text:pipExplainFallback(ctx), skill:sk2?sk2.name:'', skillId:sk2?sk2.id:'', live:false}); }
    save(); render();
    var log2=document.getElementById('chatlog'); if(log2)log2.scrollTop=log2.scrollHeight;
  }).catch(function(){
    try{
      delete asking[th.id];
      var eLive2=ex(); var th3=eLive2?eLive2.threads.find(function(t){ return t.id===th.id; }):null;
      if(th3){ th3.msgs.push({who:'pip', text:pipExplainFallback(ctx), live:false}); }
      save(); render();
    }catch(e2){}
  });
}
/* Open Ask Pip about the question on screen. Pauses the
   answer-only timer (and any countdown) FIRST — Pip time is not
   answering time — saves the banked time, opens a NEW thread with
   the question, and goes to Ask Pip. The child returns with
   "Back to my question" (returnFromAskPip). */
function askPipAbout(ctx){
  var e=ex(); if(!e)return;
  var src=(ctx&&ctx.src)||'';
  askPipPause=null;
  if(src==='warmup'){
    if(typeof warm!=='undefined'&&warm&&warm.timer){ clearInterval(warm.timer); warm.timer=null; }
  } else if(src==='quest'){
    pauseLearnTimer();
    if(typeof cur!=='undefined'&&cur&&cur.phase==='quest')persistProgress(); else save();
  } else if(src==='game'){
    if(typeof gState!=='undefined'&&gState){
      if(gState.id==='race'&&gState.raceDeadline&&!gState.answered){ askPipPause={raceLeft:bankSecsLeft(gState.raceDeadline)}; gState.raceDeadline=null; }
      if(gState.id==='number'&&gState.escapeTimer){ askPipPause=askPipPause||{}; askPipPause.escLeft=bankSecsLeft(gState.escapeDeadline); clearTimeout(gState.escapeTimer); gState.escapeTimer=null; gState.escapeDeadline=null; }
    }
    pausePlayTimer();
    saveGameProgress();
  }
  var th=newAskQuestionThread(ctx);
  e.threads.unshift(th); activeThread=th.id;
  var routeBack=src==='warmup'?'warmup':(src==='quest'?'quiz':'game');
  askReturn={route:routeBack, threadId:th.id};
  save();
  go('ask');
  pipExplainSend(th, ctx);
}
/* Back from Ask Pip to the exact question. Resumes the timers
   (and any banked countdown) and goes to the stored route. Only
   an UNANSWERED round resumes its clock — an answered round's
   clock stays paused until Next, exactly as before. */
function returnFromAskPip(){
  var ret=askReturn; askReturn=null;
  var paused=askPipPause; askPipPause=null;
  activeThread=null;
  if(!ret){ go('ask'); return; }
  if(ret.route==='quiz'){
    if(typeof cur!=='undefined'&&cur&&!cur.answered)resumeLearnTimer();
  } else if(ret.route==='game'){
    if(typeof gState!=='undefined'&&gState&&!gState.answered)resumePlayTimer();
    if(typeof gState!=='undefined'&&gState){
      if(gState.id==='race'&&paused&&paused.raceLeft>0&&!gState.answered){ gState.raceDeadline=Date.now()+paused.raceLeft*1000; }
      if(gState.id==='number'&&paused&&paused.escLeft>0&&!gState.answered&&typeof armNumberEscape==='function'){ armNumberEscape(paused.escLeft); }
    }
    if(typeof gameTimer!=='undefined'&&typeof tickGameTime==='function'){ if(gameTimer){ clearInterval(gameTimer); gameTimer=null; } gameTimer=setInterval(tickGameTime,1000); }
  }
  /* warmup: bindWarmup re-arms the 60s countdown on render. */
  go(ret.route);
}
