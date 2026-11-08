// Builds preview-5.html and anim-proof-5.html from
// new-avatar-5-code.js (the same code the app will get).
const fs=require('fs');
eval(fs.readFileSync('new-avatar-5-code.js','utf8'));
const NAMES={'🐤':'Chick','🐴':'Horse','🐧':'Penguin','🐻':'Bear','🐢':'Turtle','🐼':'Panda','🦁':'Lion','🐱':'Cat','🐷':'Pig','🦊':'Fox','🐸':'Frog','🐘':'Elephant','🦒':'Giraffe','🐰':'Rabbit','🦉':'Owl','🦝':'Raccoon','🐵':'Monkey','🐯':'Tiger','🐊':'Crocodile','🐶':'Dog','🦥':'Sloth','🦆':'Duck','🦛':'Hippo','🐑':'Sheep','🐨':'Koala'};
const cell=(f,look,w)=>'<div class="cell"><div class="art">'+avatarLookHTML(f,look,'#ffb020',w||120)+'</div><div class="lab">'+NAMES[f]+'</div></div>';
const grid=(items)=>'<div class="grid">'+items.join('')+'</div>';
// A tap-to-play cell, frozen mid-jump: the svg carries .av-play and
// PLAY_CSS pauses its jump/sparkles at 0.35s into the 0.8s trick, so
// the still shows the animal in the air with the burst visible.
const playCell=(f,look,label)=>'<div class="cell playproof"><div class="art">'+avatarLookHTML(f,look,'#ffb020',260).replace('class="av5"','class="av5 av-play"')+'</div><div class="lab">'+label+'</div></div>';
const PAGE_CSS='body{font-family:system-ui,sans-serif;background:#fffbe9;margin:0;padding:24px;color:#4a3f35}'
 +'h1{font-size:26px}h2{font-size:20px;margin:34px 0 10px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}'
 +'.cell{background:#fff;border:2px solid #ffe9a8;border-radius:16px;padding:10px 4px 8px;text-align:center}'
 +'.lab{font-size:13px;font-weight:700;margin-top:2px}.note{font-size:14px;color:#7a6a58;max-width:900px}'
 +'.mock{display:flex;gap:28px;align-items:flex-start}'
 +'.sidebar{width:228px;background:#d9f2e3;border-radius:14px;padding:8px 4px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)}'
 +'.sidebar .bname{font-weight:800;font-size:15px}.sidebar .bsub{font-size:12px;color:#5b6b60}'
 +'.topbar{flex:1;background:#fff;border:2px solid #ffe9a8;border-radius:14px;padding:10px 16px;display:flex;align-items:center;gap:10px;font-weight:800}'
 +'.closeup{display:flex;gap:20px}.closeup .cell{flex:1}'
 +'.sheet{max-width:520px;border:2px solid #ffe9a8;border-radius:16px}';
// After AVATAR_5_CSS, so these win any specificity tie with the
// play rules (the rabbit's fast ear wiggle is !important).
const PLAY_CSS='.playproof .av5.av-play .av-jump{animation-play-state:paused!important;animation-delay:-0.35s!important}'
 +'.playproof .av5.av-play .av-sparkles{animation-play-state:paused!important;animation-delay:-0.35s!important}'
 +'.playproof .av5.av-play .av-earwig{animation-play-state:paused!important;animation-delay:-0.2s!important}';
let h='<!doctype html><html><head><meta charset="utf-8"><style>'+PAGE_CSS+AVATAR_5_CSS+PLAY_CSS+'</style></head><body><h1>Round 5 — flat kawaii, sheet-exact</h1>'
 +'<p class="note">All 25 animals from the parent\'s reference sheet, redrawn to match it exactly as closely as SVG allows — thick dark-brown outlines, flat fills, big glossy black eyes with white highlights, small simple mouths, pink blush cheeks. No colour option (animals keep their own colours). No accessories — the parent dropped them. Custom background: shape × colour × pattern × effect, including three animated effects (twinkle, bubbles, petals). Tap the animal and it does a happy jump with a sparkle burst. A soft ground shadow under the feet so the character pops. The otter and butterfly are gone — they are not on the sheet.</p>'

