---
name: strudel
description: Use when the user asks to change how a song in songs/ sounds (make it darker, punchier, sparser, add a beat, more dreamy, etc.), create a new song, ask what a song currently sounds like, or says a song sounds muddy, cluttered, flat as a mix, or like a pile of parts. Encodes the axis workflow: baseline → resolve → check → render/verify → report, and the mixing pass that runs after the material is written.
---

# strudel: editing songs by musical axes

Songs are `songs/*.strudel`. A song written with `song()`/`section()` has eight layers (drums, bass, melody, pad, fx,
sample, perc, raw) with axis values in 0..1 where 0.5 is that layer's baseline. See `reference/vocab.md` (generated) for the
axes, what each does per layer, and the descriptor words.

## Workflow

1. **Baseline.** `npm run check -- songs/<name>.strudel`. Read the per-section, per-layer table.
2. **Translate.** Turn the request into a resolve phrase using descriptor words (`punchier`, `much darker`,
   `a little more spacious`). If the user gave explicit axes ("brightness up .2"), use those numbers directly.
   A motion word next to an axis: `wobbling brightness` writes `wobble` around the current value, `brightness
   rising` writes `ramp(v, v+.3)`; structural axes and existing signals refuse it. Scope it: which section(s),
   which layer(s). Default to `*` only when the user meant the whole song.
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
(`sound`, `notes`, `level`, `sounds`, `template`, `rhythm`, `fill` (`true`/`false` or a bar count `n`; the integer
form replaces the automatic climax-end roll rather than adding to it), `arp`, `follow`,
`phrase`, `riser`, `impact`, `kit`, `meter`, `bpm`, `begin`, `end`, `bars`, `slices`, `pattern`, `stretch`, `transpose`,
`patch`, `duck`, `duckDepth`, `duckAttack`, `position` (-1..1, where the part sits), `velocity` (a mini string of
per-step multipliers), `humanize` (`{ timingMs, velocity, length, correlation }`, a seeded correlated feel),
`compressor` (`{ threshold, ratio, knee, attack, release }`), the song/section `room` (`{ size, fade, damping,
dimension, ir, irbegin }`, one reverb character for every part), `dropout`, `sweep` (opens the filter to 8 kHz at the start of
its tail and closes it to 150 Hz by the end, overriding the part's own brightness in those bars)) and re-run
`npm run check`. A `sample` part slices any loaded
sample: `sound`, the region (`begin`/`end` as fractions), `bars` it stands for, `slices` (a count, or a list of break
points, fractions of the file inside the region), `pattern` (slice indices in
mini-notation over those bars), `stretch` (fit each slice to its step) and `transpose` (semitones, scales playback
speed since there is no pitch-preserving stretch); the check prints the file behind the sound
and every event's `begin`/`end`/`speed`. A sample part may name a pack definition (`pack.json` → `samples`) and
override any key; the check prints the pack sound the events carry.

`sound` may be a list (`['a', 'b']`: a pick per hit, deterministic), weights (`{ a: 3, b: 1 }`) or a double-quoted
`"<a b>"` (per bar); drum voices in `sounds` too. On a sample part a list is a list of definitions sharing `bars`
and slice count, each keeping its own region. A line of different takes is one part with a list, not four parts.

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
2. **Pick instruments, not waveforms.** Any name in the loaded packs works as `sound:`, or a `patch` on a synth:
   `pluck`, `reese`, `hollow`, `glass`, `breath`, `wide`, `sub`; `npm run check` fails on a wrong one.
   **A name says nothing about what its variants are.** `didgeridoo` is a bark at index 0 and a sustained
   note at `:8`; `sus_cymbal:0` is bowed; the Dirt `space` samples are sub-second blips. The single-song check prints a
   `sounds` block naming the file behind every `sound:index` it heard (pitched instruments show their sampled range):
   read it before calling anything a drone, bed, pad or bass, and pick the index whose file name says `Sus`, `sustain`
   or `hit` as the part needs. Anything under the song in a plain-Strudel `stack()` is not a part: mute, solo and pin
   drop it, so a sound that survives those is in the layers and one that vanishes is in the textures. Melodic: `piano`, `kalimba`, `marimba`, `vibraphone`, `glockenspiel`, `folkharp`, `harp`,
   `clavisynth`, `fmpiano`, `steinway`, `organ_8inch`, `casio`, `supersaw`. Bass: `square` or `sawtooth`.
   Keep at most one raw sawtooth layer; two saws in the same octave is mud.
   Beyond the loaded packs, `reference/sample-banks.md` lists the community `github:` banks and the two
   steps that make one usable here (an entry in `lib/packs.json`, then `npm run samples -- <pack>`).
3. **Counter-line in the climax.** `melody2: { notes: '~ 7 ~ ~ 5 ~ ~ ~', sound: 'glockenspiel', register: .8,
   level: .5, follow: true }` is a second melody layer (any `<layer><digit>` key builds that layer again). Sparse,
   an octave up or down, on the beats the hook leaves empty. That is the one place "more instruments" helps.
4. **Contrast per section**, already the system's strength: drums `template` per section, `variation` rising
   toward the end, `fill`/`riser`/`impact` at the boundaries, pad `arp` in one section only, `dropout`/`sweep`
   before a drop.
5. **A `raw` part inside the section, `stack()` around the song only for what must span sections.** `raw: { pattern:
   s("...").struct(...) }` puts a plain Strudel pattern in with the layers, so mute, solo, pin, the check table and
   the dump all see it, for anything the built layers do not model: noise beds, one-shots, a drone. `stack(theSong,
   textures)` (see `songs/machine.strudel`) stays for a texture that has to run under every section, not one that
   belongs to a single section.

The layer baselines already carry the sound design (bass filter pluck, melody vibrato and on-beat accents, pad
detune drift); do not re-add those per song.

## The mixing pass: muddy, cluttered, a pile of parts

Run this after the material is written, on every new song and whenever the user says a song sounds muddy,
cluttered, flat as a mix, or like every part is on top of every other. The parts are already there; the pass
decides where each one sits. It needs the page open (renders). Measure first, change second, one section at a time,
climax first.

**Measure a section.** One command renders the mix and every part alone and prints one row per part plus the pairs
that mask each other, then the mix lint reads the same file:

    npm run measure -- songs/<name>.strudel <section>
    npm run lint -- --measure renders/<name>.<section>.measure.json

Columns: `dB` (the mix in dBFS, each part under the mix), `depth` (0 close .. 1 far) **with the three numbers it is
made of next to it**: `dB`, `highRatio`, `tail`. Always read the three, never the score alone: a part reads as
background because it is quiet, or dark, or wet, and the fix is the one that is wrong. Never add reverb to a part
that is only too loud. Then `centroid`/`lowRatio` (who occupies which band), `crest` (who has transients), `pan`
(where it sits, 0 left .. 1 right) and `panStd` (how much it moves). The masking table is per pair and per band (low
under 300 Hz, mid 300..3000, high above): shared band energy times time together, level-independent.

**Then five passes, each written as material or axes and re-measured:**

1. **Hierarchy.** Name each part foreground, support, background or foundation (kick and bass) from its role in the
   section. Foreground sits 6..12 dB under the mix, support 10..18, background 16..26; those are defaults, not
   rules. A part more than 30 dB under the mix is inaudible: cut it or raise it, never leave it. Set `level`.
   `compressor: { threshold: -18, ratio: 3 }` only on a sparse part whose `crest` is the problem (peaks far over
   its rms): superdough builds one compressor node per hit, so on a dense kit it is dozens of live nodes a bar and
   playback drops out (the check lint says so above 16 hits a bar). The lint's "no headroom" (a real share of
   samples at full scale) is a level problem; its "transients touch full scale" (a few kick attacks, under 0.01% of
   samples) is not fixed by level either, and needs the master limiter that is not built. Say so, do not chase it.
   Reverb is per orbit and parts wanting the same reverb share one (`orbitKey`), so a song `room` with a `size` is
   one convolver for the whole section; without it, keep pads at a shared `space` value rather than one each.
2. **Collisions, arrangement first.** Fix a masking pair in this order and stop at the first that works: fewer notes
   (`density`) or a rest where the other part plays; an octave apart (`register`, or the pad's low voicing off by
   `weight` ≤ .5); a `position` each; darker on the one that matters less (`brightness`); only then `duck`. Kick
   under bass and pad is a written convention, never silent: `bass: { duck: 'drums', duckDepth: .35 }`,
   `pad: { duck: 'drums', duckDepth: .15, duckAttack: .2 }`. Two raw saws in one octave is mud (the lint says so).
3. **Depth.** The words `closer`/`forward` and `farther`/`background` are descriptors: each moves `brightness`,
   `space` and `weight` (the level-ish axis) together, `npm run resolve -- <song> <section> <part> "farther"`. A
   larger step is `level` down by hand with the words. Foreground and background must land on different `dB`,
   `highRatio` and `tail`, not the same three numbers at different levels (the lint's "no depth contrast" names the
   component they share).
4. **Stage.** `position: -1..1` is where a part sits; `width` moves around it. Kick, bass and the hook near centre
   (`position` unset or within ±.1, `width` ≤ .5); support parts off to a side (`position: ±.3`, opposite sides for
   two of them); the pad wide (`width: .7`, or `.8` for `jux`); at most one part moving (`panStd` > .2). A drum kit's
   own voice spread moves as one with its `position`. The lint's "flat stage" is three non-foundation parts at centre.
5. **One room, then contrast across sections.** A `room` on the song gives every part the same reverb character and
   turns each part's `space` into a send: dry kick and bass (`space` ≤ .5), a little on the hook, more on the pad and
   fx. **Use a generated impulse, not the synthetic tail**: `room: { ir: 'room', size: .9 }` (a small box, 8 ms
   pre-delay, for kits, breaks and anything dry), `{ ir: 'plate', size: 1.8, damping: 7000 }` (no walls, bright, for
   bells, glass, piano pop), `{ ir: 'hall', size: 3.2, damping: 4500 }` (30 ms pre-delay, the tail outlasts the bar,
   for a score or anything slow and dark); the song must declare `packs: ['rooms']`. `size` truncates the impulse and
   never stretches it (`.5` on `room` is early reflections and a door, no tail); `irbegin` skips the silent head to
   remove the pre-delay; `songs/rooms.strudel` plays the four against each other. `{ size, fade, damping }` without
   `ir` is the fallback, not the default. Then the `arc:` line of the check and each section's mix `dB`, `centroid`
   and `onsetsPerSec` must differ across roles: a climax that measures like its verse is a flat song, not a flat mix.

**Every pass, not one of them, checks off the mix material**: a twin that stops at `level`, `position` and `duck` has
done half the job. Before reporting, every one of these has been used or ruled out by name:
- `room.ir` on the song (pass 5), and `packs: ['rooms']` with it.
- `humanize: { timingMs: 12, velocity: .1, correlation: 'phrase' }` on every part that should sound played (a hook,
  a harp, a hand drum, a pulse with `correlation: 'bar'`), replacing any `organicness` it had (that is dice per hit);
  a mechanical song says so and keeps none.
- `velocity` on the hook, a phrase-shaped line such as `'.85 1 .9 1 .8 1 .9 .95'`.
- `compressor: { threshold: -18, ratio: 3 }` on each sparse part whose `crest` is over ~9 in the measure table (a
  shout, a gong, a burst, a rattle), never on a kit.
- depth by the words, not by level alone: `closer`/`farther` deltas (`lib/descriptors.json`: brightness ±.12, space
  ∓.18, weight ±.08) on the foreground and background parts, written by `resolve` or by hand on a spread layer.
- `duck` with a written `duckAttack`, and `position` per support part (passes 2 and 4).

**Report** the before/after measure table per part (dB, depth with highRatio and tail, pan, the worst masking
pairs), which pass each change came from, and what could not be measured. "Verified directionally" stays the
strongest claim.

## Rules

- Never invent sound names; the checker fails on unknown sounds.
- **Load is a bound, read it on every climax.** Each section header of the check prints `~n voices at once`, and the
  lint warns past 40: beyond that the audio thread cannot render in real time on a laptop and the song scratches and
  drops hits (arrival's threshold at ~49, machine's chorus3 at ~46). The count is hits sounding at once over the whole
  pattern in the section's window, a `stack()` of textures around the song included (`n outside the parts`), and a
  hit with a distortion, shape or coarse worklet counts one more per effect, so an aggressive song is loud in this
  count long before it is loud in parts. Fixes in order: `width` under .8 on any pad or kit at .8+ (jux plays a
  doubled copy of every voice), `aggression`/`weight` at .5 on the part with the most hits (no worklet per hit), a
  shorter release (`articulation` up), fewer chord tones (pad `density` down), one pad fewer. A distorted part also
  ignores its `level` for peaks: superdough distorts after the gain and the output saturates at full scale, so the
  mix lint's "no headroom" on such a part is fixed by less distortion, not by level.
- A song edit needs `npm run check` only. The moment the fix reaches `lib/`, `scripts/` or `web/`, run `npm test`
  and fix what it turns red before reporting — including the golden fixtures, which are read (did only the
  fixtures you expected move?) and never blind-regenerated.
- "Verified directionally" is the strongest claim. Never say it sounds better.
- Harmony is per section, not an axis. Translate harmonic requests into progression words (`resolved`, `tense`,
  `pop`, `epic`, `circular`), mode words (`major`, `dorian`, ...) and `relative`; resolve writes `key`/`progression`
  on the section. The progression grammar also takes accidentals (`bVI`), quality suffixes and sevenths (`IVm`,
  `V7`), brackets for two chords in a bar, `@n` to hold a chord for `n` bars (1..64), and `/1`/`/2` to invert it.
  `@n` is written by hand: the Mix card's harmony row refuses to edit a progression that uses it. Verify
  from the `harmony` line in the check table (code-verified). Voice leading and chord symbols are still not
  modeled: say so and offer a different section key.
- If a word is unknown to the vocabulary, pick the closest descriptors and say which you chose. If it recurs,
  propose adding it to `lib/descriptors.json` with explicit deltas.
- New song: start from `songs/demo.strudel`'s shape. Sections with roles, layers with a few axis values, a
  `seed`, and the material-first list above done before any axis tuning: written `notes` for melody and bass,
  a pack instrument as `sound`, a `melody2` counter-line in the climax. Run check before reporting.
- The user hears the page; you read the checker and the analyzer. Keep it that way.
