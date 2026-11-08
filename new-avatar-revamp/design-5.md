# Dress-up — Round 5: flat kawaii, sheet-exact (2026-11-08)

## What the parent asked for

After round 4 (shaded 3D plush, fur, texture, depth) the parent said
"still not cute" and sent a reference sheet — a 5×5 grid of 25
kawaii animals — with the words: *"Change them to these characters.
exactly the same. No need change color option. Just a number of tiny
accessories to add on. the accessories must follow the cute theme of
these animal. Maybe create a customise background. different shape,
color, effect (glitter, glow, reflective, etc)."* He then chose **all
25 animals** from the picture, and added: *"a bit shadow on the
ground to make it pop."*

Then, when the accessories proved fiddly (the chick exposed
per-animal positioning for 25 animals), he said: *"if the accessories
is hard..dropped it. any other suggestions for the avatar which is
doable?"* — so the accessories were **dropped entirely**. He picked
three of the suggestions, naming tap-to-play twice: **tap to play,
background patterns, and animated backgrounds**. Expressions and
frames were NOT picked.

## The style reset

Round 5 is a **style reset**, not a refinement of round 4. The sheet's
look is flat kawaii vector art:

- **Flat fills** — one solid colour per part, no gradients for shading,
  no fur texture, no grain. (The only gradient left in the whole
  avatar is the ground shadow.)
- **Thick dark-brown outlines** — `#4a3226`, 3px on main shapes, 2–2.5px
  on details, round joins and caps.
- **Big glossy black eyes** — solid black ovals with a white highlight
  at the top-left; a few animals (owl, frog, crocodile) have white
  sclera + black pupil instead, exactly like the sheet.
- **Small simple mouth** — a short curved smile line, or a beak/snout.
- **Pink blush cheeks** — two soft pink ovals (`#f7a8b8`, 0.85 opacity).
- **Whole-animal colour** — each animal keeps its own colours from the
  sheet. There is **no colour option any more**: the "Animal colour"
  picker section is gone, and a stored `e.look.color` is never read
  (the same way stored hair was ignored in round 2).

The shared grid is unchanged (200×260 viewBox, ground at y≈235, head
around (100, 72–84), body around (100, 178)), so the sidebar (130px),
mobile topbar (43px), modal preview (190px) and Grand Door tile (56px)
all keep working.

## The 25 animals — sheet design notes

