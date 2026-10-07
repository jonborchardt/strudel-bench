# limner

**Draws one person.** Parameters in, a posed portrait out, as SVG or on a canvas.

```js
import { person, renderPortrait } from 'limner';

renderPortrait(person({ cast: 'dwarves', seed: 7 }));
// -> '<svg viewBox="0 0 400 480" role="img">…'
```

It is aimed at editorial vector illustration rather than at an avatar generator: tone before line, the eye a socket
rather than an almond, noses modelled in shadow instead of outlined, irregular planes instead of soft ellipses, and
faces built in structural families and then perturbed, so two people differ in the bone and not only in the hair. It
knows anatomy, wardrobe, expressions and stances, and it can invent a plausible person of a given people from a seed.

No dependencies. No build step. ~125 kB packed, pure ESM, runs in Node, in a browser and inside a Worker.

---

## Install

```sh
npm install limner
```

Node 18 or newer. In a browser, import it directly — there is nothing to compile:

```html
<script type="module">
  import { person, renderPortrait } from './node_modules/limner/index.mjs';
  document.body.innerHTML = renderPortrait(person({ seed: 42 }));
</script>
```

## What it is not

Worth knowing before you adopt it:

- **It draws one figure.** There is no scene, no camera and no composition. Where a figure sits in a frame, how big it
  is drawn and whether it puts an arm around a neighbour are facts about a composition, not about a body. A group
  portrait is your code calling limner once per person and placing the boxes — `eyeY`/`feetY` tell you where to put
  them.
- **It is not a likeness tool.** You can drive it toward a photograph by hand, and the parameters are fine enough to get
  close, but nothing here looks at an image.
- **It is pre-1.0.** The surface is wider than it should be (see *Stability*), and names may be withdrawn before 1.0.

## Two shapes you will pass around

This is the one thing to learn first, because mixing them up is the usual first error.

**A character** is already drawable parameters.

```js
import { person, renderPortrait } from 'limner';
const who = person({ cast: 'elves', seed: 3 });
renderPortrait(who);                       // draw it directly
```

**An identity** is a person *plus the wardrobe they own* — `{ id, name, base, home }` — and has to be dressed for an
occasion before it can be drawn.

```js
import { archetype, dress, renderPortrait } from 'limner';
const sitter = archetype({ cast: 'elves', seed: 3, name: 'moonsinger' });
renderPortrait(dress(sitter, { expression: 'grin', costume: 'severeBlackSuit' }));
renderPortrait(dress(sitter, { expression: 'deadpan', hat: 'bucketHat' }));  // the same face, another day
```

A crowd is characters. A recurring cast is identities — that is what keeps one face recognisable across outfits.
Calling `dress()` on a character throws, because a character has no wardrobe to dress from.

## Ops are the real output

`portraitOps(params)` is the one computation; SVG and canvas are two renderers over its result.

```js
import { portraitOps, toSvg, drawOn, person } from 'limner';

const ops = portraitOps(person({ seed: 1 }));   // ~343 flat drawing ops
toSvg(ops, '#c8102e');                          // a string, with a background
drawOn(canvas.getContext('2d'), ops);           // painted, at the current transform
```

Prefer ops when you draw repeatedly. If you are animating or exporting video, compute the ops once per frame and paint
them; rasterising an SVG string per frame will not keep up at 1080p30.

`renderPortrait(params)` is the bust (`viewBox="0 0 400 480"`). `renderFigure(params)` is the whole standing body
(`-30 -200 460 1284`), shifted so the feet land on the floor.

## Parameters

One nested object. Everything has a default, so pass only what you mean:

