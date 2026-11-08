# Avatar revamp — design language

## The problem with the old version
The old avatar was a collage, not a character: an emoji face pasted over a
flat CSS dome, with hair drawn in a different coordinate system (120px wide
over a ~64px face) so it covered the eyes, and a head that floated above the
body with a visible gap. A child reads that as "broken toy" — the pieces do
not belong together.

## The new visual language: one character, one grid
Everything is a single SVG on a **200 × 260 grid**. Face, body, hair and
accessory are drawn in the same coordinate space, so they can never drift
apart. The style is flat children's-book illustration (think Duolingo /
Toca Boca): big friendly shapes, soft rounded forms, a thin soft outline
(`rgba(0,0,0,0.10)`), gentle shading, joyful colours.

## Anatomy and anchor points (non-negotiable)
- **Ground shadow** at y=246 — the character stands on something.
- **Feet** at (72,230) and (128,230) — little ovals in the body colour.
- **Torso**: top y=112, bottom y=232, widest x=46–154. Cream belly
  (white, 45% opacity) so any body colour reads as a tummy; arms at the
  sides; a soft white highlight top-left and a soft dark shade
  bottom-right so the body has volume, not a flat fill.
- **Head**: face circle centre (100,76), r=46 (lion r=42 inside a r=58
  mane). Head bottom y=122, torso top y=112 — **the head overlaps the
  torso by 10px by construction**. There is no gap to fix; a gap is
  geometrically impossible.
- **Eyes**: FIXED at (82,72) and (118,72) for every animal — big white
  ovals, dark pupils, tiny highlights. Because the eyes never move,
  glasses always ring them. Panda gets the same positions with smaller
  eyes on its black patches.
- **Hair zone**: fringe y=8–58, always above the tops of the eyes (y=60). Hair frames the face; it can never cover the eyes. The "long" style is a bob: one piece with a rounded crown, a fringe across the forehead (dipping to y≈57) and tapered side panels hugging the face down to y=106. Hair shapes are drawn in the same 200-wide coordinates as the avatar, so the picker mini-previews and the avatar can never disagree. Hair is drawn **before** the ears are re-drawn on top (`id="avatar-ears-top"`), so hair always tucks **behind** the animal's own ears — a rabbit with long hair keeps two ears, not four. (The lion's mane is not re-drawn, or it would swallow the hair.)
- **Hat**: brim y=33, crown y=2–32 — sits on the head top.
- **Glasses**: rings r=15 around the fixed eye positions, bridge and
  temples.
- **Necklace**: a gold arc across the chest (y=136–154) with coloured
  beads and a red pendant. **Bowtie**: at the neck (y=118–138), just
  under the chin.

## The twelve faces
Each animal is drawn, not pasted: ears behind the face, a muzzle/mask or
eye patches, then the shared eyes, then nose and smile. The face colour
is the animal's own (otter brown, frog green, butterfly pink, cat amber,
dog tan, rabbit near-white, lion gold in a rust mane, panda white,
fox orange, turtle green, pig pink, monkey brown with a tan mask).
Distinguishing features are one clear idea per animal: rabbit's long
ears, lion's mane, panda's patches, fox's white muzzle, pig's snout,
monkey's tan mask, dog's floppy ears and tongue, cat's whiskers,
butterfly's antennae and lashes, frog's wide smile, turtle's shell cap
(a filled dome with segment lines, not a thin arc), otter's whiskers,
small low ears and wide flat face with a light muzzle. A child should name the animal in
under a second.

## Colour system
- Body colour is the child's choice (Natural = their glow colour). Belly
  is always cream-white at 55%, arms/feet match the body, shading is
  black/white at low opacity — so **every body colour works with every
  animal**, including dark brown.
- Hair is always dark brown (#6b4423) — it reads as hair on every face.
- Accessories are bright and few: purple hat with a yellow band, gold
  necklace with coloured beads, red bowtie, dark-rimmed glasses.

## Why a child will love it
- **It is a friend, not a form.** Big eyes looking at you, a smile, arms
  at its sides, standing on the ground — it has presence.
- **Every choice shows instantly.** Colour changes the whole body, hair
  changes the silhouette, accessories are jewellery and hats — the
  feedback is the fun.
- **Nothing looks wrong.** No combination can produce a floating head, a
  covered face or a lost accessory, because the geometry forbids it.
- **It reads at small size.** The preview is ~190px and the sidebar disc
  stays the emoji; the full body only appears where it has room.

## What changed in code (and what did not)
- Changed ONLY the rendering: `LOOK_HAIR_SHAPES` (new shapes in avatar
  coordinates; "long" is now a one-piece bob, not two bars), new
  `AVATAR_FACES` / `AVATAR_FACE_EMOJI` / `AVATAR_ACCS`, new
  `avatarLookHTML` (one SVG; the otter's face is an ellipse via
  `faceRx`/`faceRy`; ears are re-drawn over hair as
  `id="avatar-ears-top"` except the lion's mane), and the hair picker
  mini-preview viewBox (120×60 → 200×110, so the bob's side panels are
  not clipped).
- Unchanged: the data model (`e.look={color,hair,accessory}`, `lookAt`,
  merge), the modal structure, the tap handlers, the sidebar/door chips
  (face emoji only), the frog facts.
- Tests: `tests/dressup-greg.test.js` avatar assertions updated to the
  new markers (`data-animal`, `fill="…"`, `id="avatar-hair"` /
  `id="avatar-acc"` groups) — the old assertions checked for emoji and
  `background:…`, which no longer exist.
