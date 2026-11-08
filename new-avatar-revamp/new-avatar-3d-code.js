/* ============================================================
   FULL-BODY LOOK — ROUND 3 (3D, Pip-style, 2026-11-08): the same
   12 complete full-body animals as round 2 (body IS the animal,
   whole-animal colour, no hair, tiny accessories), rebuilt as
   3D-looking characters in the house style — the same language
   as Pip's 3D otter and the live frog:
     • one light source, top-left (the frog's fgBack gradient:
       cx 38% cy 30%): every big form is a radial gradient,
       light at the top-left, the animal's own colour in the
       middle, a darker edge at the bottom and sides;
     • a soft white sheen where the light hits (Pip's
       .otter-shine diagonal, as a radial white fade);
     • a darker crease where the head meets the body, so the
       head sits INTO the body instead of floating on it;
     • layered depth: tails and far ears behind, arms and feet
       in front, a soft radial ground shadow;
     • glossy eyes with an iris and two catchlights (the live
       frog's eye: white, iris, pupil, white dot).
   COLOUR: the gradients are derived from the chosen colour, so
   a pink otter is a pink 3D otter — its shadows, highlights and
   belly follow the colour. Natural = the animal's own colour;
   the dark edge is always a shade of the main colour (never the
   animal's dark accent — the panda's body edge is grey, not
   black), while natDark stays for the animal's own dark parts
   (panda's patches, turtle's shell, lion's mane).
   ANIMATION (CSS only, classes in AVATAR_3D_CSS): gentle
   bobbing, blinking every few seconds, and one signature motion
   per animal — all slow and calm, transform/opacity only, so a
   child feels the animal is alive, not dancing. The svg carries
   class="av3d", so the rules only touch avatar characters.
   GEOMETRY: the round-2 coordinates are unchanged — every
   approved shape (rabbit's long ears, turtle's shell, otter's
   whiskers) stays exactly where the child-behaviour screen
   approved it. Only the fills, the layering and the motion
   are new. Stored as e.look={color,accessory}, stamped by
   e.lookAt, merged later-wins. */
