# strudle

Local [Strudel](https://strudel.cc) harness: edit `songs/*.strudel`, press play in a browser, hear it. All code and samples are served from this folder.

## Setup

    npm install
    npm run samples          # one-time, downloads Strudel's default packs (~300 MB, resumable, re-run if any fail)
    npm start                # http://localhost:3000

## Use

- Pick a song, press ▶ (or ctrl+enter). ■ or ctrl+. stops. Save writes the textarea back to the file.
- Editing a song file on disk reloads it in the page. If it was playing, it re-evaluates so you hear the change. If you have unsaved edits in the textarea, you get a reload link instead.
- Drop your own samples in `samples/user/<sound>/*.wav`, then `s("<sound>")` plays them and `s("<sound>:2")` picks the third file. Loose files at the top level work too, named after the file.

## Scripts

- `npm run check -- songs/x.strudel` evaluates a song headlessly, prints the first 4 cycles of events, and fails on syntax errors or sound names that are not in the local packs, the user folder, or the built-in synths. No args checks every song.
- `node gen/euclid.mjs --seed=3 > songs/euclid.strudel` generates a song. Generators are plain scripts that print Strudel code to stdout.
- `npm test` runs the node:test suite.

## Layout

    server.mjs           stdlib http server: static files, song api, sse reload, user sample map
    index.html           the play page
    songs/               one .strudel file per song
    samples/packs/       downloaded packs (gitignored) + <pack>.json maps + packs.json
    samples/user/        your samples
    scripts/samples.mjs  pack downloader
    scripts/check.mjs    headless checker
    scripts/esm-fix.mjs  node resolve hook (a strudel dependency ships without an exports map)
    gen/                 generators

## Not local

GM soundfont instruments (`gm_*`) still stream from GitHub when used. Built-in synths and every downloaded pack are local.

## Axes

Songs can be written as sections × layers × axis values (see `songs/demo.strudel` and
`docs/superpowers/specs/2026-09-11-musical-axes-design.md`). Then:

    npm run resolve -- songs/demo.strudel drop drums "punchier"          # what would change
    npm run resolve -- songs/demo.strudel drop drums "punchier" --write  # do it
    npm run render -- songs/demo.strudel --section drop                  # renders/demo.drop.wav (page must be open, stopped)
    npm run render -- songs/demo.strudel --mp3                           # same, then renders/demo.mp3 (or the page's "export mp3" button)
    npm run mp3 -- renders/demo.wav                                      # convert an existing render
    node scripts/analyze.mjs renders/a.wav renders/b.wav                 # metrics and deltas
    npm run verify -- songs/demo.strudel drop drums "punchier"           # the whole chain with a report
    npm run vocab                                                         # regenerate the skill's vocabulary reference

The `strudle` skill (`.claude/skills/strudle/SKILL.md`, not versioned — `.claude/` is gitignored in this repo)
encodes the baseline → resolve → check → render/verify → report workflow for an agent editing songs by ear.

### Rules

1. A primitive axis exists only if it has a deterministic, layer-aware implementation; everything else is a descriptor or an overlay.
2. Axes are semantic, adapters are mechanical — an empty cell honestly says "no implementation on this layer".
3. Descriptors are deltas, not states: *dreamier* applies relative to the current values.
4. Harmony is a separate subsystem, not an axis.
5. No new trajectory concept: an axis value is a constant in 0..1 or a Strudel signal.
6. Adapter(0.5) is a no-op — literally the material's baseline, verified by test; a direction with no honest implementation is a documented no-op, not a guess.
7. Adapters run in fixed phases, because transformations do not commute.
8. The resolver edits declarative state, never hand-authored Strudel expressions.

### The twelve axes

Kind, meaning and verification class are the ones declared in `lib/axes.mjs` (`AXES`).

| Axis | Kind | Meaning | Verification |
|---|---|---|---|
| density | structural | amount of musical activity | direct: onsetsPerSec |
| drive | structural | rhythmic insistence toward the primary pulse: where onsets fall and which are accented, not how many | code |
| brightness | continuous | spectral character, dark to bright | direct: centroidHz |
| weight | continuous | perceived low end and body | direct: lowRatio |
| space | continuous | dry and close to spacious | proxy: tail |
| articulation | continuous | sustained and smooth to short and punchy | proxy: crest |
| aggression | continuous | smooth to abrasive | proxy |
| groove | continuous | rigid to swung | proxy |
| variation | structural | repetitive to variable (0 = pure loop) | proxy |
| organicness | continuous | mechanical to humanized | proxy |
| width | continuous | narrow to wide | direct: width |
| register | structural | low to high | code |

Phase order (`PHASES`): structural → timing → pitch → articulation → spectral → spatial → level.

### Harmony

Rule 4 stands: harmony is material on the section, not an axis. Two reserved section keys next to `role`:

    section('drop', 8, { role: 'climax', key: 'Eb:major', progression: 'I V vi IV', drums: {...}, bass: {...} })

- `key` overrides the song key for that section (any Strudel scale name, so `C:harmonic minor` gives a real V in minor).
- `progression` is roman numerals `I..VII`, any case, one chord per cycle, looping. Degrees are diatonic to the section key; `npm run check` prints the chords you actually got (`I` in C minor prints `Cm`). Default is `i VI`.
- Pad voices the chord, bass transposes its line by the chord root, melody stays in key.
- Resolve phrases accept harmony words as states: progressions (`resolved`, `tense`, `pop`, `epic`, `circular`, `static`, `unresolved`), modes (`major`, `minor`, `dorian`, `lydian`, `mixolydian`, `phrygian`) and `relative`. `npm run resolve -- songs/x.strudel drop '*' "relative major, pop"` writes both fields.
- Not modeled: accidentals, sevenths, borrowed chords, sub-cycle chord changes.

The full design spec and plan live in `docs/superpowers/`, which is not versioned in this repo; the skill in
`.claude/skills/strudle/` likewise.
