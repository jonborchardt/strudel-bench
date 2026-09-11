# Strudel local harness — design

Date: 2026-09-10

## Goal

A repo where Claude edits Strudel song files on disk, and you open one local
web page, pick a song, press Play, and hear it. All code and sound files live
locally. Small Node scripts generate Strudel code into the same song folder.

## Constraints that drive the design

- Strudel produces audio only via Web Audio in a browser. Node can evaluate
  patterns but not play them. So playback lives in a browser tab served from
  localhost; Node handles serving, checking, downloading, and generating.
- One toolchain: JavaScript/Node. Strudel is JS, so generators and the
  checker can import Strudel's own packages.
- No CDN at runtime. `@strudel/web` is installed via npm and served from
  `node_modules`. Samples are served from `samples/`.

## Layout

```
strudle/
  package.json               deps: @strudel/web, @strudel/core, @strudel/mini,
                             @strudel/tonal, @strudel/transpiler
                             scripts: start, check, samples
  server.mjs                 static server + song API + reload events
  index.html                 song picker, textarea editor, Play/Stop/Save, error box
  songs/*.strudel            one song per file; plain Strudel code, last
                             expression is the pattern (same as the Strudel REPL)
  samples/packs/<pack>/      downloaded default packs (gitignored)
  samples/packs/<pack>.json  sample map per pack, _base rewritten to local path
  samples/packs/packs.json   list of downloaded pack names
  samples/user/<sound>/*.wav your own samples; folder name = sound name,
                             files inside = variants, e.g. s("kick:2")
  scripts/samples.mjs        one-time downloader for the default packs
  scripts/check.mjs          headless validation of a song file
  gen/*.mjs                  generators; each prints Strudel code to stdout
```

## Components

### server.mjs (`npm start`, http://localhost:3000)

- Serves `index.html`, `node_modules/@strudel/web/...`, and `samples/` as
  static files.
- `GET /songs` returns a JSON list of `songs/*.strudel` names.
- `GET /songs/:name` returns the file text. `PUT /songs/:name` overwrites it
  (the page's Save button).
- `GET /samples/user/strudel.json` is generated on request by walking
  `samples/user/`. Each subfolder becomes a sound name with its audio files
  sorted as variants. Loose files at the top level become single-variant
  sounds named after the file. `_base` is `/samples/user/`.
- `GET /events` is Server-Sent Events. `fs.watch` on `songs/` emits
  `{changed: name}`. EventSource reconnects on its own, so no retry code.
- Node stdlib only (`http`, `fs`, `path`). No framework.

### index.html

- On load: `initStrudel({ prebake })` where `prebake` calls `samples()` for
  every pack listed in `samples/packs/packs.json` and for
  `/samples/user/strudel.json`.
- A song `<select>` populated from `GET /songs`. Selecting loads the text into
  a `<textarea>`.
- Play runs `evaluate(textarea.value)`. Stop runs `hush()`. Save `PUT`s the
  textarea.
- Errors from `evaluate` render in a `<pre>` under the editor.
- On an SSE `changed` event for the selected song: if the textarea is
  unmodified since load, replace its text, and if the song is playing,
  re-evaluate so the edit is heard without a click. If the textarea has
  unsaved edits, show a "file changed on disk, reload?" link instead.
- The editor is a plain textarea. Upgrading to `@strudel/codemirror` is a
  bounded follow-up if the textarea gets in the way. Not part of this spec.

### scripts/samples.mjs (`npm run samples`)

- The pack list is a constant at the top of the file. Default: the packs the
  Strudel REPL preloads from `felixroos/dough-samples`
  (`tidal-drum-machines`, `piano`, `Dirt-Samples`, `EmuSP12`, `vcsl`,
  `mridangam`). Edit the list to trim. The exact JSON URLs are confirmed at
  implementation time against the current Strudel repo.
- For each pack: fetch the JSON, download every referenced file into
  `samples/packs/<pack>/` keeping the relative path, skip files that already
  exist (resumable), write `samples/packs/<pack>.json` with `_base` set to
  `/samples/packs/<pack>/`, and update `samples/packs/packs.json`.
- Concurrency capped around 8 downloads. Progress printed per pack. Non-zero
  exit if any file failed, listing the failures.
- Out of scope: GM soundfonts (`gm_*`), which Strudel fetches lazily from
  GitHub. Built-in synths need no files.

### scripts/check.mjs (`npm run check -- songs/x.strudel`)

Claude cannot hear, so this is its feedback loop.

- Loads `@strudel/core`, `@strudel/mini`, `@strudel/tonal` into the eval
  scope and evaluates the file via `@strudel/transpiler`. A parse or runtime
  error prints and exits 1.
- Queries the first 4 cycles and prints one line per event: cycle position,
  duration, and the `s`, `note`, `n` values.
- Builds the set of known sound names from `samples/packs/*.json`, the user
  folder, and Strudel's built-in synth names. Any `s` value not in that set
  prints a warning and exits 1, so a bad generator fails loudly.
- With no arguments, checks every file in `songs/`.

### gen/*.mjs

- Each generator is a standalone script that prints Strudel code to stdout.
  Usage: `node gen/euclid.mjs > songs/euclid.strudel`. The server's watcher
  picks the file up like any other edit.
- First generator: `gen/euclid.mjs`, a Euclidean drum pattern plus a melody
  over a random scale, with a `--seed` flag so output is reproducible. Its
  purpose is to prove the path. Musical quality is not the point yet.

## Data flow

1. `npm run samples` once fills `samples/packs/`.
2. `npm start` serves on :3000. Open it in a browser.
3. Claude edits or generates `songs/foo.strudel`, runs `npm run check` on
   it, and reports.
4. The watcher fires, the page reloads the text, and if playing you hear the
   change.
5. You tweak in the textarea, press Play, press Save when happy.

## Error handling

- Page: evaluate errors and sample-load failures show in the error box. The
  browser console keeps the full stack.
- Server: a missing song returns 404. A `PUT` whose name contains a path
  separator or does not end in `.strudel` returns 400.
- Downloader: resumable, failures listed, exit 1.
- Checker: exit 1 on parse error, runtime error, or unknown sound.

## Testing

- `scripts/check.mjs` doubles as the automated test. `npm run check` with no
  args must pass on every song, including `songs/demo.strudel` (drums plus a
  short melody on local samples).
- Manual proof of the loop: `npm start`, open the page, pick `demo`, press
  Play, hear drums. Then have Claude edit `demo.strudel` while it plays and
  hear the change.
- Claude can drive the page with the Playwright MCP already available in
  this session: open the page, click Play, read the console for
  "sound not found" or evaluate errors. That covers everything except ears.

## Out of scope for this pass

- CodeMirror editor, visualizers, multi-song mixing, MIDI/OSC output.
- Local GM soundfonts.
- The live-coding-music-mcp server. Our page plus Playwright gives Claude
  the same control with no extra dependency.
