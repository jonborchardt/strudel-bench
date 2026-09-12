# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Local [Strudel](https://strudel.cc) live-coding harness. Node stdlib only (plus `acorn` for the resolver and `@breezystack/lamejs` for mp3), no build step, no bundler. Songs are `songs/*.strudel`; everything (code and samples) is served from this folder.

## Commands

    npm install
    npm run samples                    # one-time ~300 MB pack download (resumable, re-run on failures); `-- <pack>` for one pack
    npm start                          # http://localhost:3000 (PORT env overrides)
    npm run pages                      # static copy in dist/ for GitHub Pages (deployed by .github/workflows/pages.yml on push to main)
    npm test                           # node:test suite in test/
    node --test test/check.test.mjs    # one test file
    npm run check -- songs/x.strudel   # headless: dumps 4 cycles of events (+ axis table, key, chords for song() files), fails on syntax errors / unknown sounds
    npm run check                      # every song, summary only
    npm run dump -- songs/x.strudel    # read-only: print the plain Strudel a song()/section() file reduces to
    node gen/euclid.mjs --seed=3 > songs/euclid.strudel

Axis workflow (page must be open and stopped for anything that renders):

    npm run resolve -- <song> <section|*> <layer|*> "phrase" [--write]   # words -> axis deltas -> edit numeric literals
    npm run render -- <song> [--section s] [--layer l] [--cycles n] [--mp3]
    npm run mp3 -- renders/x.wav [--kbps 192]
    node scripts/analyze.mjs renders/a.wav [renders/b.wav] [--json]
    npm run verify -- <song> <section> <layer> "phrase"                  # render -> resolve --write -> check -> render -> analyze -> report
    npm run vocab                                                        # regenerates .claude/skills/strudle/reference/vocab.md from code

Tests write temp files prefixed `_t_` into `test/`, `songs/`, and `samples/user/` and delete them after. `test/_scope.mjs` builds the Node strudel scope once and loads `lib/` into it; import its `ready` promise in tests that need patterns.

## Claude's feedback loop

Claude can't hear audio. `npm run check` is the primary verification: it prints the event stream (time, duration, value) and flags any `s("...")` name not in the local packs, `samples/user/`, or the hardcoded synth list in `scripts/check.mjs`. For measurable axes (brightness, weight, width, density, space, articulation) `npm run verify` renders before/after and reports metric deltas; "verified directionally" is the strongest claim to make. For browser verification use the Playwright MCP: navigate to `http://localhost:3000/#song.strudel`, click play, and read the console for `[strudle] evaluated` or error text in `#err`. Navigating to a URL that differs only by hash does not reload the page.

The `strudle` skill (`.claude/skills/strudle/SKILL.md`, gitignored) is the song-editing workflow: baseline → resolve → check → render/verify → report → commit with the musical change as the message.

## Architecture

