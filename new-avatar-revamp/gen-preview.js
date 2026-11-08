// Builds preview.html from new-avatar-code.js (same code the app will get).
const fs=require('fs');
eval(fs.readFileSync('new-avatar-code.js','utf8'));
const FACES=['🦦','🐸','🦋','🐱','🐶','🐰','🦁','🐼','🦊','🐢','🐷','🐵'];
const NAMES={ '🦦':'Otter','🐸':'Frog','🦋':'Butterfly','🐱':'Cat','🐶':'Dog','🐰':'Rabbit','🦁':'Lion','🐼':'Panda','🦊':'Fox','🐢':'Turtle','🐷':'Pig','🐵':'Monkey'};
const cell=(f,look,w)=>'<div class="cell"><div class="art">'+avatarLookHTML(f,look,'#ffb020',w||120)+'</div><div class="lab">'+NAMES[f]+'</div></div>';
const grid=(items)=>'<div class="grid">'+items.join('')+'</div>';
let h='<!doctype html><html><head><meta charset="utf-8"><style>'
 +'body{font-family:system-ui,sans-serif;background:#fffbe9;margin:0;padding:24px;color:#4a3f35}'
 +'h1{font-size:26px}h2{font-size:20px;margin:34px 0 10px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}'
 +'.cell{background:#fff;border:2px solid #ffe9a8;border-radius:16px;padding:10px 4px 8px;text-align:center}'
 +'.lab{font-size:13px;font-weight:700;margin-top:2px}.note{font-size:14px;color:#7a6a58;max-width:900px}'
 +'.mock{display:flex;gap:28px;align-items:flex-start}'
 +'.sidebar{width:228px;background:#d9f2e3;border-radius:14px;padding:8px 4px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)}'
 +'.sidebar .bname{font-weight:800;font-size:15px}.sidebar .bsub{font-size:12px;color:#5b6b60}'
 +'.topbar{flex:1;background:#fff;border:2px solid #ffe9a8;border-radius:14px;padding:10px 16px;display:flex;align-items:center;gap:10px;font-weight:800}'
 +'.closeup{display:flex;gap:20px}.closeup .cell{flex:1}'
 +'</style></head><body><h1>Round 2 — full-body avatars (parent brief, his reference sheet)</h1>'
 +'<p class="note">Each animal is a COMPLETE character — body IS the animal. Colour recolours the WHOLE animal. No hair. Accessories are tiny touches only. Top-left avatar is the character itself, BIG.</p>'

// 1. Top-left avatar at real size
h+='<h2>1 · Top-left avatar at real size (sidebar 130px + mobile topbar 43px)</h2><div class="mock">'
 +'<div class="sidebar"><div style="width:130px;margin:0 auto">'+avatarLookHTML('🦦',{color:'',accessory:'necklace'},'#ffb020',130)+'</div><div class="bname">My Terrarium</div><div class="bsub">Primary 3 · Jiyuna ⭐</div><div style="font-size:12px;margin-top:6px;color:#5b6b60">← sidebar, 228px wide, as in the app</div></div>'
 +'<div class="topbar"><span style="line-height:0">'+avatarLookHTML('🦦',{color:'',accessory:'necklace'},'#ffb020',43)+'</span><span>Home</span><span style="font-weight:400;font-size:13px;color:#7a6a58">← mobile topbar (≤820px), 43px character replacing the Pip icon</span></div>'
 +'</div>';

// 2. Natural
h+='<h2>2 · All 12 animals — Natural (their own colours)</h2>'+grid(FACES.map(f=>cell(f,{color:'',accessory:''})));
// 3. Pink
h+='<h2>3 · All 12 animals — PINK (whole-animal recolour proof)</h2>'+grid(FACES.map(f=>cell(f,{color:'#ff8fa3',accessory:''})));
// 4. Teal
h+='<h2>4 · All 12 animals — TEAL (second recolour)</h2>'+grid(FACES.map(f=>cell(f,{color:'#2dd4bf',accessory:''})));
// 5. Accessories on the otter
h+='<h2>5 · Tiny accessories — otter with each one (none first)</h2>'+grid(LOOK_ACCS.map(a=>cell('🦦',{color:'',accessory:a},120).replace('Otter','Otter · '+(a?LOOK_ACC_LABELS[a]:'None'))));
// 6. Tricky combos
const tricky=[['🦋','necklace','Butterfly + necklace'],['🦁','tinyhat','Lion + tiny hat'],['🐼','bow','Panda + little bow'],['🐸','flower','Frog + flower'],['🐷','star','Pig + star'],['🐵','necklace','Monkey + necklace']];
h+='<h2>6 · Tricky combos — accessories on the animals with wings, manes and big ears</h2>'+grid(tricky.map(([f,a,l])=>'<div class="cell"><div class="art">'+avatarLookHTML(f,{color:'',accessory:a},'#ffb020',120)+'</div><div class="lab">'+l+'</div></div>'));
// 7. Close-ups
h+='<h2>7 · Close-ups (large)</h2><div class="closeup">'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🦦',{color:'#ff8fa3',accessory:'tinyhat'},'#ffb020',260)+'</div><div class="lab">Pink otter + tiny hat</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐢',{color:'#2dd4bf',accessory:'flower'},'#ffb020',260)+'</div><div class="lab">Teal turtle + flower — shell must read</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐰',{color:'#7db4ff',accessory:'star'},'#ffb020',260)+'</div><div class="lab">Blue rabbit + star — exactly two ears</div></div>'
 +'</div></body></html>';
fs.writeFileSync('preview.html',h);
console.log('preview.html written,', h.length, 'bytes');
