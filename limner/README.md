# limner

Draws one person. Parameters in, a posed portrait out, as SVG or on a canvas.

It knows anatomy, faces, wardrobe and stances, and it can invent a plausible person of a given people. It does not know
that music, video, frames or multiple figures exist: where a figure stands in a scene, how big it is drawn and whether it
puts an arm around a neighbour are facts about a composition, not about a body, so they belong to whatever is composing
the shot. A host draws a group by calling limner once per person and placing the boxes.

```js
import { person, archetype, dress, renderPortrait } from 'limner';

renderPortrait(person({ cast: 'dwarves', seed: 7 }));                    // a plausible dwarf, drawn
renderPortrait(dress(archetype({ cast: 'elves', seed: 3 }), { expression: 'deadpan' }));
```

## A character and an identity are different things

- **A character** is a drawable set of parameters. `person()` gives you one. A crowd is characters.
- **An identity** is a person *plus the wardrobe they own* — `{ base, home }` — and has to be dressed for an occasion
  before it can be drawn. `archetype()` gives you one, and `dress(identity, styling)` picks the occasion. A recurring
  cast is identities, which is what makes the same face recognisable in every outfit.

## Ops are the output type

`portraitOps(params)` is the one computation; SVG and canvas are two renderers over its result.

```js
const ops = portraitOps(params);
toSvg(ops, background);   // a string
drawOn(ctx, ops, alpha);  // a canvas
renderPortrait(params);   // the one-liner: toSvg(portraitOps(params))
```

Prefer ops over SVG when you are drawing many frames: a video export pushes 1920x1080 at thirty frames a second through
a canvas, and rasterising an SVG string per frame will not keep up.

## Seeding is a contract

`characterFrom(cast, s, role, energy)` and `identityFrom(cast, s, name, id)` take `s`, a **caller-owned** state object
holding the generator's cursor, and consume draws from it. That is deliberate: a whole scene of people has to come out of
one stream, which is what makes a crowd reproducible together rather than person by person. `person()` and `archetype()`
are sugar that make a state from a seed, for a caller with no stream of its own.

Rewriting either generator to take a seed instead of a state would change every face. The goldens in `test/` are
statements about these exact bit patterns.

## The surface

| | |
|---|---|
| **invent** | `person`, `archetype`, `characterFrom`, `identityFrom`, `characterOf`, `identityOf`, `signatureOf`, `faceOf` |
| **dress** | `dress`, `COSTUMES`, `COSTUME_FAMILIES`, `EXPRESSIONS`, `exprVals` |
| **draw** | `portraitOps`, `toSvg`, `drawOn`, `renderPortrait`, `renderFigure` |
| **measure** | `eyeY`, `mouthY`, `feetY`, `headBox`, `CHIN_Y` |
| **stances** | `STANCES`, `SPREAD_STANCES`, `stanceOf`, `stanceNames` |
| **registries** | `CASTS`, `PACKS`, `CAST_MODULES`, `parts(kind, query)`, `tag`, `tagsOf`, `REGISTRIES` |
| **anatomy** | `ANATOMY`, `buildOf`, `FAMILIES`, `FAMILY_NAMES` |
| **generators** | `seed`, `rand`, `prng`, `pick`, `clamp`, `lerp` |

plus `DEFAULTS` and the `*_STYLES` name lists, which are what a menu is built from.

`limner/primitives` is a second entry point — `tracePath`, `path`, `ellipse`, `rect`, `line`, `soft`, `stroke`, `shade`,
`mix`, `merge` — for a host that wants to draw its own scenery in the same language as the figure.

Everything else is internal. `package.json`'s `exports` enforces that: a deep import throws rather than quietly becoming
someone's dependency.

## Parts are reached by tag, never by registry

A part registers itself by name into a registry and carries tags: `everyday` and `era:80s` say what a part *is*,
`only:undead` says who may wear it. Every generator picks through `parts(kind, { any, all, not })`, and a part tagged
`only:<x>` comes back only when the query names `only:<x>`. A cast's `pools` are those queries. Sharing is a tag;
quarantine is a pool. That is how nine casts share one wardrobe without a zombie's rot turning up on an editorial face.

## Tests

```
npm test            # from this directory
```

Two of them are goldens and are the library's real contract: `test/fixtures/cast-golden.json` pins what the generators
invent, and `test/fixtures/portrait-ops-golden.json` pins what the figure draws. Regenerate either only on purpose
(`node scripts/castgolden.mjs`, `node scripts/opsgolden.mjs`), and check that only the faces you expected moved.

`scripts/portrait.mjs` draws a face headless from the editor's own hash — an SVG, a PNG, or a labelled contact sheet
sweeping any parameter — which is how a change to the drawing gets judged.