// 1. Top-left avatar at real size
h+='<h2>1 · Top-left avatar at real size (sidebar 130px + mobile topbar 43px)</h2><div class="mock">'
 +'<div class="sidebar"><div style="width:130px;margin:0 auto">'+avatarLookHTML('🐤',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',130)+'</div><div class="bname">My Terrarium</div><div class="bsub">Primary 3 · Jiyuna ⭐</div><div style="font-size:12px;margin-top:6px;color:#5b6b60">← sidebar, 228px wide, as in the app</div></div>'
 +'<div class="topbar"><span style="line-height:0">'+avatarLookHTML('🐤',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',43)+'</span><span>Home</span><span style="font-weight:400;font-size:13px;color:#7a6a58">← mobile topbar (≤820px), 43px character replacing the Pip icon</span></div>'
 +'</div>';

// 2. All 25, default background
h+='<h2>2 · All 25 animals — default background (circle / mint / plain)</h2>'+grid(LOOK_FACES.map(f=>cell(f,{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}})));
// 3. All 25, heart/pink/glitter — the background must read on every animal
h+='<h2>3 · All 25 animals — heart / pink / glitter (the background must read on every animal)</h2>'+grid(LOOK_FACES.map(f=>cell(f,{background:{shape:'heart',color:'pink',effect:'glitter',pattern:''}})));
// 4. Backgrounds — shapes, colours, effects on the chick
h+='<h2>4 · Background shapes — chick on each shape (mint / plain)</h2>'+grid(LOOK_BG_SHAPES.map(sh=>'<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:sh,color:'mint',effect:'plain',pattern:''}},'#ffb020',120)+'</div><div class="lab">'+sh+'</div></div>'));
h+='<h2>5 · Background colours — chick on each colour (circle / plain) + none</h2>'+grid(LOOK_BG_COLOR_NAMES.concat(['none']).map(c=>'<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'circle',color:c,effect:'plain',pattern:''}},'#ffb020',120)+'</div><div class="lab">'+c+'</div></div>'));
h+='<h2>6 · Background effects — chick with each effect (circle / sky)</h2>'+grid(LOOK_BG_EFFECTS.map(ef=>'<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'circle',color:'sky',effect:ef,pattern:''}},'#ffb020',120)+'</div><div class="lab">'+ef+'</div></div>'));
// 7. Background patterns — chick on each pattern, then patterns clipped to other shapes
h+='<h2>7 · Background patterns — chick on each pattern (circle / mint), then patterns clipped to other shapes</h2>'+grid(
  LOOK_BG_PATTERNS.map(pt=>'<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'circle',color:'mint',effect:'plain',pattern:pt}},'#ffb020',120)+'</div><div class="lab">'+(pt||'none')+'</div></div>')
  .concat([
    '<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'heart',color:'pink',effect:'plain',pattern:'stripes'}},'#ffb020',120)+'</div><div class="lab">heart / pink / stripes</div></div>',
    '<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'star',color:'sky',effect:'plain',pattern:'hearts'}},'#ffb020',120)+'</div><div class="lab">star / sky / hearts</div></div>',
    '<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'cloud',color:'lilac',effect:'plain',pattern:'dots'}},'#ffb020',120)+'</div><div class="lab">cloud / lilac / dots</div></div>',
    '<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'flower',color:'peach',effect:'plain',pattern:'stars'}},'#ffb020',120)+'</div><div class="lab">flower / peach / stars</div></div>'
  ])
);
// 8. Tap to play — frozen mid-jump
h+='<h2>8 · Tap to play — frozen mid-jump (the trick, paused at 0.35s so the still shows it)</h2><div class="closeup">'
 +playCell('🐤',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'Chick — happy jump + sparkle burst')
 +playCell('🐸',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'Frog — hops higher')
 +playCell('🐰',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'Rabbit — jump + fast ear wiggle')
 +'</div>';
// 9. Crocodile — long and horizontal, like the sheet
h+='<h2>9 · Crocodile — long and horizontal, like the sheet (alone and on its background)</h2><div class="closeup">'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐊',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Crocodile — long body, tail to the side, back spikes</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐊',{background:{shape:'heart',color:'pink',effect:'glitter',pattern:''}},'#ffb020',260)+'</div><div class="lab">Crocodile — heart / pink / glitter</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐊',{background:{shape:'star',color:'sky',effect:'bubbles',pattern:''}},'#ffb020',260)+'</div><div class="lab">Crocodile — star / sky / bubbles</div></div>'
 +'</div>';
// 10. Close-ups — a few animals large, next to the sheet for comparison
h+='<h2>10 · Close-ups — a few animals large, next to the sheet for comparison</h2><div><p class="note">The reference sheet (the only target — the animals must match it as closely as SVG allows):</p><img class="sheet" src="reference-sheet.png" alt="Reference sheet: 25 kawaii animals"><div class="closeup" style="margin-top:16px">'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐸',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Frog — big eye bumps, wide smile</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐢',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Turtle — green head, brown shell</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐼',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Panda — big eye patches</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐰',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Rabbit — long ears, buck teeth</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🦊',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Fox — bushy tail, white tip</div></div>'
 +'</div></div>'
// 11. Animation, live on this page
 +'<h2>11 · Idle life — live on this page (bobbing, blinking, signature motions)</h2><div class="closeup">'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Chick — bob + blink</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐸',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Frog — hop-bob + blink</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐰',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',260)+'</div><div class="lab">Rabbit — ear wiggle + blink</div></div>'
 +'</div></body></html>';
fs.writeFileSync('preview-5.html',h);
console.log('preview-5.html written,', h.length, 'bytes');

// Animation proof page: frog, rabbit and chick, large, with all
// animations paused on load so the shooter can seek each one to an
// exact phase (Web Animations API) and capture it deterministically.
let a='<!doctype html><html><head><meta charset="utf-8"><style>'+PAGE_CSS+AVATAR_5_CSS+'.animrow{display:flex;gap:20px}.animrow .cell{flex:1}</style></head><body>'
 +'<h1>Round 5 — animation proof (frog, rabbit, chick)</h1>'
 +'<p class="note">Frames are captured by seeking the real CSS animations (Web Animations API) and pausing them — so the blink, a 0.14s event in a 4.6s cycle, can be seen at all. Frame 1: blink closed, bob low, frog at the bottom of its hop. Frame 2: eyes open, bob rising, rabbit ears mid-wiggle. Frame 3: eyes open, frog at the top of its hop, bob at the top.</p>'
 +'<div class="animrow">'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐸',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',300)+'</div><div class="lab">Frog</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐰',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',300)+'</div><div class="lab">Rabbit</div></div>'
 +'<div class="cell"><div class="art">'+avatarLookHTML('🐤',{background:{shape:'circle',color:'mint',effect:'plain',pattern:''}},'#ffb020',300)+'</div><div class="lab">Chick</div></div>'
 +'</div><script>document.getAnimations().forEach(function(an){an.pause();});</script></body></html>';
fs.writeFileSync('anim-proof-5.html',a);
console.log('anim-proof-5.html written,', a.length, 'bytes');
