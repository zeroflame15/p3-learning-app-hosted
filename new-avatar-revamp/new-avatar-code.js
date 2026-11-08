/* ============================================================
   FULL-BODY LOOK (revamped 2026-11-08, top standard): the
   "Change my name & look" modal grows a dress-up builder —
   body colour, hair and accessory, on top of the animal face.
   This is a REAL illustration, not a collage: one SVG character
   drawn on a single 200x260 grid, so face, body, hair and
   accessory always belong together.
   GEOMETRY (the whole system is built on these anchors):
   - head: face circle centre (100,76) r=46 (lion r=42 inside a
     r=58 mane); eyes FIXED at (82,72) and (118,72) for every
     animal, so glasses always sit over the eyes.
   - body: torso top y=112, head bottom y=122 — the head overlaps
     the torso by 10px, so there is never a gap; feet at y=230,
     ground shadow at y=246.
   - hair zone: fringe y=8..58, always above the tops of the eyes (y=60),
     so hair frames the face and never covers it; the "long" bob's side
     panels hug the face down to y=106 (chin length). Hair is drawn
     before the ears are re-drawn on top (id="avatar-ears-top"), so hair
     tucks BEHIND the animal's own ears — a rabbit with long hair keeps
     two ears, not four. The lion's mane is not re-drawn (mane:true),
     or it would swallow the hair.
   - otter face is a wider, flatter ellipse (rx=49, ry=44) with
     whiskers and small low ears, so it reads as an otter, not a bear.
   - turtle wears a real shell cap on its forehead (filled dome with
     segment lines) on a yellower green face, so it can never be
     mistaken for the frog's plain green face.
   - hat sits on the head top (brim y=33); glasses ring the eyes;
     necklace and bowtie sit on the chest below the chin (y=128+).
   Stored as e.look={color,hair,accessory}, stamped by the same
   e.lookAt as face/glow/badge, merged later-wins. */
var LOOK_COLORS=['','#ff8fa3','#ffb020','#2dd4bf','#7db4ff','#c084fc','#8b5e3c'];
var LOOK_HAIRS=['','spiky','curly','long','bun'];
var LOOK_HAIR_LABELS={'':'None','spiky':'Spiky','curly':'Curly','long':'Long','bun':'Bun'};
/* Hair shapes are drawn in the SAME 200-wide coordinates as the
   avatar (hair zone y=8..58), so the picker mini-previews use
   viewBox="0 0 200 80" and the avatar just includes the shape. */
var LOOK_HAIR_SHAPES={
 spiky:'<path d="M56,48 L64,14 L74,40 L86,10 L98,38 L110,10 L122,40 L132,14 L144,48 Q100,38 56,48 Z" fill="#6b4423"/>',
 curly:'<circle cx="70" cy="30" r="13" fill="#6b4423"/><circle cx="100" cy="22" r="15" fill="#6b4423"/><circle cx="130" cy="30" r="13" fill="#6b4423"/><circle cx="56" cy="40" r="9" fill="#6b4423"/><circle cx="144" cy="40" r="9" fill="#6b4423"/>',
 long:'<path d="M58,106 C50,80 48,54 56,38 C64,18 80,10 100,10 C120,10 136,18 144,38 C152,54 150,80 142,106 C140,98 136,88 134,78 C132,66 128,58 122,54 Q100,60 78,54 C72,58 68,66 66,78 C64,88 60,98 58,106 Z" fill="#6b4423"/>',
 bun:'<circle cx="100" cy="16" r="13" fill="#6b4423"/><rect x="60" y="36" width="80" height="10" rx="5" fill="#6b4423"/>'};
