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
    node scripts/analyze.mjs renders/a.wav renders/b.wav                 # metrics and deltas
    npm run verify -- songs/demo.strudel drop drums "punchier"           # the whole chain with a report
    npm run vocab                                                         # regenerate the skill's vocabulary reference

The `strudle` skill (`.claude/skills/strudle/SKILL.md`, not versioned — `.claude/` is gitignored in this repo)
encodes the baseline → resolve → check → render/verify → report workflow for an agent editing songs by ear.