| # | Animal | Sheet design | How the SVG matches it |
|---|--------|--------------|------------------------|
| 1 | Chick 🐤 | Round yellow ball, tiny wings, orange beak, little tuft | One round body (yellow `#ffd94a`), small side wings, orange triangle beak, 3-stroke yellow tuft, orange feet |
| 2 | Horse 🐴 | Tan body, brown mane swept over the head, big pink muzzle | Tan `#eec9a0` body + head, brown `#8a5a2e` mane crescent + forelock, pink muzzle with two nostril dots, brown hooves |
| 3 | Penguin 🐧 | Black head/body, white face mask + white belly, orange beak and feet | Black `#2b2b33` head/body, white face ellipse + white belly ellipse, orange triangle beak and feet |
| 4 | Bear 🐻 | Brown, round ears with pink inner, light muzzle, chubby | Brown `#c98a4b`, pink inner ears, light `#e8c39a` muzzle + belly, small black nose |
| 5 | Turtle 🐢 | Green head, brown dome shell with segments, four green feet | Green `#7cc46a` head + feet, brown `#a67c52` dome, darker-brown hexagon scute + side scutes |
| 6 | Panda 🐼 | White head/body, big black eye patches, black ears/arms/feet | White body/head, black patches (rotated ovals) with white eye + black pupil inside, black ears/arms/feet |
| 7 | Lion 🦁 | Orange face, big fluffy mane, small ears, tail with tuft | Orange-brown `#e08a2e` mane circle (r56), lighter `#f9c86a` face, small ears, tail path + brown tuft |
| 8 | Cat 🐱 | Grey, pointed ears with pink inner, whiskers, curled tail | Grey `#b8b8c0`, pink inner ears, whisker lines, tail drawn double-stroke (ink under, grey over) so it has an outline |
| 9 | Pig 🐷 | Pink, floppy ears, big snout with two nostrils, curly tail | Pink `#f6b8c1`, floppy rotated ears with darker inner, darker-pink snout with nostrils, small curl tail |
| 10 | Fox 🦊 | Orange, white lower face, pointed ears, big bushy tail with white tip | Orange `#f08a3c`, white muzzle ellipse, white inner ears, tail shape + white tip ellipse |
| 11 | Frog 🐸 | Green, two big eye bumps, wide smile, light belly | Green `#58b368`, eye bumps (r17) with white eye + green iris + black pupil, wide smile, light `#d8ec9a` belly + throat |
| 12 | Elephant 🐘 | Light blue, big ears with pink inner, long trunk, stubby legs | Blue `#a8d8e8`, pink inner ears, trunk path hanging from the face (sways), light belly |
| 13 | Giraffe 🦒 | Yellow with brown spots, long neck, ossicones, brown muzzle, long legs | Yellow `#f7d774`, neck path head→body, ossicone stalks + brown tips, spots on body + neck, four thin legs with brown hooves |
| 14 | Rabbit 🐰 | Light blue, long ears with pink inner, buck teeth, white tail | Blue `#a8d0f0`, long ears (rx9 ry32, tips y=3) with pink inner, two white buck-teeth rects, white tail circle |
| 15 | Owl 🦉 | Brown, big round white eyes, tiny orange beak, ear tufts, orange feet | Brown `#b08a5a`, white eye circles + black pupils, orange triangle beak, ear tuft triangles, light belly |
| 16 | Raccoon 🦝 | Grey, dark eye mask, pointed ears, big striped tail | Grey `#a9a9b3`, dark `#4a4a52` mask band across the eyes, tail double-stroke with three dark bands |
| 17 | Monkey 🐵 | Brown, tan heart-shaped face, big round ears, curly tail | Brown `#a8763e`, tan `#e8c39a` face oval + ear inners, curly tail double-stroke, light belly |
| 18 | Tiger 🐯 | Orange with black stripes, white belly, pink nose | Orange `#f7a83c`, forehead stripes + side stripes + tail bands, white belly, pink nose |
| 19 | Crocodile 🐊 | Green, long snout, toothy grin, eyes on top, back spikes | Green `#6fbf5a`, wide snout ellipse, eye bumps on top, white triangle teeth on the grin line, back spikes, light belly |
| 20 | Dog 🐶 | Cream, brown floppy ears, brown patch over one eye, small nose | Cream `#f2e3c9`, brown floppy ears, brown eye patch, white belly |
| 21 | Sloth 🦥 | Brown, sleepy half-closed eyes, dark eye patches, long arms, tiny claws | Brown `#b08a5a`, darker eye patches, flattened sleepy eyes, long hanging arms with claw lines |
| 22 | Duck 🦆 | Yellow, flat orange beak, small wings, orange feet, little tuft | Yellow `#ffd94a`, orange beak oval with a smile line, small wings, orange feet, tuft strokes |
| 23 | Hippo 🦛 | Grey, big pink snout, small ears, big body, short legs | Grey `#b8b8c0`, big pink `#e8b8c0` snout with two nostrils, small eyes on top of the head, light belly |
| 24 | Sheep 🐑 | Grey face, white fluffy wool body, thin dark legs | Grey `#b8b8c0` face + ears, wool body as one scalloped 8-bump arc path (no internal lines), wavy wool cap on the head, dark legs + hooves |
| 25 | Koala 🐨 | Lavender-grey, big fluffy ears, big black oval nose, small eyes | Lavender-grey `#b8b0d8`, big ears with lighter inner, big black nose oval with a white highlight, light belly |

## Accessories — DROPPED (2026-11-08)

The parent dropped the accessories: per-animal positioning for 25
animals was too fiddly, as the chick proved (its accessories landed
on its face). There is no accessory code left anywhere — no picker
in the editor, no accessory rendering, no accessory data in the
look. A stored `e.look.accessory` is never read, the same way a
stored colour is ignored. The per-animal offset table (`AV_ACC_OFF`)
built for the chick and the crocodile is gone with them — it is
moot now. The crocodile redraw (long and horizontal) still stands;
see the fix round below.

## Tap to play (the parent's favourite — he named it twice)