var LOOK_ACCS=['','necklace','hat','glasses','bowtie'];
var LOOK_ACC_EMOJI={necklace:'📿',hat:'🎩',glasses:'👓',bowtie:'🎀'};
var LOOK_ACC_LABELS={necklace:'Necklace',hat:'Hat',glasses:'Glasses',bowtie:'Bow tie'};
/* One illustrated face per animal, all on the same grid: face
   circle centre (100,76), eyes at (82,72) and (118,72). Each entry
   carries ears (drawn behind the face), a mid layer (muzzle, mask
   or eye patches, drawn after the face but before the eyes) and a
   mouth layer (nose, smile, whiskers — drawn after the eyes).
   face = the face-circle colour; faceR = face radius (lion is
   smaller inside its mane). */
var AVATAR_FACES={
 otter:{face:'#b08968',faceR:46,faceRx:49,faceRy:44,
  ears:'<circle cx="56" cy="50" r="7" fill="#b08968"/><circle cx="56" cy="50" r="3.5" fill="#8a6a4a"/><circle cx="144" cy="50" r="7" fill="#b08968"/><circle cx="144" cy="50" r="3.5" fill="#8a6a4a"/>',
  mid:'<ellipse cx="100" cy="94" rx="26" ry="12" fill="#f2d9b8"/>',
  mouth:'<ellipse cx="100" cy="86" rx="6" ry="4.5" fill="#4a2c1a"/><path d="M88,96 Q100,104 112,96" fill="none" stroke="#4a2c1a" stroke-width="2.5" stroke-linecap="round"/><path d="M62,86 L79,89 M60,95 L78,94 M64,103 L80,98 M138,86 L121,89 M140,95 L122,94 M136,103 L120,98" fill="none" stroke="rgba(74,44,26,0.5)" stroke-width="1.5" stroke-linecap="round"/>'},
 frog:{face:'#58b368',faceR:46,ears:'',
  mid:'',
  mouth:'<circle cx="92" cy="80" r="1.8" fill="#2f7a3d"/><circle cx="108" cy="80" r="1.8" fill="#2f7a3d"/><path d="M72,92 Q100,108 128,92" fill="none" stroke="#2f7a3d" stroke-width="3" stroke-linecap="round"/>'},
 butterfly:{face:'#f7a8d8',faceR:46,
  ears:'<path d="M88,36 Q80,16 72,10" fill="none" stroke="#8a6a4a" stroke-width="2.5" stroke-linecap="round"/><path d="M112,36 Q120,16 128,10" fill="none" stroke="#8a6a4a" stroke-width="2.5" stroke-linecap="round"/><circle cx="72" cy="10" r="3.5" fill="#8a6a4a"/><circle cx="128" cy="10" r="3.5" fill="#8a6a4a"/>',
  mid:'',
  mouth:'<circle cx="100" cy="84" r="2" fill="#8a6a4a"/><path d="M92,90 Q100,96 108,90" fill="none" stroke="#8a6a4a" stroke-width="2.5" stroke-linecap="round"/><path d="M74,54 L70,48 M82,52 L80,45 M118,52 L120,45 M126,54 L130,48" fill="none" stroke="#26221f" stroke-width="2" stroke-linecap="round"/>'},
 cat:{face:'#f6b73c',faceR:46,
  ears:'<path d="M62,42 L56,10 L86,30 Z" fill="#f6b73c"/><path d="M63,36 L60,18 L78,29 Z" fill="#f6b8c1"/><path d="M138,42 L144,10 L114,30 Z" fill="#f6b73c"/><path d="M137,36 L140,18 L122,29 Z" fill="#f6b8c1"/>',
  mid:'',
  mouth:'<path d="M94,84 L106,84 L100,90 Z" fill="#e88aa0"/><path d="M100,90 Q94,97 88,93 M100,90 Q106,97 112,93" fill="none" stroke="#8a5a2e" stroke-width="2.5" stroke-linecap="round"/><path d="M58,88 L76,90 M58,96 L76,94 M142,88 L124,90 M142,96 L124,94" stroke="rgba(0,0,0,0.30)" stroke-width="1.5" stroke-linecap="round"/>'},
 dog:{face:'#c68a4b',faceR:46,
  ears:'<ellipse cx="58" cy="64" rx="10" ry="22" transform="rotate(14 58 64)" fill="#8a5a2e"/><ellipse cx="142" cy="64" rx="10" ry="22" transform="rotate(-14 142 64)" fill="#8a5a2e"/>',
  mid:'<ellipse cx="100" cy="94" rx="20" ry="13" fill="#e8c9a0"/>',
  mouth:'<ellipse cx="100" cy="86" rx="7" ry="5" fill="#26221f"/><path d="M88,94 Q100,102 112,94" fill="none" stroke="#26221f" stroke-width="2.5" stroke-linecap="round"/><rect x="92" y="98" width="16" height="12" rx="8" fill="#f08ba0"/><path d="M100,100 L100,108" stroke="#d96a86" stroke-width="1.5" stroke-linecap="round"/>'},
 rabbit:{face:'#f2f2f2',faceR:46,
  ears:'<ellipse cx="72" cy="24" rx="10" ry="20" transform="rotate(-8 72 24)" fill="#efefef" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/><ellipse cx="72" cy="26" rx="5" ry="13" transform="rotate(-8 72 26)" fill="#f6b8c1"/><ellipse cx="128" cy="24" rx="10" ry="20" transform="rotate(8 128 24)" fill="#efefef" stroke="rgba(0,0,0,0.08)" stroke-width="1.5"/><ellipse cx="128" cy="26" rx="5" ry="13" transform="rotate(8 128 26)" fill="#f6b8c1"/>',
  mid:'',
  mouth:'<path d="M94,84 L106,84 L100,89 Z" fill="#e88aa0"/><path d="M100,89 Q96,95 92,92 M100,89 Q104,95 108,92" fill="none" stroke="#8a6a4a" stroke-width="2.5" stroke-linecap="round"/><rect x="94" y="96" width="5.5" height="8" rx="2" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1"/><rect x="100.5" y="96" width="5.5" height="8" rx="2" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>'},
 lion:{face:'#f7c873',faceR:42,mane:true,
  ears:'<circle cx="100" cy="76" r="58" fill="#d97f2b"/><circle cx="100" cy="76" r="52" fill="#e8963c"/>',
  mid:'',
  mouth:'<ellipse cx="100" cy="86" rx="7" ry="5" fill="#8a5a2e"/><path d="M88,94 Q100,102 112,94" fill="none" stroke="#8a5a2e" stroke-width="2.5" stroke-linecap="round"/>'},
 panda:{face:'#ffffff',faceR:46,
  ears:'<circle cx="60" cy="40" r="11" fill="#26221f"/><circle cx="140" cy="40" r="11" fill="#26221f"/>',
  mid:'<ellipse cx="82" cy="72" rx="12" ry="15" transform="rotate(-12 82 72)" fill="#26221f"/><ellipse cx="118" cy="72" rx="12" ry="15" transform="rotate(12 118 72)" fill="#26221f"/>',
  mouth:'<ellipse cx="100" cy="88" rx="6" ry="4.5" fill="#26221f"/><path d="M90,96 Q100,102 110,96" fill="none" stroke="#26221f" stroke-width="2.5" stroke-linecap="round"/>'},
 fox:{face:'#e8743c',faceR:46,
  ears:'<path d="M60,44 L54,8 L88,30 Z" fill="#e8743c"/><path d="M62,36 L59,17 L80,29 Z" fill="#ffffff"/><path d="M140,44 L146,8 L112,30 Z" fill="#e8743c"/><path d="M138,36 L141,17 L120,29 Z" fill="#ffffff"/>',
  mid:'<ellipse cx="100" cy="94" rx="22" ry="13" fill="#ffffff"/>',
  mouth:'<ellipse cx="100" cy="86" rx="6" ry="4.5" fill="#26221f"/><path d="M88,95 Q100,102 112,95" fill="none" stroke="#26221f" stroke-width="2.5" stroke-linecap="round"/>'},
 turtle:{face:'#93cf6b',faceR:46,ears:'',
  mid:'<path d="M56,62 A46,46 0 0 1 144,62 Q100,44 56,62 Z" fill="#5da85a" stroke="#4e8f4c" stroke-width="2" stroke-linejoin="round"/><path d="M100,34 Q100,46 100,52 M82,38 Q76,48 74,56 M118,38 Q124,48 126,56 M66,50 Q100,40 134,50" fill="none" stroke="#4e8f4c" stroke-width="2" stroke-linecap="round"/>',
  mouth:'<circle cx="92" cy="80" r="1.8" fill="#2f7a3d"/><circle cx="108" cy="80" r="1.8" fill="#2f7a3d"/><path d="M88,94 Q100,100 112,94" fill="none" stroke="#2f7a3d" stroke-width="2.5" stroke-linecap="round"/>'},
 pig:{face:'#f6b8c1',faceR:46,
  ears:'<circle cx="62" cy="40" r="10" fill="#f6b8c1"/><circle cx="62" cy="40" r="5" fill="#e88aa0"/><circle cx="138" cy="40" r="10" fill="#f6b8c1"/><circle cx="138" cy="40" r="5" fill="#e88aa0"/>',
  mid:'',
  mouth:'<ellipse cx="100" cy="88" rx="16" ry="12" fill="#f08ba0"/><ellipse cx="94" cy="88" rx="2.5" ry="3.5" fill="#c25a72"/><ellipse cx="106" cy="88" rx="2.5" ry="3.5" fill="#c25a72"/><path d="M90,102 Q100,107 110,102" fill="none" stroke="#c25a72" stroke-width="2.5" stroke-linecap="round"/>'},
 monkey:{face:'#c68a4b',faceR:46,
  ears:'<circle cx="58" cy="72" r="11" fill="#8a5a2e"/><circle cx="58" cy="72" r="6" fill="#e8c9a0"/><circle cx="142" cy="72" r="11" fill="#8a5a2e"/><circle cx="142" cy="72" r="6" fill="#e8c9a0"/>',
  mid:'<ellipse cx="100" cy="80" rx="34" ry="36" fill="#eccfae"/>',
  mouth:'<circle cx="94" cy="86" r="2" fill="#8a5a2e"/><circle cx="106" cy="86" r="2" fill="#8a5a2e"/><path d="M88,94 Q100,102 112,94" fill="none" stroke="#8a5a2e" stroke-width="2.5" stroke-linecap="round"/>'}
};
var AVATAR_FACE_EMOJI={'🦦':'otter','🐸':'frog','🦋':'butterfly','🐱':'cat','🐶':'dog','🐰':'rabbit','🦁':'lion','🐼':'panda','🦊':'fox','🐢':'turtle','🐷':'pig','🐵':'monkey'};
/* Accessories, drawn last so they sit on top of hair and face.
   All in the same 200x260 coordinates. */
