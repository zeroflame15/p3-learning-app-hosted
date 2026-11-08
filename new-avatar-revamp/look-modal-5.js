// The round-5 "Change my name & look" editor (replaces openLookModal
// in public/index.html). Same structure and draft pattern as round 4
// — the editor works on a DRAFT copy of the look, and nothing is
// saved until "Save my look" commits the draft into the live
// explorer (resolved fresh at that moment) and calls save(). Cancel
// just closes the modal and the draft is thrown away, so the stored
// look is untouched. (Round-4 live check: Cancel genuinely reverts.)
// What changed in round 5:
//   • 25 animals (LOOK_FACES, from the avatar block) — the otter
//     and butterfly are gone, they are not on the reference sheet.
//   • NO colour picker section — animals keep their own colours
//     from the sheet. A stored colour value is ignored.
//   • NO accessories — the parent dropped them. A stored
//     accessory value is ignored, like a stored colour.
//   • NEW "My background" section: shape (bgShapePick) × colour
//     (bgColorPick) × pattern (bgPatternPick) × effect
//     (bgEffectPick). The background is part of the look:
//     {background:{shape,color,pattern,effect}}. Patterns are
//     drawn inside the shape; the effects now include three
//     animated ones (twinkle, bubbles, petals) alongside the
//     static plain / glitter / glow / shine.
//   • TAP TO PLAY: the preview (like every avatar) is tappable —
//     the animal jumps with a sparkle burst. Nothing to wire
//     here: the svg carries its own onclick.
function openLookModal(){
  var e=ex();
  /* DRAFT (round 5 — Cancel must revert): the editor works on a
     draft copy of the look, never on the live explorer. Every pick
     only changes the draft and refreshes the modal preview; nothing
     is saved until "Save my look" commits the draft into the live
     explorer (resolved fresh at that moment — the background sync
     replaces the whole DB object, so the copy captured when the
     modal opened may be detached) and calls save(). Cancel just
     closes the modal and the draft is thrown away, so the stored
     look is untouched. The sidebar/topbar characters show the
     SAVED look and only change on Save, via render(). */
  var draft={face:e.face, glow:e.glow, badge:e.badge, look:{background:{shape:((e.look||{}).background||{}).shape||'circle', color:((e.look||{}).background||{}).color||'mint', pattern:((e.look||{}).background||{}).pattern||'', effect:((e.look||{}).background||{}).effect||'plain'}}};
  function bgShapeMini(shape){return '<svg viewBox="0 0 200 260" width="26" height="34" aria-hidden="true">'+bgShapeEl(shape,'#ffd6e0')+'</svg>'}
  var BG_EFF_LABELS={plain:'Plain',glitter:'✨ Glitter',glow:'🌟 Glow',shine:'💫 Shine',twinkle:'⭐ Twinkle',bubbles:'🫧 Bubbles',petals:'🌸 Petals'};
  var BG_PATTERN_LABELS={'':'None','dots':'Polka dots','stars':'Stars','stripes':'Stripes','hearts':'Hearts'};
  openModal('<h3 style="margin-top:0">Change my name &amp; look 🎨</h3>'
   +'<label class="flabel">Magic name</label><input class="field" id="lkName" value="'+esc(e.name)+'" maxlength="20">'
   +'<label class="flabel">My animal friend</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_FACES.map(function(a){return '<button class="iconbtn facePick" data-f="'+a+'" style="font-size:1.2rem;'+(e.face===a?'outline:3px solid var(--ink)':'')+'">'+a+'</button>';}).join('')+'</div>'
   +'<label class="flabel">My full-body look</label><div id="lookPreview" class="card" style="padding:12px;margin-bottom:4px">'+avatarLookHTML(e.face,e.look,e.glow)+'</div>'
   +'<label class="flabel">My background</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_BG_SHAPES.map(function(sh){ var cur=(draft.look.background||{}).shape||'circle'; return '<button class="iconbtn bgShapePick" data-s="'+sh+'" style="width:40px;height:48px;padding:0;display:flex;align-items:center;justify-content:center;'+(cur===sh?'outline:3px solid var(--ink)':'')+'" aria-label="'+sh+' background">'+bgShapeMini(sh)+'</button>'; }).join('')+'</div>'
   +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+LOOK_BG_COLOR_NAMES.concat(['none']).map(function(c){ var cur=(draft.look.background||{}).color||'mint'; return '<button class="iconbtn bgColorPick" data-c="'+c+'" style="background:'+(c==='none'?'repeating-linear-gradient(45deg,#ffffff 0 4px,#e8e2d4 4px 8px)':LOOK_BG_COLORS[c])+';'+(cur===c?'outline:3px solid var(--ink)':'')+'" aria-label="Background colour '+(c==='none'?'none':c)+'"></button>'; }).join('')+'</div>'
   +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+LOOK_BG_PATTERNS.map(function(pt){ var cur=(draft.look.background||{}).pattern||''; return '<button class="iconbtn bgPatternPick" data-p="'+pt+'" style="width:auto;font-size:.85rem;font-weight:600;padding:.35rem .6rem;'+(cur===pt?'outline:3px solid var(--ink)':'')+'" aria-label="Background pattern '+BG_PATTERN_LABELS[pt]+'">'+BG_PATTERN_LABELS[pt]+'</button>'; }).join('')+'</div>'
   +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+LOOK_BG_EFFECTS.map(function(ef){ var cur=(draft.look.background||{}).effect||'plain'; return '<button class="iconbtn bgEffectPick" data-e="'+ef+'" style="width:auto;font-size:.85rem;font-weight:600;padding:.35rem .6rem;'+(cur===ef?'outline:3px solid var(--ink)':'')+'">'+BG_EFF_LABELS[ef]+'</button>'; }).join('')+'</div>'
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
  document.querySelectorAll('.bgShapePick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var s=b.getAttribute('data-s'); if((draft.look.background||{}).shape!==s){ draft.look.background.shape=s; refreshLookPreview(); } document.querySelectorAll('.bgShapePick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.bgColorPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var c=b.getAttribute('data-c'); if((draft.look.background||{}).color!==c){ draft.look.background.color=c; refreshLookPreview(); } document.querySelectorAll('.bgColorPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.bgPatternPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var pt=b.getAttribute('data-p'); if((draft.look.background||{}).pattern!==pt){ draft.look.background.pattern=pt; refreshLookPreview(); } document.querySelectorAll('.bgPatternPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.bgEffectPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var ef=b.getAttribute('data-e'); if((draft.look.background||{}).effect!==ef){ draft.look.background.effect=ef; refreshLookPreview(); } document.querySelectorAll('.bgEffectPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.glowPick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var g=b.getAttribute('data-g'); if(draft.glow!==g){ draft.glow=g; refreshLookPreview(); } document.querySelectorAll('.glowPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.badgePick').forEach(function(b){ b.onclick=function(){ var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var bd=b.getAttribute('data-b'); if(draft.badge!==bd){ draft.badge=bd; } document.querySelectorAll('.badgePick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--amber)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.getElementById('lkSave').onclick=function(){ var live=ex(); if(!live)return; live.face=draft.face; live.glow=draft.glow; live.badge=draft.badge; live.look={background:{shape:draft.look.background.shape, color:draft.look.background.color, pattern:draft.look.background.pattern, effect:draft.look.background.effect}}; live.lookAt=new Date().toISOString(); var v=document.getElementById('lkName').value.trim(); if(v&&v!==live.name){ live.name=v; live.nameAt=new Date().toISOString(); } save(); closeModal(); render(); toast('Looking great, '+live.name+'!'); };
}
