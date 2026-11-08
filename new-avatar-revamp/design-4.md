# Round 4 — realistic fur, texture, depth

The parent's brief (2026-11-08): "change the frog, butterfly, tortoise,
panda. make them cuter. all animals become more realistic like mira.
Textures, fur, depth." Mira is a rendered 3D picture; the app's animals
are drawn in code, which is what lets them change colour on tap, blink,
bob and wear accessories. Round 4 pushes the drawings as far as SVG can
go toward that rendered look — fur, grain, layered shading, lifelike
eyes — while keeping everything the code-drawn animals can do.

## What changed, per animal

### The four focus animals (visibly reworked, not just re-shaded)

**Frog** — bigger eye bumps (r 17) with bigger eye whites (r 11.5) and
irises (r 8, with rim and inner ring), so the eyes are the first thing
you see; realistic skin with subtle bump dots on the head and body plus
a sheen; a wider smile (M70,96 Q100,114 130,96); a throat patch; toe-pad
lines on the feet. It should feel like the same frog as the app's live
frog (Greg Washington): green, glossy, big-eyed, friendly.

**Butterfly** — delicate, realistic wings: scalloped upper-wing paths
with veins, spots with rings, and a slimmer body (rx 14) so the wings
carry the shape; a thorax ellipse covering the wing join; longer curved
antennae (M88,40 Q78,18 68,8) with fine tips. The wings are patterned,
not flat colour.

**Turtle** — a realistic shell with a real scute pattern: a central
hexagonal scute (M100,106 L118,116 L112,138 L100,146 L88,138 L82,116 Z)
plus side scutes with dark borders and marginal rim arcs, so the shell
is unmistakably a shell and clearly distinct from the frog; bigger eyes
(rx 9 ry 11, iris rim), blush cheeks, toe lines on all four feet, and a
softer face.

**Panda** — bigger eye patches (rx 13.5 ry 17) with bigger warm-brown
eyes (iris rim, not black beads), fur tufts on the patches, ears and
arms (shade(p.dark,0.25) strands), and a nose highlight. The patches
read as fur, not flat black shapes.

### All 12 animals — fur, texture, depth

- **Fur strands and tufts** (`avFur`): fine stroke groups at the edges
  — cheek ruffs (fox), ear tufts (cat, dog, rabbit, lion mane edge,
  panda patches), chest strands, tail tufts — drawn in a darker shade
  of the animal's own colour (`fur: shade(main,-0.18)`), so they
  recolour with the animal. `furHi: shade(main,0.38)` is the light
  strand colour.
- **Grain** (`fGr` filter): a feTurbulence fractal-noise overlay at
  0.05 alpha, gated on `a.grain` (the nine furry animals only — the
  frog, butterfly and turtle have smooth skin/shell/wings and no
  grain). It gives the surface a soft, slightly uneven feel instead
  of flat vinyl. It is deliberately faint: at 0.05 it reads as
  texture, not dirt.
- **Rim light** (`avRim`): a light arc on the top-left edge, in the
  animal's lighter shade, so the form turns toward the light.
- **Deeper shading**: the body gradient (gB) plus a chin crease
  (ambient occlusion where the head meets the body), a ground shadow,
  and highlights that follow the form (sheen ellipses). Noses got a
  highlight; feet got toe lines.
- **Lifelike eyes** (`avEyes` upgraded): iris rim, a lighter inner
  ring, and an upper-lid shadow arc, plus the existing catchlight.
  Eyes now have depth instead of being flat dots.
- **More natural proportions**: the otter's arms are narrower
  (rx 7.5 ry 20, with toe lines) so they read as arms, not wings;
  the dog's arms are narrower too; the pig's tail is a proper visible
  curl (M150,172 C162,166 172,170 170,180 C168,188 158,190 156,182
  C154,176 160,172 164,176) replacing the old squiggle.

