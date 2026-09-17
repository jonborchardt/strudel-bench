---
name: strudel
description: Use when the user asks to change how a song in songs/ sounds (make it darker, punchier, sparser, add a beat, more dreamy, etc.), create a new song, or ask what a song currently sounds like. Encodes the axis workflow: baseline → resolve → check → render/verify → report.
---

# strudel: editing songs by musical axes

Songs are `songs/*.strudel`. A song written with `song()`/`section()` has layers (drums, bass, melody, pad, fx, sample)
with axis values in 0..1 where 0.5 is that layer's baseline. See `reference/vocab.md` (generated) for the
axes, what each does per layer, and the descriptor words.

## Workflow

1. **Baseline.** `npm run check -- songs/<name>.strudel`. Read the per-section, per-layer table.
2. **Translate.** Turn the request into a resolve phrase using descriptor words (`punchier`, `much darker`,
   `a little more spacious`). If the user gave explicit axes ("brightness up .2"), use those numbers directly.
   Scope it: which section(s), which layer(s). Default to `*` only when the user meant the whole song.
3. **Resolve.** `npm run resolve -- songs/<name>.strudel <section|*> <layer|*> "<phrase>"` and read the report:
   collisions, saturation, refusals (signals are never rewritten; offer to change the signal's range by hand).
   Then rerun with `--write`.
4. **Check.** `npm run check` again. It must pass.
5. **Verify when measurable.** If the page is open and the axes touched have a metric (brightness, weight, width,
   density, space, articulation): `node scripts/verify.mjs songs/<name>.strudel <section> <layer> "<phrase>"`.
   (verify does resolve+write itself, so use it *instead of* step 3's `--write` when you plan to verify.)
6. **Report** in this shape, in musical terms:
   - Requested: the axis deltas
   - Source: the values that changed and the concrete control changes (from the resolve report)
   - Render: the before/after metrics (if verified)
   - Result: which axes verified directionally, which are code-verified, which weren't measured
   - Harmony: key and progression per section, from the check table
7. **Record why.** `npm run note -- songs/<name>.strudel --ask "<the user's request>" --change "<section>.<layer>.<axis> <from>><to> <why, in musical terms>"`
   (one `--change` per value you touched; `section.layer` or just `section` for material/harmony edits; `song` for
   kit/cps). For a new song also `--prompt "<one-line summary of the request>"`. The Compose page's "Why it
   sounds this way" card shows this file next to the source comments.
8. **Commit** with the musical change as the message, e.g. `drop drums punchier (articulation .5→.9, drive .5→.7)`;
   include `songs/<name>.notes.json`.

## Material

Descriptors never touch material. To change a sound, level, fill, arp or meter, edit the literal by hand
(`sound`, `notes`, `level`, `sounds`, `fill`, `arp`, `follow`, `phrase`, `riser`, `impact`, `kit`, `meter`, `bpm`,
`begin`, `end`, `bars`, `slices`, `pattern`, `stretch`) and re-run `npm run check`. A `sample` part slices any loaded
sample: `sound`, the region (`begin`/`end` as fractions), `bars` it stands for, `slices`, `pattern` (slice indices in
mini-notation over those bars) and `stretch` (fit each slice to its step); the check prints the file behind the sound
and every event's `begin`/`end`/`speed`.

## Flat, thin, simplistic, boring, aimless: material first, not axes

Those words mean the notes and the sounds, and no axis fixes them. Adding more layers at once adds mass, not
interest. Do these, in this order, on every new song and whenever a song is called flat:

1. **Write the hooks.** Every melody and every bass that carries the song gets `notes:` in mini-notation, never the
   seeded line. Scale degrees 0..7 (7 = the octave), `~` rests, `@2` holds, single quotes (`notes: '0 2 3@2 ~ 4 3 2 0'`)
   so the check table prints the line. Rules for a line that reads as a phrase: start on the root, move mostly by
   step with one leap, hold at least one note, rest at least once, end on the root (or on the fifth/seventh for a
   question the next phrase answers). `phrase: 2` with 16 slots gives a question and an answer. `follow: true`
   moves the line with the progression. A bass line has as many tokens as its density grid (`density` .8 = 8 slots,
   .75 = 4, .4 = 2): `'0 ~ 0 7 ~ 4 3 ~'` syncopates, `'0 7 0 4'` pops the octave.
2. **Pick instruments, not waveforms.** Any name in the loaded packs works as `sound:`; `npm run check` fails on a
   wrong one. **A name says nothing about what its variants are.** `didgeridoo` is a bark at index 0 and a sustained
   note at `:8`; `sus_cymbal:0` is bowed; the Dirt `space` samples are sub-second blips. The single-song check prints a
   `sounds` block naming the file behind every `sound:index` it heard (pitched instruments show their sampled range):
   read it before calling anything a drone, bed, pad or bass, and pick the index whose file name says `Sus`, `sustain`
   or `hit` as the part needs. Anything under the song in a plain-Strudel `stack()` is not a part: mute, solo and pin
   drop it, so a sound that survives those is in the layers and one that vanishes is in the textures. Melodic: `piano`, `kalimba`, `marimba`, `vibraphone`, `glockenspiel`, `folkharp`, `harp`,
   `clavisynth`, `fmpiano`, `steinway`, `organ_8inch`, `casio`, `supersaw`. Bass: `square` or `sawtooth`.
   Keep at most one raw sawtooth layer; two saws in the same octave is mud.
3. **Counter-line in the climax.** `melody2: { notes: '~ 7 ~ ~ 5 ~ ~ ~', sound: 'glockenspiel', register: .8,
   level: .5, follow: true }` is a second melody layer (any `<layer><digit>` key builds that layer again). Sparse,
   an octave up or down, on the beats the hook leaves empty. That is the one place "more instruments" helps.
4. **Contrast per section**, already the system's strength: drums `template` per section, `variation` rising
   toward the end, `fill`/`riser`/`impact` at the boundaries, pad `arp` in one section only.
5. **Textures outside the axes.** Plain Strudel next to `song()` (`stack(theSong, textures)`, see
   `songs/machine.strudel`) for anything the layers do not model: noise beds, one-shots, a drone.

The layer baselines already carry the sound design (bass filter pluck, melody vibrato and on-beat accents, pad
detune drift); do not re-add those per song.

## Rules

- Never invent sound names; the checker fails on unknown sounds.
- A song edit needs `npm run check` only. The moment the fix reaches `lib/`, `scripts/` or `web/`, run `npm test`
  and fix what it turns red before reporting — including the golden fixtures, which are read (did only the
  fixtures you expected move?) and never blind-regenerated.
- "Verified directionally" is the strongest claim. Never say it sounds better.
- Harmony is per section, not an axis. Translate harmonic requests into progression words (`resolved`, `tense`,
  `pop`, `epic`, `circular`), mode words (`major`, `dorian`, ...) and `relative`; resolve writes `key`/`progression`
  on the section. Verify from the `harmony` line in the check table (code-verified). Accidentals, sevenths and
  borrowed chords are still not modeled: say so and offer a different section key.
- If a word is unknown to the vocabulary, pick the closest descriptors and say which you chose. If it recurs,
  propose adding it to `lib/descriptors.json` with explicit deltas.
- New song: start from `songs/demo.strudel`'s shape. Sections with roles, layers with a few axis values, a
  `seed`, and the material-first list above done before any axis tuning: written `notes` for melody and bass,
  a pack instrument as `sound`, a `melody2` counter-line in the climax. Run check before reporting.
- The user hears the page; you read the checker and the analyzer. Keep it that way.