Tapping the animal makes it do a little trick: a happy jump with
squash-and-stretch (up tall, land squashed, small rebound, settle)
plus a tiny sparkle burst around it. The frog hops higher than the
rest and the rabbit wiggles its ears faster while it plays; every
other animal does the same happy jump — one good trick, not 25
separate ones.

How it works: every avatar on the page renders through
`avatarLookHTML`, so the svg itself carries
`onclick="avatarPlay(this)"` — the sidebar avatar (130px), the
editor preview (190px) and the Grand Door tile (56px) all play with
no extra wiring. `avatarPlay` adds the `av-play` class to the svg
and takes it off when the jump ends (`animationend`, with a 900ms
timer safety net), so the idle life resumes. Click fires on tap, so
it works by touch on a real device too. The jump animates a wrapper
group around the bob group (`.av-jump`), so the trick never fights
the bob's own inline stagger delay, and the background and ground
shadow stay put while only the animal jumps. The sparkles are a
group of five 4-point stars, hidden (opacity 0) until the class
lands. Reduced motion switches the trick off entirely.

## Background patterns

A fourth row in "My background": **None, Polka dots, Stars,
Stripes, Hearts**. The pattern is drawn INSIDE the background
shape (clipped to it by the same `bgClip` clip path the effects
use), in white — bold enough to read at the real 120px size
(dots 0.45, stars 0.6, stripes 0.3, hearts 0.55; the stars are
s=8 and the hearts are scaled 1.3×). The first version was too
faint (dots 0.32, stars 0.4, stripes 0.16, hearts 0.35) and the
screen found the stars, hearts and stripes invisible at 120px,
so they were bumped and the stars and hearts made bigger — the
animal still pops off it, because the pattern only shows in
the thin margins around it. The look's background becomes
`{shape, color, pattern, effect}`. A stored background without
a pattern falls back to None; an unknown pattern falls back to
None; no background colour means no pattern either.

## Animated backgrounds

Three new options in the Effect row, alongside the static
plain / glitter / glow / shine: **Twinkle** (six larger star
sparkles fading in and out in sequence), **Bubbles** (six circles
drifting gently upward, 7s cycle) and **Petals** (seven soft-pink
petals drifting gently downward and turning, 8s cycle, holding
at 0.6 opacity while they fall). The petals are `#f7a8b8` (the
blush pink) and slightly larger than the first version, and
their spots sit in the left/right margins and the top crescent
— the first version used white petals in the middle, which were
invisible on pale sky blue at 120px and spent most of the fall
hidden behind the animal.
All three are drawn inside the background shape (clipped to it),
slow and gentle, each element staggered by a negative
animation-delay so the cycle is already spread out on load. They
respect reduced motion — the reduced-motion rule switches them off
exactly like the bob and the blink. The static glitter effect is
unchanged and distinct (its sparkles use the `av-twinkle` class;
the new twinkle effect uses `av-twinklebg`).

## Custom background

A new picker section, **"My background"**, with four rows:

- **Shape** — circle, heart, star, rounded square, cloud, flower.
  Drawn behind the animal, centred on (100,135), ~190 wide, with the
  same thick dark-brown outline as the animals. The cloud and flower
  are single paths (the flower is six arcs, the cloud is a hand-drawn
  bump path) so they have no internal lines.
- **Colour** — six pastels matching the cute theme: mint `#bfe8d8`,
  pink `#ffd6e0`, sky `#cfe8ff`, lilac `#e6d9ff`, peach `#ffe3c7`,
  lemon `#fff3b0` — plus **none** (no background at all).
- **Pattern** — none, polka dots, stars, stripes, hearts. Drawn
  inside the shape (clipped to it), white at low opacity, subtle
  so the animal still pops.
- **Effect** — plain (nothing), glitter (7 little 4-point sparkles,
  white + gold, clipped to the shape, twinkling), glow (the shape
  scaled 1.15×, blurred, 0.45 opacity, behind the shape — a soft
  halo), shine (two diagonal white bands, clipped to the shape — a
  reflective sweep), twinkle (6 larger stars fading in and out),
  bubbles (circles drifting up), petals (petals drifting down).
  The last three are animated, slow and gentle, and respect
  reduced motion.

