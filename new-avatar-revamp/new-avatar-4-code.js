/* ============================================================
   FULL-BODY LOOK — ROUND 4 (realistic fur, texture, depth,
   2026-11-08): the same 12 complete full-body animals as
   round 3 (body IS the animal, whole-animal colour, no hair,
   tiny accessories, idle life), pushed further toward
   realistic, like Mira — the rendered 3D otter with soft
   visible fur, layered depth and glossy dimensional eyes.
   The parent asked for it directly: "change the frog,
   butterfly, tortoise, panda. make them cuter. all animals
   become more realistic like mira. Textures, fur, depth."
     • FUR: fine strand strokes following the fur flow,
       plus short tuft strokes at the silhouette — cheeks,
       chest, ear tips, tail tips — so the edge reads fuzzy,
       not cut-out; a faint feTurbulence grain over the body
       and head of furry animals (one filter per render) for
       a soft furry surface;
     • DEPTH: rim light along the top-left edge, ambient
       occlusion where limbs meet the body, deeper gradients,
       toe lines on the feet, dimensional noses;
     • EYES: iris rim + inner ring + an upper-lid shadow, so
       the eyes sit IN the face instead of on it.
   FOCUS FOUR — visibly reworked, cuter and more realistic:
   the FROG (bigger eyes, skin bumps, wider smile, toe pads),
   the BUTTERFLY (scalloped patterned wings with veins,
   slimmer segmented body, longer antennae), the TURTLE
   (real scute pattern with borders and a rim, bigger eyes)
   and the PANDA (fur tufts on the black patches, bigger
   warmer eyes, soft white fur).
   COLOUR: the gradients are derived from the chosen colour,
   so a pink otter is a pink furry otter — its fur, shadows
   and belly follow the colour. Natural = the animal's own
   colour; the dark edge is always a shade of the main colour
   (never the animal's dark accent — the panda's body edge is
   grey, not black), while natDark stays for the animal's own
   dark parts (panda's patches, turtle's shell, lion's mane).
   ANIMATION (CSS only, classes in AVATAR_3D_CSS): gentle
   bobbing, blinking every few seconds, and one signature
   motion per animal — all slow and calm, transform/opacity
   only, so a child feels the animal is alive, not dancing.
   The svg carries class="av3d", so the rules only touch
   avatar characters.
   GEOMETRY: the round-3 coordinates are the base; only the
   focus four and the otter's arms change shape (see
   design-4.md). Stored as e.look={color,accessory}, stamped
   by e.lookAt, merged later-wins. */
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
    fur:shade(main,-0.18), furHi:shade(main,0.38),
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
/* A rim-light arc along the top-left edge of a form, in a lighter
   shade of the animal's colour. */
function avRim(d,col){
  return '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="3" stroke-linecap="round" opacity="0.5"/>';
}
/* Fur: tufts and strands. Wrapped in class="av-fur" so tests can
   find them. Tufts are short strokes that cross the silhouette a
   little — fur is fuzzy at the edge, not cut out. Strands stay
   inside the form, following the fur flow. */
function avFur(s){
  return '<g class="av-fur" fill="none" stroke-linecap="round">'+s+'</g>';
}
/* Big glossy kawaii eyes (the live frog's eye: white, iris, pupil,
   two catchlights), wrapped in the blink group. Round 4 adds an
   iris rim, a lighter inner ring and an upper-lid shadow, so the
   eyes sit IN the face. p.bdelay staggers the blink so a page of
   animals never blinks in lockstep. */
