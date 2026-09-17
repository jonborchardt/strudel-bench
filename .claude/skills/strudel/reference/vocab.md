# strudel-bench vocabulary (generated, do not edit)

## Axes (0..1, 0.5 = layer baseline)

| axis | kind | meaning | verification |
|---|---|---|---|
| density | structural | amount of musical activity | direct: onsetsPerSec |
| drive | structural | rhythmic insistence toward the primary pulse: where onsets fall and which are accented, not how many | code |
| brightness | continuous | spectral character, dark to bright | direct: centroidHz |
| weight | continuous | perceived low end and body | direct: lowRatio |
| space | continuous | dry and close to spacious | proxy: tail |
| articulation | continuous | sustained and smooth to short and punchy | proxy: crest |
| aggression | continuous | smooth to abrasive | proxy: flatness |
| groove | continuous | rigid to swung | proxy: swing |
| variation | structural | repetitive to variable (0 = pure loop) | proxy: novelty |
| organicness | continuous | mechanical to humanized | proxy: jitter |
| width | continuous | narrow to wide | direct: width |
| register | structural | low to high | code |

## Adapter cells (what each axis does per layer at 0.2 / 0.8)

| axis | drums | bass | melody | pad | fx | sample |
|---|---|---|---|---|---|---|
| density | voices bd / voices bd+sd+hh+oh, 16th hats | 1 notes per cycle / 8 notes per cycle | drop 48% of notes / double notes p=0.60 | 1 chord tones / 4 chord tones | — | — |
| drive | kick/snare pushed to offbeats / kick onto the pulse, snare onto the backbeat, hats accent on-beat | notes syncopated / notes pulled onto beats, on-beat accent | — | no duck / pulse duck depth 0.36 | — | — |
| brightness | lpf 2899 Hz / hpf 267 Hz | lpf 400 Hz -> 152 Hz / lpf 400 Hz -> 1051 Hz | lpf 2000 Hz -> 641 Hz / lpf 2000 Hz -> 4595 Hz | lpf 1200 Hz -> 410 Hz / lpf 1200 Hz -> 3152 Hz | lpf x0.44 / lpf x1.73 | lpf 1913 Hz / open |
| weight | gain x0.76 / gain x1.12 | gain x0.85, lpf x1.00 / gain x1.23, lpf x0.85, octave down | — | gain x0.80 / gain x1.27, low voicing | gain x0.70 / gain x1.30 | gain x0.70 / gain x1.30 |
| space | room 0.00 / room 0.24 | room 0.00 / room 0.18 | room 0.08, delay 0.00 / room 0.62, delay 0.24 | room 0.12, size 0.48 / room 0.66, size 0.81 | room 0.20 / room 0.77 | room 0.20 / room 0.77 |
| articulation | clip 1.12, release 0.28 s / clip 0.52, release 0.05 s, hats choke | clip 0.98, release 0.22 s / clip 0.50, release 0.06 s | clip 0.98, release 0.22 s / clip 0.50, release 0.06 s | clip 1.12, attack 0.42 s, release 1.44 s / clip 0.58, attack 0.06 s, release 0.27 s | — | — |
| aggression | distort 0.00 / distort 0.36 | distort 0.00 / distort 0.42 | distort 0.00 / distort 0.24, coarse | distort 0.00 / distort 0.18 | — | — |
| groove | swing 0 -> 0 / swing 0 -> 0.18 | swing 0 -> 0 / swing 0 -> 0.18 | swing 0 -> 0 / swing 0 -> 0.18 | — | — | — |
| variation | pure loop / fills with p=0.60, reversed every 4th | pure loop / octave jumps p=0.60 | pure loop / bursts p=0.60, reversed every 4th | — | — | — |
| organicness | timing jitter +/-0 ms, gain jitter 0% / timing jitter +/-24 ms, gain jitter 12% | timing jitter +/-0 ms, gain jitter 0% / timing jitter +/-24 ms, gain jitter 12% | timing jitter +/-0 ms, gain jitter 0% / timing jitter +/-24 ms, gain jitter 12% | gain jitter 0% / gain jitter 12% | — | — |
| width | stereo spread +/-0.04 / stereo spread +/-0.34 | — | centred / pan sweep +/-0.30 | pan sweep +/-0.04 / jux(rev) | centred / pan sweep +/-0.30 | centred / pan sweep +/-0.30 |
| register | — | octave 1 / octave 3 | octave 3 / octave 5 | octave 3 / octave 5 | — | — |