```js
renderPortrait({
  skin: '#b07a52',
  face: { width: 168, height: 212, jaw: 0.7, chin: 0.4, fullness: 0.3, asym: { chin: 0.4 } },
  eyes: { style: 'hooded', spacing: 62, squint: 0.3, iris: '#4a6b4e', look: { x: 0.4, y: -0.2 } },
  nose: { style: 'aquiline', length: 44, width: 22 },
  mouth: { style: 'full', smile: 0.35, open: 0.1 },
  hair: { style: 'afroMedium', color: '#2b2320' },
  facialHair: { style: 'fullBeard', density: 0.8, color: '#3a2f28', mustache: true },
  top: { style: 'tunic', color: '#6e7278' },
  jacket: { style: 'blazer' },
  hat: { style: 'wideBrimFelt' },
  pose: { headTilt: 0.08, turn: 0.3, shoulder: 0.4, gaze: 'camera' },
  light: { contrast: 1.4 },
  build: { trunk: 0.9, legs: 0.8, shoulders: 1.2, head: 1.05 },
});
```

The groups are `skin`, `hairColor`, `face`, `ears`, `eyes`, `nose`, `mouth`, `hair`, `facialHair`, `hat`, `top`,
`jacket`, `body`, `build`, `pants`, `shoes`, `glasses`, `accessories`, `details`, `makeup`, `marks`, `props`, `blush`,
`neck`, `pose`, `light`, `background` and `seed`. Read `DEFAULTS` for the full tree — it is the specification.

Styling, the second argument to `dress`: `costume`, `variant`, `hat`, `makeup`, `marks`, `props`, `expression`, `smile`
(an offset, so two deadpans differ), `pose`, `look`, and `stance: false` to drop the person's own lean so two figures
can hold exactly the same one.

## Peoples, casts and parts

Twenty-one casts ship: the fantasy peoples, the future ones, and the genres and eras. Each is a *people*: a signature merged over every member (an elf's ears, a dragonborn's muzzle, the
build itself), pools of parts it may wear, archetypes with pinned faces, and its own palettes.

| cast | archetypes | | cast | archetypes |
|---|---|---|---|---|
| `editorial` | 24 | | `orcs` | 6 |
| `undead` | 19 | | `halflings` | 6 |
| `dwarves` | 8 | | `tieflings` | 6 |
| `elves` | 6 | | `gnomes` | 5 |
| `humans` | 6 | | `dragonborn` | 5 |
| `scifi` | 5 | | `cyborgs` | 6 |
| `aliens` | 7 | | `holograms` | 5 |
| `wastelanders` | 5 | | `steampunks` | 7 |
| `gothic` | 5 | | `noir` | 5 |
| `synthwave` | 5 | | `punks` | 5 |
| `robots` | 7 | | | |

A robot is not a mask over a face: its eyes, mouth, ears and nose are **machine modes** of the features themselves
(`eyes.mode` lens/led/visor, `mouth.mode` grille/slot/speaker, `ears.mode` disc/antenna/none, `nose.mode` vent/none),
driven by the same expression dials, so a robot still squints and smiles. And a **lighting look** is not a people:
`dress(identity, { lighting: 'noir' })` puts anybody in `LOOKS.noir` (hard light, the colour graded toward grey through
`figure.saturation`), which the noir cast wears as its signature.

```js
import { CASTS, characterFrom, seed, prng } from 'limner';

const s = {}; seed(s, prng(11));                       // one stream for the whole crowd
const crowd = Array.from({ length: 16 }, () => characterFrom(CASTS.orcs, s));
```

A **part** — a top, a jacket, a hat, a hairstyle, makeup, a mark, a prop, teeth — registers itself by name and carries
tags. `everyday` and `era:80s` say what a part *is*; `only:undead` says who may wear it. Every generator picks through
a query:

```js
import { parts } from 'limner';
parts('top', { any: ['everyday'] });              // the nine ordinary tops
parts('top', { any: ['era:fantasy'] });           // the shared fantasy wardrobe
parts('makeup', { any: ['only:undead'] });        // the rot: reached only by asking for it
```

`everyday` is carried by the kinds a plain modern person needs — `top`, `jacket`, `hair`, `facialHair`, `glasses`,
`details`, `graphics`. Hats, makeup, marks, props and teeth are not tagged `everyday`: a hat comes from a cast's
`wardrobe` or from `HAT_STYLES`, and most makeup and every prop is `only:`-quarantined to the people who wear it. Use
`tagsOf(kind, name)` to see what any part carries.

