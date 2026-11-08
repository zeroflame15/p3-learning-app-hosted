// Apply the jokes + friends-to-bottom + critter-detail fix to a copy
// of the learning-app project. Usage:
//   node new-jokes-friends-critter/apply.js <project-dir>
// Fails fast if any anchor is missing or already applied (so it can
// never double-apply). See new-jokes-friends-critter/jokes-diff.md.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
if (!root) { console.error('usage: node apply.js <project-dir>'); process.exit(2); }
const PAGE = path.join(root, 'public', 'index.html');
const ICONS_TEST = path.join(root, 'tests', 'icons.test.js');
const NEW_TEST_SRC = path.join(__dirname, 'tests-jokes-critter.test.js');
const NEW_TEST_DST = path.join(root, 'tests', 'jokes-critter.test.js');

function replaceOnce(src, anchor, replacement, label) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + label);
  if (src.indexOf(anchor, i + anchor.length) >= 0) throw new Error('anchor not unique: ' + label);
  return src.slice(0, i) + replacement + src.slice(i + anchor.length);
}

const JOKES_CODE = `
/* ============================================================ CLASSROOM JOKES (requested 2026-11-08) — a
   break section: one joke at a time, tap to reveal the punchline,
   then another. Order is shuffled per visit, no repeats until all
   24 have been told. Session-only state, nothing is saved. */
var CLASS_JOKES=[
 {q:'Why did the teddy bear say no to dessert?',a:'Because it was already stuffed!'},
 {q:'Why is 6 afraid of 7?',a:'Because 7 8 9! (Seven ate nine!)'},
 {q:'What do you call a fish without eyes?',a:'A fsh!'},
 {q:'What did the big flower say to the little flower?',a:'Hi, bud!'},
 {q:'What is a snake\\'s favourite subject?',a:'Hisss-tory!'},
 {q:'Why did the pencil go to the doctor?',a:'It felt a little blunt.'},
 {q:'What did the zero say to the eight?',a:'Nice belt!'},
 {q:'Why did the music teacher need a ladder?',a:'To reach the high notes!'},
 {q:'What do you get when you cross a teacher with a vampire?',a:'Lots of blood tests!'},
 {q:'Why was the computer cold in class?',a:'It left its Windows open!'},
 {q:'What is the king of the classroom?',a:'The ruler!'},
 {q:'Why did the clock go to the principal\\'s office?',a:'For tocking too much!'},
 {q:'What did the paper say to the pencil?',a:'You have a good point!'},
 {q:'Why are ghosts bad at telling lies?',a:'Because you can see right through them!'},
 {q:'What do you call a bear with no teeth?',a:'A gummy bear!'},
 {q:'Why did the student bring a ladder to school?',a:'She wanted to go to high school!'},
 {q:'What is a witch\\'s favourite subject?',a:'Spelling!'},
 {q:'Why did the boy put his money in the freezer?',a:'He wanted cold, hard cash!'},
 {q:'What did one tomato say to the other?',a:'Let\\'s ketchup!'},
 {q:'Why did the cookie go to the doctor?',a:'It felt crumby!'},
 {q:'What do you call cheese that isn\\'t yours?',a:'Nacho cheese!'},
 {q:'Why did the library book go to the gym?',a:'To work on its spine!'},
 {q:'Why was the broom late for class?',a:'It overswept!'},
 {q:'Why did the teacher wear sunglasses?',a:'Because her students were so bright!'}
];
var jokeState=null;
function jokeOrder(){ var idx=[]; CLASS_JOKES.forEach(function(j,i){ idx.push(i); }); return shuffle(idx); }
function jokesHTML(){
  if(!jokeState)jokeState={order:jokeOrder(), idx:0, revealed:false, seen:0};
  var j=CLASS_JOKES[jokeState.order[jokeState.idx]];
  return pageHero('','😂','Classroom Jokes','A break from learning — read the joke, guess the ending, then tap to see the punchline. Have a good laugh, then back to the quests!','😂 '+CLASS_JOKES.length+' jokes')
   +'<div class="card" style="text-align:center;max-width:640px;margin:0 auto">'
   +'<span class="chip">Joke #'+(jokeState.seen+1)+'</span>'
   +'<h2 style="margin:18px 0 6px;font-size:1.4rem">'+esc(j.q)+'</h2>'
   +(jokeState.revealed
     ?'<div class="feedback ok" style="font-size:1.15rem">😂 '+esc(j.a)+'</div><button class="btn" id="jkNext" style="margin-top:14px">Tell me another! 😂</button>'
     :'<button class="btn" id="jkShow" style="margin-top:14px">Show the punchline 👀</button>')
   +'<p class="small muted" style="font-weight:700;margin-top:14px">Take a breather — laughing is learning too. When you are ready, hop back to Learn for your next quest!</p></div>';
}
function bindJokes(){
  var sh=document.getElementById('jkShow'); if(sh)sh.onclick=function(){ jokeState.revealed=true; sndCorrect(); render(); };
  var nx=document.getElementById('jkNext'); if(nx)nx.onclick=function(){
    jokeState.idx++; jokeState.seen++; jokeState.revealed=false;
    if(jokeState.idx>=jokeState.order.length){ jokeState.order=jokeOrder(); jokeState.idx=0; }
    sndPop(); render();
  };
}
`;

let html = fs.readFileSync(PAGE, 'utf8');
if (html.indexOf('var CLASS_JOKES=') >= 0) throw new Error('already applied: var CLASS_JOKES= exists');

