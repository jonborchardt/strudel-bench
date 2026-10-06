# CLAUDE.md — limner

Guidance for working inside `limner/`. The outer `../CLAUDE.md` covers the Strudel harness that consumes it; this file
covers the package. `README.md` is written for someone who installed limner from npm and is the better place to learn
what it does — read it first if you have not.

limner draws **one person**: parameters in, an op list out, SVG or canvas from the ops. It also invents people and owns
anatomy. It knows nothing about music, frames, scenes or multiple figures.

## The one rule that is not negotiable

**limner never imports from outside itself.** Not `../web/`, not `../lib/`, not `../scripts/`, not `../test/`. The host
imports limner; the reverse is the boundary, and it is what makes the package a package. `test/pages.test.mjs` in the
parent repo enforces the outside half (nothing out there may reach past limner's entries); inside, a path starting
`../../` is the mistake. If you need something the host has, copy it in and say so in a comment — `rng.mjs` is the
precedent, and the four duplicated lines are cheaper than the dependency.

## What is where

| file | what it is |
|---|---|
| `portrait.mjs` | the figure. One 154 KB leaf that imports nothing: every part, the drawing, `portraitOps`, `toSvg`, `drawOn`, the registries and `tag`/`parts`. |
| `people.mjs` | who a person is. The generators (`characterFrom`, `identityFrom`), `dress`, families, costumes, expressions, `ANATOMY`, `buildOf`. |
| `casts/<name>.mjs` | one people: pools as tag queries, a `build`, archetypes, a signature merged over every member. |
| `parts/<name>.mjs` | drawable parts, registered **by name** into `portrait.mjs`'s registries and **tagged**. |
| `registry.mjs` | `CASTS`, `PACKS`, `CAST_MODULES`. Importing it registers every part. |
| `stances.mjs` | named single-body stances. One body only — see below. |
| `schema.mjs` | the editor's spec: every parameter with the control that fits it, the presets, the hash codec. Internal. |
| `rng.mjs` | the seeded generators, copied verbatim from the host. Do not touch. |
| `index.mjs` | the published barrel, plus the `person`/`archetype` sugar. |
| `primitives.mjs` | the second entry: drawing primitives a host may reuse for its own scenery. |

## Determinism is the contract

Everything here is reproducible from a seed, and three fixtures say so. **Never regenerate a golden to make a test
pass.** A moved golden means the drawing or a generator changed; find out why, and regenerate only when the change was
the point (`node scripts/castgolden.mjs`, `node scripts/opsgolden.mjs`, then read the diff and confirm only the faces
you expected moved).

- `test/fixtures/cast-golden.json` — what the generators invent, for fixed seeds.
- `test/fixtures/portrait-ops-golden.json` — what the figure draws, for four portraits.
- `../test/fixtures/layout-golden.json` — the host's, but it pins every stance through `layoutOf`.

Two traps around this:

**`characterFrom(cast, s, …)` and `identityFrom(cast, s, …)` take a caller-owned state object, not a seed.** `s` holds
the generator's cursor and the call consumes draws from it. That is deliberate: a whole scene of people comes out of one
stream, which is what makes a crowd reproducible *together*. "Tidying" either into `(cast, seed, …)` changes every face
in every golden at once. `person()`/`archetype()` in `index.mjs` are the sugar for a caller with no stream; nothing
inside this package uses them.

**`rng.mjs` is a verbatim copy** of the host's `seed`/`rand` (mulberry32, state in an object) and `prng`/`pick` (an LCG).
`../test/limner-rng.test.mjs` compares the streams bit for bit across the boundary. Improving the arithmetic moves
every golden and the diff will tell you only that every face changed.

## A character is not an identity

- **A character** (`characterFrom`, `person`) is already drawable parameters. `renderPortrait(character)`.
- **An identity** (`identityFrom`, `archetype`) is `{ id, name, base, home }` — a person *plus the wardrobe they own* —
  and `dress(identity, styling)` turns it into parameters for one occasion.

Calling `dress` on a character throws on `home.costume`, which is the first mistake everyone makes, including whoever
writes the next sheet. A crowd is characters; a recurring cast is identities, which is what keeps one face recognisable
across outfits.

## A stance is one body

`stances.mjs` holds the head's tilt and lean, the turn off the torso, a dropped shoulder and the hands it puts up — the
keys `dress(idn, { pose })` already takes. It does **not** hold where a body is in a frame: `dx`, `dy`, `k`, and
reaching an arm around a neighbour are *blocking*, facts about a composition rather than a body, and they belong to
whatever is composing the shot. Two entries still carry a blocking field (`swaggerLean.dx`, `graveReach.dy`) because
they did before the split; they are the two to clean up if blocking ever becomes a table of its own.

If you find yourself wanting a second figure in here, the answer is that the host calls limner twice and places the two
boxes.

## Parts are reached by tag, never by iterating a registry

`tag(kind, name, ...tags)` says what a part is (`everyday`, `era:80s`) and who may wear it (`only:undead`). Every
generator picks through `parts(kind, { any, all, not })`, and a part tagged `only:<x>` comes back only when the query
names `only:<x>`. A cast's `pools` are those queries. **Sharing is a tag; quarantine is a pool.** Ten casts share one
wardrobe this way without a zombie's rot reaching an editorial face, and `parts/fantasy.mjs` (tagged `era:fantasy`, no
`only:`) is the proof — six casts reach it, and `humans` is dressed out of it alone, with no pack of its own.