**Sharing is a tag; quarantine is a pool.** A part tagged `only:<x>` comes back only when a query names
`only:<x>`, which is how twenty-one casts share one wardrobe without a zombie's rot reaching an ordinary face. Register your
own with `tag(kind, name, ...tags)` after adding it to the matching registry.

### Anatomy is solved, not stated

`ANATOMY` is a published table: a stature relative to a human (`height`, human = 1) and then the figure itself in
**head heights** — `totalHeight`, `shoulderWidth`, `torsoLength`, `armLength`, `legLength`, `handSize`, `footLength` —
every one of them a *range* rather than a number.

```js
ANATOMY.dwarf
// { height: 0.78, totalHeight: [5.5, 6.5], shoulderWidth: [2.3, 2.9], torsoLength: [2.1, 2.5], … }
buildOf('dwarf')   // -> { trunk, legs, shoulders, arms, hands, feet, head }, solved
```

The two halves of the table pull against each other, because this drawing's human stands about 4.6 heads rather than
the canonical 7.5 — a head-to-body ratio and an absolute stature do not both land at a range's midpoint. The ranges are
the slack: `buildOf(race)` walks one parameter across all of them at once (the tall end of `totalHeight`, which means a
*smaller* head, together with the short end of every length, or the reverse) and bisects until the figure actually
stands at the race's own stature. The human row solves to all 1s, which is what ties the table to the drawing.

Fifteen rows, shortest to tallest: halfling and gnome (0.52), dwarf (0.78), grey alien (0.92), green alien (0.95), human,
tiefling, post-apocalyptic human and steampunk human (1.0), cyborg (1.03), elf (1.04), half-orc
(1.06), reptilian alien (1.08), orc (1.1), dragonborn (1.13). The alien cast takes a row per kind (the insectoid borrows
the green alien's, the nordic the elf's): an archetype is one kind, and a random member of a crowd draws its kind and
that kind's build together.

## Stances

A stance is how one body stands — the head's tilt and lean, the turn off the torso, a dropped shoulder, the hands it
puts up. Twenty-one ship in two packs (`editorial`, `undead`).

```js
import { STANCES, stanceOf, dress, archetype, renderPortrait } from 'limner';

const st = stanceOf('swaggerLean');           // or stanceOf('thrillerClaw', 'undead')
renderPortrait(dress(archetype({ seed: 2 }), {
  pose: { headTilt: st.tilt, turn: st.turn, shoulder: st.shoulder, headX: st.headX, headY: st.headY },
  props: st.props,
}));
```

A stance deliberately says nothing about *placement*. `dx`, `k` and reaching for a neighbour are blocking, and blocking
is yours.

## Determinism

Every face is a pure function of its parameters, and every generated person a pure function of its seed.

`characterFrom(cast, s, role, energy)` and `identityFrom(cast, s, name, id)` take **`s`, a state object you own**, and
consume draws from it. That is the point: a whole scene of people comes out of one stream, which makes a crowd
reproducible *together* rather than person by person. `person()` and `archetype()` are sugar that make a state from a
seed, for when you have no stream of your own.

```js
import { person, seed, rand, prng } from 'limner';

person({ seed: 7 });                 // the same person, always
const s = {}; seed(s, prng(7));      // or drive the stream yourself
rand(s);                             // mulberry32, state in the object
```

Two golden fixtures pin this — one for what the generators invent, one for what the figure draws — so an accidental
change to either is visible rather than ambient.

## In a browser, and in a Worker

Pure ESM with relative internal imports, so it loads from a `<script type="module">`, from a bundler, or inside a
module Worker with nothing special done to it.

One warning if you are used to bare specifiers: **a module Worker cannot be given the document's import map.** There is
no API for it. If you load limner inside a worker, import it by path (`./node_modules/limner/index.mjs` or whatever
your bundler emits) rather than as `'limner'`, or the import will throw where the document's own import map would have
saved you. The failure is silent if your worker has no rejection handler.