Phases: structural → timing → pitch → articulation → spectral → spatial → level

## Descriptors (deltas)

- **dreamy**: space +0.35, articulation -0.2, drive -0.15, brightness -0.05, variation +0.1
- **punchy**: articulation +0.4, weight +0.15, drive +0.2, space -0.15
- **massive**: density +0.3, weight +0.35, width +0.3, space +0.1
- **frantic**: density +0.35, drive +0.4, variation +0.25, articulation +0.15
- **delicate**: density -0.2, weight -0.25, aggression -0.3, articulation -0.1
- **heavy**: weight +0.35, aggression +0.15, register -0.15
- **light**: weight -0.3, density -0.1, register +0.1
- **dark**: brightness -0.3, register -0.1
- **bright**: brightness +0.3, register +0.05
- **spacious**: space +0.35, width +0.2
- **dry**: space -0.35, width -0.1
- **human**: organicness +0.35, groove +0.1
- **mechanical**: organicness -0.35, groove -0.15, variation -0.1
- **tight**: articulation +0.25, groove -0.15, organicness -0.1
- **loose**: articulation -0.15, groove +0.25, organicness +0.15
- **busy**: density +0.35, variation +0.1
- **sparse**: density -0.35
- **wide**: width +0.35
- **narrow**: width -0.35
- **driving**: drive +0.35, articulation +0.1
- **floating**: drive -0.35, space +0.15
- **swung**: groove +0.35
- **straight**: groove -0.35
- **aggressive**: aggression +0.4, articulation +0.1
- **smooth**: aggression -0.35, articulation -0.15

## Overlays (emotion/genre, low confidence)

- **sad**: brightness -0.2, drive -0.2, space +0.15, register -0.1, articulation -0.15
- **happy**: brightness +0.2, drive +0.15, articulation +0.1
- **ominous**: brightness -0.3, register -0.2, space +0.2, density -0.15
- **euphoric**: brightness +0.25, density +0.2, width +0.25, space +0.15
- **hypnotic**: variation -0.3, drive +0.1, density -0.05
- **chaotic**: variation +0.4, density +0.25, aggression +0.15
- **playful**: variation +0.2, groove +0.2, brightness +0.1, register +0.1
- **cinematic**: space +0.3, width +0.3, weight +0.15, articulation -0.15

## Modifiers

slightly ×0.5, a little ×0.5, a bit ×0.5, somewhat ×0.75, more ×1, much ×2, way ×2, a lot ×2, extremely ×3, very ×1.5; "less X" negates.

## Harmony words (states, not deltas; modifiers ignored)

Write `key` and `progression` on the section. Numerals are diatonic to the section key; one chord per cycle unless bracketed; default `i VI`.

- **static**: i
- **resolved**: I IV V I
- **unresolved**: i VI VII
- **tense**: i VII VI VII
- **pop**: I V vi IV
- **epic**: vi IV I V
- **circular**: i VI III VII
- modes: major, minor, dorian, lydian, mixolydian, phrygian (keep the root, swap the mode)
- **relative**: relative major/minor of the current key; `relative major` = relative key then that mode
- progression grammar: `b`/`#` before a numeral, `m`/`M`/`dim` after it, `7` (dominant on uppercase: `V7`; diatonic on lowercase: `ii7`) or `M7` (major seventh), `[..]` for several chords in one bar: `'i bVI [III VII] V7'`
- not modeled: inversions, voice leading, chords longer than a bar. For other scales use a different section key (e.g. `C:harmonic minor`).
