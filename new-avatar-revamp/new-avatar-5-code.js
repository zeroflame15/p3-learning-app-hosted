/* ============================================================
   FULL-BODY LOOK — ROUND 5 (flat kawaii, sheet-exact,
   2026-11-08): all 25 animals from the parent's reference
   sheet, redrawn to match it exactly as closely as SVG
   allows — thick dark-brown outlines, flat fills, big glossy
   black eyes with white highlights, small simple mouths,
   pink blush cheeks. This is a STYLE RESET from the round-3/4
   shaded 3D plush look: no gradients for shading, no fur
   texture, no grain — flat colours, exactly like the sheet.
   The parent asked for it directly: "Change them to these
   characters. exactly the same. No need change color option."
     • NO COLOUR OPTION: animals keep their own colours from
       the sheet. A stored e.look.color is NEVER read (the
       same way stored hair was ignored in round 2).
     • NO ACCESSORIES: the parent dropped them (2026-11-08 —
       per-animal positioning for 25 animals was too fiddly,
       as the chick proved). A stored e.look.accessory is
       NEVER read, the same way a stored colour is ignored.
     • CUSTOM BACKGROUND: shape (circle, heart, star, rounded
       square, cloud, flower) × colour (6 pastels + none) ×
       pattern (none, polka dots, stars, stripes, hearts) ×
       effect (plain, glitter, glow, shine, twinkle, bubbles,
       petals) — part of the look. Patterns and animated
       effects are drawn INSIDE the shape (clipped to it),
       subtle so the animal still pops.
     • TAP TO PLAY: tapping the animal makes it do a happy
       jump with squash-and-stretch plus a tiny sparkle burst.
       The frog hops higher, the rabbit wiggles its ears
       faster. The idle bob/blink keep running underneath and
       the trick ends by itself, so the idle life resumes.
     • GROUND SHADOW: a soft ellipse under the feet, between
       the background and the animal, so the character lifts
       off the background and pops — flat and soft, not a heavy
       3D drop shadow.
   ANIMATION (CSS only, classes in AVATAR_5_CSS): gentle
   bobbing, blinking every few seconds, and a signature motion
   for the obvious ones — all slow and calm, transform/opacity
   only. The svg carries class="av5", so the rules only touch
   avatar characters.
   OTTER + BUTTERFLY are gone (not in the sheet): a stored
   face of 🦦 or 🦋 falls back gracefully to the chick (the
   first animal on the sheet). Stored as e.look=
   {background:{shape,color,pattern,effect}}, stamped by
   e.lookAt, merged later-wins (whole look object). */
var AV_INK='#4a3226';
var AV_EYE='#26221f';
var AV_BLUSH='#f7a8b8';
/* Background shapes, colours and effects. Colours are pastel,
   matching the cute theme; 'none' means no background at all. */
var LOOK_BG_SHAPES=['circle','heart','star','square','cloud','flower'];
var LOOK_BG_COLORS={mint:'#bfe8d8',pink:'#ffd6e0',sky:'#cfe8ff',lilac:'#e6d9ff',peach:'#ffe3c7',lemon:'#fff3b0'};
var LOOK_BG_COLOR_NAMES=['mint','pink','sky','lilac','peach','lemon'];
var LOOK_BG_EFFECTS=['plain','glitter','glow','shine','twinkle','bubbles','petals'];
/* Background patterns, drawn inside the shape (clipped to it) in
   white at low opacity, so the animal still pops off it. '' is none. */
var LOOK_BG_PATTERNS=['','dots','stars','stripes','hearts'];
/* One background shape, centred on (100,135), ~190 wide. The
   element has no fill/stroke — bgShapeEl adds them. */
var BG_SHAPE_EL={
 circle:'<circle cx="100" cy="135" r="92"/>',
 heart:'<path d="M100,246 C54,212 4,176 4,120 C4,82 32,48 66,48 C84,48 96,60 100,78 C104,60 116,48 134,48 C168,48 196,82 196,120 C196,176 146,212 100,246 Z"/>',
 star:'<path d="M100,40 L125,101 L190,106 L140,148 L156,212 L100,177 L44,212 L60,148 L10,106 L75,101 Z"/>',
 square:'<rect x="12" y="48" width="176" height="176" rx="28"/>',
 cloud:'<path d="M25,200 A25,25 0 0 1 18,160 A32,32 0 0 1 45,105 A32,32 0 0 1 95,85 A30,30 0 0 1 145,100 A28,28 0 0 1 182,140 A28,28 0 0 1 185,195 Q100,212 25,200 Z"/>',
 flower:'<path d="M135,74 A40,40 0 0 1 170,135 A40,40 0 0 1 135,196 A40,40 0 0 1 65,196 A40,40 0 0 1 30,135 A40,40 0 0 1 65,74 A40,40 0 0 1 135,74 Z"/>'
};
function bgShapeEl(shape, fill, stroke){
  var el=BG_SHAPE_EL[shape]||BG_SHAPE_EL.circle;
  return el.replace('/>', ' fill="'+fill+'" stroke="'+(stroke||AV_INK)+'" stroke-width="3" stroke-linejoin="round"/>');
}
/* Big glossy kawaii eyes (the sheet's eyes: solid black ovals
   with a white highlight), wrapped in the blink group. d is
   the stagger delay. */
function kEyes(x1,y1,x2,y2,r,d){
  return '<g class="av-blink" style="animation-delay:'+(d||'-0.4s')+'">'
  +'<ellipse cx="'+x1+'" cy="'+y1+'" rx="'+r+'" ry="'+(r*1.15).toFixed(1)+'" fill="'+AV_EYE+'"/>'
  +'<ellipse cx="'+x2+'" cy="'+y2+'" rx="'+r+'" ry="'+(r*1.15).toFixed(1)+'" fill="'+AV_EYE+'"/>'
  +'<circle cx="'+(x1-r*0.35).toFixed(1)+'" cy="'+(y1-r*0.45).toFixed(1)+'" r="'+(r*0.38).toFixed(1)+'" fill="#ffffff"/>'
  +'<circle cx="'+(x2-r*0.35).toFixed(1)+'" cy="'+(y2-r*0.45).toFixed(1)+'" r="'+(r*0.38).toFixed(1)+'" fill="#ffffff"/>'
  +'</g>';
}
/* Pink blush cheeks, the sheet's signature. */
function kBlush(x1,y1,x2,y2){
  return '<ellipse cx="'+x1+'" cy="'+y1+'" rx="7" ry="4.5" fill="'+AV_BLUSH+'" opacity="0.85"/><ellipse cx="'+x2+'" cy="'+y2+'" rx="7" ry="4.5" fill="'+AV_BLUSH+'" opacity="0.85"/>';
}
/* A small simple mouth. */
function kSmile(cx,cy,w){
  return '<path d="M'+(cx-w)+','+cy+' Q'+cx+','+(cy+6)+' '+(cx+w)+','+cy+'" fill="none" stroke="'+AV_EYE+'" stroke-width="2.5" stroke-linecap="round"/>';
}
/* A 4-point star path, centred on (cx,cy) — the shared shape
   for the glitter sparkles, the twinkle stars and the tap-to-play
   burst. The position is baked into the path (no transform
   attribute), so a CSS animation on the element itself is free
   to move it. */
