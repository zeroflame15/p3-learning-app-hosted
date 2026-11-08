# Avatar revamp — ROUND 2 (2026-11-08): the parent's own brief

## What changed and why

Round 1 built one shared torso + 12 faces. The parent corrected the
brief with his own reference picture (a sheet of kawaii full-body
animals — `~/workspace/user/media_library/image/image-21.png`):
the body must BE the animal, the colour must recolour the WHOLE
animal, there must be no hair, and accessories must be tiny touches.
Round 1 is thrown away and replaced by this round.

## The visual language

Each animal is a COMPLETE full-body character in its own shape,
drawn on one 200×260 SVG grid — kawaii style, like the reference
sheet: big head, big friendly eyes, a smile, a small plump body,
tiny arms and feet, a ground shadow at y=246. Nothing is shared
between animals except the eye positions and the grid.

| Animal | Its own shape — what makes it itself at a glance |
|---|---|
| Otter | Wide flat face, whiskers, small low ears, light muzzle, tail |
| Frog | Eye bumps on top of the head, wide smile, round body |
| Butterfly | Big upper + lower wings with spots, antennae, slim body |
| Cat | Pointed triangle ears, curving tail, pink nose |
| Dog | Floppy ears, tongue out, tail |
| Rabbit | Long upright ears with pink inners, buck teeth, fluffy tail |
| Lion | Mane ring, tail with tuft |
| Panda | Black ears, eye patches, black arms and feet |
| Fox | Pointed ears, big bushy tail with a pale tip, light muzzle |
| Turtle | Small head sitting INTO a big shell dome with segment lines |
| Pig | Snout with nostrils, curly tail |
| Monkey | Light face patch, round ears, long tail |

Heads sit on bodies with no gap: plump bodies start at y=116
(head bottom y=122); the pig/frog round bodies start at
y=122–130, exactly at the chin; the turtle head sits down into
the shell dome. The rabbit is the exception, fixed after the
child-behaviour screen (2026-11-08): its head sits 8px lower
(cy=84, bottom y=130) and its round body starts at y=124, so the
head overlaps the body by 6px and merges into it with no seam —
the way the otter's head merges into its body. The head had to sit
lower so the ears fit the grid: they are long and slim (rx=9,
ry=32, tips at y=3, 35px above the head top — the reference
rabbit's ears rise ~0.40× its head height above the head), exactly
two, with pink inners that stop short of the tip. (Round-1 lesson
kept: the turtle's shell and the otter's whiskers are what stop
them reading as a frog or a bear.)

## Whole-animal colour

`lookPal(color, nat, natDark)` builds the palette for one look:
`main` is the picked colour — or the animal's own natural colour
when Natural is chosen. Belly, muzzle and ear accents are lighter
shades of that same colour; feet, tail tips and dark accents are
darker shades of it. In Natural mode the dark accent is the
animal's own (`natDark`: the panda's black, the turtle's shell
green, the lion's mane orange-brown), so a natural panda is still
a panda. The glow colour is ignored for the character now — the
animal keeps its own colour. A pink otter is a pink otter, face
and body together, not a pink blob: verified in `proof-pink.png`
(all 12 in pink) and `proof-teal.png` (all 12 in teal).

Colours: Natural + pink `#ff8fa3`, amber `#ffb020`, teal `#2dd4bf`,
blue `#7db4ff`, purple `#c084fc`, brown `#8b5e3c`.

## No hair

There is no hair picker and no hair rendering. The modal has two
picker rows (Animal colour, Accessory). A saved look that still
carries a hair value renders identically to one without — the
value is never read. The test asserts the output is byte-identical.

## Tiny accessories

Five, all small touches that never cover the face or change the
silhouette: **necklace** (a small beaded arc hugging the neck),
**tiny hat** (a little tilted top hat on the head), **flower** (a
small daisy tucked beside the left ear), **star** (a small star
clip beside the right ear), **little bow** (a small bow at the
neck). Unknown accessory values render as no accessory. Verified
on the otter (`proof-accs.png`) and on the trickiest animals —
butterfly + necklace, lion + tiny hat, panda + bow, frog + flower,
pig + star, monkey + necklace (`proof-tricky.png`).

## The top-left avatar — BIG

The sidebar brand is no longer a small emoji disc. It is the
full-body character itself, **130px wide** (~169px tall), centred
at the top of the sidebar with the name below it. On mobile
(≤820px, where the sidebar hides) the character is **43px** in the
topbar, replacing the Pip icon; Pip stays on desktop. Both slots
are `#sideAvatar` / `#tbChar` and are refreshed in place by
`refreshLookPreview()` on every look tap, and `render()` rebuilds
them from `e.look` on Save — so the saved look IS the top-left
avatar, immediately. Verified in `proof-topleft.png` (sidebar and
mobile topbar at real size) and by tests.

## Why a child will love it

Every animal is a whole little friend, not a face on a blob — she
can pick the animal she loves, paint the WHOLE friend her
favourite colour, and add one tiny treasure that is hers alone.
The character greets her big in the corner every time she opens
the app, wearing exactly what she chose.

## Files

- `new-avatar-code.js` — the renderer (drop-in replacement for the
  round-1 avatar block in `public/index.html`).
- `preview.html` — standalone render of every animal × Natural /
  pink / teal, every accessory, tricky combos, 3 close-ups, and the
  top-left avatar at real size. Built by `gen-preview.js` from the
  same code file, so the preview can never drift from the code.
- `proof-*.png` — rendered screenshots (Chrome for Testing):
  `proof-full.png` (whole page), `proof-topleft.png`,
  `proof-natural.png`, `proof-pink.png`, `proof-teal.png`,
  `proof-accs.png`, `proof-tricky.png`, `proof-closeups.png`.
- `apply.js` — applies the revamp to a project copy: replaces the
  avatar block, the sidebar brand, the mobile topbar, the CSS
  rules, the new-explorer default, the modal label/rows/handlers,
  and both test files. Fail-fast anchors, refuses a double-apply.
- `tests-dressup-r2.test.js` — the round-2 dress-up suite (the
  frog-facts tests are unchanged).
- `shoot.js` — renders `preview.html` into the proof PNGs.

## Verification

- All 504 combos (12 animals × 7 colours × 6 accessories) render
  without error; stored hair ignored (identical output); unknown
  face/accessory degrade gracefully; Natural ignores the glow.
- `npm test` on a fresh /tmp copy of the current project:
  **556/556 green** (baseline 556). Double-apply refuses.
- Page loads in Chrome with no JavaScript errors (file:// smoke
  check; the only console noise is the expected blocked
  `/api/progress` fetch, which needs the live server).

## What still isn't perfect (honest list)

- Rabbit ears FIXED after the child-behaviour screen (2026-11-08):
  lengthened to the reference ratio and the head–body seam merged.
  The old note ("ears on the short side") no longer applies.
- The tiny hat is genuinely tiny: at the 43px mobile size it is a
  small purple speck on the head. It is a "tiny touch" by design,
  but a child may not notice it in the topbar.
- The necklace is a thin beaded arc; at small sizes it reads as a
  dotted line on the chest rather than jewellery.
- The butterfly's lower wings overlap the body slightly at the
  sides — it reads as a butterfly, but the wing/body join is the
  least clean of the twelve.
- The pig's curly tail is small and can hide behind the body at
  some sizes.
- The `.disc` CSS rule is now unused (the sidebar disc is gone);
  left in place as harmless dead CSS rather than risk touching
  shared styles.