// 1. NAV: jokes after vibe, friends last.
const NAV_OLD = "var NAV=[['home','🏠','Home','icons/nav-home.webp'],['learn','📚','Learn','icons/nav-learn.webp'],['ask','💬','Ask Pip','icons/nav-ask.webp'],['play','✨','Play','icons/nav-play.webp'],['trivia','🎲','Trivia','icons/nav-trivia.webp'],['friends','👥','Friends','icons/nav-friends.webp'],['create','🎨','Create','icons/nav-create.webp'],['critter','🐸','Critter Lab','icons/nav-critter.webp'],['treasure','💎','Treasure','icons/nav-treasure.webp'],['vibe','🎵','Vibe','icons/nav-vibe.webp']];";
const NAV_NEW = "var NAV=[['home','🏠','Home','icons/nav-home.webp'],['learn','📚','Learn','icons/nav-learn.webp'],['ask','💬','Ask Pip','icons/nav-ask.webp'],['play','✨','Play','icons/nav-play.webp'],['trivia','🎲','Trivia','icons/nav-trivia.webp'],['create','🎨','Create','icons/nav-create.webp'],['critter','🐸','Critter Lab','icons/nav-critter.webp'],['treasure','💎','Treasure','icons/nav-treasure.webp'],['vibe','🎵','Vibe','icons/nav-vibe.webp'],['jokes','😂','Jokes',''],['friends','👥','Friends','icons/nav-friends.webp']];";
html = replaceOnce(html, NAV_OLD, NAV_NEW, 'NAV');

// 2. PAGE_TITLES: jokes entry.
html = replaceOnce(html,
  "vibe:'Vibe Zone',parent:'Grown-ups'",
  "vibe:'Vibe Zone',jokes:'Classroom Jokes',parent:'Grown-ups'",
  'PAGE_TITLES jokes');

// 3. Render branch for jokes, after trivia.
html = replaceOnce(html,
  "else if(route==='trivia')c.innerHTML=triviaHTML(),bindTrivia();",
  "else if(route==='trivia')c.innerHTML=triviaHTML(),bindTrivia();\n  else if(route==='jokes')c.innerHTML=jokesHTML(),bindJokes();",
  'render branch jokes');

// 4. Jokes code, before the PLAY ARCADE section.
html = replaceOnce(html,
  '/* ============================================================ PLAY ARCADE */',
  JOKES_CODE + '\n/* ============================================================ PLAY ARCADE */',
  'jokes code insert');

// 5a. Critter detail card gets an id for scrolling.
html = replaceOnce(html,
  "detail='<div class=\"card\" style=\"margin-top:16px;border-color:var(--teal)\">",
  "detail='<div class=\"card\" id=\"critterDetail\" style=\"margin-top:16px;border-color:var(--teal)\">",
  'detail card id');

// 5b. Detail renders inline under its own category's grid, not up top.
html = replaceOnce(html,
  "(isVisiting?'✨ Visiting this week — tap to discover!':'Tap to discover'))+'</span></button>'; }).join('')+'</div>';",
  "(isVisiting?'✨ Visiting this week — tap to discover!':'Tap to discover'))+'</span></button>'; }).join('')+'</div>'+(sel&&sel.cat===cat.id?detail:'');",
  'detail inline under category grid');

// 5c. Remove the fixed-position render.
html = replaceOnce(html,
  '   + visitingHTML + detail',
  '   + visitingHTML',
  'remove fixed-position detail render');

// 5d. After a critter tap, scroll the detail card into view.
html = replaceOnce(html,
  '    } else sndPop();\n    save(); render(); }; });',
  '    } else sndPop();\n    save(); render();\n    /* The detail card now sits right under this critter\'s category, so bring it into view instead of making the child scroll up to find it. */\n    var cd=document.getElementById(\'critterDetail\'); if(cd)cd.scrollIntoView({behavior:\'smooth\',block:\'nearest\'}); }; });',
  'scroll detail into view on tap');

fs.writeFileSync(PAGE, html);

// 6. Icons test: nav entries carry their emoji; counts 50→51, fallback 17→18.
let icons = fs.readFileSync(ICONS_TEST, 'utf8');
icons = replaceOnce(icons,
  "NAV.forEach(function (n) { wanted.push(['nav ' + n[0], n[3]]); });",
  "NAV.forEach(function (n) { wanted.push(['nav ' + n[0], n[3], n[1]]); });",
  'icons test nav emoji');
icons = replaceOnce(icons,
  "assert.equal(wanted.length, 50, '10 nav + 9 games + 31 quests');",
  "assert.equal(wanted.length, 51, '11 nav + 9 games + 31 quests');",
  'icons test wanted count');
icons = replaceOnce(icons,
  "      // purpose; custom 3D art for them is a separate follow-up.",
  "      // purpose; custom 3D art for them is a separate follow-up.\n      // The Jokes nav item (2026-11-08) is img:'' too.",
  'icons test fallback comment');
icons = replaceOnce(icons,
  "assert.equal(fallback, 17, '17 emoji-fallback topics (the gap-fill topics)');",
  "assert.equal(fallback, 18, '18 emoji-fallback entries (17 gap-fill topics + the Jokes nav item)');",
  'icons test fallback count');
icons = replaceOnce(icons,
  "    ['Vibe', 'icons/nav-vibe.webp', '🎵'],",
  "    ['Vibe', 'icons/nav-vibe.webp', '🎵'],\n    ['Jokes', '', '😂'],",
  'icons test sections list');
fs.writeFileSync(ICONS_TEST, icons);

// 7. New test file.
fs.copyFileSync(NEW_TEST_SRC, NEW_TEST_DST);

console.log('applied jokes + friends-to-bottom + critter-detail fix to ' + root);