function kStar4(cx,cy,s){
  return 'M'+cx+','+(cy-s)+' L'+(cx+s*0.25).toFixed(1)+','+(cy-s*0.25).toFixed(1)+' L'+(cx+s)+','+cy+' L'+(cx+s*0.25).toFixed(1)+','+(cy+s*0.25).toFixed(1)+' L'+cx+','+(cy+s)+' L'+(cx-s*0.25).toFixed(1)+','+(cy+s*0.25).toFixed(1)+' L'+(cx-s)+','+cy+' L'+(cx-s*0.25).toFixed(1)+','+(cy-s*0.25).toFixed(1)+' Z';
}
/* A 4-point sparkle, centred on (cx,cy), for the glitter effect. */
function kSpark(cx,cy,s,fill,delay){
  return '<path class="av-twinkle" style="animation-delay:'+delay+'" d="'+kStar4(cx,cy,s)+'" fill="'+fill+'"/>';
}
/* Background patterns, drawn inside the shape (clipped by
   bgClip) — white, bold enough to read at the real 120px size.
   The first version was too faint (dots 0.32, stars 0.4,
   stripes 0.16, hearts 0.35): at 120px the stars, hearts and
   stripes were invisible and a child could not tell them from
   none. The screen's fix round bumped them (dots 0.45, stars
   0.6, stripes 0.3, hearts 0.55) and made the stars and hearts
   slightly larger — still white, and the animal still pops,
   because the pattern only shows in the thin margins around
   it. The shape is ~190 wide centred on (100,135); anything
   outside it is clipped away. */
function bgPatternSVG(pattern){
  var i,s='';
  if(pattern==='dots'){
    var rows=[70,105,140,175,210];
    for(var r=0;r<rows.length;r++){
      var off=(r%2)?15:0;
      for(var x=30+off;x<=180;x+=30){ s+='<circle cx="'+x+'" cy="'+rows[r]+'" r="4" fill="#ffffff" opacity="0.45"/>'; }
    }
    return s;
  }
  if(pattern==='stars'){
    var spots=[[45,75],[155,70],[30,140],[170,140],[60,200],[140,200],[100,110]];
    for(i=0;i<spots.length;i++){ s+='<path d="'+kStar4(spots[i][0],spots[i][1],8)+'" fill="#ffffff" opacity="0.6"/>'; }
    return s;
  }
  if(pattern==='stripes'){
    for(var x=-10;x<=170;x+=60){ s+='<rect x="'+x+'" y="-60" width="16" height="380" fill="#ffffff" opacity="0.3" transform="rotate(18 100 135)"/>'; }
    return s;
  }
  if(pattern==='hearts'){
    var hps=[[50,80],[150,75],[35,150],[165,150],[75,205],[125,205],[100,115]];
    for(i=0;i<hps.length;i++){ s+='<path d="M0,-4 C-3,-8 -9,-8 -9,-3 C-9,2 -4,6 0,9 C4,6 9,2 9,-3 C9,-8 3,-8 0,-4 Z" fill="#ffffff" opacity="0.55" transform="translate('+hps[i][0]+' '+hps[i][1]+') scale(1.3)"/>'; }
    return s;
  }
  return '';
}
/* Animated background effects — drawn inside the shape (clipped
   by bgClip), gentle and slow. Each element carries a staggered
   negative animation-delay, so the cycle is already spread out
   on load instead of starting in lockstep. The classes are
   animated by AVATAR_5_CSS and switched off by the
   reduced-motion rule, exactly like the bob and blink. */
function bgTwinkleSVG(){
  var spots=[[40,75,10],[160,70,9],[28,135,9],[172,135,10],[55,195,9],[145,195,9]];
  var s='';
  for(var i=0;i<spots.length;i++){ s+='<path class="av-twinklebg" style="animation-delay:'+(i*0.5)+'s" d="'+kStar4(spots[i][0],spots[i][1],spots[i][2])+'" fill="'+(i%2?'#ffd166':'#ffffff')+'"/>'; }
  return s;
}
function bgBubblesSVG(){
  var spots=[[45,215,6],[75,225,8],[105,210,5],[130,225,7],[160,215,6],[60,205,5]];
  var s='';
  for(var i=0;i<spots.length;i++){ s+='<circle class="av-bub" style="animation-delay:'+(-i*1.2)+'s" cx="'+spots[i][0]+'" cy="'+spots[i][1]+'" r="'+spots[i][2]+'" fill="#ffffff"/>'; }
  return s;
}
function bgPetalsSVG(){
  /* Soft pink (#f7a8b8 — the blush pink; petals are naturally
     pink), not white: white petals on pale sky blue were
     invisible at 120px, and at 0.55 they barely read even at
     3x zoom. Slightly larger than before, holding at 0.6 while
     they fall. The spots sit in the left/right margins and the
     top crescent — the first version put them all in the middle,
     where they spent most of the fall hidden behind the animal.
     These stay visible for most of the fall, so the falling
     motion reads in the stills. */
  var spots=[[28,60],[172,50],[100,42],[32,135],[168,125],[55,58],[145,62]];
  var s='';
  /* Each petal sits in its own positioned <g> and the CSS
     animates the path inside it — a transform attribute on the
     path itself would be overridden by the animation. */
  for(var i=0;i<spots.length;i++){ s+='<g transform="translate('+spots[i][0]+' '+spots[i][1]+')"><path class="av-pet" style="animation-delay:'+(-i*1.15)+'s" d="M0,-9 C5,-3 5,5 0,9 C-5,5 -5,-3 0,-9 Z" fill="#f7a8b8"/></g>'; }
  return s;
}
/* The 25 animals, in sheet order (row by row). The picker
   shows this list; the first animal (chick) is the fallback
   for any stored face that is not on the sheet. */
var LOOK_FACES=['🐤','🐴','🐧','🐻','🐢','🐼','🦁','🐱','🐷','🦊','🐸','🐘','🦒','🐰','🦉','🦝','🐵','🐯','🐊','🐶','🦥','🦆','🦛','🐑','🐨'];
var AVATAR_FACE_EMOJI={'🐤':'chick','🐴':'horse','🐧':'penguin','🐻':'bear','🐢':'turtle','🐼':'panda','🦁':'lion','🐱':'cat','🐷':'pig','🦊':'fox','🐸':'frog','🐘':'elephant','🦒':'giraffe','🐰':'rabbit','🦉':'owl','🦝':'raccoon','🐵':'monkey','🐯':'tiger','🐊':'crocodile','🐶':'dog','🦥':'sloth','🦆':'duck','🦛':'hippo','🐑':'sheep','🐨':'koala'};
/* (Accessories were dropped by the parent, 2026-11-08 — a stored
   e.look.accessory is never read. There is no accessory code
   left in this file.) */

/* ------------------------------------------------------------------
   The 25 animals — flat kawaii, sheet-exact. Each draw() returns
   the animal's svg, in the 200×260 viewBox. Shared layout: the
   ground is y≈235, the ground shadow sits at y≈246, the head
   is around (100, 72–84) and the body around (100, 178). Every
   main shape: flat fill, thick dark-brown outline (3px), round
   joins. Eyes are the sheet's big glossy black ovals with a
   white highlight; blush is two pink ovals. No gradients for
   shading, no fur, no grain. */
