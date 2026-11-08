// Apply the dress-up + frog-facts diff to a copy of the learning-app
// project. Usage:
//   node new-dressup-greg/apply.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-dressup-greg/dressup-greg-diff.md.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const FROG_DRAG_TEST = path.join(root, 'tests', 'frog-drag.test.js');
const NEW_TEST_SRC = path.join(__dirname, 'tests-dressup-greg.test.js');
const NEW_TEST_DST = path.join(root, 'tests', 'dressup-greg.test.js');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

const LOOK_CODE = `
/* ============================================================
   FULL-BODY LOOK (2026-11-08, Bryan): the "Change my name &
   look" modal grows a dress-up builder — body colour, hair and
   accessory, on top of the animal face. Emoji + CSS only, no new
   image files. Stored as e.look={color,hair,accessory}, stamped by
   the same e.lookAt as face/glow/badge, merged later-wins. */
var LOOK_COLORS=['','#ff8fa3','#ffb020','#2dd4bf','#7db4ff','#c084fc','#8b5e3c'];
var LOOK_HAIRS=['','spiky','curly','long','bun'];
var LOOK_HAIR_LABELS={'':'None','spiky':'Spiky','curly':'Curly','long':'Long','bun':'Bun'};
var LOOK_HAIR_SHAPES={
 spiky:'<path d="M15,58 L28,12 L42,46 L55,6 L70,46 L84,12 L96,48 L108,22 L110,58 Z" fill="#6b4423"/>',
 curly:'<circle cx="32" cy="40" r="17" fill="#6b4423"/><circle cx="60" cy="32" r="19" fill="#6b4423"/><circle cx="88" cy="40" r="17" fill="#6b4423"/>',
 long:'<rect x="12" y="14" width="17" height="46" rx="8" fill="#6b4423"/><rect x="91" y="14" width="17" height="46" rx="8" fill="#6b4423"/>',
 bun:'<circle cx="60" cy="24" r="15" fill="#6b4423"/><rect x="34" y="40" width="52" height="10" rx="5" fill="#6b4423"/>'};
var LOOK_ACCS=['','necklace','hat','glasses','bowtie'];
var LOOK_ACC_EMOJI={necklace:'📿',hat:'🎩',glasses:'👓',bowtie:'🎀'};
var LOOK_ACC_LABELS={necklace:'Necklace',hat:'Hat',glasses:'Glasses',bowtie:'Bow tie'};
/* Full-body preview: the animal emoji is the head, a CSS shape in
   the chosen colour is the body (Natural = the explorer's glow),
   hair is an SVG over the head, the accessory is an emoji overlaid
   where it belongs. Tolerates a missing look (legacy explorers). */
function avatarLookHTML(face, look, glow){
  look=look||{};
  var body=look.color||glow||'#7cc46a';
  var hair=look.hair||'', acc=look.accessory||'';
  var accPos={hat:'top:0;font-size:2.6rem',glasses:'top:56px;font-size:2.4rem',necklace:'top:108px;font-size:1.9rem',bowtie:'top:106px;font-size:1.9rem'};
  return '<div style="position:relative;height:182px;display:flex;flex-direction:column;align-items:center">'
   +'<div style="font-size:4rem;line-height:1;margin-top:30px">'+(face||'🦦')+'</div>'
   +'<div style="width:118px;height:62px;margin-top:-12px;border-radius:46% 46% 42% 42%/72% 72% 28% 28%;background:'+body+'"></div>'
   +(hair?'<div style="position:absolute;left:50%;transform:translateX(-50%);top:2px;width:120px"><svg viewBox="0 0 120 60" style="width:120px;height:60px;display:block">'+LOOK_HAIR_SHAPES[hair]+'</svg></div>':'')
   +(acc?'<div style="position:absolute;left:50%;transform:translateX(-50%);'+accPos[acc]+'">'+LOOK_ACC_EMOJI[acc]+'</div>':'')
   +'</div>';
}
`;