The background is part of the look:
`e.look={background:{shape,color,pattern,effect}}`. It shows in the
editor preview, the big top-left sidebar avatar, the mobile topbar,
and the Grand Door explorer tile. It saves with the look (draft
editor: changes commit only on Save; Cancel discards everything,
background included).

## Ground shadow (added 2026-11-08, parent's words: "a bit shadow on the ground to make it pop")

A soft ellipse under the animal's feet (`cx=100, cy=246, rx=56,
ry=9`), filled with a radial gradient from `rgba(0,0,0,0.20)` to
transparent — the only gradient left in the avatar. Drawn between
the custom background and the animal, so the character lifts off the
background and pops. It is flat and soft, not a heavy 3D drop
shadow, and it reads on every background shape, colour and effect
(including glitter and glow) and at the 130px sidebar size, because
it sits on the page background below the background shape, not
inside it.

## What was kept

- **Draft editor** — Cancel genuinely reverts (verified live in
  round 4); Save commits the whole draft and stamps `lookAt`.
  The modal structure, handler pattern and Save flow are the same
  as round 4, only the colour row is replaced by the background
  rows and the look shape changed.
- **Big top-left avatar** — now the character ON its background,
  130px in the sidebar, 43px in the mobile topbar, 56px on the
  Grand Door tile.
- **Same data model and public API shape** — `e.look`, `lookAt`,
  `avatarLookHTML(face,look,glow,w)`, `LOOK_FACES`. The sync merge
  carries `e.look` whole-object, later-wins via `lookAt`, so the
  new look shape merges safely (no merge change) — the pattern
  rides along with the rest of the background.
- **CSS idle life** — gentle bob (3.6s) + blink (4.6s) for every
  animal, plus a signature motion for the obvious ones: frog hop,
  elephant trunk sway, giraffe nod, rabbit + dog ear wiggle.
  No flutter — the butterfly is gone. Tap to play layers on top
  of it (the trick ends by itself and the idle life resumes).
- **Otter + butterfly removed from the picker** — they are not on
  the sheet. A stored otter/butterfly face falls back gracefully
  to the chick (the first animal on the sheet) in the renderer, so
  nothing breaks; the picker just never offers them.

## Editor sections (round 5)

Magic name → My animal friend (25) → My full-body look (preview) →
My background (shape, colour, pattern, effect) → Pip's glow
colour → My badge. No "Animal colour" section, no hair anywhere,
no accessory section.

## Files

- `new-avatar-5-code.js` — the renderer (25 animals + 6
  backgrounds with patterns and animated effects + ground shadow
  + tap to play), replacing the round-4 avatar block; same
  structure, same animation hooks (`av5` class).
- `look-modal-5.js` — the editor (remove colour, add background
  picker, keep the draft pattern), replacing `openLookModal`.
- `design-5.md` — this file.
- `preview-5.html` / `anim-proof-5.html` — preview + animation proof
  pages; `gen-preview-5.js` / `shoot-5.js` generate and shoot them.
- `apply-5.js` — fail-fast apply (refuses if already applied, fails
  fast if the round-4 anchors are missing).
- `tests-dressup-r5.test.js`, `dressup-5.test.js`,
  `look-modal-5.test.js` — replace the three round-4 test files.
- `proof-5-*.png` — rendered proofs. The animated-backgrounds
  section is shot twice (`proof-5-bgs-effects.png` = frame A,
  `proof-5-anim-bg-b.png` = frame B, ~3.5s later) so the motion
  reads in the stills. The tap-to-play section is frozen mid-jump
  (proof-5-taptoplay.png). The old accessory proofs
  (`proof-5-accs.png`, `proof-5-tricky.png`,
  `proof-5-croc-accs.png`) are deleted — do not upload them.

## Fix round (child-behaviour screen FAIL → fixed)

The screen passed everything except two must-fixes:

1. **Chick accessories.** The chick is the only single-ball animal
   (face in the middle — eyes at cy=125, beak at y=136–146), but the
   accessories were positioned for the two-part head/body template,
   so the bow and necklace sat on its eyes and the hat and crown
   floated above its head. The fix was a per-animal offset table
   `AV_ACC_OFF` — but the parent then dropped the accessories
   entirely, so the table and the fix are gone with them. The
   chick itself is unchanged (the single ball, eyes at cy=125).
2. **Crocodile proportions.** The first redraw stacked a wide flat
   snout on top of a round body. Redrawn long and horizontal in the
   same 200×260 grid, facing left like the sheet: tail to the
   right (tip at x=190), yellow back spikes along the body top,
   body ellipse (108,192) rx58 ry30, tan belly, head ellipse
   (66,162) rx46 ry32 with two eye bumps on top (52,126) and
   (92,130), nostril at the snout tip, long curved mouth with four
   white triangle teeth. Same colours, outlines and face. The
   crocodile redraw STANDS — it is re-proofed in the new section 9,
   `proof-5-croc.png` (alone and on its background).

Tests: the crocodile recognition markers were updated to the new
tooth marker, plus markers for the long body, the tail and the back
spikes. The accessory-offset tests are gone with the accessories;
in their place the suite asserts that no accessory code remains in
the page (`LOOK_ACCS`, `AVATAR_ACCS`, `AV_ACC_OFF`, `lookAccPick`
all absent) and that a stored accessory value changes nothing in
the render.

## Round 5b — accessories dropped, three new features (2026-11-08)

The parent dropped the accessories and picked tap to play,
background patterns and animated backgrounds (see the top of this
file). All three were built in this round, on top of the accessory
removal:

- **Tap to play** — `avatarPlay(svg)` + the `.av-play` class, the
  `.av-jump` wrapper group and the `.av-sparkles` burst group, the
  `av5Play` / `av5PlayHop` / `av5Spark` keyframes, the frog's
  higher hop and the rabbit's faster ear wiggle (CSS by
  `data-animal`). Tests: the svg carries the tap handler, the
  class is added on tap and removed when the jump ends (but not
  when the sparkles end), a second tap while playing does nothing,
  and reduced motion switches the trick off.
- **Background patterns** — `LOOK_BG_PATTERNS` + `bgPatternSVG`,
  a Pattern row in the editor (`bgPatternPick`), the look's
  background gains `pattern`. Tests: every pattern renders
  inside the shape (clipped), subtle white; none / missing /
  unknown all fall back to none; no background colour means no
  pattern.
- **Animated backgrounds** — `twinkle` / `bubbles` / `petals`
  join `LOOK_BG_EFFECTS`, with `bgTwinkleSVG` / `bgBubblesSVG` /
  `bgPetalsSVG` and the `av5TwinkleBg` / `av5Bub` / `av5Pet`
  keyframes. Tests: each renders its class, clipped to the shape,
  staggered by negative delays; the static glitter is unchanged
  and distinct; reduced motion switches them off.

Verified on a pristine /tmp copy: baseline 580/580, after apply
584/584, double-apply still refuses.

## Fix round 5b (child-behaviour screen FAIL → fixed)

The screen passed everything except two must-fixes — both about
things a child picks and then cannot see:

1. **Petals nearly invisible.** White petals on pale sky blue at
   0.55, all starting in the middle, so at 3× zoom the expert
   could barely find one petal in either frame — frame A showed
   essentially nothing, frame B one faint petal at the left edge.
   A child who picks "petals" would see nothing falling and think
   the feature is broken. The fix: soft pink `#f7a8b8` (the blush
   pink) at 0.6, slightly larger (18 tall instead of 14), and the
   spots moved into the left/right margins and the top crescent
   so they stay visible for most of the fall instead of hiding
   behind the animal. Re-proofed in both animated-background
   frames (A and B, ~3.5s apart) so the falling motion reads in
   the stills.
2. **Patterns too subtle at real size.** At the real 120px size
   the dots read, but the stars and hearts were nearly invisible
   and the stripes a faint texture — the expert had to zoom to 3×
   before the hearts read as hearts and the stars as sparkles.
   The fix: opacities bumped (stars 0.4→0.6, hearts 0.35→0.55,
   stripes 0.16→0.3, dots 0.32→0.45) and the stars and hearts
   made slightly larger (stars s=8, hearts scaled 1.3×), so each
   pattern is clearly distinguishable at 120px while the animal
   still pops off it. Re-proofed on the patterns page.

Tests: the pattern assertions now pin the new opacities and the
bigger stars/hearts, and the animated-effects test pins the pink
petals (seven, counted against a plain render, since the chick's
own blush is the same pink), their bigger size, their margin
spots, and the 0.6 hold in the `av5Pet` keyframes.