function avEyes(p){
  var d=p?p.bdelay:'-0.4s';
  return '<g class="av-blink" style="animation-delay:'+d+'">'
  +'<ellipse cx="82" cy="74" rx="10" ry="12" fill="#ffffff"/><ellipse cx="118" cy="74" rx="10" ry="12" fill="#ffffff"/>'
  +'<circle cx="83" cy="76" r="6.5" fill="#7a4a21"/><circle cx="117" cy="76" r="6.5" fill="#7a4a21"/>'
  +'<circle cx="83" cy="76" r="6.5" fill="none" stroke="#4a2c14" stroke-width="1"/><circle cx="117" cy="76" r="6.5" fill="none" stroke="#4a2c14" stroke-width="1"/>'
  +'<circle cx="83" cy="76" r="4.5" fill="none" stroke="#a06a35" stroke-width="1" opacity="0.7"/><circle cx="117" cy="76" r="4.5" fill="none" stroke="#a06a35" stroke-width="1" opacity="0.7"/>'
  +'<circle cx="83" cy="77" r="3.6" fill="#26221f"/><circle cx="117" cy="77" r="3.6" fill="#26221f"/>'
  +'<circle cx="85.5" cy="70.5" r="2.4" fill="#ffffff"/><circle cx="114.5" cy="70.5" r="2.4" fill="#ffffff"/>'
  +'<circle cx="80.5" cy="79" r="1.2" fill="#ffffff" opacity=".85"/><circle cx="114.5" cy="79" r="1.2" fill="#ffffff" opacity=".85"/>'
  +'<path d="M72,70 Q82,64 92,70" fill="none" stroke="#26221f" stroke-width="2" opacity="0.18" stroke-linecap="round"/><path d="M108,70 Q118,64 128,70" fill="none" stroke="#26221f" stroke-width="2" opacity="0.18" stroke-linecap="round"/>'
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
 otter:{nat:'#b08968',natDark:'#8a6a4a',grain:true,draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M146,184 C166,178 176,166 174,154 C172,146 162,148 156,156 C148,166 144,174 144,184 Z" fill="url(#gD'+u+')"/></g>'
  +avFur('<path d="M172,150 l6,-3 M175,157 l6,-1 M173,164 l5,2" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="7.5" ry="20" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="7.5" ry="20" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M44,182 l5,4 M48,189 l5,4 M156,182 l-5,4 M152,189 l-5,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M68,230 l2,4 M74,231 l1,4 M80,231 l0,4 M120,231 l0,4 M126,231 l-1,4 M132,230 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<circle cx="56" cy="52" r="7" fill="url(#gB'+u+')"/><circle cx="56" cy="52" r="3.5" fill="'+p.dark+'"/><circle cx="144" cy="52" r="7" fill="url(#gB'+u+')"/><circle cx="144" cy="52" r="3.5" fill="'+p.dark+'"/>'
  +'<ellipse cx="100" cy="78" rx="49" ry="44" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +avFur('<path d="M54,46 l-3,-5 M58,44 l-1,-6 M146,46 l3,-5 M142,44 l1,-6 M56,96 l-5,4 M58,104 l-5,3 M144,96 l5,4 M142,104 l5,3" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<ellipse cx="100" cy="96" rx="26" ry="12" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="'+p.ink+'"/><circle cx="98" cy="86.5" r="1.5" fill="#ffffff" opacity="0.7"/>'+avSmile(100,98,12)
  +'<path d="M62,86 L79,89 M60,95 L78,94 M64,103 L80,98 M138,86 L121,89 M140,95 L122,94 M136,103 L120,98" fill="none" stroke="rgba(74,44,26,0.5)" stroke-width="1.5" stroke-linecap="round"/>'; }},
 frog:{nat:'#58b368',natDark:'#2f7a3d',bob:'av-hop',draw:function(p){
  var u=p.uid;
  return '<ellipse cx="100" cy="178" rx="52" ry="48" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,72,158,16,20,0.35,-14)
  +'<ellipse cx="100" cy="188" rx="34" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<g class="av-skin"><circle cx="72" cy="160" r="2" fill="'+p.dark+'" opacity="0.3"/><circle cx="86" cy="150" r="1.6" fill="'+p.light+'" opacity="0.5"/><circle cx="118" cy="156" r="2.2" fill="'+p.dark+'" opacity="0.3"/><circle cx="130" cy="168" r="1.6" fill="'+p.light+'" opacity="0.5"/><circle cx="100" cy="168" r="1.8" fill="'+p.dark+'" opacity="0.25"/><circle cx="80" cy="182" r="1.6" fill="'+p.light+'" opacity="0.5"/><circle cx="122" cy="184" r="1.8" fill="'+p.dark+'" opacity="0.25"/><circle cx="92" cy="200" r="1.6" fill="'+p.light+'" opacity="0.5"/><circle cx="110" cy="202" r="1.6" fill="'+p.dark+'" opacity="0.25"/></g>'
  +'<ellipse cx="52" cy="176" rx="8" ry="20" transform="rotate(-15 52 176)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="148" cy="176" rx="8" ry="20" transform="rotate(15 148 176)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="66" cy="228" rx="16" ry="9" fill="'+p.dark+'"/><ellipse cx="134" cy="228" rx="16" ry="9" fill="'+p.dark+'"/>'
  +'<path d="M60,226 l2,4 M66,227 l1,4 M72,227 l0,4 M128,227 l0,4 M134,227 l-1,4 M140,226 l-2,4" fill="none" stroke="'+p.dark3+'" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>'
  +avCrease(100,130,28,7)
  +'<ellipse cx="100" cy="132" rx="22" ry="10" fill="'+p.light+'" opacity="0.45"/>'
  +'<circle cx="100" cy="84" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,78,60,18,11,0.5,-20)
  +'<g class="av-skin"><circle cx="70" cy="66" r="2" fill="'+p.dark+'" opacity="0.3"/><circle cx="86" cy="58" r="1.6" fill="'+p.light+'" opacity="0.5"/><circle cx="116" cy="60" r="1.8" fill="'+p.dark+'" opacity="0.3"/><circle cx="130" cy="68" r="1.6" fill="'+p.light+'" opacity="0.5"/><circle cx="100" cy="60" r="1.6" fill="'+p.dark+'" opacity="0.25"/></g>'
  +'<g class="av-blink" style="animation-delay:'+p.bdelay+'">'
  +'<circle cx="70" cy="46" r="17" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><circle cx="130" cy="46" r="17" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<circle cx="70" cy="46" r="11.5" fill="#ffffff"/><circle cx="130" cy="46" r="11.5" fill="#ffffff"/>'
  +'<circle cx="70" cy="46" r="8" fill="#3a7d2c"/><circle cx="130" cy="46" r="8" fill="#3a7d2c"/>'
  +'<circle cx="70" cy="46" r="8" fill="none" stroke="#24511c" stroke-width="1"/><circle cx="130" cy="46" r="8" fill="none" stroke="#24511c" stroke-width="1"/>'
  +'<circle cx="70" cy="46" r="5.5" fill="none" stroke="#6db35a" stroke-width="1" opacity="0.7"/><circle cx="130" cy="46" r="5.5" fill="none" stroke="#6db35a" stroke-width="1" opacity="0.7"/>'
  +'<circle cx="71" cy="48" r="4.5" fill="#26221f"/><circle cx="131" cy="48" r="4.5" fill="#26221f"/>'
  +'<circle cx="73" cy="41" r="2.8" fill="#ffffff"/><circle cx="133" cy="41" r="2.8" fill="#ffffff"/>'
  +'<circle cx="68" cy="50" r="1.3" fill="#ffffff" opacity=".85"/><circle cx="128" cy="50" r="1.3" fill="#ffffff" opacity=".85"/>'
  +'</g>'
  +'<circle cx="66" cy="92" r="6" fill="'+p.light+'" opacity="0.7"/><circle cx="134" cy="92" r="6" fill="'+p.light+'" opacity="0.7"/>'
  +'<circle cx="92" cy="86" r="1.8" fill="'+p.dark+'"/><circle cx="108" cy="86" r="1.8" fill="'+p.dark+'"/><path d="M70,96 Q100,114 130,96" fill="none" stroke="'+p.dark+'" stroke-width="3" stroke-linecap="round"/>'; }},
 butterfly:{nat:'#f7a8d8',natDark:'#c96ba0',draw:function(p){
  var u=p.uid;
  return '<g class="av-flutter-l">'
  +'<path d="M90,102 C74,90 54,92 44,106 C38,114 38,122 42,128 C36,134 36,142 42,148 C38,154 40,162 46,166 C58,174 80,170 88,154 C94,142 94,118 90,102 Z" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/>'
  +'<path d="M88,128 Q64,116 48,112 M88,130 Q62,132 44,138 M88,134 Q64,148 50,158" fill="none" stroke="'+p.dark+'" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="58" cy="112" r="5" fill="'+p.light+'" opacity="0.8"/><circle cx="58" cy="112" r="5" fill="none" stroke="'+p.dark+'" stroke-width="1" opacity="0.5"/><circle cx="66" cy="140" r="4" fill="'+p.light+'" opacity="0.8"/><circle cx="66" cy="140" r="4" fill="none" stroke="'+p.dark+'" stroke-width="1" opacity="0.5"/>'
  +'<ellipse cx="58" cy="184" rx="23" ry="29" transform="rotate(-16 58 184)" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/>'
  +'<path d="M64,184 Q56,196 52,204" fill="none" stroke="'+p.dark+'" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="58" cy="180" r="3.5" fill="'+p.light+'" opacity="0.8"/>'
  +'</g><g class="av-flutter-r">'
  +'<path d="M110,102 C126,90 146,92 156,106 C162,114 162,122 158,128 C164,134 164,142 158,148 C162,154 160,162 154,166 C142,174 120,170 112,154 C106,142 106,118 110,102 Z" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/>'
  +'<path d="M112,128 Q136,116 152,112 M112,130 Q138,132 156,138 M112,134 Q136,148 150,158" fill="none" stroke="'+p.dark+'" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="142" cy="112" r="5" fill="'+p.light+'" opacity="0.8"/><circle cx="142" cy="112" r="5" fill="none" stroke="'+p.dark+'" stroke-width="1" opacity="0.5"/><circle cx="134" cy="140" r="4" fill="'+p.light+'" opacity="0.8"/><circle cx="134" cy="140" r="4" fill="none" stroke="'+p.dark+'" stroke-width="1" opacity="0.5"/>'
  +'<ellipse cx="142" cy="184" rx="23" ry="29" transform="rotate(16 142 184)" fill="url(#gB'+u+')" stroke="'+p.dark+'" stroke-width="2"/>'
  +'<path d="M136,184 Q144,196 148,204" fill="none" stroke="'+p.dark+'" stroke-width="1.2" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="142" cy="180" r="3.5" fill="'+p.light+'" opacity="0.8"/>'
  +'</g>'
  +'<ellipse cx="100" cy="172" rx="14" ry="36" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<ellipse cx="100" cy="172" rx="8" ry="30" fill="url(#gBel'+u+')" opacity="0.6"/>'
  +'<path d="M88,160 Q100,164 112,160 M88,178 Q100,182 112,178" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.4" stroke-linecap="round"/>'
  +'<ellipse cx="100" cy="140" rx="12" ry="10" fill="url(#gD'+u+')"/>'
  +'<ellipse cx="90" cy="210" rx="7" ry="5" fill="'+p.dark+'"/><ellipse cx="110" cy="210" rx="7" ry="5" fill="'+p.dark+'"/>'
  +'<path d="M88,40 Q78,18 68,8" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/><path d="M112,40 Q122,18 132,8" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/><circle cx="68" cy="8" r="4" fill="'+p.dark+'"/><circle cx="132" cy="8" r="4" fill="'+p.dark+'"/>'
  +'<circle cx="100" cy="76" r="40" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,78,54,16,10,0.5,-20)
  +avEyes(p)
  +'<path d="M74,54 L70,48 M82,52 L80,45 M118,52 L120,45 M126,54 L130,48" fill="none" stroke="#26221f" stroke-width="2" stroke-linecap="round"/>'
  +'<circle cx="100" cy="84" r="2" fill="'+p.dark+'"/>'+avSmile(100,92,8); }},
 cat:{nat:'#f6b73c',natDark:'#d98a1f',grain:true,draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M148,196 C170,192 180,172 172,154 C168,144 158,146 158,156 C158,168 150,180 140,186 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/></g>'
  +avFur('<path d="M170,152 l5,-3 M173,159 l6,-1 M171,166 l5,2" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<path d="M100,118 C132,118 150,144 150,174 C150,206 128,230 100,230 C72,230 50,206 50,174 C50,144 68,118 100,118 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="190" rx="28" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="78" cy="222" rx="12" ry="7" fill="'+p.light+'"/><ellipse cx="122" cy="222" rx="12" ry="7" fill="'+p.light+'"/>'
  +'<path d="M72,222 l2,4 M78,223 l1,4 M84,223 l0,4 M116,223 l0,4 M122,223 l-1,4 M128,222 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<path d="M62,42 L56,10 L86,30 Z" fill="url(#gB'+u+')"/><path d="M63,36 L60,18 L78,29 Z" fill="'+p.light+'"/><path d="M138,42 L144,10 L114,30 Z" fill="url(#gB'+u+')"/><path d="M137,36 L140,18 L122,29 Z" fill="'+p.light+'"/>'
  +avFur('<path d="M56,12 l-3,-4 M60,10 l-1,-5 M144,12 l3,-4 M140,10 l1,-5 M58,40 l-4,2 M142,40 l4,2" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +'<path d="M88,44 q2,6 0,10 M100,42 q0,6 0,10 M112,44 q-2,6 0,10" fill="none" stroke="'+p.dark+'" stroke-width="2" opacity="0.3" stroke-linecap="round"/>'
  +avFur('<path d="M58,92 l-5,3 M60,100 l-5,2 M142,92 l5,3 M140,100 l5,2" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +avEyes(p)
  +'<path d="M94,84 L106,84 L100,90 Z" fill="#e88aa0"/>'+avSmile(100,94,12)
  +'<path d="M58,88 L76,90 M58,96 L76,94 M142,88 L124,90 M142,96 L124,94" stroke="rgba(0,0,0,0.30)" stroke-width="1.5" stroke-linecap="round"/>'; }},
 dog:{nat:'#c68a4b',natDark:'#8a5a2e',grain:true,draw:function(p){
  var u=p.uid;
  return '<path d="M52,170 C40,162 36,148 44,140 C50,134 56,140 54,150 C52,160 56,166 60,170 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="7.5" ry="20" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="7.5" ry="20" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M44,182 l5,4 M48,189 l5,4 M156,182 l-5,4 M152,189 l-5,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M68,230 l2,4 M74,231 l1,4 M80,231 l0,4 M120,231 l0,4 M126,231 l-1,4 M132,230 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<g class="av-earwig"><ellipse cx="56" cy="66" rx="10" ry="24" transform="rotate(14 56 66)" fill="url(#gD'+u+')"/><ellipse cx="144" cy="66" rx="10" ry="24" transform="rotate(-14 144 66)" fill="url(#gD'+u+')"/></g>'
  +'<path d="M52,56 q3,10 1,18 M60,58 q2,10 0,18 M148,56 q-3,10 -1,18 M140,58 q-2,10 0,18" fill="none" stroke="'+p.dark2+'" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +'<path d="M94,40 q3,-5 6,-4 M100,38 q0,-6 3,-6 M106,40 q-3,-5 -6,-4" fill="none" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>'
  +'<ellipse cx="100" cy="96" rx="20" ry="13" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="7" ry="5" fill="'+p.ink+'"/><circle cx="98" cy="86.5" r="1.4" fill="#ffffff" opacity="0.7"/><path d="M88,94 Q100,102 112,94" fill="none" stroke="'+p.ink+'" stroke-width="2.5" stroke-linecap="round"/><g class="av-tongue"><rect x="92" y="100" width="16" height="14" rx="8" fill="#f08ba0"/><path d="M100,102 L100,112" stroke="#d96a86" stroke-width="1.5" stroke-linecap="round"/></g>'; }},
 rabbit:{nat:'#f2f2f2',natDark:'#cfc9bd',grain:true,draw:function(p){
  var u=p.uid;
  var inner=p.nat?'#f6b8c1':p.light;
  return '<circle cx="42" cy="196" r="12" fill="#ffffff" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/>'
  +avFur('<path d="M32,188 l-4,-3 M34,196 l-5,0 M36,204 l-4,3 M50,188 l4,-3 M50,196 l5,0 M50,204 l4,3" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.5"/>')
  +'<ellipse cx="100" cy="174" rx="50" ry="50" fill="url(#gR'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,152,16,20,0.35,-12)
  +avRim('M60,140 Q66,124 82,118',p.lighter)
  +avFur('<path d="M66,146 q-4,10 -2,20 M134,146 q4,10 2,20 M78,168 q4,12 2,24 M88,166 q3,12 1,24 M112,166 q-3,12 -1,24 M122,168 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="186" rx="32" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="70" cy="228" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="130" cy="228" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M64,228 l2,4 M70,229 l1,4 M76,229 l0,4 M124,229 l0,4 M130,229 l-1,4 M136,228 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,126,28,7)
  +'<g class="av-earwig"><ellipse cx="76" cy="35" rx="9" ry="32" transform="rotate(-7 76 35)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/><ellipse cx="76" cy="37" rx="4.5" ry="22" transform="rotate(-7 76 37)" fill="'+inner+'"/><ellipse cx="124" cy="35" rx="9" ry="32" transform="rotate(7 124 35)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/><ellipse cx="124" cy="37" rx="4.5" ry="22" transform="rotate(7 124 37)" fill="'+inner+'"/></g>'
  +'<path d="M71,16 q2,8 0,16 M81,16 q-2,8 0,16 M119,16 q2,8 0,16 M129,16 q-2,8 0,16" fill="none" stroke="'+p.fur+'" stroke-width="1.4" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="100" cy="84" r="46" fill="url(#gR'+u+')" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,58,18,11,0.5,-20)
  +avRim('M62,58 Q70,42 86,38',p.lighter)
  +avFur('<path d="M58,98 l-5,4 M60,106 l-5,3 M142,98 l5,4 M140,106 l5,3" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +avEyes(p)
  +'<path d="M94,84 L106,84 L100,89 Z" fill="#e88aa0"/><path d="M100,89 Q96,95 92,92 M100,89 Q104,95 108,92" fill="none" stroke="#8a6a4a" stroke-width="2.5" stroke-linecap="round"/><rect x="94" y="96" width="5.5" height="8" rx="2" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1"/><rect x="100.5" y="96" width="5.5" height="8" rx="2" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>'; }},
 lion:{nat:'#f7c873',natDark:'#d97f2b',grain:true,draw:function(p){
  var u=p.uid;
  return '<path d="M148,192 C168,188 178,172 172,158" fill="none" stroke="url(#gB'+u+')" stroke-width="7" stroke-linecap="round"/><circle cx="172" cy="156" r="10" fill="url(#gD'+u+')"/>'
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="7.5" ry="20" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="7.5" ry="20" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M44,182 l5,4 M48,189 l5,4 M156,182 l-5,4 M152,189 l-5,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M68,230 l2,4 M74,231 l1,4 M80,231 l0,4 M120,231 l0,4 M126,231 l-1,4 M132,230 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<g class="av-nod">'
  +'<circle cx="100" cy="78" r="58" fill="url(#gD'+u+')"/><circle cx="100" cy="78" r="52" fill="'+p.dark2+'"/>'
  +avFur('<path d="M52,32 l-4,-4 M60,26 l-2,-5 M100,20 l0,-6 M140,26 l2,-5 M148,32 l4,-4 M156,60 l5,-2 M156,96 l5,2 M148,124 l4,4 M52,124 l-4,4 M44,96 l-5,2 M44,60 l-5,-2" stroke="'+p.dark3+'" stroke-width="1.8" opacity="0.6"/>')
  +'<path d="M60,60 q8,10 4,22 M140,60 q-8,10 -4,22 M70,110 q6,-8 14,-6 M130,110 q-6,-8 -14,-6" fill="none" stroke="'+p.dark2+'" stroke-width="1.6" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="64" cy="36" r="8" fill="url(#gB'+u+')"/><circle cx="136" cy="36" r="8" fill="url(#gB'+u+')"/>'
  +'<circle cx="100" cy="78" r="42" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,78,56,18,11,0.5,-20)
  +avRim('M64,56 Q72,42 86,38',p.lighter)
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="7" ry="5" fill="#8a5a2e"/><circle cx="98" cy="86.5" r="1.4" fill="#ffffff" opacity="0.7"/>'+avSmile(100,96,12)
  +'</g>'; }},
 panda:{nat:'#f5f2ea',natDark:'#26221f',grain:true,draw:function(p){
  var u=p.uid;
  return '<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="10" ry="22" transform="rotate(-18 50 172)" fill="url(#gD'+u+')"/><ellipse cx="150" cy="172" rx="10" ry="22" transform="rotate(18 150 172)" fill="url(#gD'+u+')"/>'
  +avFur('<path d="M42,160 l-4,3 M44,168 l-4,2 M46,176 l-4,1 M158,160 l4,3 M156,168 l4,2 M154,176 l4,1" stroke="'+shade(p.dark,0.25)+'" stroke-width="1.6" opacity="0.6"/>')
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M68,230 l2,4 M74,231 l1,4 M80,231 l0,4 M120,231 l0,4 M126,231 l-1,4 M132,230 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<g class="av-earwig"><circle cx="60" cy="42" r="11" fill="url(#gD'+u+')"/><circle cx="140" cy="42" r="11" fill="url(#gD'+u+')"/></g>'
  +avFur('<path d="M52,34 l-4,-3 M56,32 l-2,-5 M60,31 l0,-5 M148,34 l4,-3 M144,32 l2,-5 M140,31 l0,-5" stroke="'+shade(p.dark,0.25)+'" stroke-width="1.6" opacity="0.6"/>')
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +avFur('<path d="M64,60 q4,8 2,16 M136,60 q-4,8 -2,16" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<g class="av-blink" style="animation-delay:'+p.bdelay+'">'
  +'<ellipse cx="82" cy="74" rx="13.5" ry="17" transform="rotate(-12 82 74)" fill="'+p.dark+'"/><ellipse cx="118" cy="74" rx="13.5" ry="17" transform="rotate(12 118 74)" fill="'+p.dark+'"/>'
  +avFur('<path d="M70,60 l-3,-4 M74,58 l-1,-5 M78,57 l1,-5 M130,60 l3,-4 M126,58 l1,-5 M122,57 l-1,-5" stroke="'+shade(p.dark,0.25)+'" stroke-width="1.6" opacity="0.6"/>')
  +'<ellipse cx="82" cy="74" rx="7.5" ry="9" fill="#ffffff"/><ellipse cx="118" cy="74" rx="7.5" ry="9" fill="#ffffff"/><circle cx="82" cy="76" r="5" fill="#7a4a21"/><circle cx="118" cy="76" r="5" fill="#7a4a21"/><circle cx="82" cy="76" r="5" fill="none" stroke="#4a2c14" stroke-width="1"/><circle cx="118" cy="76" r="5" fill="none" stroke="#4a2c14" stroke-width="1"/><circle cx="83" cy="77" r="3" fill="#26221f"/><circle cx="117" cy="77" r="3" fill="#26221f"/><circle cx="84.5" cy="72" r="1.6" fill="#ffffff"/><circle cx="115.5" cy="72" r="1.6" fill="#ffffff"/>'
  +'</g>'
  +'<ellipse cx="100" cy="90" rx="6" ry="4.5" fill="#26221f"/><circle cx="98" cy="88.5" r="1.4" fill="#ffffff" opacity="0.7"/>'+avSmile(100,98,10); }},
 fox:{nat:'#e8743c',natDark:'#c25a2e',grain:true,draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M146,182 C174,172 188,142 178,118 C172,102 156,104 154,120 C152,138 142,158 136,172 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="170" cy="118" rx="11" ry="15" transform="rotate(18 170 118)" fill="'+p.light+'"/></g>'
  +avFur('<path d="M176,126 l6,-2 M180,136 l6,0 M179,148 l5,2 M174,160 l5,3" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="7.5" ry="20" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="7.5" ry="20" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M44,182 l5,4 M48,189 l5,4 M156,182 l-5,4 M152,189 l-5,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M68,230 l2,4 M74,231 l1,4 M80,231 l0,4 M120,231 l0,4 M126,231 l-1,4 M132,230 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<path d="M60,44 L54,8 L88,30 Z" fill="url(#gB'+u+')"/><path d="M62,36 L59,17 L80,29 Z" fill="'+p.light+'"/><path d="M140,44 L146,8 L112,30 Z" fill="url(#gB'+u+')"/><path d="M138,36 L141,17 L120,29 Z" fill="'+p.light+'"/>'
  +avFur('<path d="M54,10 l-3,-4 M58,8 l-1,-5 M146,10 l3,-4 M142,8 l1,-5" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +avFur('<path d="M58,84 l-5,3 M60,94 l-5,2 M62,102 l-4,3 M142,84 l5,3 M140,94 l5,2 M138,102 l4,3" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<ellipse cx="100" cy="96" rx="22" ry="13" fill="url(#gBel'+u+')"/>'
  +avEyes(p)
  +'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="'+p.ink+'"/><circle cx="98" cy="86.5" r="1.4" fill="#ffffff" opacity="0.7"/>'+avSmile(100,97,12); }},
 turtle:{nat:'#93cf6b',natDark:'#4e8f4c',draw:function(p){
  var u=p.uid;
  return '<ellipse cx="58" cy="228" rx="10" ry="7" fill="'+p.dark+'"/><ellipse cx="84" cy="231" rx="10" ry="7" fill="'+p.dark+'"/><ellipse cx="116" cy="231" rx="10" ry="7" fill="'+p.dark+'"/><ellipse cx="142" cy="228" rx="10" ry="7" fill="'+p.dark+'"/>'
  +'<path d="M52,229 l1,4 M58,230 l0,4 M64,230 l-1,4 M78,230 l1,4 M84,231 l0,4 M90,231 l-1,4 M110,231 l1,4 M116,231 l0,4 M122,231 l-1,4 M136,230 l1,4 M142,230 l0,4 M148,229 l-1,4" fill="none" stroke="'+p.dark3+'" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>'
  +'<path d="M100,100 C142,100 160,136 160,176 C160,206 134,228 100,228 C66,228 40,206 40,176 C40,136 58,100 100,100 Z" fill="url(#gD'+u+')" stroke="rgba(0,0,0,0.12)" stroke-width="2"/>'
  +avSheen(u,70,140,18,14,0.4,-16)
  +'<g class="av-scute">'
  +'<path d="M100,106 L118,116 L112,138 L100,146 L88,138 L82,116 Z" fill="'+p.dark2+'" opacity="0.55" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'<path d="M100,150 L116,158 L110,178 L100,186 L90,178 L84,158 Z" fill="'+p.dark2+'" opacity="0.55" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'<path d="M100,190 L112,196 L108,210 L100,216 L92,210 L88,196 Z" fill="'+p.dark2+'" opacity="0.45" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'<path d="M76,118 L88,126 L84,146 L70,142 L66,124 Z" fill="'+p.dark2+'" opacity="0.45" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'<path d="M124,118 L134,124 L130,142 L116,146 L112,126 Z" fill="'+p.dark2+'" opacity="0.45" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'<path d="M68,150 L84,156 L80,176 L64,172 L60,158 Z" fill="'+p.dark2+'" opacity="0.45" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'<path d="M132,150 L140,158 L136,172 L120,176 L116,156 Z" fill="'+p.dark2+'" opacity="0.45" stroke="'+p.dark3+'" stroke-width="1.5" stroke-linejoin="round"/>'
  +'</g>'
  +'<path d="M52,182 Q100,170 148,182 M48,200 Q100,190 152,200" fill="none" stroke="'+p.dark3+'" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>'
  +'<g class="av-nod">'
  +'<circle cx="100" cy="78" r="34" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +avSheen(u,80,58,13,8,0.5,-20)
  +'<g class="av-blink" style="animation-delay:'+p.bdelay+'">'
  +'<ellipse cx="88" cy="74" rx="9" ry="11" fill="#ffffff"/><ellipse cx="112" cy="74" rx="9" ry="11" fill="#ffffff"/>'
  +'<circle cx="89" cy="76" r="5.5" fill="#6b4226"/><circle cx="111" cy="76" r="5.5" fill="#6b4226"/>'
  +'<circle cx="89" cy="76" r="5.5" fill="none" stroke="#4a2c14" stroke-width="1"/><circle cx="111" cy="76" r="5.5" fill="none" stroke="#4a2c14" stroke-width="1"/>'
  +'<circle cx="89" cy="77" r="3" fill="#26221f"/><circle cx="111" cy="77" r="3" fill="#26221f"/>'
  +'<circle cx="90.5" cy="71" r="1.8" fill="#ffffff"/><circle cx="110" cy="71" r="1.8" fill="#ffffff"/>'
  +'</g>'
  +'<circle cx="94" cy="84" r="1.5" fill="'+p.dark+'"/><circle cx="106" cy="84" r="1.5" fill="'+p.dark+'"/><path d="M88,90 Q100,97 112,90" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/>'
  +'<circle cx="80" cy="82" r="3.5" fill="'+p.light+'" opacity="0.6"/><circle cx="120" cy="82" r="3.5" fill="'+p.light+'" opacity="0.6"/>'
  +'</g>'; }},
 pig:{nat:'#f6b8c1',natDark:'#e88aa0',grain:true,draw:function(p){
  var u=p.uid;
  return '<path d="M150,172 C162,166 172,170 170,180 C168,188 158,190 156,182 C154,176 160,172 164,176" fill="none" stroke="'+p.dark+'" stroke-width="3" stroke-linecap="round"/>'
  +'<ellipse cx="100" cy="172" rx="52" ry="50" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,72,150,16,20,0.35,-12)
  +avRim('M60,140 Q66,124 82,118',p.lighter)
  +avFur('<path d="M66,146 q-4,10 -2,20 M134,146 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="184" rx="34" ry="34" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="70" cy="228" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="130" cy="228" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M64,228 l2,4 M70,229 l1,4 M76,229 l0,4 M124,229 l0,4 M130,229 l-1,4 M136,228 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,120,28,7)
  +'<g class="av-flop"><circle cx="62" cy="42" r="10" fill="url(#gB'+u+')"/><circle cx="62" cy="42" r="5" fill="'+p.dark+'"/><circle cx="138" cy="42" r="10" fill="url(#gB'+u+')"/><circle cx="138" cy="42" r="5" fill="'+p.dark+'"/></g>'
  +'<path d="M58,36 q2,4 1,8 M66,36 q-1,4 -2,8 M134,36 q2,4 1,8 M142,36 q-1,4 -2,8" fill="none" stroke="'+p.fur+'" stroke-width="1.4" opacity="0.4" stroke-linecap="round"/>'
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +avEyes(p)
  +'<ellipse cx="100" cy="90" rx="16" ry="12" fill="url(#gD'+u+')"/><ellipse cx="94" cy="90" rx="2.5" ry="3.5" fill="'+p.ink+'" opacity="0.55"/><ellipse cx="106" cy="90" rx="2.5" ry="3.5" fill="'+p.ink+'" opacity="0.55"/><circle cx="94" cy="86" r="1.6" fill="#ffffff" opacity="0.6"/>'
  +'<path d="M90,104 Q100,109 110,104" fill="none" stroke="'+p.dark+'" stroke-width="2.5" stroke-linecap="round"/>'; }},
 monkey:{nat:'#c68a4b',natDark:'#8a5a2e',grain:true,draw:function(p){
  var u=p.uid;
  return '<g class="av-sway"><path d="M54,192 C30,188 22,166 32,152 C38,144 48,148 46,158 C44,170 52,178 60,182 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/></g>'
  +avFur('<path d="M32,154 l-5,-2 M30,161 l-6,0 M32,168 l-5,2" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<path d="M100,116 C134,116 152,144 152,176 C152,208 130,232 100,232 C70,232 48,208 48,176 C48,144 66,116 100,116 Z" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,74,148,16,22,0.35,-12)
  +avRim('M58,142 Q64,124 80,118',p.lighter)
  +avFur('<path d="M64,142 q-4,10 -2,20 M136,142 q4,10 2,20 M78,160 q4,12 2,24 M88,158 q3,12 1,24 M112,158 q-3,12 -1,24 M122,160 q-4,12 -2,24" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
  +'<ellipse cx="100" cy="192" rx="30" ry="36" fill="url(#gBel'+u+')" opacity="0.9"/>'
  +'<ellipse cx="50" cy="172" rx="7.5" ry="20" transform="rotate(-18 50 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="150" cy="172" rx="7.5" ry="20" transform="rotate(18 150 172)" fill="url(#gB'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
  +'<path d="M44,182 l5,4 M48,189 l5,4 M156,182 l-5,4 M152,189 l-5,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +'<ellipse cx="74" cy="230" rx="14" ry="8" fill="'+p.dark+'"/><ellipse cx="126" cy="230" rx="14" ry="8" fill="'+p.dark+'"/>'
  +'<path d="M68,230 l2,4 M74,231 l1,4 M80,231 l0,4 M120,231 l0,4 M126,231 l-1,4 M132,230 l-2,4" fill="none" stroke="'+p.dark+'" stroke-width="1.5" opacity="0.45" stroke-linecap="round"/>'
  +avCrease(100,118,30,8)
  +'<circle cx="58" cy="74" r="11" fill="url(#gD'+u+')"/><circle cx="58" cy="74" r="6" fill="'+p.light+'"/><circle cx="142" cy="74" r="11" fill="url(#gD'+u+')"/><circle cx="142" cy="74" r="6" fill="'+p.light+'"/>'
  +avFur('<path d="M48,68 l-4,-2 M50,76 l-4,0 M152,68 l4,-2 M150,76 l4,0" stroke="'+p.fur+'" stroke-width="1.6" opacity="0.55"/>')
  +'<circle cx="100" cy="76" r="46" fill="url(#gH'+u+')" stroke="rgba(0,0,0,0.10)" stroke-width="2" filter="url(#fGr'+u+')"/>'
  +avSheen(u,76,54,20,12,0.5,-20)
  +avRim('M62,54 Q70,40 86,36',p.lighter)
  +'<ellipse cx="100" cy="82" rx="34" ry="36" fill="url(#gBel'+u+')"/>'
  +avFur('<path d="M70,58 q4,8 2,16 M130,58 q-4,8 -2,16" stroke="'+p.fur+'" stroke-width="1.5" opacity="0.3"/>')
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
 flower:'<g><path d="M58,54 L56,63" stroke="#4e8f4c" stroke-width="2" stroke-linecap="round"/><circle cx="56" cy="44" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="64" cy="48" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="62" cy="56" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="54" cy="56" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="52" cy="48" r="4" fill="#ffffff" stroke="#e88aa0" stroke-width="1"/><circle cx="58" cy="50" r="3.4" fill="#ffd166"/></g>',
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
   // Rabbit only: the head circle and body ellipse share one
   // userSpaceOnUse gradient, so the head–body join is seamless.
   // (The per-shape gB gradient samples a different field on each
   // shape — the head's dark bottom met the body's light top — and
   // that shading step was the faint circular edge seen live in
   // round 3. A shared field has no step at the overlap.)
   +(key==='rabbit'?'<radialGradient id="gR'+u+'" gradientUnits="userSpaceOnUse" cx="100" cy="55" r="230"><stop offset="0%" stop-color="'+pal.hi+'"/><stop offset="48%" stop-color="'+pal.main+'"/><stop offset="100%" stop-color="'+pal.edge+'"/></radialGradient>':'')
   +'<radialGradient id="gH'+u+'" cx="40%" cy="26%" r="75%"><stop offset="0%" stop-color="'+pal.lighter+'"/><stop offset="55%" stop-color="'+pal.main+'"/><stop offset="100%" stop-color="'+pal.edge+'"/></radialGradient>'
   +'<radialGradient id="gBel'+u+'" cx="50%" cy="32%" r="72%"><stop offset="0%" stop-color="'+pal.lighter+'"/><stop offset="100%" stop-color="'+pal.bellyEnd+'"/></radialGradient>'
   +'<radialGradient id="gD'+u+'" cx="40%" cy="30%" r="78%"><stop offset="0%" stop-color="'+shade(pal.dark,0.28)+'"/><stop offset="55%" stop-color="'+pal.dark+'"/><stop offset="100%" stop-color="'+shade(pal.dark,-0.28)+'"/></radialGradient>'
   +'<radialGradient id="gSh'+u+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>'
   +'<radialGradient id="gGl'+u+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="rgba(255,255,255,0.55)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient>'
   +(a.grain?'<filter id="fGr'+u+'" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" result="na"/><feComposite in="na" in2="SourceAlpha" operator="in" result="grain"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge></filter>':'')
   +'</defs>';
  return '<svg class="av3d" viewBox="0 0 200 260" data-animal="'+key+'" style="width:'+wpx+'px;height:'+hpx+'px;display:block;margin:0 auto" role="img" aria-label="My animal friend, the '+key+'">'
   +defs
   +'<ellipse cx="100" cy="246" rx="56" ry="9" fill="url(#gSh'+u+')"/>'
   +'<g class="'+(a.bob||'av-bob')+'" style="animation-delay:'+bobDelay+'">'
   +a.draw(pal)
   +(AVATAR_ACCS[acc]?'<g id="avatar-acc">'+AVATAR_ACCS[acc]+'</g>':'')
   +'</g></svg>';
}
/* The idle-life CSS (round 3, revised in round 4: the butterfly
   flutter is now a real flap — a big fold plus a tilt, so it
   reads in motion — and the head nod is a tilt, not a 2px
   shift). Same language as Pip's otterFloat / otterBlink /
   earWig and the frog's frogBlink / frogBreathe: slow, calm,
   transform and opacity only. The svg carries class="av3d", so
   these rules only touch avatar characters. Blink and bob
   delays are staggered per animal (inline style), so a page of
   animals never moves in lockstep. */
var AVATAR_3D_CSS=`
.av3d .av-bob{transform-box:fill-box;transform-origin:50% 100%;animation:avBob 3.6s ease-in-out infinite}
@keyframes avBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}
.av3d .av-blink{transform-box:fill-box;transform-origin:center;animation:avBlink 4.6s infinite}
@keyframes avBlink{0%,90%,100%{transform:scaleY(1)}93%{transform:scaleY(.08)}}
.av3d .av-earwig{transform-box:fill-box;transform-origin:50% 100%;animation:avEarWig 5s ease-in-out infinite}
@keyframes avEarWig{0%,86%,100%{transform:rotate(0)}90%{transform:rotate(-8deg)}94%{transform:rotate(6deg)}}
.av3d .av-sway{transform-box:fill-box;transform-origin:50% 0;animation:avSway 3.8s ease-in-out infinite}
@keyframes avSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
.av3d .av-flutter-l{transform-box:fill-box;transform-origin:100% 50%;animation:avFlutterL 1.8s ease-in-out infinite}
.av3d .av-flutter-r{transform-box:fill-box;transform-origin:0% 50%;animation:avFlutterR 1.8s ease-in-out infinite}
@keyframes avFlutterL{0%,100%{transform:scaleX(1) rotate(0deg)}50%{transform:scaleX(.45) rotate(-14deg)}}
@keyframes avFlutterR{0%,100%{transform:scaleX(1) rotate(0deg)}50%{transform:scaleX(.45) rotate(14deg)}}
.av3d .av-hop{transform-box:fill-box;transform-origin:50% 100%;animation:avHop 2.8s ease-in-out infinite}
@keyframes avHop{0%,78%,100%{transform:translateY(0) scale(1,1)}86%{transform:translateY(-7px) scale(.98,1.04)}92%{transform:translateY(0) scale(1.05,.94)}}
.av3d .av-nod{transform-box:fill-box;transform-origin:50% 100%;animation:avNod 4.2s ease-in-out infinite}
@keyframes avNod{0%,84%,100%{transform:rotate(0deg)}88%{transform:rotate(3deg)}92%{transform:rotate(-2deg)}}
.av3d .av-tongue{transform-box:fill-box;transform-origin:50% 0;animation:avTongue 3.4s ease-in-out infinite}
@keyframes avTongue{0%,100%{transform:rotate(-2deg) scaleY(1)}50%{transform:rotate(3deg) scaleY(1.1)}}
.av3d .av-flop{transform-box:fill-box;transform-origin:50% 0;animation:avFlop 4.4s ease-in-out infinite}
@keyframes avFlop{0%,82%,100%{transform:rotate(0)}88%{transform:rotate(-10deg)}94%{transform:rotate(7deg)}}
@media (prefers-reduced-motion: reduce){.av3d .av-bob,.av3d .av-blink,.av3d .av-earwig,.av3d .av-sway,.av3d .av-flutter-l,.av3d .av-flutter-r,.av3d .av-hop,.av3d .av-nod,.av3d .av-tongue,.av3d .av-flop{animation:none}}
`;