The approved round-2/round-3 geometry is otherwise untouched. The
shapes are still the same plump bodies underneath — the realism comes
from the surface treatment, not new geometry (see "What still isn't
perfect").

## The whole-animal colour system (unchanged)

`lookPal` still recolours the WHOLE animal: the main colour, the dark
shade, the fur strands, the rim light and the grain all derive from the
chosen colour, so a pink otter is a pink *furry* otter and a teal turtle
is a teal turtle with a darker teal shell. Verified in the proofs:
Natural, pink and teal grids, all 12 animals each.

## Idle life (unchanged, except the flutter)

Bobbing, blinking and one signature motion per animal still work in the
editor preview, the 130px sidebar avatar and the 43px mobile topbar.
Two changes:

- **Butterfly flutter is now a real flap.** Round 3's flutter was a
  scaleX squash (0.72) — in motion the wings only moved up and down
  with the bob and no independent flutter phase was visible (found
  live). Round 4 replaces it with two mirrored animations, avFlutterL
  and avFlutterR (1.8s): scaleX 0.45 *plus* a rotation (∓14°) with
  the transform origin at the wing base, so both wing tips rise as the
  wings fold — a real flap. Verified in the animation frames: frame 2
  shows the wings folded narrow and tilted, frame 1 and 3 show them
  open. The same standard was applied to every signature motion: each
  one must be VISIBLE in motion, not just present as a class.
- **Head nod is a tilt, not a shift.** avNod now rotates (3°/−2°,
  origin at the neck) instead of translating 2px, so the nod reads
  as a nod rather than a wobble.

## The Cancel bug (found live in round 3 — fixed here)

The editor saved live on tap: picking an animal then tapping Cancel
still changed the stored look (verified on the real app after a full
reload). The editor now works on a **draft** copy of the look and only
commits it to `e.look` (and saves) when "Save my look" is tapped;
Cancel discards the draft and changes nothing.

How it works (`look-modal-4.js`): on open, the modal builds
`draft = {face, glow, badge, look:{color, accessory}}` — a copy, not
an alias. All five pick handlers (animal, glow, badge, colour,
accessory) write to the draft only, never call `save()`, and refresh
the modal preview from the draft. `refreshLookPreview` renders only
the modal preview from the draft — it does NOT touch the sidebar or
topbar, which keep showing the saved look until Save. Save resolves
the live explorer fresh with `ex()` (required: the background sync
~800ms after a save replaces the whole DB object, so the copy captured
at open may be detached), commits `draft.face/glow/badge/look` as a
fresh object copy, stamps `lookAt`, commits the typed name, then
`saves()`, closes, re-renders and toasts. Cancel is unchanged
(`onclick="closeModal()"`) — the draft is simply discarded.

Tests: the draft pattern is asserted in `tests-dressup-r4.test.js`
(the 'look taps' and 'draft editor' blocks, including a functional
test that evals the Save handler with a stubbed draft/live/document
and asserts exactly one save, a fresh look object, and the lookAt
stamp), and the two files that locked in the old live-save behaviour
(`tests/dressup.test.js`, `tests/look-modal.test.js`) are replaced by
their round-4 versions (`dressup-4.test.js`, `look-modal-4.test.js`).

## The rabbit head–body seam (found live in round 3 — fixed here)

The rabbit showed a faint circular edge where the head circle overlaps
the body. Removing the head's stroke (round 4's first attempt) was not
enough: the cause was the gradient, not the stroke. The per-shape gB
gradient samples a different field on each shape, so the head's dark
bottom met the body's light top and the step showed as a faint arc.