var AVATAR_ACCS={
 hat:'<ellipse cx="100" cy="33" rx="44" ry="7" fill="#6d28d9"/><path d="M80,32 L80,8 Q80,2 86,2 L114,2 Q120,2 120,8 L120,32 Z" fill="#8b5cf6"/><rect x="80" y="24" width="40" height="7" fill="#ffd166"/>',
 glasses:'<g stroke="#4a2c1a" stroke-width="3.5" fill="rgba(255,255,255,0.30)"><circle cx="82" cy="72" r="15"/><circle cx="118" cy="72" r="15"/><path d="M97,72 Q100,68 103,72" fill="none"/><path d="M67,70 L56,66 M133,70 L144,66" fill="none"/></g>',
 necklace:'<path d="M62,138 Q100,164 138,138" fill="none" stroke="#eab308" stroke-width="3" stroke-linecap="round"/><circle cx="76" cy="147" r="3.5" fill="#ef4444"/><circle cx="88" cy="150" r="3.5" fill="#3b82f6"/><circle cx="100" cy="151" r="5" fill="#ef4444"/><circle cx="112" cy="150" r="3.5" fill="#22c55e"/><circle cx="124" cy="147" r="3.5" fill="#ef4444"/>',
 bowtie:'<path d="M100,128 L76,118 L76,138 Z" fill="#ef4444"/><path d="M100,128 L124,118 L124,138 Z" fill="#ef4444"/><circle cx="100" cy="128" r="5.5" fill="#dc2626"/>'};