var AVATAR_ANIMALS={
 chick:{draw:function(p){
   return '<ellipse cx="78" cy="228" rx="8" ry="5" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="122" cy="228" rx="8" ry="5" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="46" cy="165" rx="10" ry="18" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-15 46 165)"/>'
   +'<ellipse cx="154" cy="165" rx="10" ry="18" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(15 154 165)"/>'
   +'<ellipse cx="100" cy="155" rx="56" ry="68" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M94,90 Q92,82 88,78 M100,88 Q100,79 100,74 M106,90 Q108,82 112,78" fill="none" stroke="#f2b705" stroke-width="2.5" stroke-linecap="round"/>'
   +kEyes(80,125,120,125,8.5,p.bdelay)
   +'<path d="M92,136 L108,136 L100,146 Z" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>'
   +kBlush(66,142,134,142);
 }},
 horse:{draw:function(p){
   return '<path d="M48,190 Q34,194 36,206 Q38,214 46,212" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linecap="round"/>'
   +'<ellipse cx="78" cy="216" rx="10" ry="14" fill="#eec9a0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="122" cy="216" rx="10" ry="14" fill="#eec9a0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="78" cy="228" rx="10" ry="5" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="122" cy="228" rx="10" ry="5" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="100" cy="175" rx="50" ry="48" fill="#eec9a0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M58,66 C56,34 78,20 100,20 C124,20 142,36 142,62 L132,62 C132,44 118,32 100,32 C82,32 68,46 68,66 Z" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M58,48 L54,28 L74,38 Z" fill="#eec9a0" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linejoin="round"/>'
   +'<path d="M142,48 L146,28 L126,38 Z" fill="#eec9a0" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linejoin="round"/>'
   +'<circle cx="100" cy="78" r="42" fill="#eec9a0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M68,66 C70,44 84,34 100,34 C118,34 132,46 132,66 C126,50 114,44 100,44 C86,44 74,50 68,66 Z" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +kEyes(78,70,122,70,8,p.bdelay)
   +'<ellipse cx="100" cy="94" rx="20" ry="12" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="92" cy="94" rx="1.8" ry="2.5" fill="'+AV_INK+'"/><ellipse cx="108" cy="94" rx="1.8" ry="2.5" fill="'+AV_INK+'"/>'
   +kBlush(64,84,136,84);
 }},
 penguin:{draw:function(p){
   return '<ellipse cx="74" cy="230" rx="11" ry="6" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="230" rx="11" ry="6" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="50" cy="175" rx="8" ry="20" fill="#2b2b33" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-15 50 175)"/>'
   +'<ellipse cx="150" cy="175" rx="8" ry="20" fill="#2b2b33" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(15 150 175)"/>'
   +'<ellipse cx="100" cy="178" rx="50" ry="52" fill="#2b2b33" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="188" rx="32" ry="38" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="76" r="44" fill="#2b2b33" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="84" rx="30" ry="22" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +kEyes(84,74,116,74,7.5,p.bdelay)
   +'<path d="M93,84 L107,84 L100,94 Z" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>';
 }},
 bear:{draw:function(p){
   return '<circle cx="58" cy="42" r="12" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="3"/><circle cx="58" cy="42" r="6" fill="#f6b8c1"/>'
   +'<circle cx="142" cy="42" r="12" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="3"/><circle cx="142" cy="42" r="6" fill="#f6b8c1"/>'
   +'<ellipse cx="50" cy="175" rx="9" ry="20" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 50 175)"/>'
   +'<ellipse cx="150" cy="175" rx="9" ry="20" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(12 150 175)"/>'
   +'<ellipse cx="100" cy="178" rx="50" ry="50" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="30" ry="34" fill="#e8c39a" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="74" cy="228" rx="13" ry="7" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="13" ry="7" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="78" r="46" fill="#c98a4b" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(80,72,120,72,8,p.bdelay)
   +'<ellipse cx="100" cy="92" rx="18" ry="11" fill="#e8c39a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="100" cy="86" rx="6" ry="4.5" fill="'+AV_EYE+'"/>'
   +'<path d="M94,96 Q100,101 106,96" fill="none" stroke="'+AV_EYE+'" stroke-width="2.5" stroke-linecap="round"/>'
   +kBlush(64,86,136,86);
 }},
 turtle:{draw:function(p){
   return '<ellipse cx="58" cy="228" rx="10" ry="7" fill="#7cc46a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="84" cy="231" rx="10" ry="7" fill="#7cc46a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="116" cy="231" rx="10" ry="7" fill="#7cc46a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="142" cy="228" rx="10" ry="7" fill="#7cc46a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M100,100 C142,100 160,136 160,176 C160,206 134,228 100,228 C66,228 40,206 40,176 C40,136 58,100 100,100 Z" fill="#a67c52" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M100,124 L124,140 L112,172 L88,172 L76,140 Z" fill="#8a5f3c" opacity="0.35" stroke="#8a5f3c" stroke-width="2" stroke-linejoin="round"/>'
   +'<path d="M76,140 L64,172 L88,172 Z M124,140 L136,172 L112,172 Z" fill="#8a5f3c" opacity="0.25" stroke="#8a5f3c" stroke-width="2" stroke-linejoin="round"/>'
   +'<circle cx="100" cy="72" r="32" fill="#7cc46a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(88,68,112,68,7,p.bdelay)
   +kSmile(100,82,10)
   +'<ellipse cx="78" cy="80" rx="5" ry="3.5" fill="'+AV_BLUSH+'" opacity="0.85"/><ellipse cx="122" cy="80" rx="5" ry="3.5" fill="'+AV_BLUSH+'" opacity="0.85"/>';
 }},
 panda:{draw:function(p){
   return '<circle cx="58" cy="42" r="13" fill="'+AV_EYE+'" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<circle cx="142" cy="42" r="13" fill="'+AV_EYE+'" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="50" cy="175" rx="10" ry="22" fill="'+AV_EYE+'" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-15 50 175)"/>'
   +'<ellipse cx="150" cy="175" rx="10" ry="22" fill="'+AV_EYE+'" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(15 150 175)"/>'
   +'<ellipse cx="100" cy="178" rx="50" ry="50" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="74" cy="228" rx="13" ry="7" fill="'+AV_EYE+'" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="13" ry="7" fill="'+AV_EYE+'" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="78" r="46" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="80" cy="74" rx="11" ry="16" fill="'+AV_EYE+'" transform="rotate(-12 80 74)"/>'
   +'<ellipse cx="120" cy="74" rx="11" ry="16" fill="'+AV_EYE+'" transform="rotate(12 120 74)"/>'
   +'<g class="av-blink" style="animation-delay:'+(p.bdelay||'-0.4s')+'">'
   +'<ellipse cx="80" cy="74" rx="5.5" ry="7" fill="#ffffff"/><ellipse cx="120" cy="74" rx="5.5" ry="7" fill="#ffffff"/>'
   +'<circle cx="80" cy="75" r="3" fill="'+AV_EYE+'"/><circle cx="120" cy="75" r="3" fill="'+AV_EYE+'"/>'
   +'<circle cx="78.5" cy="72" r="1.2" fill="#ffffff"/><circle cx="118.5" cy="72" r="1.2" fill="#ffffff"/>'
   +'</g>'
   +'<ellipse cx="100" cy="90" rx="6" ry="4.5" fill="'+AV_EYE+'"/>'
   +kSmile(100,98,9)
   +kBlush(64,88,136,88);
 }},
 lion:{draw:function(p){
   return '<path d="M148,192 C168,188 178,172 172,158" fill="none" stroke="'+AV_INK+'" stroke-width="12" stroke-linecap="round"/>'
   +'<path d="M148,192 C168,188 178,172 172,158" fill="none" stroke="#f7b95c" stroke-width="7" stroke-linecap="round"/>'
   +'<circle cx="172" cy="156" r="10" fill="#d97f2b" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="52" cy="178" rx="9" ry="20" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 178)"/>'
   +'<ellipse cx="148" cy="178" rx="9" ry="20" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(12 148 178)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="78" r="56" fill="#e08a2e" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<circle cx="64" cy="36" r="8" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="2.5"/><circle cx="64" cy="36" r="4" fill="#f6b8c1"/>'
   +'<circle cx="136" cy="36" r="8" fill="#f7b95c" stroke="'+AV_INK+'" stroke-width="2.5"/><circle cx="136" cy="36" r="4" fill="#f6b8c1"/>'
   +'<circle cx="100" cy="78" r="40" fill="#f9c86a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(82,74,118,74,8,p.bdelay)
   +'<ellipse cx="100" cy="86" rx="7" ry="5" fill="#8a5a2e"/>'
   +kSmile(100,94,11)
   +kBlush(66,86,134,86);
 }},
 cat:{draw:function(p){
   return '<path d="M148,190 C170,186 178,168 170,154 C166,146 156,148 158,158 C160,168 152,176 144,180" fill="none" stroke="'+AV_INK+'" stroke-width="12" stroke-linecap="round"/>'
   +'<path d="M148,190 C170,186 178,168 170,154 C166,146 156,148 158,158 C160,168 152,176 144,180" fill="none" stroke="#b8b8c0" stroke-width="8" stroke-linecap="round"/>'
   +'<ellipse cx="100" cy="178" rx="46" ry="48" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="78" cy="226" rx="12" ry="7" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="122" cy="226" rx="12" ry="7" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M62,44 L56,10 L88,30 Z" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M63,36 L60,18 L78,29 Z" fill="#f6b8c1"/>'
   +'<path d="M138,44 L144,10 L112,30 Z" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M137,36 L140,18 L122,29 Z" fill="#f6b8c1"/>'
   +'<circle cx="100" cy="78" r="44" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(82,74,118,74,8,p.bdelay)
   +'<path d="M94,84 L106,84 L100,90 Z" fill="#e88aa0" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>'
   +kSmile(100,94,10)
   +'<path d="M56,80 L40,76 M56,88 L40,90 M144,80 L160,76 M144,88 L160,90" fill="none" stroke="'+AV_INK+'" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>'
   +kBlush(66,86,134,86);
 }},

 pig:{draw:function(p){
   return '<path d="M150,172 C162,166 172,170 170,180 C168,188 158,190 156,182" fill="none" stroke="#e88aa0" stroke-width="3" stroke-linecap="round"/>'
   +'<ellipse cx="100" cy="178" rx="50" ry="50" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="32" ry="34" fill="#fadde2" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="74" cy="228" rx="13" ry="7" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="13" ry="7" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="60" cy="52" rx="10" ry="16" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(20 60 52)"/>'
   +'<ellipse cx="140" cy="52" rx="10" ry="16" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(-20 140 52)"/>'
   +'<ellipse cx="60" cy="54" rx="5" ry="9" fill="#e88aa0" transform="rotate(20 60 54)"/>'
   +'<ellipse cx="140" cy="54" rx="5" ry="9" fill="#e88aa0" transform="rotate(-20 140 54)"/>'
   +'<circle cx="100" cy="78" r="44" fill="#f6b8c1" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(82,70,118,70,8,p.bdelay)
   +'<ellipse cx="100" cy="90" rx="16" ry="11" fill="#e88aa0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="94" cy="90" rx="2.5" ry="3.5" fill="'+AV_INK+'" opacity="0.6"/><ellipse cx="106" cy="90" rx="2.5" ry="3.5" fill="'+AV_INK+'" opacity="0.6"/>'
   +kSmile(100,104,9)
   +kBlush(64,84,136,84);
 }},
 fox:{draw:function(p){
   return '<path d="M146,182 C174,172 188,142 178,118 C172,102 156,104 154,120 C152,138 142,158 136,172 Z" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="170" cy="118" rx="11" ry="15" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(18 170 118)"/>'
   +'<ellipse cx="52" cy="178" rx="9" ry="20" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 178)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="50" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="34" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M60,44 L54,8 L88,30 Z" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M62,36 L59,17 L80,29 Z" fill="#ffffff"/>'
   +'<path d="M140,44 L146,8 L112,30 Z" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M138,36 L141,17 L120,29 Z" fill="#ffffff"/>'
   +'<circle cx="100" cy="78" r="44" fill="#f08a3c" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="96" rx="22" ry="13" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2"/>'
   +kEyes(82,72,118,72,8,p.bdelay)
   +'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="'+AV_EYE+'"/>'
   +kSmile(100,96,11)
   +kBlush(64,84,136,84);
 }},
 frog:{draw:function(p){
   return '<g class="av-hop" style="animation-delay:'+(p.bobDelay||'0s')+'">'
   +'<ellipse cx="52" cy="176" rx="8" ry="20" fill="#58b368" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-15 52 176)"/>'
   +'<ellipse cx="148" cy="176" rx="8" ry="20" fill="#58b368" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(15 148 176)"/>'
   +'<ellipse cx="100" cy="178" rx="52" ry="48" fill="#58b368" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="188" rx="34" ry="34" fill="#d8ec9a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="66" cy="228" rx="16" ry="9" fill="#58b368" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="134" cy="228" rx="16" ry="9" fill="#58b368" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M62,228 L62,233 M134,228 L134,233" fill="none" stroke="#2f7a3d" stroke-width="2" stroke-linecap="round"/>'
   +'<circle cx="100" cy="84" r="46" fill="#58b368" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<g class="av-blink" style="animation-delay:'+(p.bdelay||'-0.4s')+'">'
   +'<circle cx="70" cy="46" r="17" fill="#58b368" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<circle cx="130" cy="46" r="17" fill="#58b368" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<circle cx="70" cy="46" r="11.5" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<circle cx="130" cy="46" r="11.5" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<circle cx="70" cy="46" r="5" fill="'+AV_EYE+'"/><circle cx="130" cy="46" r="5" fill="'+AV_EYE+'"/>'
   +'<circle cx="68" cy="43" r="2" fill="#ffffff"/><circle cx="128" cy="43" r="2" fill="#ffffff"/>'
   +'</g>'
   +'<ellipse cx="100" cy="128" rx="22" ry="10" fill="#d8ec9a" opacity="0.6"/>'
   +'<ellipse cx="92" cy="86" rx="1.8" ry="2.5" fill="#2f7a3d"/><ellipse cx="108" cy="86" rx="1.8" ry="2.5" fill="#2f7a3d"/>'
   +'<path d="M70,96 Q100,114 130,96" fill="none" stroke="#2f7a3d" stroke-width="3" stroke-linecap="round"/>'
   +'<ellipse cx="66" cy="92" rx="6" ry="4" fill="#a8d8a0" opacity="0.7"/><ellipse cx="134" cy="92" rx="6" ry="4" fill="#a8d8a0" opacity="0.7"/>'
   +'</g>';
 }},
 elephant:{draw:function(p){
   return '<path d="M52,180 C40,178 34,168 38,158" fill="none" stroke="'+AV_INK+'" stroke-width="8" stroke-linecap="round"/>'
   +'<path d="M52,180 C40,178 34,168 38,158" fill="none" stroke="#a8d8e8" stroke-width="5" stroke-linecap="round"/>'
   +'<circle cx="38" cy="156" r="4" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="100" cy="180" rx="52" ry="48" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="192" rx="32" ry="32" fill="#c8e6f2" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="72" cy="228" rx="12" ry="8" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="128" cy="228" rx="12" ry="8" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="52" cy="72" rx="16" ry="26" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(-12 52 72)"/>'
   +'<ellipse cx="148" cy="72" rx="16" ry="26" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(12 148 72)"/>'
   +'<ellipse cx="52" cy="72" rx="9" ry="18" fill="#f6b8c1" transform="rotate(-12 52 72)"/>'
   +'<ellipse cx="148" cy="72" rx="9" ry="18" fill="#f6b8c1" transform="rotate(12 148 72)"/>'
   +'<circle cx="100" cy="76" r="44" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<g class="av-sway" style="animation-delay:'+(p.bobDelay||'0s')+'">'
   +'<path d="M92,86 C90,110 88,130 94,144 C97,152 107,152 109,144 C111,132 106,112 108,88 C104,92 96,92 92,86 Z" fill="#a8d8e8" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linejoin="round"/>'
   +'</g>'
   +kEyes(80,68,120,68,8,p.bdelay)
   +kBlush(64,84,136,84);
 }},
 giraffe:{draw:function(p){
   return '<path d="M148,180 C160,178 166,168 164,158" fill="none" stroke="'+AV_INK+'" stroke-width="9" stroke-linecap="round"/>'
   +'<path d="M148,180 C160,178 166,168 164,158" fill="none" stroke="#f7d774" stroke-width="5" stroke-linecap="round"/>'
   +'<circle cx="164" cy="156" r="7" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="72" y="198" width="10" height="32" rx="4" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<rect x="92" y="202" width="10" height="28" rx="4" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<rect x="108" y="202" width="10" height="28" rx="4" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<rect x="128" y="198" width="10" height="32" rx="4" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<rect x="72" y="222" width="10" height="9" rx="3" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="92" y="222" width="10" height="9" rx="3" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="108" y="222" width="10" height="9" rx="3" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="128" y="222" width="10" height="9" rx="3" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="100" cy="185" rx="48" ry="45" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="78" cy="172" rx="8" ry="6" fill="#b07a45"/><ellipse cx="118" cy="196" rx="9" ry="7" fill="#b07a45"/><ellipse cx="128" cy="166" rx="6" ry="5" fill="#b07a45"/><ellipse cx="88" cy="200" rx="7" ry="5" fill="#b07a45"/>'
   +'<path d="M86,80 L86,150 Q86,162 100,162 Q114,162 114,150 L114,80 Z" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="120" rx="6" ry="8" fill="#b07a45"/><ellipse cx="92" cy="146" rx="5" ry="6" fill="#b07a45"/>'
   +'<ellipse cx="66" cy="52" rx="8" ry="12" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-20 66 52)"/>'
   +'<ellipse cx="134" cy="52" rx="8" ry="12" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(20 134 52)"/>'
   +'<g class="av-nod" style="animation-delay:'+(p.bobDelay||'0s')+'">'
   +'<ellipse cx="100" cy="58" rx="34" ry="30" fill="#f7d774" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M86,34 L82,18 M114,34 L118,18" fill="none" stroke="#8a5a2e" stroke-width="3" stroke-linecap="round"/>'
   +'<circle cx="82" cy="16" r="5" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<circle cx="118" cy="16" r="5" fill="#8a5a2e" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="100" cy="70" rx="18" ry="11" fill="#e8c39a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="93" cy="70" rx="1.8" ry="2.5" fill="'+AV_INK+'"/><ellipse cx="107" cy="70" rx="1.8" ry="2.5" fill="'+AV_INK+'"/>'
   +kEyes(84,54,116,54,7.5,p.bdelay)
   +kBlush(68,66,132,66)
   +'</g>';
 }},
 rabbit:{draw:function(p){
   return '<circle cx="42" cy="196" r="12" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="100" cy="178" rx="46" ry="48" fill="#a8d0f0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#d8e8f8" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="72" cy="228" rx="13" ry="7" fill="#a8d0f0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="128" cy="228" rx="13" ry="7" fill="#a8d0f0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<g class="av-earwig" style="animation-delay:'+(p.bobDelay||'0s')+'">'
   +'<ellipse cx="76" cy="35" rx="9" ry="32" fill="#a8d0f0" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(-7 76 35)"/>'
   +'<ellipse cx="124" cy="35" rx="9" ry="32" fill="#a8d0f0" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(7 124 35)"/>'
   +'<ellipse cx="76" cy="37" rx="4.5" ry="22" fill="#f6b8c1" transform="rotate(-7 76 37)"/>'
   +'<ellipse cx="124" cy="37" rx="4.5" ry="22" fill="#f6b8c1" transform="rotate(7 124 37)"/>'
   +'</g>'
   +'<circle cx="100" cy="84" r="42" fill="#a8d0f0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(82,80,118,80,8,p.bdelay)
   +'<path d="M94,88 L106,88 L100,93 Z" fill="#e88aa0" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>'
   +'<rect x="94" y="95" width="5.5" height="9" rx="2" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<rect x="100.5" y="95" width="5.5" height="9" rx="2" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +kBlush(66,92,134,92);
 }},
 owl:{draw:function(p){
   return '<path d="M64,44 L58,24 L78,36 Z" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M136,44 L142,24 L122,36 Z" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<ellipse cx="52" cy="175" rx="9" ry="22" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 175)"/>'
   +'<ellipse cx="148" cy="175" rx="9" ry="22" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(12 148 175)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="50" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="30" ry="34" fill="#e8c39a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="76" cy="228" rx="11" ry="6" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="124" cy="228" rx="11" ry="6" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="78" r="44" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<g class="av-blink" style="animation-delay:'+(p.bdelay||'-0.4s')+'">'
   +'<circle cx="82" cy="72" r="13" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="118" cy="72" r="13" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="82" cy="73" r="6.5" fill="'+AV_EYE+'"/><circle cx="118" cy="73" r="6.5" fill="'+AV_EYE+'"/>'
   +'<circle cx="80" cy="70" r="2.5" fill="#ffffff"/><circle cx="116" cy="70" r="2.5" fill="#ffffff"/>'
   +'</g>'
   +'<path d="M94,84 L106,84 L100,92 Z" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>'
   +kBlush(64,88,136,88);
 }},
 raccoon:{draw:function(p){
   return '<path d="M148,192 C170,188 182,170 176,152 C172,142 160,142 160,152" fill="none" stroke="'+AV_INK+'" stroke-width="19" stroke-linecap="round"/>'
   +'<path d="M148,192 C170,188 182,170 176,152 C172,142 160,142 160,152" fill="none" stroke="#a9a9b3" stroke-width="14" stroke-linecap="round"/>'
   +'<path d="M160,188 L172,184 M170,172 L178,166 M174,156 L178,150" fill="none" stroke="#4a4a52" stroke-width="3" stroke-linecap="round"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#d8d8de" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="52" cy="178" rx="9" ry="20" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 178)"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M62,44 L56,10 L88,30 Z" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M63,36 L60,18 L78,29 Z" fill="#f6b8c1"/>'
   +'<path d="M138,44 L144,10 L112,30 Z" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M137,36 L140,18 L122,29 Z" fill="#f6b8c1"/>'
   +'<circle cx="100" cy="78" r="44" fill="#a9a9b3" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M62,66 Q100,52 138,66 Q138,82 100,88 Q62,82 62,66 Z" fill="#4a4a52"/>'
   +kEyes(82,72,118,72,7.5,p.bdelay)
   +'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="'+AV_EYE+'"/>'
   +kSmile(100,96,10)
   +kBlush(64,86,136,86);
 }},

 monkey:{draw:function(p){
   return '<path d="M52,190 C36,186 28,172 34,160 C38,152 48,154 48,162" fill="none" stroke="'+AV_INK+'" stroke-width="10" stroke-linecap="round"/>'
   +'<path d="M52,190 C36,186 28,172 34,160 C38,152 48,154 48,162" fill="none" stroke="#a8763e" stroke-width="6" stroke-linecap="round"/>'
   +'<ellipse cx="50" cy="175" rx="9" ry="24" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 50 175)"/>'
   +'<ellipse cx="150" cy="175" rx="9" ry="24" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(12 150 175)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#e8c39a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="56" cy="72" r="11" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="3"/><circle cx="56" cy="72" r="6" fill="#e8c39a"/>'
   +'<circle cx="144" cy="72" r="11" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="3"/><circle cx="144" cy="72" r="6" fill="#e8c39a"/>'
   +'<circle cx="100" cy="78" r="44" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="80" rx="34" ry="32" fill="#e8c39a"/>'
   +kEyes(82,74,118,74,8,p.bdelay)
   +'<ellipse cx="94" cy="86" rx="2" ry="2.5" fill="#8a5a2e"/><ellipse cx="106" cy="86" rx="2" ry="2.5" fill="#8a5a2e"/>'
   +kSmile(100,94,11)
   +kBlush(66,88,134,88);
 }},
 tiger:{draw:function(p){
   return '<path d="M148,190 C168,186 178,168 170,152" fill="none" stroke="'+AV_INK+'" stroke-width="14" stroke-linecap="round"/>'
   +'<path d="M148,190 C168,186 178,168 170,152" fill="none" stroke="#f7a83c" stroke-width="10" stroke-linecap="round"/>'
   +'<path d="M158,184 L168,182 M166,168 L174,164" fill="none" stroke="'+AV_EYE+'" stroke-width="3" stroke-linecap="round"/>'
   +'<ellipse cx="52" cy="178" rx="9" ry="20" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 178)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M56,162 Q60,178 56,194 M144,162 Q140,178 144,194" fill="none" stroke="'+AV_EYE+'" stroke-width="3" stroke-linecap="round"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M62,44 L56,10 L88,30 Z" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M63,36 L60,18 L78,29 Z" fill="#ffffff"/>'
   +'<path d="M138,44 L144,10 L112,30 Z" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<path d="M137,36 L140,18 L122,29 Z" fill="#ffffff"/>'
   +'<circle cx="100" cy="78" r="44" fill="#f7a83c" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M88,44 Q90,50 88,56 M100,42 Q100,48 100,54 M112,44 Q110,50 112,56" fill="none" stroke="'+AV_EYE+'" stroke-width="2.5" stroke-linecap="round"/>'
   +kEyes(82,74,118,74,8,p.bdelay)
   +'<ellipse cx="100" cy="86" rx="6" ry="4.5" fill="#e88aa0"/>'
   +kSmile(100,94,11)
   +kBlush(66,86,134,86);
 }},
 crocodile:{draw:function(p){
   return '<path d="M182,188 L187,177 L192,189 Z" fill="#e8c94a" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>'
   +'<path d="M164,182 C178,180 190,188 193,200 C184,204 172,202 164,196 Z" fill="#6fbf5a" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linejoin="round"/>'
   +'<path d="M110,172 L116,150 L122,172 Z M126,172 L132,152 L138,172 Z M142,172 L148,155 L154,172 Z M156,174 L162,160 L168,174 Z" fill="#e8c94a" stroke="'+AV_INK+'" stroke-width="2" stroke-linejoin="round"/>'
   +'<path d="M14,170 C30,160 50,156 70,156 C95,156 120,160 142,166 C164,172 176,182 178,196 C178,208 168,218 150,220 C120,224 90,222 72,216 C58,210 40,200 28,190 C20,184 14,178 14,170 Z" fill="#6fbf5a" stroke="'+AV_INK+'" stroke-width="3" stroke-linejoin="round"/>'
   +'<ellipse cx="120" cy="203" rx="32" ry="15" fill="#d8ec9a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="86" cy="227" rx="11" ry="6.5" fill="#6fbf5a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="146" cy="227" rx="11" ry="6.5" fill="#6fbf5a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<g class="av-blink" style="animation-delay:'+(p.bdelay||'-0.4s')+'">'
   +'<circle cx="66" cy="146" r="11" fill="#6fbf5a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="94" cy="148" r="11" fill="#6fbf5a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="66" cy="146" r="7" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<circle cx="94" cy="148" r="7" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<circle cx="66" cy="146" r="3.5" fill="'+AV_EYE+'"/><circle cx="94" cy="148" r="3.5" fill="'+AV_EYE+'"/>'
   +'<circle cx="68" cy="143" r="1.5" fill="#ffffff"/><circle cx="96" cy="145" r="1.5" fill="#ffffff"/>'
   +'</g>'
   +'<ellipse cx="24" cy="168" rx="2" ry="2.5" fill="#2f7a3d"/><ellipse cx="36" cy="166" rx="2" ry="2.5" fill="#2f7a3d"/>'
   +'<ellipse cx="108" cy="172" rx="6" ry="4" fill="#f7a8b8" opacity="0.85"/>'
   +'<path d="M22,178 Q55,190 100,180" fill="none" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linecap="round"/>'
   +'<path d="M26,180 L31,180 L29,188 Z M40,183 L45,183 L43,191 Z M54,184 L59,184 L57,192 Z M66,184 L71,184 L69,192 Z" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="1.5" stroke-linejoin="round"/>';
 }},
 dog:{draw:function(p){
   return '<path d="M148,185 C160,180 164,168 158,158" fill="none" stroke="'+AV_INK+'" stroke-width="11" stroke-linecap="round"/>'
   +'<path d="M148,185 C160,180 164,168 158,158" fill="none" stroke="#f2e3c9" stroke-width="7" stroke-linecap="round"/>'
   +'<ellipse cx="52" cy="178" rx="9" ry="20" fill="#f2e3c9" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 178)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#f2e3c9" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#f2e3c9" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#f2e3c9" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<g class="av-earwig" style="animation-delay:'+(p.bobDelay||'0s')+'">'
   +'<ellipse cx="56" cy="68" rx="11" ry="24" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(14 56 68)"/>'
   +'<ellipse cx="144" cy="68" rx="11" ry="24" fill="#a8763e" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(-14 144 68)"/>'
   +'</g>'
   +'<circle cx="100" cy="78" r="44" fill="#f2e3c9" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="82" cy="72" rx="13" ry="15" fill="#a8763e" transform="rotate(-10 82 72)"/>'
   +kEyes(82,72,118,72,8,p.bdelay)
   +'<ellipse cx="100" cy="88" rx="7" ry="5" fill="'+AV_EYE+'"/>'
   +kSmile(100,96,11)
   +kBlush(64,86,136,86);
 }},
 sloth:{draw:function(p){
   return '<ellipse cx="48" cy="185" rx="10" ry="30" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(-8 48 185)"/>'
   +'<ellipse cx="152" cy="185" rx="10" ry="30" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3" transform="rotate(8 152 185)"/>'
   +'<path d="M44,212 L42,218 M48,214 L48,220 M52,212 L54,218 M148,212 L146,218 M152,214 L152,220 M156,212 L158,218" fill="none" stroke="#e8e2d4" stroke-width="2" stroke-linecap="round"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#d8c9a8" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="78" r="44" fill="#b08a5a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="80" cy="72" rx="12" ry="14" fill="#8a6a4a"/>'
   +'<ellipse cx="120" cy="72" rx="12" ry="14" fill="#8a6a4a"/>'
   +'<g class="av-blink" style="animation-delay:'+(p.bdelay||'-0.4s')+'">'
   +'<ellipse cx="80" cy="72" rx="7" ry="4.5" fill="'+AV_EYE+'"/>'
   +'<ellipse cx="120" cy="72" rx="7" ry="4.5" fill="'+AV_EYE+'"/>'
   +'<circle cx="78" cy="70" r="1.2" fill="#ffffff"/><circle cx="118" cy="70" r="1.2" fill="#ffffff"/>'
   +'</g>'
   +'<ellipse cx="100" cy="86" rx="5" ry="4" fill="'+AV_INK+'"/>'
   +kSmile(100,94,9)
   +kBlush(64,86,136,86);
 }},
 duck:{draw:function(p){
   return '<path d="M48,170 L32,160 L38,176 L32,188 L50,182 Z" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linejoin="round"/>'
   +'<ellipse cx="52" cy="175" rx="10" ry="20" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 175)"/>'
   +'<ellipse cx="148" cy="175" rx="10" ry="20" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(12 148 175)"/>'
   +'<ellipse cx="100" cy="178" rx="50" ry="48" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="76" cy="230" rx="11" ry="6" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="124" cy="230" rx="11" ry="6" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="76" r="40" fill="#ffd94a" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M94,50 Q92,42 88,38 M100,48 Q100,39 100,34 M106,50 Q108,42 112,38" fill="none" stroke="#f2b705" stroke-width="2.5" stroke-linecap="round"/>'
   +kEyes(82,70,118,70,8,p.bdelay)
   +'<ellipse cx="100" cy="88" rx="14" ry="8" fill="#ff9f1c" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<path d="M88,88 Q100,92 112,88" fill="none" stroke="'+AV_INK+'" stroke-width="2" stroke-linecap="round"/>'
   +kBlush(66,84,134,84);
 }},
 hippo:{draw:function(p){
   return '<ellipse cx="100" cy="182" rx="55" ry="48" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="194" rx="34" ry="30" fill="#d8d8de" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<ellipse cx="68" cy="228" rx="12" ry="8" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="94" cy="230" rx="12" ry="8" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="106" cy="230" rx="12" ry="8" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="132" cy="228" rx="12" ry="8" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="66" cy="44" r="8" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/><circle cx="66" cy="44" r="4" fill="#e8b8c0"/>'
   +'<circle cx="134" cy="44" r="8" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/><circle cx="134" cy="44" r="4" fill="#e8b8c0"/>'
   +'<ellipse cx="100" cy="82" rx="52" ry="40" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(78,62,122,62,6.5,p.bdelay)
   +'<ellipse cx="100" cy="96" rx="30" ry="16" fill="#e8b8c0" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="88" cy="94" rx="4" ry="5.5" fill="'+AV_INK+'"/><ellipse cx="112" cy="94" rx="4" ry="5.5" fill="'+AV_INK+'"/>'
   +kSmile(100,114,10)
   +kBlush(60,92,140,92);
 }},
 sheep:{draw:function(p){
   return '<rect x="70" y="200" width="9" height="30" rx="4" fill="#8a8a92" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="90" y="202" width="9" height="28" rx="4" fill="#8a8a92" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="110" y="202" width="9" height="28" rx="4" fill="#8a8a92" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="130" y="200" width="9" height="30" rx="4" fill="#8a8a92" stroke="'+AV_INK+'" stroke-width="2"/>'
   +'<rect x="70" y="224" width="9" height="7" rx="3" fill="#4a4a52" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<rect x="90" y="224" width="9" height="7" rx="3" fill="#4a4a52" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<rect x="110" y="224" width="9" height="7" rx="3" fill="#4a4a52" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<rect x="130" y="224" width="9" height="7" rx="3" fill="#4a4a52" stroke="'+AV_INK+'" stroke-width="1.5"/>'
   +'<path d="M148,178 A24,24 0 0 1 134,212 A24,24 0 0 1 100,226 A24,24 0 0 1 66,212 A24,24 0 0 1 52,178 A24,24 0 0 1 66,144 A24,24 0 0 1 100,130 A24,24 0 0 1 134,144 A24,24 0 0 1 148,178 Z" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="64" cy="78" rx="8" ry="14" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-25 64 78)"/>'
   +'<ellipse cx="136" cy="78" rx="8" ry="14" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(25 136 78)"/>'
   +'<circle cx="100" cy="78" r="34" fill="#b8b8c0" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<path d="M70,62 C70,44 84,34 100,34 C116,34 130,44 130,62 C120,54 112,56 104,60 C96,56 88,56 80,60 C76,58 72,60 70,62 Z" fill="#ffffff" stroke="'+AV_INK+'" stroke-width="2.5" stroke-linejoin="round"/>'
   +kEyes(84,76,116,76,7,p.bdelay)
   +'<ellipse cx="100" cy="88" rx="5" ry="4" fill="'+AV_INK+'"/>'
   +kSmile(100,96,8)
   +kBlush(68,88,132,88);
 }},
 koala:{draw:function(p){
   return '<circle cx="54" cy="44" r="16" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="3"/><circle cx="54" cy="44" r="9" fill="#d8d2ea"/>'
   +'<circle cx="146" cy="44" r="16" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="3"/><circle cx="146" cy="44" r="9" fill="#d8d2ea"/>'
   +'<ellipse cx="52" cy="178" rx="9" ry="20" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(-12 52 178)"/>'
   +'<ellipse cx="148" cy="178" rx="9" ry="20" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="2.5" transform="rotate(12 148 178)"/>'
   +'<ellipse cx="100" cy="178" rx="48" ry="48" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="3"/>'
   +'<ellipse cx="100" cy="190" rx="28" ry="32" fill="#d8d2ea" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="74" cy="228" rx="12" ry="7" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<ellipse cx="126" cy="228" rx="12" ry="7" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="2.5"/>'
   +'<circle cx="100" cy="78" r="44" fill="#b8b0d8" stroke="'+AV_INK+'" stroke-width="3"/>'
   +kEyes(80,70,120,70,7.5,p.bdelay)
   +'<ellipse cx="100" cy="88" rx="10" ry="14" fill="'+AV_EYE+'"/>'
   +'<ellipse cx="96" cy="82" rx="3" ry="5" fill="#ffffff" opacity="0.85"/>'
   +kSmile(100,106,8)
   +kBlush(64,86,136,86);
 }}
};