Fix: the rabbit's head circle and body ellipse now share one
`userSpaceOnUse` gradient (`gR`, centre (100,55), r 230, same stops as
gB), so both shapes sample one continuous light field and the overlap
has no step. `gR` is rabbit-only — the other 11 animals keep gB.
Verified at 400px: the head flows into the body with only a soft chin
shadow (the intentional crease peeking out below the head's edge),
which reads as depth, not a seam. Test: the rabbit assertions in
`tests-dressup-r4.test.js`.

## Files

- `design-4.md` — this file.
- `new-avatar-4-code.js` — the new renderer (replaces only the animal
  art block; same structure, colour, accessories, animation hooks).
- `look-modal-4.js` — the fixed draft editor (replaces openLookModal).
- `preview-4.html` / `anim-proof-4.html` — generated by
  `gen-preview-4.js` (8 sections: top-left, Natural, pink, teal,
  accessories, tricky combos, close-ups of the four reworked animals
  + the rabbit join, live animation).
- `apply-4.js` — fail-fast apply: refuses if already applied (av-fur
  present, or the round-4 test markers), refuses if the round-3
  anchors are missing. Replaces the avatar block, the editor, the
  idle-life CSS, and three test files.
- `tests-dressup-r4.test.js`, `dressup-4.test.js`,
  `look-modal-4.test.js` — the round-4 test files.
- `gen-preview-4.js`, `shoot-4.js` — preview generation and
  screenshotting (Chrome for Testing + playwright-core).
- Proofs: `proof-4-full.png`, `proof-4-topleft.png`,
  `proof-4-natural.png`, `proof-4-pink.png`, `proof-4-teal.png`,
  `proof-4-accs.png`, `proof-4-tricky.png`, `proof-4-closeups.png`,
  `proof-4-anim.png`, `proof-4-anim-f1-blink.png`,
  `proof-4-anim-f2-flutter.png`, `proof-4-anim-f3-hop.png`.

## Verification

- Pristine /tmp copy of the current project: baseline **577/577**
  green before apply, **580/580** green after (577 + 3 new tests:
  focus-four, fur/texture/depth, draft-editor). Double-apply refuses.
- Every proof read back and looked at. Blink reads in frame 1 (all
  three animals' eyes closed). The flutter reads in frame 2 (wings
  folded narrow and tilted, vs open in frames 1 and 3). The frog hop
  reads in frame 3 (frog lifted, shadow detached below). The rabbit
  join is seamless at 400px.

## What still isn't perfect (honest list)

1. **The shapes are still the round-2 templates underneath.** The
   realism is surface treatment — fur, grain, shading — on the same
   plump bodies. A truly realistic animal (Mira's rendered 3D) would
   need different proportions and anatomy, which SVG redraws can't
   reach without a full re-model.
2. **Fur and grain fade at small sizes.** At the 43px mobile topbar
   the animals read by colour and shape; the fur strands and grain
   are barely visible. At 130px they read; at 260px they read well.
3. **The butterfly's folded wings are very narrow.** The flap is
   unmistakable in the frames, but at the folded extreme the wings
   are two thin pink slivers — in fast motion they may read as the
   wings briefly disappearing rather than folding.
4. **The frog's skin bumps are subtle.** Visible at large size,
   nearly invisible at 120px. The frog's cuteness still comes mostly
   from its big eyes and smile.
5. **The rabbit's tail** reads as a small fluffy circle at the body's
   left edge and sits slightly detached; at small sizes it can look
   like a speck beside the body.
6. **The pig's tail** is a proper curl now, but it is small and can
   hide behind the body at some sizes.
7. **The tiny hat at 43px is still a speck** (round-2 nit, unchanged).
   It reads at 130px and above.
8. **The otter's arms** are narrower with toe lines, but at the
   largest sizes they can still read slightly wing-like — the arms
   are simple ellipses, not shaped paws.
9. **The lion's mane** has tufts around the edge but is still a flat
   ring shape; the tufts don't break the ring's outline much.
10. **The draft editor trades live preview for correctness.** The
    sidebar/topbar now keep showing the saved look while the modal is
    open (correct — Cancel must revert), so a child tapping animals
    sees the change only in the modal preview, not in the big
    top-left avatar, until they tap Save. That is the right trade-off,
    but it is a behaviour change from round 2/3.