const LOOK_ROWS = `   +'<label class="flabel">My full-body look</label><div id="lookPreview" class="card" style="padding:12px;margin-bottom:4px">'+avatarLookHTML(e.face,e.look,e.glow)+'</div>'
   +'<label class="flabel">Body colour</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_COLORS.map(function(c){ var cur=(e.look||{}).color||''; return '<button class="iconbtn lookColorPick" data-c="'+c+'" style="background:'+(c||'repeating-linear-gradient(45deg,#ffffff 0 4px,#e8e2d4 4px 8px)')+';'+(cur===c?'outline:3px solid var(--ink)':'')+'" aria-label="Body colour '+(c||'natural')+'"></button>'; }).join('')+'</div>'
   +'<label class="flabel">Hair</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_HAIRS.map(function(h){ var cur=(e.look||{}).hair||''; return '<button class="btn'+(cur===h?'':' ghost')+' lookHairPick" data-h="'+h+'" style="padding:8px 10px">'+(h?'<span style="display:inline-block;width:24px;vertical-align:middle"><svg viewBox="0 0 120 60" style="width:24px;height:12px;display:block">'+LOOK_HAIR_SHAPES[h]+'</svg></span> ':'')+LOOK_HAIR_LABELS[h]+'</button>'; }).join('')+'</div>'
   +'<label class="flabel">Accessory</label><div style="display:flex;gap:8px;flex-wrap:wrap">'+LOOK_ACCS.map(function(a){ var cur=(e.look||{}).accessory||''; return '<button class="iconbtn lookAccPick" data-a="'+a+'" style="font-size:1.2rem;'+(cur===a?'outline:3px solid var(--ink)':'')+'" aria-label="'+(a?LOOK_ACC_LABELS[a]:'No accessory')+'">'+(a?LOOK_ACC_EMOJI[a]:'🚫')+'</button>'; }).join('')+'</div>'
`;

const LOOK_HANDLERS = `  document.querySelectorAll('.lookColorPick').forEach(function(b){ b.onclick=function(){ var live=ex(); if(!live)return; var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var c=b.getAttribute('data-c'); if(!live.look)live.look={color:'',hair:'',accessory:''}; if((live.look.color||'')!==c){ live.look.color=c; live.lookAt=new Date().toISOString(); save(); refreshLookPreview(); } document.querySelectorAll('.lookColorPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.lookHairPick').forEach(function(b){ b.onclick=function(){ var live=ex(); if(!live)return; var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var h=b.getAttribute('data-h'); if(!live.look)live.look={color:'',hair:'',accessory:''}; if((live.look.hair||'')!==h){ live.look.hair=h; live.lookAt=new Date().toISOString(); save(); refreshLookPreview(); } document.querySelectorAll('.lookHairPick').forEach(function(x){ x.classList.toggle('ghost',x!==b); }); if(keepEl)keepEl.value=keep; }; });
  document.querySelectorAll('.lookAccPick').forEach(function(b){ b.onclick=function(){ var live=ex(); if(!live)return; var keepEl=document.getElementById('lkName'); var keep=keepEl?keepEl.value:''; var a=b.getAttribute('data-a'); if(!live.look)live.look={color:'',hair:'',accessory:''}; if((live.look.accessory||'')!==a){ live.look.accessory=a; live.lookAt=new Date().toISOString(); save(); refreshLookPreview(); } document.querySelectorAll('.lookAccPick').forEach(function(x){ x.style.outline=(x===b?'3px solid var(--ink)':''); }); if(keepEl)keepEl.value=keep; }; });
`;

const FROG_FACTS_CODE = `/* What the frog says when tapped — a tap always replays the happy
   reaction (hop + floating emoji + bubble), even while every care
   is on cooldown. Now the frog tells FUN FACTS about frogs (Bryan,
   2026-11-08): one per tap, shuffled, no repeats until all 12
   have been told, then reshuffled. The bubble shows the frog's own
   name (e.critterName), so the fact reads as the frog telling it.
   Session-only state, never saved or synced. The old greeting
   lines are gone. */
var FROG_FACTS=['Frogs soak up water through their skin — they never take a sip like we do!','A group of frogs is called an army!','Frogs use their eyes to help push food down when they swallow!','Glass frogs are see-through — you can spot their tiny organs inside!','A frog’s tongue is stuck on at the front of its mouth, so it can flick it out super fast!','Some frogs can jump 20 times their own body length!','Tadpoles breathe with gills like fish, then grow lungs as they turn into frogs!','A frog’s big bulging eyes help it see almost all around!','The tiniest frog in the world is smaller than a coin!','Some frogs can change colour to hide from hungry hunters!','Frogs have hopped around Earth for more than 200 million years!','The round circle behind a frog’s eye is its ear — its eardrum!'];
var frogFactState=null;
function nextFrogFact(){
  if(!frogFactState||frogFactState.idx>=frogFactState.order.length){ frogFactState={order:shuffle(FROG_FACTS.map(function(f,i){ return i; })), idx:0}; }
  return FROG_FACTS[frogFactState.order[frogFactState.idx++]];
}
`;

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('var LOOK_COLORS=') >= 0) throw new Error('already applied: var LOOK_COLORS= exists');
if (html.indexOf('var FROG_FACTS=') >= 0) throw new Error('already applied: var FROG_FACTS= exists');