var avUid=0;
/* The avatar renderer. face is the emoji; look is
   {background:{shape,color,pattern,effect}}; glow is Pip's
   glow colour (ignored for the animal, kept for call-site
   compatibility); w is the width in px (default 190).
   The animal's own colours are always used — a stored colour
   value is ignored, like stored hair in round 2. A stored
   accessory value is ignored too (accessories were dropped).
   A stored face that is not on the sheet (🦦 otter, 🦋
   butterfly) falls back to the chick, the first animal.
   A stored background without a pattern falls back to none;
   an unknown pattern or effect falls back to none / plain.
   Draw order: background shape → pattern (clipped) → effects
   (clipped) → ground shadow → animal (jump group around the
   bob group) → tap-to-play sparkles (hidden until a tap).
   The svg is the tap target for avatarPlay: every avatar on
   the page renders through here, so the sidebar avatar, the
   editor preview and the Grand Door tile all play. */
function avatarLookHTML(face,look,glow,w){
  var key=AVATAR_FACE_EMOJI[face]||'chick';
  var a=AVATAR_ANIMALS[key]||AVATAR_ANIMALS.chick;
  var lk=look||{};
  var bg=lk.background||{};
  var shape=LOOK_BG_SHAPES.indexOf(bg.shape)>=0?bg.shape:'circle';
  var color=LOOK_BG_COLORS[bg.color]?bg.color:'mint';
  if(bg.color==='none') color='none';
  var pattern=LOOK_BG_PATTERNS.indexOf(bg.pattern)>=0?bg.pattern:'';
  var effect=LOOK_BG_EFFECTS.indexOf(bg.effect)>=0?bg.effect:'plain';
  var uid='a'+(++avUid);
  var W=w||190,H=Math.round(W*1.3);
  var p={uid:uid,bdelay:(-0.4+((avUid*0.7)%4.6)).toFixed(1)+'s',bobDelay:((avUid*0.9)%3.6).toFixed(1)+'s'};
  var s='<svg class="av5" viewBox="0 0 200 260" data-animal="'+key+'" width="'+W+'" height="'+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+key+'" onclick="avatarPlay(this)">';
  s+='<defs><radialGradient id="gSh'+uid+'"><stop offset="0%" stop-color="rgba(0,0,0,0.20)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/></radialGradient>'
  +'<clipPath id="bgClip'+uid+'">'+BG_SHAPE_EL[shape]+'</clipPath>'
  +(effect==='glow'?'<filter id="bgBlur'+uid+'" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>':'')
  +'</defs>';
  if(color!=='none'){
    if(effect==='glow'){
      s+='<g filter="url(#bgBlur'+uid+')" opacity="0.45" transform="translate(100 135) scale(1.15) translate(-100 -135)">'+BG_SHAPE_EL[shape].replace('/>', ' fill="'+LOOK_BG_COLORS[color]+'"/>')+'</g>';
    }
    s+=bgShapeEl(shape,LOOK_BG_COLORS[color]);
    if(pattern){
      s+='<g clip-path="url(#bgClip'+uid+')">'+bgPatternSVG(pattern)+'</g>';
    }
    if(effect==='glitter'){
      s+='<g clip-path="url(#bgClip'+uid+')">'
      +kSpark(28,80,10,'#ffffff','0s')+kSpark(172,75,9,'#ffd166','0.4s')+kSpark(25,130,9,'#ffd166','0.9s')+kSpark(175,135,10,'#ffffff','0.2s')+kSpark(30,180,9,'#ffffff','0.7s')+kSpark(170,185,9,'#ffd166','1.1s')+kSpark(45,105,8,'#ffffff','0.5s')+kSpark(155,105,8,'#ffd166','1.4s')
      +'</g>';
    }
    if(effect==='shine'){
      s+='<g clip-path="url(#bgClip'+uid+')">'
      +'<rect x="55" y="-60" width="70" height="380" fill="#ffffff" opacity="0.40" transform="rotate(18 100 135)"/>'
      +'<rect x="140" y="-60" width="14" height="380" fill="#ffffff" opacity="0.30" transform="rotate(18 100 135)"/>'
      +'</g>';
    }
    if(effect==='twinkle'){
      s+='<g clip-path="url(#bgClip'+uid+')">'+bgTwinkleSVG()+'</g>';
    }
    if(effect==='bubbles'){
      s+='<g clip-path="url(#bgClip'+uid+')">'+bgBubblesSVG()+'</g>';
    }
    if(effect==='petals'){
      s+='<g clip-path="url(#bgClip'+uid+')">'+bgPetalsSVG()+'</g>';
    }
  }
  s+='<ellipse cx="100" cy="246" rx="56" ry="9" fill="url(#gSh'+uid+')"/>';
  s+='<g class="av-jump"><g class="av-bob" style="animation-delay:'+p.bobDelay+'">'+a.draw(p);
  s+='</g></g>';
  /* Tap-to-play sparkle burst — hidden (opacity 0) until the svg
     carries .av-play; the positions are baked into the paths so
     the burst animation can scale the whole group. */
  s+='<g class="av-sparkles">'
  +'<path d="'+kStar4(38,60,9)+'" fill="#ffd166"/>'
  +'<path d="'+kStar4(162,58,9)+'" fill="#ffffff"/>'
  +'<path d="'+kStar4(170,140,8)+'" fill="#ffd166"/>'
  +'<path d="'+kStar4(30,145,8)+'" fill="#ffffff"/>'
  +'<path d="'+kStar4(100,28,9)+'" fill="#ffd166"/>'
  +'</g></svg>';
  return s;
}
/* TAP TO PLAY — tapping the animal makes it do a little trick: a
   happy jump with squash-and-stretch, plus a tiny sparkle burst.
   The class goes on the svg; the CSS animates the jump group (the
   animal only — the background and ground shadow stay put) and
   the sparkles. The idle bob/blink keep running underneath, and
   the class comes off when the jump ends (animationend, with a
   timer safety net), so the idle life resumes. Click fires on
   tap, so this works by touch on a real device too. The frog
   hops higher and the rabbit wiggles its ears faster (CSS, by
   data-animal); every other animal does the same happy jump. */