var LOOK_COLORS=['','#ff8fa3','#ffb020','#2dd4bf','#7db4ff','#c084fc','#8b5e3c'];
/* Mix a hex colour toward white (f>0) or black (f<0). */
function shade(hex,f){
  var n=parseInt(hex.slice(1),16), r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  var t=f<0?0:255, p=Math.abs(f);
  r=Math.round(r+(t-r)*p); g=Math.round(g+(t-g)*p); b=Math.round(b+(t-b)*p);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
/* Whole-animal palette for one look: main is the picked colour or
   the animal's own natural colour; hi/edge are the gradient ends
   (always shades of main, so the body edge never goes black on a
   pale animal); dark is the animal's own dark accent (panda's
   black, turtle's shell green, lion's mane) for its dark parts. */
function lookPal(color, nat, natDark){
  var main=color||nat;
  var dark=color?shade(main,-0.38):natDark;
  return {main:main, light:shade(main,0.62), lighter:shade(main,0.82),
    dark:dark, dark2:shade(dark,0.15), dark3:shade(dark,-0.22),
    hi:shade(main,0.42), edge:shade(main,-0.30), deep:shade(dark,-0.18),
    bellyEnd:shade(main,0.25),
    ink:'#26221f', white:'#ffffff', nat:!color};
}
/* A soft white sheen where the top-left light hits the form. */
function avSheen(u,cx,cy,rx,ry,op,rot){
  return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="url(#gGl'+u+')" opacity="'+op+'"'+(rot?' transform="rotate('+rot+' '+cx+' '+cy+')"':'')+'/>';
}
/* The darker crease under the chin, where the head meets the body. */
function avCrease(cx,cy,rx,ry){
  return '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="#000000" opacity="0.10"/>';
}
/* Big glossy kawaii eyes (the live frog's eye: white, iris, pupil,
   two catchlights), wrapped in the blink group. p.bdelay staggers
   the blink so a page of animals never blinks in lockstep. */
function avEyes(p){
  var d=p?p.bdelay:'-0.4s';
  return '<g class="av-blink" style="animation-delay:'+d+'">'
  +'<ellipse cx="82" cy="74" rx="10" ry="12" fill="#ffffff"/><ellipse cx="118" cy="74" rx="10" ry="12" fill="#ffffff"/>'
  +'<circle cx="83" cy="76" r="6.5" fill="#7a4a21"/><circle cx="117" cy="76" r="6.5" fill="#7a4a21"/>'
  +'<circle cx="83" cy="77" r="3.6" fill="#26221f"/><circle cx="117" cy="77" r="3.6" fill="#26221f"/>'
  +'<circle cx="85.5" cy="70.5" r="2.4" fill="#ffffff"/><circle cx="114.5" cy="70.5" r="2.4" fill="#ffffff"/>'
  +'<circle cx="80.5" cy="79" r="1.2" fill="#ffffff" opacity=".85"/><circle cx="114.5" cy="79" r="1.2" fill="#ffffff" opacity=".85"/>'
  +'</g>';
}
function avSmile(cx,cy,w){
  return '<path d="M'+(cx-w)+','+cy+' Q'+cx+','+(cy+8)+' '+(cx+w)+','+cy+'" fill="none" stroke="#26221f" stroke-width="2.5" stroke-linecap="round"/>';
}
/* One complete character per animal. Each draw(p) returns the whole
   animal — body, head, ears, tail, face — in its own shape, in the
   palette's colours. p.uid is this render's gradient suffix; the
   gradients live in the <defs> avatarLookHTML writes. nat = its
   own natural main colour. */
var AVATAR_ANIMALS={
 otter:{nat:'#b08968',natDark:'#8a6a4a',draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M146,184 C166,178 176,166 174,154 C172,146 162,148 156,156 C148,166 144,174 144,184 Z" fill="url(#gD'+u+')"/></g>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,118,30,8)
  +'<circle cx="56" cy="52" r="7" fill="url(#gB'+u+')"/><circle cx="56" cy="52" r="3.5" fill="'+p.dark+'"/><circle cx="144" cy="52" r="7" fill="url(#gB'+u+')"/><circle cx="144" cy="52" r="3.5" fill="'+p.dark+'"/>'
  +'<ellipse cx="100" cy="78" rx="49" ry="44" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +'<ellipse cx="100" cy="96" rx="26" ry="12" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="'+p.ink+'"/>'+avSmile(100,98,12)
  +'<path d="M62,86 L79,89 M60,95 L78,94 M64,103 L80,98 M138,86 L121,89 M140,95 L122,94 M136,103 L120,98" fill="none" stroke="rgba(74,44,26,0.5)" stroke-width="1.5" stroke-linecap="round"/>'; }},
 frog:{nat:'#58b368',natDark:'#2f7a3d',bob:'av-hop',draw:function(p){
  var u=p.uid;
  return '<ellipse cx="100" cy="178" rx="52" ry="48" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,72,158,16,20,0.35,-14)
  +'<ellipse cx="100" cy="188" rx="34" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="52" cy="176" rx="8" ry="20" transform="rotate(-15 52 176)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="148" cy="176" rx="8" ry="20" transform="rotate(15 148 176)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="66" cy="228" rx="16" ry="9" fill="'+p.dark+'"/><ellipse cx="134" cy="228" rx="16" ry="9" fill="'+p.dark+'"/>'
  +avCrease(100,130,28,7)
  +'<circle cx="100" cy="84" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,78,60,18,11,0.5,-20)
  +'<g class="av-blink" style="animation-delay:'+p.bdelay+'">'
  +'<circle cx="70" cy="46" r="15" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><circle cx="130" cy="46" r="15" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<circle cx="70" cy="46" r="10" fill="#ffffff"/><circle cx="130" cy="46" r="10" fill="#ffffff"/>'
  +'<circle cx="70" cy="46" r="7" fill="#3a7d2c"/><circle cx="130" cy="46" r="7" fill="#3a7d2c"/>'
  +'<circle cx="71" cy="48" r="4" fill="#26221f"/><circle cx="131" cy="48" r="4" fill="#26221f"/>'
  +'<circle cx="73" cy="41" r="2.6" fill="#ffffff"/><circle cx="133" cy="41" r="2.6" fill="#ffffff"/>'
  +'</g>'
  +'<circle cx="66" cy="92" r="6" fill="'+p.light+'" opacity="0.7"/><circle cx="134" cy="92" r="6" fill="'+p.light+'" opacity="0.7"/>'
  +'<circle cx="92" cy="86" r="1.8" fill="'+p.dark+'"/><circle cx="108" cy="86" r="1.8" fill="'+p.dark+'"/><path d="M72,96 Q100,112 128,96" fill="none" stroke="'+p.dark+'" stroke-width="3" stroke-linecap="round"/>'; }},
 butterfly:{nat:'#f7a8d8',natDark:'#c96ba0',draw:function(p){
  var u=p.uid;
  return '<g class="av-flutter-l">'
  +'<ellipse cx="50" cy="118" rx="30" ry="42" transform="rotate(-24 50 118)" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/><ellipse cx="58" cy="184" rx="22" ry="28" transform="rotate(-16 58 184)" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/>'
  +'<circle cx="44" cy="108" r="6" fill="'+p.light+'"/><circle cx="58" cy="128" r="4" fill="'+p.light+'"/>'
  +'</g><g class="av-flutter-r">'
  +'<ellipse cx="150" cy="118" rx="30" ry="42" transform="rotate(24 150 118)" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/><ellipse cx="142" cy="184" rx="22" ry="28" transform="rotate(16 142 184)" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/>'
  +'<circle cx="156" cy="108" r="6" fill="'+p.light+'"/><circle cx="142" cy="128" r="4" fill="'+p.light+'"/>'
  +'</g>'
  +'<ellipse cx="100" cy="172" rx="16" ry="36" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="100" cy="172" rx="9" ry="30" fill="url(#gBel'+u+')" opacity="0.6"/>'
  +'<ellipse cx="90" cy="210" rx="7" ry="5" fill="'+p.dark+'"/><ellipse cx="110" cy="210" rx="7" ry="5" fill="'+p.dark+'"/>'
  +'<path d="M88,40 Q80,20 72,12" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/><path d="M112,40 Q120,20 128,12" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="12" r="3.5" fill="'+p.dark+'"/><circle cx="128" cy="12" r="3.5" fill="'+p.dark+'"/>'
  +'<circle cx="100" cy="76" r="40" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,78,54,16,10,0.5,-20)
  +avEyes(p)
  +'<path d="M74,54 L70,48 M82,52 L80,45 M118,52 L120,45 M126,54 L130,48" fill="none" stroke="#26221f" stroke-width="2" stroke-linecap="round"/>'
  +'<circle cx="100" cy="84" r="2" fill="'+p.dark+'"/>'+avSmile(100,92,8); }},
 cat:{nat:'#f6b73c',natDark:'#d98a1f',draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M148,196 C170,192 180,172 172,154 C168,144 158,146 158,156 C158,168 150,180 140,186 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/></g>'
  +'<path d="M100,118 C132,118 150,144 150,174 C150,206 128,230 100,230 C72,230 50,206 50,174 C50,144 68,118 100,118 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="190" rx="28" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="78" cy="222" rx="12" ry="7" fill="'+p.light+'"/><ellipse cx="122" cy="222" rx="12" ry="7" fill="'+p.light+'"/>'
  +avCrease(100,118,30,8)
  +'<path d="M62,42 L56,10 L86,30 Z" fill="url(#gB'+u+')"/><path d="M63,36 L60,18 L78,29 Z" fill="'+p.light+'"/><path d="M138,42 L144,10 L114,30 Z" fill="url(#gB'+u+')"/><path d="M137,36 L140,18 L122,29 Z" fill="'+p.light+'"/>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avEyes(p)
  +'<path d="M94,84 L106,84 L100,90 Z" fill="#e88aa0"/>'+avSmile(100,94,12)
  +'<path d="M58,88 L76,90 M58,96 L76,94 M142,88 L124,90 M142,96 L124,94" stroke="rgba(0,0,0,0.30)" stroke-width="1.5" stroke-linecap="round"/>'; }},
 dog:{nat:'#c68a4b',natDark:'#8a5a2e',draw:function(p){
  var u=p.uid;
  return '<path d="M52,170 C40,162 36,148 44,140 C50,134 56,140 54,150 C52,160 56,166 60,170 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,118,30,8)
  +'<g class="av-earwig"><ellipse cx="56" cy="66" rx="10" ry="24" transform="rotate(14 56 66)" fill="url(#gD'+u+')"/><ellipse cx="144" cy="66" rx="10" ry="24" transform="rotate(-14 144 66)" fill="url(#gD'+u+')"/></g>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +'<ellipse cx="100" cy="96" rx="20" ry="13" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="7" ry="5" fill="'+p.ink+'"/><path d="M88,94 Q100,102 112,94" fill="none" stroke="'+p.ink+'" stroke-width="2.5" stroke-linecap="round"/><g class="av-tongue"><rect x="92" y="100" width="16" height="14" rx="8" fill="#f08ba0"/><path d="M100,102 L100,112" stroke="#d96a86" stroke-width="1.5" stroke-linecap="round"/></g>'; }},
 rabbit:{nat:'#f2f2f2',natDark:'#cfc9bd',draw:function(p){
  var u=p.uid;
  var inner=p.nat?'#f6b8c1':p.light;
  return '<circle cx="42" cy="196" r="12" fill="#ffffff" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>'
  +'<ellipse cx="100" cy="174" rx="50" ry="50" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,152,16,20,0.35,-12)
  +'<ellipse cx="100" cy="186" rx="32" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="70" cy="228" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="130" cy="228" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,126,28,7)
  +'<g class="av-earwig"><ellipse cx="76" cy="35" rx="9" ry="32" transform="rotate(-7 76 35)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/><ellipse cx="76" cy="37" rx="4.5" ry="22" transform="rotate(-7 76 37)" fill="'+inner+'"/><ellipse cx="124" cy="35" rx="9" ry="32" transform="rotate(7 124 35)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/><ellipse cx="124" cy="37" rx="4.5" ry="22" transform="rotate(7 124 37)" fill="'+inner+'"/></g>'
  +'<circle cx="100" cy="84" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,58,18,11,0.5,-20)
  +avEyes(p)
  +'<path d="M94,84 L106,84 L100,89 Z" fill="#e88aa0"/><path d="M100,89 Q96,95 92,92 M100,89 Q104,95 108,92" fill="none" stroke="#8a6a4a" stroke-width="2.5" stroke-linecap="round"/><rect x="94" y="96" width="5.5" height="8" rx="2" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1"/><rect x="100.5" y="96" width="5.5" height="8" rx="2" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>'; }},
 lion:{nat:'#f7c873',natDark:'#d97f2b',draw:function(p){
  var u=p.uid;
  return '<path d="M148,192 C168,188 178,172 172,158" fill="none" stroke="url(#gB'+u+')" stroke-width="7" stroke-linecap="round"/><circle cx="172" cy="156" r="10" fill="url(#gD'+u+')"/>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,118,30,8)
  +'<g class="av-nod">'
  +'<circle cx="100" cy="78" r="58" fill="url(#gD'+u+')"/><circle cx="100" cy="78" r="52" fill="'+p.dark2+'"/>'
  +'<circle cx="64" cy="36" r="8" fill="url(#gB'+u+')"/><circle cx="136" cy="36" r="8" fill="url(#gB'+u+')"/>'
  +'<circle cx="100" cy="78" r="42" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,78,56,18,11,0.5,-20)
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="7" ry="5" fill="#8a5a2e"/>'+avSmile(100,96,12)
  +'</g>'; }},
 panda:{nat:'#f5f2ea',natDark:'#26221f',draw:function(p){
  var u=p.uid;
  return '<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gD'+u+')"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gD'+u+')"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,118,30,8)
  +'<g class="av-earwig"><circle cx="60" cy="42" r="11" fill="url(#gD'+u+')"/><circle cx="140" cy="42" r="11" fill="url(#gD'+u+')"/></g>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +'<g class="av-blink" style="animation-delay:'+p.bdelay+'">'
  +'<ellipse cx="82" cy="74" rx="12" ry="15" transform="rotate(-12 82 74)" fill="'+p.dark+'"/><ellipse cx="118" cy="74" rx="12" ry="15" transform="rotate(12 118 74)" fill="'+p.dark+'"/>'
  +'<ellipse cx="82" cy="74" rx="6.5" ry="8" fill="#ffffff"/><ellipse cx="118" cy="74" rx="6.5" ry="8" fill="#ffffff"/><circle cx="82" cy="76" r="3.5" fill="#26221f"/><circle cx="118" cy="76" r="3.5" fill="#26221f"/><circle cx="84" cy="71" r="1.5" fill="#ffffff"/><circle cx="116" cy="71" r="1.5" fill="#ffffff"/>'
  +'</g>'
  +'<ellipse cx="100" cy="90" rx="6" ry="4.5" fill="#26221f"/>'+avSmile(100,98,10); }},
 fox:{nat:'#e8743c',natDark:'#c25a2e',draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M146,182 C174,172 188,142 178,118 C172,102 156,104 154,120 C152,138 142,158 136,172 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="170" cy="118" rx="11" ry="15" transform="rotate(18 170 118)" fill="'+p.light+'"/></g>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,118,30,8)
  +'<path d="M60,44 L54,8 L88,30 Z" fill="url(#gB'+u+')"/><path d="M62,36 L59,17 L80,29 Z" fill="'+p.light+'"/><path d="M140,44 L146,8 L112,30 Z" fill="url(#gB'+u+')"/><path d="M138,36 L141,17 L120,29 Z" fill="'+p.light+'"/>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +'<ellipse cx="100" cy="96" rx="22" ry="13" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="'+p.ink+'"/>'+avSmile(100,97,12); }},
 turtle:{nat:'#93cf6b',natDark:'#4e8f4c',draw:function(p){
  var u=p.uid;
  return '<ellipse cx="58" cy="228" rx="10" ry="7" fill="'+p.dark+'"/><ellipse cx="84" cy="231" rx="10" ry="7" fill="'+p.dark+'"/><ellipse cx="116" cy="231" rx="10" ry="7" fill="'+p.dark+'"/><ellipse cx="142" cy="228" rx="10" ry="7" fill="'+p.dark+'"/>'
  +'<path d="M100,100 C142,100 160,136 160,176 C160,206 134,228 100,228 C66,228 40,206 40,176 C40,136 58,100 100,100 Z" fill="url(#gD'+u+')" stroke="rgba(0,0,0,0.12)" stroke-width="2"/>'
  +avSheen(u,70,140,18,14,0.4,-16)
  +'<path d="M100,104 L100,126 M76,114 Q70,136 70,156 M124,114 Q130,136 130,156 M60,156 Q100,144 140,156 M52,182 Q100,170 148,182" fill="none" stroke="'+p.dark3+'" stroke-width="2" stroke-linecap="round"/>'
  +'<g class="av-nod">'
  +'<circle cx="100" cy="78" r="34" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,80,58,13,8,0.5,-20)
  +'<g class="av-blink" style="animation-delay:'+p.bdelay+'">'
  +'<ellipse cx="88" cy="74" rx="8" ry="10" fill="#ffffff"/><ellipse cx="112" cy="74" rx="8" ry="10" fill="#ffffff"/>'
  +'<circle cx="89" cy="76" r="5" fill="#6b4226"/><circle cx="111" cy="76" r="5" fill="#6b4226"/>'
  +'<circle cx="89" cy="77" r="2.8" fill="#26221f"/><circle cx="111" cy="77" r="2.8" fill="#26221f"/>'
  +'<circle cx="90.5" cy="71" r="1.8" fill="#ffffff"/><circle cx="110" cy="71" r="1.8" fill="#ffffff"/>'
  +'</g>'
  +'<circle cx="94" cy="84" r="1.5" fill="'+p.dark+'"/><circle cx="106" cy="84" r="1.5" fill="'+p.dark+'"/><path d="M88,90 Q100,96 112,90" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/>'
  +'</g>'; }},
 pig:{nat:'#f6b8c1',natDark:'#e88aa0',draw:function(p){
  var u=p.uid;
  return '<path d="M152,176 q14,-6 12,4 q-2,9 -11,5" fill="none" stroke="'+p.dark+'" stroke-width="3" stroke-linecap="round"/>'
  +'<ellipse cx="100" cy="172" rx="52" ry="50" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,72,150,16,20,0.35,-12)
  +'<ellipse cx="100" cy="184" rx="34" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="70" cy="228" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="130" cy="228" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,120,28,7)
  +'<g class="av-flop"><circle cx="62" cy="42" r="10" fill="url(#gB'+u+')"/><circle cx="62" cy="42" r="5" fill="'+p.dark+'"/><circle cx="138" cy="42" r="10" fill="url(#gB'+u+')"/><circle cx="138" cy="42" r="5" fill="'+p.dark+'"/></g>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avEyes(p)
  +'<ellipse cx="100" cy="90" rx="16" ry="12" fill="url(#gD'+u+')"/><ellipse cx="94" cy="90" rx="2.5" ry="3.5" fill="'+p.ink+'" opacity="0.55"/><ellipse cx="106" cy="90" rx="2.5" ry="3.5" fill="'+p.ink+'" opacity="0.55"/>'
  +'<path d="M90,104 Q100,109 110,104" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/>'; }},
 monkey:{nat:'#c68a4b',natDark:'#8a5a2e',draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M54,192 C30,188 22,166 32,152 C38,144 48,148 46,158 C44,170 52,178 60,182 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/></g>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +avCrease(100,118,30,8)
  +'<circle cx="58" cy="74" r="11" fill="url(#gD'+u+')"/><circle cx="58" cy="74" r="6" fill="'+p.light+'"/><circle cx="142" cy="74" r="11" fill="url(#gD'+u+')"/><circle cx="142" cy="74" r="6" fill="'+p.light+'"/>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +'<ellipse cx="100" cy="82" rx="34" ry="36" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<circle cx="94" cy="88" r="2" fill="#8a5a2e"/><circle cx="106" cy="88" r="2" fill="#8a5a2e"/>'+avSmile(100,96,12); }}
};
var AVATAR_FACE_EMOJI={'🦦':'otter','🐸':'frog','🦋':'butterfly','🐱':'cat','🐶':'dog','🐰':'rabbit','🦁':'lion','🐼':'panda','🦊':'fox','🐢':'turtle','🐷':'pig','🐵':'monkey'};
/* TINY accessories — small touches only, drawn last, inside the
   bob group so they ride the animal. None covers the face or
   changes the silhouette: the necklace hugs the neck, the hat
   sits tilted on the top of the head, the flower tucks beside
   the left ear, the star clips beside the right ear, the bow
   sits at the neck. */
var LOOK_ACCS=['','necklace','tinyhat','flower','star','bow'];
var LOOK_ACC_EMOJI={necklace:'📿',tinyhat:'🎩',flower:'🌸',star:'⭐',bow:'🎀'};
var LOOK_ACC_LABELS={necklace:'Necklace',tinyhat:'Tiny hat',flower:'Flower',star:'Star',bow:'Little bow'};
var AVATAR_ACCS={
 necklace:'<path d="M84,122 Q100,136 116,122" fill="none" stroke="#eab308" stroke-width="2.5" stroke-linecap="round"/><circle cx="88" cy="127" r="2.6" fill="#ef4444"/><circle cx="94" cy="130" r="2.6" fill="#3b82f6"/><circle cx="100" cy="131" r="3.4" fill="#ef4444"/><circle cx="106" cy="130" r="2.6" fill="#22c55e"/><circle cx="112" cy="127" r="2.6" fill="#ef4444"/>',
 tinyhat:'<g transform="rotate(14 100 24)"><ellipse cx="100" cy="30" rx="17" ry="3.5" fill="#6d28d9"/><path d="M90,29 L90,12 Q90,8 94,8 L106,8 Q110,8 110,12 L110,29 Z" fill="#8b5cf6"/><rect x="90" y="23" width="20" height="4" fill="#ffd166"/></g>',
 flower:'<g><circle cx="56" cy="44" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="64" cy="48" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="62" cy="56" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="54" cy="56" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="52" cy="48" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="58" cy="50" r="3.4" fill="#ffd166"/></g>',
 star:'<path d="M142,44 L144.5,50 L151,50.5 L146,55 L147.5,61.5 L142,58 L136.5,61.5 L138,55 L133,50.5 L139.5,50 Z" fill="#ffd166" stroke="#e8a100" stroke-width="1.2" stroke-linejoin="round"/>',
 bow:'<path d="M100,124 L84,116 L84,132 Z" fill="#ef4444"/><path d="M100,124 L116,116 L116,132 Z" fill="#ef4444"/><circle cx="100" cy="124" r="4" fill="#dc2626"/>'};
/* Gradient ids must be unique per svg on the page (a matrix shows
   36+ characters at once), so every render takes a fresh number. */
var avUid=0;
/* One complete character: soft radial ground shadow, the animal
   itself (its own body, head, ears, tail and face, 3D-shaded),
   then one tiny accessory riding along inside the bob group.
   A look with a stored hair value is NEVER read — a saved hair
   value is ignored. glow is accepted for call-site compatibility
   and ignored: the character's Natural colour is its own.
   w = display width in px (default 190); height follows the
   200x260 grid. Tolerates a missing look (legacy explorers) and
   an unknown face (otter). */
function avatarLookHTML(face, look, glow, w){
  look=look||{};
  var acc=look.accessory||'';
  var key=AVATAR_FACE_EMOJI[face]||'otter';
  var a=AVATAR_ANIMALS[key];
  var pal=lookPal(look.color||'', a.nat, a.natDark);
  var u=++avUid;
  pal.uid=u;
  var keys=Object.keys(AVATAR_ANIMALS);
  var idx=keys.indexOf(key);
  pal.bdelay=(-(idx*0.9+0.4)).toFixed(2)+'s';
  var bobDelay=(-(idx*0.55)).toFixed(2)+'s';
  var wpx=w||190, hpx=Math.round(wpx*260/200);
  var defs='<defs>'
   +'<radialGradient id="gB'+u+'" cx="38%" cy="28%" r="78%"><stop offset="0%" stop-color="'+pal.hi+'"/><stop offset="48%" stop-color="'+pal.main+'"/><stop offset="100%" stop-color="'+pal.edge+'"/></radialGradient>'
   +'<radialGradient id="gH'+u+'" cx="40%" cy="26%" r="75%"><stop offset="0%" stop-color="'+pal.lighter+'"/><stop offset="55%" stop-color="'+pal.main+'"/><stop offset="100%" stop-color="'+pal.edge+'"/></radialGradient>'
   +'<radialGradient id="gBel'+u+'" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="'+pal.lighter+'"/><stop offset="100%" stop-color="'+pal.bellyEnd+'"/></radialGradient>'
   +'<radialGradient id="gD'+u+'" cx="40%" cy="30%" r="78%"><stop offset="0%" stop-color="'+shade(pal.dark,0.28)+'"/><stop offset="55%" stop-color="'+pal.dark+'"/><stop offset="100%" stop-color="'+shade(pal.dark,-0.28)+'"/></radialGradient>'
   +'<radialGradient id="gSh'+u+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>'
   +'<radialGradient id="gGl'+u+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,255,255,0.55)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>'
   +'</defs>';
  return '<svg class="av3d" viewBox="0 0 200 260" data-animal="'+key+'" style="width:'+wpx+'px;height:'+hpx+'px;display:block;margin:0 auto" role="img" aria-label="My animal friend, the '+key+'">'
   +defs
   +'<ellipse cx="100" cy="246" rx="56" ry="9" fill="url(#gSh'+u+')"/>'
   +'<g class="'+(a.bob||'av-bob')+'" style="animation-delay:'+bobDelay+'">'
   +a.draw(pal)
   +(AVATAR_ACCS[acc]?'<g id="avatar-acc">'+AVATAR_ACCS[acc]+'</g>':'')
   +'</g></svg>';
}
/* The idle-life CSS (round 3). Same language as Pip's otterFloat /
   otterBlink / earWig and the frog's frogBlink / frogBreathe:
   slow, calm, transform and opacity only. The svg carries
   class="av3d", so these rules only touch avatar characters.
   Blink and bob delays are staggered per animal (inline style),
   so a page of animals never moves in lockstep. */
var AVATAR_3D_CSS=`
.av3d .av-bob{transform-box:fill-box;transform-origin:50% 100%;animation:avBob 3.6s ease-in-out infinite}
@keyframes avBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}
.av3d .av-blink{transform-box:fill-box;transform-origin:center;animation:avBlink 4.6s infinite}
@keyframes avBlink{0%,90%,100%{transform:scaleY(1)}93%{transform:scaleY(.08)}}
.av3d .av-earwig{transform-box:fill-box;transform-origin:50% 100%;animation:avEarWig 5s ease-in-out infinite}
@keyframes avEarWig{0%,86%,100%{transform:rotate(0)}90%{transform:rotate(-8deg)}94%{transform:rotate(6deg)}}
.av3d .av-sway{transform-box:fill-box;transform-origin:50% 0;animation:avSway 3.8s ease-in-out infinite}
@keyframes avSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
.av3d .av-flutter-l{transform-box:fill-box;transform-origin:100% 50%;animation:avFlutter 1.6s ease-in-out infinite}
.av3d .av-flutter-r{transform-box:fill-box;transform-origin:0% 50%;animation:avFlutter 1.6s ease-in-out infinite}
@keyframes avFlutter{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.72)}}
.av3d .av-hop{transform-box:fill-box;transform-origin:50% 100%;animation:avHop 2.8s ease-in-out infinite}
@keyframes avHop{0%,78%,100%{transform:translateY(0) scale(1,1)}86%{transform:translateY(-7px) scale(.98,1.04)}92%{transform:translateY(0) scale(1.05,.94)}}
.av3d .av-nod{transform-box:fill-box;transform-origin:50% 100%;animation:avNod 4.2s ease-in-out infinite}
@keyframes avNod{0%,84%,100%{transform:translateY(0)}88%{transform:translateY(2px)}92%{transform:translateY(0)}}
.av3d .av-tongue{transform-box:fill-box;transform-origin:50% 0;animation:avTongue 3.4s ease-in-out infinite}
@keyframes avTongue{0%,100%{transform:rotate(-2deg) scaleY(1)}50%{transform:rotate(3deg) scaleY(1.1)}}
.av3d .av-flop{transform-box:fill-box;transform-origin:50% 0;animation:avFlop 4.4s ease-in-out infinite}
@keyframes avFlop{0%,82%,100%{transform:rotate(0)}88%{transform:rotate(-10deg)}94%{transform:rotate(7deg)}}
@media (prefers-reduced-motion: reduce){.av3d .av-bob,.av3d .av-blink,.av3d .av-earwig,.av3d .av-sway,.av3d .av-flutter-l,.av3d .av-flutter-r,.av3d .av-hop,.av3d .av-nod,.av3d .av-tongue,.av3d .av-flop{animation:none}}
`;
