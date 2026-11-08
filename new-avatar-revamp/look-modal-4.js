// The round-4 "Change my name & look" editor (replaces openLookModal
// in public/index.html). The editor works on a DRAFT copy of the
// look — picking an animal, a colour, an accessory, a glow or a
// badge only changes the draft and refreshes the modal preview.
// Nothing is saved until "Save my look" commits the draft into the
// live explorer (resolved fresh at that moment) and calls save().
// Cancel just closes the modal and the draft is thrown away, so the
// stored look is untouched. The sidebar/topbar characters show the
// SAVED look and only change on Save, via render().
function openLookModal(){
  var e=ex();
  /* DRAFT (round 4 — Cancel must revert): the editor works on a
     draft copy of the look, never on the live explorer. Every pick
     only changes the draft and refreshes the modal preview; nothing
     is saved until "Save my look" commits the draft into the live
     explorer (resolved fresh at that moment — the background sync
     replaces the whole DB object, so the copy captured when the
     modal opened may be detached) and calls save(). Cancel just
     closes the modal and the draft is thrown away, so the stored
     look is untouched. The sidebar/topbar characters show the
     SAVED look and only change on Save, via render(). */
  var draft={face:e.face, glow:e.glow, badge:e.badge, look:{color:(e.look||{}).color||'', accessory:(e.look||{}).accessory||''}};
  openModal('<h3 style="margin-top:0">Change my name &amp; look 🎨</h3>'
   +'<label class="flabel">Magic name</label><input class="field" id="lkName" value="'+esc(e.name)+'" maxlength="20">'
   +'<label class="flabel">My animal friend</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+['🦦','🐸','🦋','🐱','🐶','🐰','🦁','🐼','🦊','🐢','🐷','🐵'].map(function(a){return '<button class="iconbtn facePick" data-f="'+a+'" style="font-size:1.2rem;'+(e.face===a?'outline:3px solid var(--ink)':'')+'">'+a+'</button>';}).join('')+'</div>'
   +'<label class="flabel">My full-body look</label><div id="lookPreview" class="card" style="padding:12px;margin-bottom:4px">'+avatarLookHTML(e.face,e.look,e.glow)+'</div>'
   +'<label class="flabel">Animal colour</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_COLORS.map(function(c){ var cur=(e.look||{}).color||''; return '<button class="iconbtn lookColorPick" data-c="'+c+'" style="background:'+(c||'repeating-linear-gradient(45deg,#ffffff 0 4px,#e8e2d4 4px 8px)')+';'+(cur===c?'outline:3px solid var(--ink)':'')+'" aria-label="Animal colour '+(c||'natural')+'"></button>'; }).join('')+'</div>'
   +'<label class="flabel">Accessory</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_ACCS.map(function(a){ var cur=(e.look||{}).accessory||''; return '<button class="iconbtn lookAccPick" data-a="'+a+'" style="font-size:1.2rem;'+(cur===a?'outline:3px solid var(--ink)':'')+'" aria-label="'+(a?LOOK_ACC_LABELS[a]:'No accessory')+'">'+(a?LOOK_ACC_EMOJI[a]:'🚫')+'</button>'; }).join('')+'</div>'
   +'<label class="flabel">Pip’s glow colour</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+GLOWS.map(function(g){return '<button class="iconbtn glowPick" data-g="'+g+'" style="background:'+g+';'+(e.glow===g?'outline:3px solid var(--ink)':'')+'" aria-label="Glow '+g+'"></button>';}).join('')+'</div>'
   +'<label class="flabel">My badge</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+['⭐','🦦','🌈','🚀','🍓','⚡','🐸','🦋','🌟','💎','🎨','🏆','🌸','🍀','🎵','❤️'].map(function(b){return '<button class="iconbtn badgePick" data-b="'+b+'" style="font-size:1.2rem;'+(e.badge===b?'outline:3px solid var(--amber)':'')+'">'+b+'</button>';}).join('')+'</div>'
   +'<div style="display:flex;gap:10px;margin-top:18px"><button class="btn" id="lkSave">Save my look</button><button class="btn ghost" onclick="closeModal()">Cancel</button></div>');
  /* Glow/badge/animal taps must NEVER rebuild the modal: rebuilding it from the
     saved name threw away a name the child had just typed but not saved
     yet. Update only the outlines in place, and keep the typed name.
     They write to the DRAFT only — never to the live explorer, never
     save() — so Cancel can still throw the whole draft away. */
  /* Refresh the full-body preview in place after a look tap — from
     the DRAFT, not the live explorer — same rule as the outlines:
     never rebuild the modal (that would throw away a typed
     unsaved name). The sidebar/topbar characters are NOT touched
     here: they show the saved look until Save. */
  function refreshLookPreview(){ var pv=document.getElementById('lookPreview'); if(pv)pv.innerHTML=avatarLookHTML(draft.face,draft.look,draft.glow); }
  document.querySelectorAll('.facePick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var f=b.getAttribute('data-f'); if(draft.face!==f){ draft.face=f; refreshLookPreview(); } document.querySelectorAll('.facePick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.glowPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var g=b.getAttribute('data-g'); if(draft.glow!==g){ draft.glow=g; refreshLookPreview(); } document.querySelectorAll('.glowPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.badgePick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var bd=b.getAttribute('data-b'); if(draft.badge!==bd){ draft.badge=bd; } document.querySelectorAll('.badgePick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--amber)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.lookColorPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var c=b.getAttribute('data-c'); if((draft.look.color||'')!==c){ draft.look.color=c; refreshLookPreview(); } document.querySelectorAll('.lookColorPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.lookAccPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var a=b.getAttribute('data-a'); if((draft.look.accessory||'')!==a){ draft.look.accessory=a; refreshLookPreview(); } document.querySelectorAll('.lookAccPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.getElementById('lkSave').onclick=function(){ var live=ex(); if(!live)return; live.face=draft.face; live.glow=draft.glow; live.badge=draft.badge; live.look={color:draft.look.color, accessory:draft.look.accessory}; live.lookAt=new Date().toISOString(); var v=document.getElementById('lkName').value.trim(); if(v&&v!==live.name){ live.name=v; live.nameAt=new Date().toISOString(); } save(); closeModal(); render(); toast('Looking great, '+live.name+'!'); };
}