function avatarPlay(svg){
  if(!svg||svg.classList.contains('av-play'))return;
  svg.classList.add('av-play');
  var cleanup=function(){ svg.classList.remove('av-play'); svg.removeEventListener('animationend',done); };
  var done=function(e){ if(e.animationName==='av5Play'||e.animationName==='av5PlayHop'){ cleanup(); } };
  svg.addEventListener('animationend',done);
  setTimeout(cleanup,900);
}
var AVATAR_5_CSS=[
'.av5{cursor:pointer}',
'.av5 .av-bob{transform-box:fill-box;transform-origin:50% 100%;animation:av5Bob 3.6s ease-in-out infinite}',
'.av5 .av-blink{transform-box:fill-box;transform-origin:center;animation:av5Blink 4.6s infinite}',
'.av5 .av-earwig{transform-box:fill-box;transform-origin:50% 100%;animation:av5EarWig 5s ease-in-out infinite}',
'.av5 .av-sway{transform-box:fill-box;transform-origin:50% 0;animation:av5Sway 3.8s ease-in-out infinite}',
'.av5 .av-hop{transform-box:fill-box;transform-origin:50% 100%;animation:av5Hop 2.8s ease-in-out infinite}',
'.av5 .av-nod{transform-box:fill-box;transform-origin:50% 100%;animation:av5Nod 4.2s ease-in-out infinite}',
'.av5 .av-twinkle{animation:av5Twinkle 2.2s ease-in-out infinite}',
/* Tap to play: the jump group wraps the bob group (so the play
   animation never fights the bob's own inline stagger delay),
   and the sparkles sit hidden until the svg carries .av-play.
   The frog hops higher; the rabbit wiggles its ears faster
   (the !important delay beats the ear group's inline stagger,
   so the fast wiggle starts at once). */
'.av5 .av-jump{transform-box:fill-box;transform-origin:50% 100%}',
'.av5 .av-sparkles{opacity:0;transform-box:fill-box;transform-origin:center;pointer-events:none}',
'.av5.av-play .av-jump{animation:av5Play .8s cubic-bezier(.34,1.56,.64,1)}',
'.av5[data-animal="frog"].av-play .av-jump{animation:av5PlayHop .8s cubic-bezier(.34,1.56,.64,1)}',
'.av5[data-animal="rabbit"].av-play .av-earwig{animation:av5EarWig .8s ease-in-out infinite!important;animation-delay:0s!important}',
'.av5.av-play .av-sparkles{animation:av5Spark .8s ease-out}',
/* Animated background effects: slow and gentle, inside the
   shape. Twinkle stars pulse, bubbles drift up, petals drift
   down — each element staggered by its inline delay. */
'.av5 .av-twinklebg{transform-box:fill-box;transform-origin:center;animation:av5TwinkleBg 3s ease-in-out infinite}',
'.av5 .av-bub{animation:av5Bub 7s linear infinite}',
'.av5 .av-pet{transform-box:fill-box;transform-origin:center;animation:av5Pet 8s linear infinite}',
'@keyframes av5Bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}',
'@keyframes av5Blink{0%,90%,100%{transform:scaleY(1)}93%{transform:scaleY(.08)}}',
'@keyframes av5EarWig{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}',
'@keyframes av5Sway{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}',
'@keyframes av5Hop{0%,55%,100%{transform:translateY(0)}12%{transform:translateY(-8px)}30%{transform:translateY(0)}42%{transform:translateY(-4px)}}',
'@keyframes av5Nod{0%,100%{transform:rotate(0deg)}30%{transform:rotate(3deg)}65%{transform:rotate(-3deg)}}',
'@keyframes av5Twinkle{0%,100%{opacity:.25}50%{opacity:1}}',
'@keyframes av5Play{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-26px) scale(.96,1.06)}55%{transform:translateY(0) scale(1.08,.9)}75%{transform:translateY(-8px) scale(.98,1.03)}100%{transform:translateY(0) scale(1,1)}}',
'@keyframes av5PlayHop{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-38px) scale(.96,1.06)}55%{transform:translateY(0) scale(1.08,.9)}75%{transform:translateY(-10px) scale(.98,1.03)}100%{transform:translateY(0) scale(1,1)}}',
'@keyframes av5Spark{0%{opacity:0;transform:scale(.5)}30%{opacity:1;transform:scale(1.12)}100%{opacity:0;transform:scale(.7)}}',
'@keyframes av5TwinkleBg{0%,100%{opacity:.15;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}',
'@keyframes av5Bub{0%{transform:translateY(0);opacity:0}15%{opacity:.5}85%{opacity:.5}100%{transform:translateY(-170px);opacity:0}}',
'@keyframes av5Pet{0%{transform:translateY(-25px) rotate(0deg);opacity:0}15%{opacity:.6}85%{opacity:.6}100%{transform:translateY(190px) rotate(160deg);opacity:0}}',
'@media (prefers-reduced-motion: reduce){.av5 .av-bob,.av5 .av-blink,.av5 .av-earwig,.av5 .av-sway,.av5 .av-hop,.av5 .av-nod,.av5 .av-twinkle,.av5 .av-twinklebg,.av5 .av-bub,.av5 .av-pet{animation:none}.av5.av-play .av-jump,.av5.av-play .av-sparkles{animation:none!important}}'
].join('\n');
/* end of FULL-BODY LOOK — ROUND 5 */