- **server.mjs** exports `createServer()` and `userMap()`. Routes: `/` (index.html), `/songs/index.json` (list), `GET|PUT /songs/<name>` (name must match `^[\w.-]+\.strudel$`), `/events` (SSE, fires `{changed}` from `fs.watch` on `songs/` and `{render}` jobs), `/samples/user/strudel.json` (generated sample map), `/assets/` (aliases `@strudel/web/dist/assets` so the clock SharedWorker resolves), and static passthrough for `/node_modules/`, `/samples/` and `/lib/` only.
- **Render routes** (the page renders; Node drives it): `POST /render` pushes the job over SSE and waits up to 60 s, `PUT /renders/<name>.wav[?mp3]` receives the result (converted with `wavToMp3` when asked), `POST /render-error` rejects the waiter. `POST /dump/<song>` runs `scripts/dump.mjs` in a child process (it patches strudel globals, which must not happen in the server) and writes `renders/<song>.dump.txt`.
- **index.html** loads `@strudel/web` straight from node_modules (UMD global `strudel`). `prebake` reads `samples/packs/packs.json`, registers each `<pack>.json` plus the user map, and applies the tidal-drum-machines alias bank so `.bank("RolandTR909")` works. SSE reload re-evaluates if playing; unsaved textarea edits get a reload link instead. `fs.watch` fires twice on Windows, hence the 200 ms debounce. Pause remembers the scheduler cycle because the worker clock resets on stop. `renderWav` renders offline one cycle at a time (a single `renderPatternAudio` graph runs ~40x slower than realtime on long songs) and replaces the audio context, so the page must be stopped and reloaded after a failed render.
- **Sample maps** are Strudel JSON (`{_base, sound: [files]}`). `scripts/samples.mjs` downloads packs from the Strudel CDN, rewrites `_base` to `/samples/packs/<name>/`, and appends the name to `packs.json`. Pack contents are gitignored; the `.json` maps are committed so `npm run check` knows the sound names on a fresh clone. When `samples/packs/packs.json` is absent (GitHub Pages), index.html streams the packs listed in `lib/packs.json` from the Strudel CDN with the same base URLs `scripts/samples.mjs` downloads from. All page URLs are relative because a project page lives under `/<repo>/`; `scripts/pages.mjs` assembles `dist/` and the page hides save/export when `/events` 404s. `userMap()` builds the same shape from `samples/user/`: subfolder = sound with variants, loose audio file = single-variant sound.
- **scripts/check.mjs** runs Strudel in Node: `evalScope` over core/mini/tonal with stubbed `setcps`/`samples`/`hush`, loads `lib/index.mjs`, `evaluate(code, transpiler)`, then `pattern.queryArc(0, 4)`. Bank-prefixed sounds resolve as `<bank>_<name>`. Exports `checkFile` and `ensureScope` for the other scripts.
- **scripts/dump.mjs** has no source to print (song() builds patterns at runtime), so it wraps every core function and Pattern method, records the call chain behind each pattern, and prints it per section and layer.
- **scripts/resolve.mjs** parses the song with acorn and edits only numeric literals that are direct values of axis keys inside `section()` layer objects, plus the `key`/`progression` strings for harmony words. Signals and hand-written expressions are refused, never rewritten.
- **gen/** generators are plain scripts that print Strudel code to stdout with a seeded PRNG; each exports `generate(seed)` so tests can run output through `checkFile`.

## Node gotcha

`@kabelsalat/web` (pulled in by `@strudel/core`) ships no `exports` map, so Node resolves its CJS build and named imports break. Any Node script importing `@strudel/*` must `import './esm-fix.mjs'` (a `registerHooks` resolve hook) first and then use dynamic `import()` for the strudel packages, as `scripts/check.mjs` does. `lib/` never imports `@strudel/*`: it reaches Strudel through `lib/strudel.mjs` (`S`), which is `window.strudel` in the page and `globalThis` after `evalScope` in Node.

## Axes

A song can be written declaratively: `song({ cps, key, seed, kit }, [section(name, cycles, { role, key, progression, drums: {...}, bass: {...}, melody: {...}, pad: {...}, fx: {...} })])`. Each layer takes axis values in 0..1, where **0.5 is the baseline no-op** (enforced by test) and a continuous axis may also take a Strudel signal or `ramp(a, b)`; structural axes take numbers only. `key` and `progression` are per-section harmony (rule 4: harmony is material, not an axis); material keys (`sound`, `level`, `fill`, `arp`, `follow`, `kit`, `meter`, `bpm`, ...) live next to axes in the same layer/section objects. `test/golden.test.mjs` pins the full event stream of every song in `songs/`; regenerate it (`UPDATE_GOLDEN=1 node --test test/golden.test.mjs`) only on purpose, and check that only the songs you meant to change moved.

- `lib/axes.mjs` — the 12-axis registry (`AXES`), `PHASES` (structural → timing → pitch → articulation → spectral → spatial → level), and the `ctl`/`piece` mapping helpers.
- `lib/layers.mjs` — the five layers (drums, bass, melody, pad, fx) and their per-axis cells.
- `lib/grid.mjs` (step grids and placement, parametric on meter), `lib/song.mjs` (`song`/`section`/`registerLayer`), `lib/harmony.mjs` (roman-numeral progressions over a section key, `chordName`, harmony words), `lib/vocab.mjs` (phrase → axis deltas; `MODIFIERS` scale them).
- `lib/index.mjs` loads all of it into the current scope and defines `song`, `section`, `strudleLib` and one global per layer (`drums({ density: .8 })` returns just that layer's pattern) on `globalThis`.
- Vocabulary is data, not code: `lib/descriptors.json` (control words), `lib/overlays.json` (emotions/genres), `lib/harmony.json` (progression and mode words). Node reads them eagerly, the page fetches them via `/lib/`. Add words there, then `npm run vocab`.

README.md carries the rules, the axis table, the phase order and the harmony contract, because `docs/` and `.claude/` are gitignored here.

## Deliberate deferrals

Plain textarea editor (CodeMirror via `@strudel/codemirror` is the agreed follow-up). GM soundfont instruments (`gm_*`) still stream from GitHub. Harmony does not model inversions, voice leading, or chords longer than a bar. Design spec and plan: `docs/superpowers/`.
