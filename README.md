# strudel-bench

Local [Strudel](https://strudel.cc) harness: edit `songs/*.strudel`, press play in a browser, hear it. All code and samples are served from this folder.

## Setup

    npm install
    npm run samples          # one-time, downloads Strudel's default packs (~300 MB, resumable, re-run if any fail)
    npm start                # http://localhost:3000

The same page is deployed to GitHub Pages by `.github/workflows/pages.yml` on every push to main (`npm run pages` builds it into `dist/`). There it has no server: save and new song keep songs in the browser's localStorage instead of `songs/`, sample packs stream from the Strudel CDN instead of `samples/packs/`, and of the local packs in `samples/user/` only those whose `pack.json` says `deploy` ship with the site (songs that need the others are left out of the list there). Export works the same as locally (the browser renders and encodes), it just downloads instead of also writing `renders/`.

## Use

The page has two views: **Compose** (index.html) and **Examples** (examples.html, a scrollable showcase of playable snippets for every axis, descriptor, modifier, harmony word and section edit; entries marked "example coming" are placeholders).

- Pick a song, press ▶. ■ stops; pause remembers the cycle and resumes from it. Save writes the textarea back to the file. **+ New song** writes a minimal `song()` template to `songs/<name>.strudel`.
- The editable source and the expanded Strudel it reduces to sit side by side (stacked on narrow screens). The expanded pane follows the textarea as you type (expanded in the browser by `lib/dump.mjs`, also on GitHub Pages); lines the last edit changed flash briefly, and the source pane says "unsaved" until you save. Switching or creating a song asks before discarding unsaved edits.
- **Change comments** collects notes pinned at the cycle the playhead is on (pause where it bothers you, write what should change, Add note here) and builds one paste-ready request: song name, section map, the numbered notes with their bar, a line saying each note may be about that exact spot, its section, or what led into it, and the source of the sections around those spots (a first-bar note also quotes the section before). **Why it sounds this way** lists, per section, the `//` comments in the source and the decisions recorded in `songs/<name>.notes.json` (the prompt the song came from, then one entry per request with the changes it made: section, layer, axis, from → to, why; the card shows the why with the request's date and ask as a tooltip). `npm run note -- songs/x.strudel --ask "..." --change "drop.melody.brightness .5>.7 raised because ..."` appends one; `--prompt "..."` sets the summary. On GitHub Pages the request card is hidden. The **Kit** selector lists the drum kits the loaded packs actually have (a `<kit>_bd/sd/hh` prefix, local or CDN), each with a one-line label, hover description and icon from `lib/kits.json` (icons are drawn from the description words by `node scripts/kiticons.mjs`; the menu has a filter box); picking one rewrites the song-level `kit:` in the source, re-evaluates if playing, and saves like any other edit.
- The **Mix** card is the song as an instrument, and every control in it is a source edit (unsaved until Save, undoable with ctrl+z or the ↶ ↷ buttons, re-evaluated in place while playing). Top to bottom: a **song** pane (the header's tempo, key, seed, kit as inline controls), the **arrangement strip** (a block per section, one row per part shaded by density; click to scrub, 📌 to pin, ◀ ▶ to reorder, ⧉ to duplicate, ✎ or double-click to rename, × to remove, and on each block the transition into the next: riser bars and a hit sample), a **section** pane (that section's source with controls), the **harmony strip** (the key and one chord per bar, each a pick), the **axes** grid (a slider per axis the part adapts, with mute, solo and remove on each row and the part's events across the section's bars under it), **materials** (drum template and per-voice samples, each part's sound with a play button, notes, the melody's seed stepper showing the line it makes, arp, follow, level, and for a sample part the waveform with start/end sliders, a button per slice to hear it, bars, slices, the play order and the fit toggle) and the **phrase** row (words become pills, only vocabulary words and part names are accepted, a part pill scopes the words after it; Apply rewrites the values, Verify renders before and after, measures both and shows the deltas next to two players; "all sections" widens either to the whole song). Pinning a section loops it on its own pattern, starts Play there and keeps the card on it; **A/B** in the card's header plays the song as it was before the last change; solo, mute and A/B change what you hear, never the source. Save also records the mixer's edits in `songs/<name>.notes.json`. **Link** in the export group copies a URL carrying the song itself, which opens in this page anywhere, unsaved.
- **Embedding this page** in another one: `?play=1` starts playing on load and `?section=<name>` opens pinned to that section, so an iframe can land on the exact bars the surrounding text is about (`?play=1&section=contact#arrival.strudel`). They are query parameters, not hash ones, because the hash is the song name. Autoplay still needs user activation to reach the frame, which a reader's click on a click-to-load teaser provides; when the browser refuses anyway the transport just says Play and the button's tooltip says why, rather than looking like it is playing.
- Editing a song file on disk reloads it in the page. If it was playing, it re-evaluates so you hear the change. If you have unsaved edits in the textarea, you get a reload link instead.
- **Export MP3** stops playback, renders the source offline in the browser, encodes it there and downloads `<song>.mp3`. **Export Strudel** downloads the expanded pane as `<song>.strudel.txt`, ready to paste into the strudel.cc REPL, and **Open** opens it there. The badge next to the buttons shows the state (rendering with a percentage, ✓ file, ✗ why) and the buttons lock while a render runs. All work identically on localhost and GitHub Pages; with the local server the file is also written to `renders/` (the ✓ tooltip says so).
- Your own samples live in **local packs**: one folder per pack, `samples/user/<pack>/`. Inside it `<sound>/*.wav` is a sound with variants (`s("<sound>:2")` picks the third file) and a loose audio file is a single sound named after the file. A song declares the packs it uses, `song({ ..., packs: ['<pack>'] })` (a comment line `packs: ['<pack>']` does the same in a plain Strudel file), and `npm run check` refuses a pack sound the song does not declare, a declared pack that is not in `samples/user/`, and any sound in no pack at all. Nothing is ever substituted: a missing pack plays silence for its sounds, and the page says so. The header shows the song's packs as **deployed**, **local** or **missing**; the status line lists every local pack this environment has. Adding a pack touches no code: a folder, and a `pack.json` only if it should ship. `samples/user/demo-pack` (a generated sine blip, CC0) and `songs/ping.strudel` are the worked example. The Compose page imports a file for a sample part (materials → import…, or drop it on the row): it lands in `samples/user/<song>/`, the song declares the pack, and a license at the prompt writes the `pack.json` that ships it; `songs/chop.strudel` is the worked example, on the demo pack's generated loop.
- **Deploying local packs** (GitHub Pages) is opt-in per pack through `samples/user/<pack>/pack.json`: `{ "deploy": true, "license": "CC0-1.0", "source": "..." }` ships the whole pack, `"deploy": ["kick", "snare"]` ships only those sounds, no file (or `"deploy": false`) keeps it local-only. `npm run pages` copies only what ships, refuses to deploy a pack with no `license`, leaves songs that declare a non-shipping pack out of the deployed song list (their files do not ship either), and re-checks every deployed song against exactly the shipped sounds, so a subset that drops a sound a song uses fails the build instead of playing silence online. Built-in packs are unaffected: they come from `samples/packs/` locally and stream from the Strudel CDN on Pages.

## Scripts

- `npm run check -- songs/x.strudel` evaluates a song headlessly, prints the first 4 cycles of events (plus the per-section axis table with each layer's values read back as vocabulary words, key and chord names, and an `arc:` line of each section's energy for `song()` files), and fails on syntax errors or sound names that are not in the local packs, the user folder, or the built-in synths. No args checks every song.
- `npm run lint -- songs/x.strudel` applies the musical rules to that table: a climax exists and is the most energetic section, no two consecutive sections are identical, no section has two raw saws, every melody and bass writes its notes, axes stay in 0..1 and level in 0..2. Warnings for taste, errors for the impossible (exit 1). No args lints every song.
- `npm run dump -- songs/x.strudel` prints the plain Strudel a `song()`/`section()` file reduces to. Read-only.
- `npm run form -- --mood=ominous --bars=64 --seed=5 > songs/new.strudel` generates a song skeleton: six sections with roles and bar counts, key, tempo and progressions chosen by the mood, axis values pushed by the mood's overlay vector. Then material first (see the skill). `node gen/euclid.mjs --seed=3` is the older, plain-Strudel generator. Generators are plain scripts that print code to stdout.
- `npm run snippets -- clips.json [--out-dir DIR] [--force]` renders a batch of short clips as small mono MP3s, one per entry in the manifest (`{ out, song, section?, layer?, cycles?, kbps?, mono? }`, the same arguments as `render`). Defaults are 64 kbps mono, roughly a third the size of a full-quality render, which is what a few bars embedded in a web page wants. The page has to be open, so start `npm run headless` first. A clip that already exists is skipped, so re-running fills only the gaps.
- `npm run headless -- songs/x.strudel` opens the page in a headless Chromium so `render` and `verify` run with no window (starts the server if none answers; needs `playwright-core`, installed as a dev dependency, plus a browser: `npx playwright-core install chromium`, or `CHROME=<path to a chrome binary>`).
- `npm test` runs the node:test suite. `test/golden.test.mjs` pins the events of the fixture songs in `test/fixtures/` (copies kept still, so a change there is a change in `lib/`); the songs in `songs/` only have to check clean.

## Layout

    server.mjs           stdlib http server: static files, song api, sse reload, render/dump routes, user sample map
    index.html           Compose: song header, transport, source + expanded strudel, section feedback, offline renderer
    examples.html        Examples: data-driven playable cards (GROUPS at the top of its script), stubs where content is pending
    about.html           About: what strudel-bench is and why; legal.html: privacy and disclaimers (static, no strudel loaded)
    404.html             not-found page, served by the local server and by GitHub Pages for any unknown path
    web/                 boot.mjs (shared initStrudel/prebake, playCode, nav, footer), compose.mjs (kit + notes + request helpers),
                         examples.mjs (the GROUPS data), mp3.mjs (lamejs wrapper), sampler.mjs (waveform peaks, time labels, the file behind a sound),
                         kits/ (one icon per kit), strudel.css, icon.svg, og.png
    songs/               one .strudel file per song
    lib/                 the axis system (see below), loaded by both the page and the Node scripts
    samples/packs/       downloaded packs (gitignored) + <pack>.json maps + packs.json
    samples/user/        your sample packs, one folder each; pack.json = deploy policy (see Use)
    renders/             wav/mp3 renders and dumps (gitignored)
    scripts/samples.mjs  pack downloader
    scripts/check.mjs    headless checker (events, axis table with words, harmony, energy arc)
    scripts/lint.mjs     musical lint over the check table
    scripts/headless.mjs the page in a headless Chromium, for render/verify with no window
    scripts/dump.mjs     song() -> plain Strudel
    lib/resolve.mjs      words -> axis edits (scripts/resolve.mjs is the cli; the Compose page Mix card uses it too)
    scripts/render.mjs   drive the page's offline renderer
    scripts/mp3.mjs      wav -> mp3 (lamejs), --kbps and --mono for small web clips
    scripts/snippets.mjs a manifest of short clips -> small mono mp3s, for embedding in a page
    lib/analyze.mjs      wav metrics and deltas, no dependencies (scripts/analyze.mjs: cli and wav writing)
    scripts/verify.mjs   render -> resolve -> check -> render -> analyze -> report
    scripts/vocab.mjs    generate the skill's vocabulary reference from code
    scripts/note.mjs     record why a change was made into songs/<song>.notes.json
    scripts/kiticons.mjs redraw web/kits/*.svg from each kit's description in lib/kits.json
    scripts/esm-fix.mjs  node resolve hook (a strudel dependency ships without an exports map)
    gen/                 generators: form.mjs (a song skeleton from a mood), euclid.mjs (plain Strudel)
    test/                node:test suite; test/fixtures/ are the songs the golden test pins
    .claude/skills/strudel/  the song-editing skill (the one versioned path under .claude/)
    blog-ideas/          notes on making songs with an agent

## Not local

GM soundfont instruments (`gm_*`) still stream from GitHub when used. Built-in synths and every downloaded pack are local.

## Axes

Songs can be written as sections × layers × axis values (see `songs/demo.strudel`):

    song({ cps: .5, key: 'C:minor', seed: 1, kit: 'RolandTR909' }, [
      section('drop', 8, { role: 'climax', drums: { density: .7, drive: .8 }, bass: { weight: .8 }, melody: {}, pad: { space: .7 } }),
    ])

Five layers — drums, bass, melody, pad, fx — each take axis values in 0..1 where 0.5 is that layer's baseline. Then:

    npm run resolve -- songs/demo.strudel drop drums "punchier"          # what would change
    npm run resolve -- songs/demo.strudel drop drums "punchier" --write  # do it
    npm run render -- songs/demo.strudel --section drop                  # renders/demo.drop.wav (page must be open; it stops playback first)
    npm run render -- songs/demo.strudel --mp3                           # same, then renders/demo.mp3 (or the page's "export mp3" button)
    npm run mp3 -- renders/demo.wav                                      # convert an existing render
    node scripts/analyze.mjs renders/a.wav renders/b.wav                 # metrics and deltas
    npm run verify -- songs/demo.strudel drop drums "punchier"           # the whole chain with a report
    npm run vocab                                                        # regenerate the skill's vocabulary reference

Vocabulary is data: `lib/descriptors.json` (control words → axis deltas), `lib/overlays.json` (emotions and genres),
`lib/harmony.json` (progression and mode words). Modifiers like `slightly`, `much`, `extremely` scale a delta.

The `strudel` skill (`.claude/skills/strudel/SKILL.md`, versioned: the rest of `.claude/` is gitignored)
encodes the baseline → resolve → check → render/verify → report workflow for an agent editing songs by ear.
`blog-ideas/making-machine-with-claude.md` is a worked example of that loop from the user's side.

### Rules

1. A primitive axis exists only if it has a deterministic, layer-aware implementation; everything else is a descriptor or an overlay.
2. Axes are semantic, adapters are mechanical — an empty cell honestly says "no implementation on this layer".
3. Descriptors are deltas, not states: *dreamier* applies relative to the current values.
4. Harmony is a separate subsystem, not an axis.
5. No new trajectory concept: an axis value is a constant in 0..1, a Strudel signal, or `ramp(a, b)`.
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
| aggression | continuous | smooth to abrasive | proxy: flatness |
| groove | continuous | rigid to swung | proxy: swing |
| variation | structural | repetitive to variable (0 = pure loop) | proxy: novelty |
| organicness | continuous | mechanical to humanized | proxy: jitter |
| width | continuous | narrow to wide | direct: width |
| register | structural | low to high | code |

Phase order (`PHASES`): structural → timing → pitch → articulation → spectral → spatial → level.

### Harmony

Rule 4 stands: harmony is material on the section, not an axis. Two reserved section keys next to `role`:

    section('drop', 8, { role: 'climax', key: 'Eb:major', progression: 'I V vi IV', drums: {...}, bass: {...} })

- `key` overrides the song key for that section (any Strudel scale name, so `C:harmonic minor` gives a real V in minor).
- `progression` is roman numerals `I..VII`, any case, one chord per cycle (or several in `[..]`), looping. Degrees are diatonic to the section key; `npm run check` prints the chords you actually got (`I` in C minor prints `Cm`). Default is `i VI`.
- Pad voices the chord, bass transposes its line by the chord root, melody stays in key.
- Resolve phrases accept harmony words as states: progressions (`resolved`, `tense`, `pop`, `epic`, `circular`, `static`, `unresolved`), modes (`major`, `minor`, `dorian`, `lydian`, `mixolydian`, `phrygian`) and `relative`. `npm run resolve -- songs/x.strudel drop '*' "relative major, pop"` writes both fields.
- Not modeled: inversions and voice leading, chords longer than a bar.

### Material

Material is a literal value on a layer or a section, never an axis (rule 4). Omit it and nothing changes.

| Where | Key | Value | Effect |
|---|---|---|---|
| bass, melody, pad, fx | `sound` | any local synth or sample name | replaces the default (sawtooth; white noise for fx). Drums take `sounds` instead |
| any layer | `level` | number, 1 = untouched | gain multiplier, applied after every axis |
| drums | `template` | `'house'` (default), `'breaks'`, `'minimal'`, `'halftime'` | the base grid the axes thin out, place or fill |
| drums | `sounds` | `{ sd: 'rim', hh: 'hh:2' }` | per-voice sound; a name the kit has keeps the kit (the 909 rim), any other sample plays as named (`cajon`) |
| bass, melody | `notes` | mini-notation of scale degrees | replaces the seeded line; density thins or doubles it instead of choosing one |
| pad | `chord` | a scale degree or mini-notation of degrees | pins the pad to that degree instead of the progression; the bass still follows it |
| drums | `fill` | `true`/`false` | snare roll in the last half bar of the section; on by default before a `climax` section |
| pad | `arp` | `'up'`, `'down'`, `'updown'` or `"0 2 1 2"` | arpeggiates the chord in 8ths (8 notes a bar in 4/4, 6 in 3/4) |
| melody | `follow` | `true` | the line moves with the chord root |
| melody | `phrase` | integer bars | the seeded line spans that many bars |
| fx | `riser` | `true` (4 bars) or bars | noise sweep into the next section |
| fx | `impact` | `true` (`bd`) or a sound | one hit on the downbeat, half speed, big room |
| sample | `sound` | any loaded sample | the file the part slices (`npm run check` prints the file behind it) |
| sample | `begin`, `end` | fractions of the file, 0..1 | the region used (default the whole file); the trim is folded into the slice grid |
| sample | `bars` | number | what the region stands for at the section tempo (default 1): playback speed follows |
| sample | `slices` | integer | equal slices of the region (default 1) |
| sample | `pattern` | mini-notation of slice indices | the order, spanning the sample's bars: `'0 1 2 3 4 5 6 7'` is the loop as recorded, `'0 1 [2 3] 0'` a chop |
| sample | `stretch` | `true` | fit each slice to its step (Strudel's `fit()`); off, a slice keeps its own length at the fitted speed |
| song, section | `kit` | drum machine name | section overrides song |
| song, section | `meter` | `'4/4'`, `'3/4'`, `'6/8'`, `'7/8'`, `'5/4'` | one bar is still one cycle; 16th grid |
| song | `bpm` | number | instead of `cps`: beats per minute on the meter's denominator |
| section | `bpm` or `cps` | number | that section plays at its own tempo |

A key that is neither an axis nor that layer's material throws, naming both lists: a typo (`arpp: 'up'`) is a build error, not a silent no-op. The same goes for song metadata (`bmp: 120` throws).

`ramp(a, b)` is an axis value that sweeps over exactly the section: `brightness: ramp(.3, .8)`.

Sections are JavaScript, so reuse them with spread: `const verse = { drums: {...}, bass: {...} }; section('verse2', 8, { ...verse, drums: { ...verse.drums, variation: .5 } })`. The resolver reads literal values only, so it refuses a layer built with spread (it cannot see the baseline it would be editing) — set those axes by hand.

Progressions accept `b`/`#` before a numeral, `m`/`M`/`dim` and `7`/`M7` after it, and `[..]` to put chords in one bar: `'i bVI [III VII] V7'`. Case never changes a plain diatonic triad's quality (write `IVm` for a borrowed iv), but it does set the triad under a seventh: `V7` is the dominant seventh in any key (G7 in C minor), `v7` the diatonic one (Gm7), `VM7` a major seventh (Gmaj7), and a lowercase diatonic seventh keeps its quality (`vii7` in C major is Bm7b5). `npm run check` prints the chord names you actually got.

The full design spec and plan live in `docs/superpowers/`, which is not versioned in this repo.

## License

MIT, see `LICENSE`. Sample packs keep their own licenses: the Strudel CDN packs as published upstream, local packs whatever their `pack.json` declares.