Iterating `REGISTRIES[kind]` or a `*_STYLES` list to pick a part breaks the quarantine silently. Don't.

**Anatomy is never a part.** A pack may only register things that are *worn* or *drawn on*. A nose is not a part, so a
dragonborn's muzzle is a portrait dial (`nose.muzzle`) that the cast pins, exactly as the elf ear is (`ears.pointed`).
`ANATOMY` is the published table — a stature relative to a human (`height`, human = 1) and the figure in **head
heights** (`totalHeight`, `shoulderWidth`, `torsoLength`, `armLength`, `legLength`, `handSize`, `footLength`), each a
range — and `buildOf(race)` solves it against this drawing's own human, which stands about 4.6 heads rather than the
canonical 7.5. The ranges are the slack: it walks one parameter across all of them at once and bisects on
`feetY`/`headBox` until the figure stands at the race's own stature, and the human row solves to all 1s. No cast writes
its own build.

## Coordinates

One sheet, in its own units; the host scales. The head is 204 tall, every chin lands on `CHIN_Y` (327.2) and every pair
of feet on `FEET_Y` (1078). `renderPortrait` is the bust (`viewBox="0 0 400 480"`), `renderFigure` the whole standing
body (`-30 -200 460 1284`, shifted so the feet land on the floor). `eyeY(p)`, `mouthY(p)`, `feetY(p)` and `headBox(p)`
read where a given figure's features actually landed, which is what a host frames on — never assume the defaults.

## Ops, not SVG

`portraitOps(params)` is the one computation and returns a flat list of `{ k, … }` ops (`path`, `ellipse`, `rect`,
`line`, `clip`/`unclip`, `push`/`pop`). `toSvg` prints them; `drawOn` paints them. A default figure is ~343 ops. Add a
new op kind and both renderers need the case, plus the `--sweep` sheet to look at.

## Two things that will bite a bundler

**Parts register by import side effect**, so `package.json` must **not** declare `sideEffects: false` — a bundler would
strip `import './parts/undead.mjs'` and the registries would come up empty, which shows up as a missing hat rather than
an error. It is deliberately absent; leave it absent.

**`index.mjs` uses `export *`**, so the published surface is currently 155 names, including tuning constants
(`EAR_TURN`, `HAT_PUFF_MAX`, `BEARD_PULL`) that were never meant to be public. Every exported name is a promise once
this is on npm. Narrowing it is a breaking change worth making before 1.0, not a tidy-up to slip in.

## Verifying a change

Nobody can review a face from a description. Render it.

    npm test                                     # from here: 37 tests, both goldens
    node scripts/portrait.mjs "<hash|url|{json}>" # one face -> renders/portrait.svg
    node scripts/portrait.mjs <hash> --out x.png  # a png, through playwright-core's chromium
    node scripts/portrait.mjs <hash> --photo p.png --crop "95 105 210 220"
    node scripts/portrait.mjs <hash> --sweep "facialHair.density=0.2,0.6" --sweep "eyes.squint=0,.5"

A `--sweep` prints each cell's own hash, so the one that looks right is a link straight back into the editor. The
sheets, served by the parent repo's dev server, are the other half: `stances.html` (every stance on one body),
`parts.html?pack=<name>` (one pack by kind, with tags), `casts.html?cast=<name>` (archetypes and a crowd of sixteen),
`faces.html` (everything), and `../limner.html` (the explorer: its **editor** tab is every parameter, and `#editor/<hash>` *is* the face).

`scripts/` and `test/` are not published (`files` excludes them), so they may use the parent's dev dependencies —
`scripts/portrait.mjs` reaches for `playwright-core` for the png path. The published library itself has **no
dependencies**, and that is worth keeping.

## When the host's expectations matter

limner is consumed by a Strudel live-coding harness in the parent repo, which uses it from Node, from a browser page and
**inside a module Worker**. A worker cannot be handed an import map, so the host reaches limner by path through one shim
(`../web/visual/limner.mjs`) rather than by the bare specifier. Nothing here needs to care, except: do not add a bare
import of anything, and keep every internal import relative.
