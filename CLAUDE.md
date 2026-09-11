# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Local [Strudel](https://strudel.cc) live-coding harness. Node stdlib only, no build step, no bundler. Songs are `songs/*.strudel`; everything (code and samples) is served from this folder.

## Commands

    npm install
    npm run samples                    # one-time ~300 MB pack download (resumable, re-run on failures); `-- <pack>` for one pack
    npm start                          # http://localhost:3000 (PORT env overrides)
    npm test                           # node:test suite in test/
    node --test test/check.test.mjs    # one test file
    npm run check -- songs/x.strudel   # headless: dumps 4 cycles of events, fails on syntax errors / unknown sounds
    npm run check                      # every song, summary only
    npm run dump -- songs/x.strudel    # read-only: print the plain Strudel a song()/section() file reduces to
    node gen/euclid.mjs --seed=3 > songs/euclid.strudel

Tests write temp files prefixed `_t_` into `test/`, `songs/`, and `samples/user/` and delete them after.

## Claude's feedback loop

Claude can't hear audio. `npm run check` is the primary verification: it prints the event stream (time, duration, value) and flags any `s("...")` name not in the local packs, `samples/user/`, or the hardcoded synth list in `scripts/check.mjs`. For browser verification use the Playwright MCP: navigate to `http://localhost:3000/#song.strudel`, click play, and read the console for `[strudle] evaluated` or error text in `#err`. Navigating to a URL that differs only by hash does not reload the page.

## Architecture

- **server.mjs** exports `createServer()` and `userMap()`. Routes: `/` (index.html), `/songs` (list), `GET|PUT /songs/<name>` (name must match `^[\w.-]+\.strudel$`), `/events` (SSE, fires `{changed}` from `fs.watch` on `songs/`), `/samples/user/strudel.json` (generated sample map), and static passthrough for `/node_modules/` and `/samples/` only.
- **index.html** loads `@strudel/web` straight from node_modules (UMD global `strudel`). `prebake` reads `samples/packs/packs.json`, registers each `<pack>.json` plus the user map, and applies the tidal-drum-machines alias bank so `.bank("RolandTR909")` works. SSE reload re-evaluates if playing; unsaved textarea edits get a reload link instead. `fs.watch` fires twice on Windows, hence the 200 ms debounce.
- **Sample maps** are Strudel JSON (`{_base, sound: [files]}`). `scripts/samples.mjs` downloads packs from the Strudel CDN, rewrites `_base` to `/samples/packs/<name>/`, and appends the name to `packs.json`. Pack contents are gitignored; the `.json` maps are committed. `userMap()` builds the same shape from `samples/user/`: subfolder = sound with variants, loose audio file = single-variant sound.
- **scripts/check.mjs** runs Strudel in Node: `evalScope` over core/mini/tonal with stubbed `setcps`/`samples`/`hush`, `evaluate(code, transpiler)`, then `pattern.queryArc(0, 4)`. Bank-prefixed sounds resolve as `<bank>_<name>`.
- **gen/** generators are plain scripts that print Strudel code to stdout with a seeded PRNG; each exports `generate(seed)` so tests can run output through `checkFile`.

## Node gotcha

`@kabelsalat/web` (pulled in by `@strudel/core`) ships no `exports` map, so Node resolves its CJS build and named imports break. Any Node script importing `@strudel/*` must `import './esm-fix.mjs'` (a `registerHooks` resolve hook) first and then use dynamic `import()` for the strudel packages, as `scripts/check.mjs` does.

## Axes

A song can be written declaratively: `song({ cps, key, seed, kit }, [section(name, cycles, { drums: {...}, bass: {...}, melody: {...}, pad: {...} })])`. Each layer takes axis values in 0..1, where **0.5 is the baseline no-op** (enforced by test) and a continuous axis may also take a Strudel signal; structural axes take numbers only.

- `lib/axes.mjs` — the 12-axis registry (`AXES`), `PHASES` (structural → timing → pitch → articulation → spectral → spatial → level), and the `ctl`/`piece` mapping helpers.
- `lib/layers.mjs` — the four layers (drums, bass, melody, pad) and their per-axis cells.
- `lib/grid.mjs` (step grids and placement), `lib/song.mjs` (`song`/`section`/`registerLayer`), `lib/vocab.mjs` (descriptor phrases → axis deltas).

Render routes (the page does the rendering; Node just drives it): `POST /render` (server pushes the job over SSE and waits), `PUT /renders/<name>.wav` (page uploads the result), `POST /render-error` (page reports a failure), plus static passthrough for `/lib/`.

Commands: `npm run resolve -- <song> <section|*> <layer|*> "phrase" [--write]`, `npm run render -- <song> [--section s] [--layer l]`, `npm run verify -- <song> <section> <layer> "phrase"`, `npm run vocab`, and `node scripts/analyze.mjs renders/a.wav renders/b.wav`. README.md carries the rules, the axis table and the phase order, because `docs/` and `.claude/` are gitignored here.

## Deliberate deferrals

Plain textarea editor (CodeMirror via `@strudel/codemirror` is the agreed follow-up). GM soundfont instruments (`gm_*`) still stream from GitHub. Design spec and plan: `docs/superpowers/`.