// 1. Look constants + preview helper, just above openLookModal.
html = replaceOnce(html,
  'function openLookModal(){',
  LOOK_CODE + '\nfunction openLookModal(){',
  'look constants + avatarLookHTML');

// 2. New explorers start with an empty look.
html = replaceOnce(html,
  "face:'🦦', glow:'#ffb020', badge:'⭐', stars:0",
  "face:'🦦', glow:'#ffb020', badge:'⭐', look:{color:'',hair:'',accessory:''}, stars:0",
  'newExplorer default look');

// 3. Merge carries e.look later-wins, deep-copied, in all three branches.
html = replaceOnce(html,
  "  if(_lAtB>_lAtA){ if(b.glow!=null)e.glow=b.glow; if(b.badge!=null)e.badge=b.badge; if(b.face!=null)e.face=b.face; e.lookAt=b.lookAt; } else if(_lAtA>_lAtB){ if(a.glow!=null)e.glow=a.glow; if(a.badge!=null)e.badge=a.badge; if(a.face!=null)e.face=a.face; e.lookAt=a.lookAt; } else if(_lAtA&&_lAtB&&_lAtB===_lAtA){ if(b.glow!=null)e.glow=b.glow; if(b.badge!=null)e.badge=b.badge; if(b.face!=null)e.face=b.face; e.lookAt=b.lookAt; }",
  "  if(_lAtB>_lAtA){ if(b.glow!=null)e.glow=b.glow; if(b.badge!=null)e.badge=b.badge; if(b.face!=null)e.face=b.face; if(b.look!=null)e.look=JSON.parse(JSON.stringify(b.look)); e.lookAt=b.lookAt; } else if(_lAtA>_lAtB){ if(a.glow!=null)e.glow=a.glow; if(a.badge!=null)e.badge=a.badge; if(a.face!=null)e.face=a.face; if(a.look!=null)e.look=JSON.parse(JSON.stringify(a.look)); e.lookAt=a.lookAt; } else if(_lAtA&&_lAtB&&_lAtB===_lAtA){ if(b.glow!=null)e.glow=b.glow; if(b.badge!=null)e.badge=b.badge; if(b.face!=null)e.face=b.face; if(b.look!=null)e.look=JSON.parse(JSON.stringify(b.look)); e.lookAt=b.lookAt; }",
  'mergeExplorer look');

// 4. Modal: preview + three picker rows, after the animal row.
html = replaceOnce(html,
  "   +'<label class=\"flabel\">Pip’s glow colour</label>",
  LOOK_ROWS + "   +'<label class=\"flabel\">Pip’s glow colour</label>",
  'modal look rows');

// 5. refreshLookPreview helper, before the facePick handler.
html = replaceOnce(html,
  "  document.querySelectorAll('.facePick').forEach(function(b){",
  "  /* Refresh the full-body preview in place after a look tap —\n     same rule as the outlines: never rebuild the modal (that\n     would throw away a typed unsaved name). */\n  function refreshLookPreview(){ var live=ex(); var pv=document.getElementById('lookPreview'); if(live&&pv)pv.innerHTML=avatarLookHTML(live.face,live.look,live.glow); }\n  document.querySelectorAll('.facePick').forEach(function(b){",
  'refreshLookPreview helper');