/* One cohesive illustrated character: ground shadow, feet, torso
   (belly, arms, soft shading), head (ears, face, muzzle, eyes,
   nose and smile), then hair, then accessory. Tolerates a missing
   look (legacy explorers) and an unknown face (defaults to otter). */
function avatarLookHTML(face, look, glow){
  look=look||{};
  var body=look.color||glow||'#7cc46a';
  var hair=look.hair||'', acc=look.accessory||'';
  var key=AVATAR_FACE_EMOJI[face]||'otter';
  var f=AVATAR_FACES[key];
  var head=(f.faceRx)
    ?'<ellipse cx="100" cy="76" rx="'+f.faceRx+'" ry="'+f.faceRy+'" fill="'+f.face+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
    :'<circle cx="100" cy="76" r="'+f.faceR+'" fill="'+f.face+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>';
  var eyes=(key==='panda')
    ?'<ellipse cx="82" cy="72" rx="6.5" ry="8" fill="#ffffff"/><ellipse cx="118" cy="72" rx="6.5" ry="8" fill="#ffffff"/><circle cx="82" cy="74" r="3.5" fill="#26221f"/><circle cx="118" cy="74" r="3.5" fill="#26221f"/><circle cx="84" cy="69" r="1.5" fill="#ffffff"/><circle cx="116" cy="69" r="1.5" fill="#ffffff"/>'
    :'<ellipse cx="82" cy="72" rx="10" ry="12" fill="#ffffff"/><ellipse cx="118" cy="72" rx="10" ry="12" fill="#ffffff"/><circle cx="83" cy="74" r="5" fill="#26221f"/><circle cx="117" cy="74" r="5" fill="#26221f"/><circle cx="85" cy="68" r="2.2" fill="#ffffff"/><circle cx="115" cy="68" r="2.2" fill="#ffffff"/>';
  return '<svg viewBox="0 0 200 260" data-animal="'+key+'" style="width:190px;height:247px;display:block;margin:0 auto" role="img" aria-label="My animal friend, the '+key+'">'
   +'<ellipse cx="100" cy="246" rx="54" ry="8" fill="rgba(0,0,0,0.08)"/>'
   +'<g id="avatar-body">'
   +'<ellipse cx="72" cy="230" rx="15" ry="9" fill="'+body+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="128" cy="230" rx="15" ry="9" fill="'+body+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
   +'<path d="M100,112 C136,112 154,140 154,172 C154,208 132,232 100,232 C68,232 46,208 46,172 C46,140 64,112 100,112 Z" fill="'+body+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
   +'<ellipse cx="100" cy="186" rx="36" ry="42" fill="#ffffff" opacity="0.55"/>'
   +'<ellipse cx="48" cy="170" rx="11" ry="24" transform="rotate(-18 48 170)" fill="'+body+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/><ellipse cx="152" cy="170" rx="11" ry="24" transform="rotate(18 152 170)" fill="'+body+'" stroke="rgba(0,0,0,0.10)" stroke-width="2"/>'
   +'<ellipse cx="76" cy="138" rx="20" ry="12" transform="rotate(-18 76 138)" fill="#ffffff" opacity="0.22"/>'
   +'<ellipse cx="128" cy="198" rx="14" ry="22" fill="#000000" opacity="0.05"/>'
   +'</g>'
   +'<g id="avatar-face">'+f.ears
   +head
   +f.mid+eyes+f.mouth+'</g>'
   +(hair?'<g id="avatar-hair">'+LOOK_HAIR_SHAPES[hair]+'</g>':'')
   +(hair&&!f.mane?'<g id="avatar-ears-top">'+f.ears+'</g>':'')
   +(acc?'<g id="avatar-acc">'+AVATAR_ACCS[acc]+'</g>':'')
   +'</svg>';
}
