# Round 3 — 3D avatars, Pip-style

## The brief

Round 2 is approved and live, but the parent said the animals still
read as flat 2D stickers: "can generate them in 3d? eg: otter is
like Mira. 3d animated." He confirmed: make them 3D like Pip.

## The house 3D language (studied first)

Pip himself is a rendered 3D image (`assets/pip-otter.png`) — Pixar
style: fur, glossy eyes with catchlights, soft directional shading,
a leaf on his head — inside a ring with a glow, a drop shadow and a
diagonal white shine (`.otter-shine`, a 125° white gradient). The
live frog is the same language drawn in SVG: radial gradients with
the light at top-left (`fgBack`: cx 38% cy 30%, light → mid → dark
edge), a pale radial belly, glossy eyes (white, iris, pupil, white
catchlight dot), blush cheeks, a soft dark ground shadow, and CSS
idle life (`frogBlink` scaleY squash, `frogBreathe` scale,
`otterFloat` translateY + rotate, `otterTilt` rotateY/rotateX,
`earWig`, `tongueWig`). All of it is transform/opacity only, with
`transform-box:fill-box` origins and a `prefers-reduced-motion`
off-switch.

Round 3 uses exactly that language — no WebGL, no Three.js, no new
assets. The animals must look like they belong standing next to
Pip, not like a different art style pasted in.

## The 3D treatment

One light source, top-left, everywhere:

- **Body and head gradients** — every big form is a radial
  gradient, light at the top-left (cx 38–40%, cy 26–30%), the
  animal's own colour in the middle, a darker edge at the bottom
  and sides. The dark edge is always a shade of the main colour
  (`shade(main,-0.30)`) — never the animal's dark accent — so a
  pale animal's body edge goes soft grey, not black (the panda
  stays a white panda; its black lives only in its ears, arms
  and eye patches, as in round 2).
- **Dark-accent gradient** — shells, manes, dark ears and dark
  patches get their own radial gradient (light → dark accent →
  darker), so the turtle's shell and the lion's mane are round
  too, not flat discs.
- **Sheen** — a soft radial white fade where the light hits:
  top-left of the head and of the body (Pip's `.otter-shine`,
  as an ellipse). Opacity 0.35–0.5, never a hard white blob.
- **Crease** — a soft dark ellipse under the chin where the head
  meets the body, so the head sits INTO the body. Round 2 merged
  the shapes; round 3 shades the join.
- **Layered depth** — tails and far ears behind the body, arms
  and feet in front, feet a shade darker (contact with the
  ground), a soft radial ground shadow instead of a flat grey
  ellipse.
- **Glossy eyes** — white, a warm-brown iris, a dark pupil, two
  catchlights (one big, one small). The frog keeps its green
  iris, like the live frog's `#3a7d2c`.

## Colour

The gradients are derived from the chosen colour, so a pink
otter is a pink 3D otter — its shadows, highlights and belly
follow the colour. Natural = the animal's own colour. The
round-2 geometry is untouched: every approved shape (rabbit's
long ears at the reference ratio, turtle's shell with segment
lines, otter's whiskers and flat face) stays exactly where the
child-behaviour screen approved it. Only the fills, the layering
and the motion are new.

## Animation (idle life, CSS only)

Slow and calm — a child should feel the animal is alive, not
that it is dancing. All transform/opacity, all on the svg
(`class="av3d"`), so it works in the editor preview, the sidebar
130px avatar and the mobile 43px topbar alike, and degrades
gracefully at small sizes.

- **Bob** (`av-bob`, 3.6s): the whole character rises ~3.5px
  and settles. The frog hops instead (`av-hop`, 2.8s: up, land
  with a squash).
- **Blink** (`av-blink`, 4.6s): eyes close for ~0.14s, the
  frog's 91–94% beat. Staggered per animal (inline
  `animation-delay`), so a page of animals never blinks in
  lockstep.
- **Signature motion, one per animal:**
  otter tail sway · frog hop-bob · butterfly wing flutter
  (scaleX, wings folding toward the body) · cat tail sway ·
  dog ear wiggle + tongue · rabbit ear wiggle · lion head nod
  (a circle can't sway visibly, so the head nods) · panda ear
  wiggle · fox tail sway · turtle head nod · pig ear flop ·
  monkey tail sway.
- **Reduced motion**: one media query switches all of it off,
  next to Pip's own.

## What is kept

Whole-animal colour (7 colours + Natural), the same 5 tiny
accessories (necklace, tiny hat, flower, star, little bow —
drawn last, inside the bob group so they ride the animal),
no hair, the big top-left avatar (130px sidebar / 43px mobile),
the same data model (`e.look={color,accessory}`), the same
504 combinations.

## What to judge in the proofs

- Do the animals look round and soft, like plush 3D
  characters, or still like flat stickers with a gradient?
- Does the light read consistently (top-left) across all 12?
- Does the pink matrix still read as 12 different animals?
- Do the accessories still sit ON the animal without
  flattening it?
- Is the motion alive but calm in the 3-frame sequences?
- At 43px, is it still clearly a living character?