// 6. Face + glow taps refresh the preview too (face is the head;
//    glow is the Natural body colour).
html = replaceOnce(html,
  "if(live.face!==f){ live.face=f; live.lookAt=new Date().toISOString(); save(); }",
  "if(live.face!==f){ live.face=f; live.lookAt=new Date().toISOString(); save(); refreshLookPreview(); }",
  'facePick refreshes preview');
html = replaceOnce(html,
  "if(live.glow!==g){ live.glow=g; live.lookAt=new Date().toISOString(); save(); }",
  "if(live.glow!==g){ live.glow=g; live.lookAt=new Date().toISOString(); save(); refreshLookPreview(); }",
  'glowPick refreshes preview');

// 7. The three new pick handlers, before Save.
html = replaceOnce(html,
  "  document.getElementById('lkSave').onclick=function(){",
  LOOK_HANDLERS + "  document.getElementById('lkSave').onclick=function(){",
  'look pick handlers');

// 8. Frog facts replace the greeting lines.
html = replaceOnce(html,
  "/* What the frog says when tapped — a tap always replays the happy\n   reaction (hop + floating emoji + bubble), even while every care\n   is on cooldown. */\nvar FROG_LINES=['Ribbit! That tickles! 🐸','I love my pond! 💧','Hop hop hooray! 🎉','You are my favourite explorer! ⭐','Ribbit ribbit! Let’s play! 🎾','I’m growing big and strong! 🌱'];",
  FROG_FACTS_CODE.trimEnd(),
  'FROG_FACTS replaces FROG_LINES');

// 9. frogTap tells the next fact, by the frog's own name.
html = replaceOnce(html,
  "    var line=FROG_LINES[Math.floor(Math.random()*FROG_LINES.length)];",
  "    var line=nextFrogFact();",
  'frogTap next fact');
html = replaceOnce(html,
  "    var b=document.getElementById('frogBubble'); if(b){ b.textContent='💬 '+line; b.style.display='block'; }",
  "    var b=document.getElementById('frogBubble'); if(b){ b.textContent='💬 '+(eNow.critterName||'Frog')+': '+line; b.style.display='block'; }",
  'frogTap bubble names the frog');

// 10. The speech bubble wraps (facts are full sentences).
html = replaceOnce(html,
  ".frog-bubble{position:absolute;left:50%;top:10px;transform:translateX(-50%);max-width:88%;background:#fff;border:2px solid var(--line);border-radius:14px;padding:8px 12px;font-weight:800;font-size:.92rem;z-index:6;box-shadow:var(--shadow);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".frog-bubble{position:absolute;left:50%;top:10px;transform:translateX(-50%);max-width:88%;background:#fff;border:2px solid var(--line);border-radius:14px;padding:8px 12px;font-weight:800;font-size:.92rem;z-index:6;box-shadow:var(--shadow);text-align:center;line-height:1.35}",
  'frog-bubble wraps');

fs.writeFileSync(PAGE, html);

// 11. frog-drag test harness: load the facts machinery, not FROG_LINES.
let drag = fs.readFileSync(FROG_DRAG_TEST, 'utf8');
drag = replaceOnce(drag,
  "  vm.runInContext(varText('FROG_LINES'), ctx);",
  "  vm.runInContext(varText('FROG_FACTS'), ctx);\n  vm.runInContext(varText('frogFactState'), ctx);\n  vm.runInContext(fnText('function nextFrogFact(){'), ctx);",
  'frog-drag loads FROG_FACTS');
drag = replaceOnce(drag,
  "    sndPop: () => {}, sndCorrect: () => {}, sndFanfare: () => {},",
  "    sndPop: () => {}, sndCorrect: () => {}, sndFanfare: () => {},\n    shuffle: (a) => a.slice(), // facts cycle in page order in tests (the real shuffle lives in the page),",
  'frog-drag sandbox shuffle');
drag = replaceOnce(drag,
  "'the bubble holds a hello line'",
  "'the bubble holds a frog fact'",
  'frog-drag bubble comment');
fs.writeFileSync(FROG_DRAG_TEST, drag);

// 12. New test file.
fs.copyFileSync(NEW_TEST_SRC, NEW_TEST_DST);

console.log('applied dress-up + frog facts to ' + root);