For the same reason, **do not mark limner `sideEffects: false`** in a bundler config. Parts register themselves on
import; strip those imports and the registries come up empty, which shows as a missing hat rather than an error.

## API

Grouped by what you reach for. `DEFAULTS` and the `*_STYLES` arrays are the authority for valid values.

**Invent** — `person`, `archetype`, `characterFrom`, `identityFrom`, `characterOf`, `identityOf`, `faceOf`,
`signatureOf`

**Dress** — `dress`, `COSTUMES`, `COSTUME_FAMILIES` (29), `EXPRESSIONS` (18), `exprVals`, `WARDROBE`, `wearable`,
`hoodFits`

**Draw** — `portraitOps`, `toSvg`, `drawOn`, `renderPortrait`, `renderFigure`

**Measure** — `eyeY`, `mouthY`, `feetY`, `headBox`, `CHIN_Y`, `FEET_Y`

**Stances** — `STANCES`, `stanceOf`, `stanceNames`

**Registries** — `CASTS`, `PACKS`, `CAST_MODULES`, `parts`, `tag`, `tagsOf`, `REGISTRIES`, `PART_TAGS`

**Anatomy and families** — `ANATOMY`, `buildOf`, `FAMILIES`, `FAMILY_NAMES`

**Catalogues** — `FACE_SHAPES`, `NECK_TYPES`, `EYE_STYLES`, `BROW_STYLES`, `NOSE_STYLES`, `MOUTH_STYLES`,
`TEETH_STYLES`, `HAIR_STYLES`, `FACIAL_HAIR_STYLES`, `MUSTACHE_STYLES`, `GLASSES_STYLES`, `HAT_STYLES`, `TOP_STYLES`,
`JACKET_STYLES`, `LEG_STYLES`, `ACCESSORY_STYLES`, `DETAIL_STYLES`, `MAKEUP_STYLES`, `MARK_STYLES`, `PROP_STYLES`,
`GRAPHIC_STYLES`, `SKIN_COLORS`, `HAIR_COLORS`, `EYE_COLORS`, `CLOTHING_COLORS`, `COLORS`

**Generators** — `seed`, `rand`, `prng`, `pick`, `clamp`, `lerp`

**`limner/primitives`** — a second entry point (`tracePath`, `path`, `ellipse`, `rect`, `line`, `soft`, `stroke`,
`shade`, `mix`, `merge`) for drawing your own scenery in the same language as the figure.

## Stability

`0.1.0`, and honest about it. Two things will change before 1.0:

- **The surface is too wide.** `index.mjs` re-exports everything `portrait.mjs` exports, which includes internal tuning
  constants (`EAR_TURN`, `HAT_PUFF_MAX`, `BEARD_PULL`) that were never meant to be public. They will be withdrawn.
  Nothing listed under *API* above is going anywhere.
- **Two stances still carry a placement field** (`swaggerLean.dx`, `graveReach.dy`), which contradicts the rule that a
  stance says nothing about placement. They will move out.

Semver from 1.0. Until then, pin the patch.

## Developing

```sh
npm test                                           # the whole suite, both goldens
node scripts/portrait.mjs '{"seed":11}'            # one face -> renders/portrait.svg
node scripts/portrait.mjs <hash> --out face.png    # a png, via playwright-core
node scripts/portrait.mjs <hash> --sweep "facialHair.density=0.2,0.5,0.9"
```

A `--sweep` renders a labelled contact sheet of every combination and prints each cell's own hash, so the one that looks
right is a link straight back into the editor. Nobody reviews a face from a description — render it.

The goldens are the contract. Regenerate them only on purpose (`UPDATE_GOLDEN=1 node --test test/`) and read the diff to confirm only the faces you expected moved.

## Provenance

limner was pulled out of [strudel-bench](https://github.com/jonborchardt/strudel-bench), a local Strudel live-coding
harness, where it draws the people in the music videos the harness renders. It grew to be the largest thing in a repo
about songs, which is why it now lives on its own. `CLAUDE.md` in this directory is the working guide for the internals.

## License

MIT © Jonathan Borchardt
