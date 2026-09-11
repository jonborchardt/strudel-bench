# Strudel Local Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web page that plays Strudel song files from `songs/` with local samples, plus Node scripts to download samples, validate songs headlessly, and generate songs.

**Architecture:** A stdlib-only Node server serves `index.html`, the `@strudel/web` bundle from `node_modules`, and `samples/`. It exposes a tiny song API and a Server-Sent Events stream so the page reloads a song when its file changes. Scripts share nothing but the server's exported user-sample map function.

**Tech Stack:** Node 24 (ESM, `node:test`, `fetch`), `@strudel/web` 1.3.0 in the browser, `@strudel/core` + `@strudel/mini` + `@strudel/tonal` + `@strudel/transpiler` 1.2.6 in Node. No other dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-strudel-harness-design.md`

## Global Constraints

- Node stdlib only for the server. No Express, no Vite, no test framework beyond `node:test`.
- No CDN at page runtime. Everything the page loads comes from `localhost:3000`.
- Song files are `songs/<name>.strudel`, plain Strudel code, last expression is the pattern.
- Sample packs land in `samples/packs/<name>/` with a sibling `samples/packs/<name>.json` whose `_base` is `/samples/packs/<name>/`. `samples/packs/packs.json` lists downloaded pack names.
- User samples live in `samples/user/<sound>/*.wav` (or loose files at the top level).
- Song names must match `/^[\w.-]+\.strudel$/` at the server boundary.
- Commit after each task with the attribution trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Verified facts (from inspecting installed packages and the Strudel repo)

- `node_modules/@strudel/web/dist/index.js` is an IIFE that defines global `strudel` and sets `window.initStrudel`. It resolves `assets/clockworker-*.js` relative to the script URL, so the whole `dist/` folder must be servable.
- `initStrudel({ prebake, onEvalError })` runs Strudel's default prebake (registers synths, puts `samples`, `evaluate`, `hush` on `globalThis`), then awaits our `prebake`. Extra options are forwarded to the repl, so `onEvalError` reaches it.
- `strudel.evaluate(code)` plays; `strudel.hush()` stops; `strudel.samples(url)` loads a map; `strudel.aliasBank(url)` loads bank aliases.
- Sample JSON values come in three shapes: a string, an array of strings, or an object mapping note names to strings (piano).
- The Strudel REPL preloads from `https://strudel.b-cdn.net`: `piano`, `vcsl` (base `VCSL/`), `tidal-drum-machines` (base `tidal-drum-machines/machines/`), `uzu-drumkit`, `uzu-wavetables`, `mridangam` (base `mrid/`), plus an inline Dirt-Samples map that matches `https://raw.githubusercontent.com/felixroos/dough-samples/main/Dirt-Samples.json`, then `aliasBank('tidal-drum-machines-alias.json')`.
- In Node: `evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'))`, then `evaluate(code, transpiler)` from `@strudel/core` returns `{ pattern }`. `pattern.queryArc(0, 4)` returns haps with `.whole.begin`, `.whole.end`, `.value`.

---

### Task 1: Scaffold, demo song, package scripts

**Files:**
- Modify: `package.json`
- Create: `songs/demo.strudel`, `samples/user/.gitkeep`, `samples/packs/.gitkeep`

**Interfaces:**
- Produces: `npm start`, `npm test`, `npm run check`, `npm run samples` scripts; `songs/demo.strudel` used by later tests.

- [ ] **Step 1: Set package.json scripts and type**

Replace the `scripts` block and add `"type": "module"`:

```json
{
  "name": "strudle",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.mjs",
    "test": "node --test test/",
    "check": "node scripts/check.mjs",
    "samples": "node scripts/samples.mjs"
  }
}
```

Keep the existing `dependencies` block untouched.

- [ ] **Step 2: Write the demo song**

`songs/demo.strudel`:

```js
// demo: 909 drums + a slow bass line. bd/sd/hh come from uzu-drumkit,
// .bank() swaps them for RolandTR909_* from tidal-drum-machines.
setcps(0.5)
stack(
  s("bd*2, [~ sd]*2, hh*8").bank("RolandTR909"),
  note("<c2 eb2 g2 bb1>").s("sawtooth").lpf(600).gain(.5)
)
```

- [ ] **Step 3: Create placeholder dirs**

```bash
mkdir -p samples/user samples/packs test && touch samples/user/.gitkeep samples/packs/.gitkeep
```

`.gitignore` already ignores `samples/packs/`; add `!samples/packs/.gitkeep` on its own line so the folder exists in a fresh clone.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold strudel harness with demo song"
```

---

### Task 2: server.mjs

**Files:**
- Create: `server.mjs`
- Test: `test/server.test.mjs`

**Interfaces:**
- Produces: `export function userMap()` → `{ _base: '/samples/user/', [sound]: string[] }`; `export function createServer()` → `http.Server` (not listening). Running `node server.mjs` listens on `PORT` env or 3000.
- HTTP: `GET /` (index.html), `GET /songs` (JSON string[]), `GET /songs/:name` (text), `PUT /songs/:name` (body → file, 204), `GET /events` (SSE, `data: {"changed":"<file>"}`), `GET /samples/user/strudel.json` (userMap), static under `/node_modules/` and `/samples/`.

- [ ] **Step 1: Write the failing test**

`test/server.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, userMap } from '../server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const USER = path.join(ROOT, 'samples', 'user');

async function withServer(fn) {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('userMap turns folders into sounds and loose files into single sounds', () => {
  fs.mkdirSync(path.join(USER, '_t_kick'), { recursive: true });
  fs.writeFileSync(path.join(USER, '_t_kick', 'b.wav'), '');
  fs.writeFileSync(path.join(USER, '_t_kick', 'a.wav'), '');
  fs.writeFileSync(path.join(USER, '_t_kick', 'notes.txt'), '');
  fs.writeFileSync(path.join(USER, '_t_loose.mp3'), '');
  try {
    const m = userMap();
    assert.equal(m._base, '/samples/user/');
    assert.deepEqual(m._t_kick, ['_t_kick/a.wav', '_t_kick/b.wav']);
    assert.deepEqual(m._t_loose, ['_t_loose.mp3']);
  } finally {
    fs.rmSync(path.join(USER, '_t_kick'), { recursive: true });
    fs.rmSync(path.join(USER, '_t_loose.mp3'));
  }
});

test('song list, read, write, and name validation', async () => {
  await withServer(async (base) => {
    const list = await (await fetch(`${base}/songs`)).json();
    assert.ok(list.includes('demo.strudel'));

    const text = await (await fetch(`${base}/songs/demo.strudel`)).text();
    assert.match(text, /setcps/);

    const put = await fetch(`${base}/songs/_t_new.strudel`, { method: 'PUT', body: 'note("c")' });
    assert.equal(put.status, 204);
    assert.equal(fs.readFileSync(path.join(ROOT, 'songs', '_t_new.strudel'), 'utf8'), 'note("c")');
    fs.rmSync(path.join(ROOT, 'songs', '_t_new.strudel'));

    assert.equal((await fetch(`${base}/songs/nope.strudel`)).status, 404);
    assert.equal((await fetch(`${base}/songs/x.txt`, { method: 'PUT', body: '' })).status, 400);
    assert.equal((await fetch(`${base}/songs/..%2Fpackage.json`, { method: 'PUT', body: '' })).status, 400);
  });
});

test('static files and user sample map', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/`)).headers.get('content-type'), 'text/html');
    const js = await fetch(`${base}/node_modules/@strudel/web/dist/index.js`);
    assert.equal(js.status, 200);
    assert.equal((await fetch(`${base}/node_modules/../package.json`)).status, 404);
    const m = await (await fetch(`${base}/samples/user/strudel.json`)).json();
    assert.equal(m._base, '/samples/user/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `../server.mjs`.

- [ ] **Step 3: Write server.mjs**

```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = import.meta.dirname;
const SONGS = path.join(ROOT, 'songs');
const USER = path.join(ROOT, 'samples', 'user');
const SONG_NAME = /^[\w.-]+\.strudel$/;
const AUDIO = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a', '.webm']);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.aif': 'audio/aiff', '.aiff': 'audio/aiff', '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.strudel': 'text/plain',
};

const isAudio = (f) => AUDIO.has(path.extname(f).toLowerCase());

/** Sample map for samples/user: each subfolder is a sound, loose audio files are single-variant sounds. */
export function userMap() {
  const map = { _base: '/samples/user/' };
  if (!fs.existsSync(USER)) return map;
  for (const e of fs.readdirSync(USER, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const files = fs.readdirSync(path.join(USER, e.name)).filter(isAudio).sort();
      if (files.length) map[e.name] = files.map((f) => `${e.name}/${f}`);
    } else if (isAudio(e.name)) {
      map[path.parse(e.name).name] = [e.name];
    }
  }
  return map;
}

const send = (res, status, body, type = 'text/plain') => {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
};
const json = (res, obj) => send(res, 200, JSON.stringify(obj), 'application/json');
const readBody = (req) => new Promise((r) => { let s = ''; req.on('data', (d) => (s += d)).on('end', () => r(s)); });

function serveStatic(res, urlPath) {
  const rel = decodeURIComponent(urlPath);
  const file = path.resolve(ROOT, '.' + rel);
  const allowed = [path.join(ROOT, 'node_modules'), path.join(ROOT, 'samples')];
  if (!allowed.some((d) => file.startsWith(d + path.sep)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export function createServer() {
  const clients = new Set();
  fs.mkdirSync(SONGS, { recursive: true });
  const watcher = fs.watch(SONGS, (_ev, file) => {
    if (!file || !SONG_NAME.test(file)) return;
    for (const res of clients) res.write(`data: ${JSON.stringify({ changed: file })}\n\n`);
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/') return send(res, 200, fs.readFileSync(path.join(ROOT, 'index.html')), 'text/html');

    if (p === '/songs') {
      return json(res, fs.readdirSync(SONGS).filter((f) => SONG_NAME.test(f)).sort());
    }
    if (p.startsWith('/songs/')) {
      const name = decodeURIComponent(p.slice('/songs/'.length));
      if (!SONG_NAME.test(name)) return send(res, 400, 'bad song name');
      const file = path.join(SONGS, name);
      if (req.method === 'PUT') {
        fs.writeFileSync(file, await readBody(req));
        return send(res, 204, '');
      }
      if (!fs.existsSync(file)) return send(res, 404, 'no such song');
      return send(res, 200, fs.readFileSync(file), 'text/plain; charset=utf-8');
    }

    if (p === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (p === '/samples/user/strudel.json') return json(res, userMap());
    if (p.startsWith('/node_modules/') || p.startsWith('/samples/')) return serveStatic(res, p);
    send(res, 404, 'not found');
  });

  server.on('close', () => watcher.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`strudle → http://localhost:${port}`));
}
```

Note: `index.html` does not exist until Task 3, so the `GET /` test will fail on read until then. Create an empty `index.html` in this task (`echo '<!doctype html>' > index.html`) so the test passes; Task 3 replaces it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add server.mjs test/server.test.mjs index.html && git commit -m "feat: stdlib http server with song api, sse reload, user sample map"
```

---

### Task 3: index.html

**Files:**
- Create: `index.html` (replace the placeholder)

**Interfaces:**
- Consumes: server routes from Task 2, `samples/packs/packs.json` and `samples/packs/tidal-drum-machines-alias.json` from Task 4 (both optional at runtime: missing files are tolerated).
- Produces: console line `[strudle] evaluated <song>` after every successful evaluate (used by the Playwright check in Task 7).

- [ ] **Step 1: Write index.html**

```html
<!doctype html>
<meta charset="utf-8">
<title>strudle</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 1rem; max-width: 64rem; }
  .bar { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-bottom: .5rem; }
  textarea { width: 100%; height: 26rem; font: 13px/1.4 ui-monospace, Consolas, monospace; box-sizing: border-box; }
  #err { color: #b00; white-space: pre-wrap; }
  #status { color: #555; }
  kbd { font: inherit; color: #777; }
</style>
<div class="bar">
  <select id="song"></select>
  <button id="play">▶ play</button>
  <button id="stop">■ stop</button>
  <button id="save">save</button>
  <span id="status"></span>
  <kbd>ctrl+enter play · ctrl+. stop</kbd>
</div>
<textarea id="code" spellcheck="false"></textarea>
<pre id="err"></pre>
<script src="/node_modules/@strudel/web/dist/index.js"></script>
<script>
  const $ = (id) => document.getElementById(id);
  let loaded = '';      // text as last loaded from disk (or saved)
  let playing = false;

  const ready = initStrudel({
    onEvalError: (e) => ($('err').textContent = e.message),
    prebake: async () => {
      const packs = await fetch('/samples/packs/packs.json').then((r) => (r.ok ? r.json() : []));
      await Promise.all([
        ...packs.map((p) => strudel.samples(`/samples/packs/${p}.json`)),
        strudel.samples('/samples/user/strudel.json'),
      ]);
      if (packs.includes('tidal-drum-machines')) strudel.aliasBank('/samples/packs/tidal-drum-machines-alias.json');
      $('status').textContent = `packs: ${packs.join(', ') || 'none (run npm run samples)'}`;
    },
  });

  // surface strudel's own error log lines (e.g. "sound not found")
  document.addEventListener('strudel.log', (e) => {
    if (e.detail.type === 'error') $('err').textContent = e.detail.message;
  });

  async function loadList() {
    const names = await (await fetch('/songs')).json();
    $('song').innerHTML = names.map((n) => `<option>${n}</option>`).join('');
    const want = decodeURIComponent(location.hash.slice(1));
    if (names.includes(want)) $('song').value = want;
    await loadSong();
  }
  async function loadSong() {
    const name = $('song').value;
    location.hash = name;
    loaded = await (await fetch(`/songs/${name}`)).text();
    $('code').value = loaded;
    $('err').textContent = '';
  }
  async function play() {
    $('err').textContent = '';
    await ready;
    await strudel.evaluate($('code').value);
    playing = true;
    console.log('[strudle] evaluated', $('song').value);
  }
  function stop() { strudel.hush(); playing = false; }
  async function save() {
    await fetch(`/songs/${$('song').value}`, { method: 'PUT', body: $('code').value });
    loaded = $('code').value;
    $('status').textContent = 'saved';
  }

  $('play').onclick = play;
  $('stop').onclick = stop;
  $('save').onclick = save;
  $('song').onchange = loadSong;
  $('code').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); play(); }
    if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); stop(); }
  });

  // reload from disk when the current song file changes (fs.watch fires twice on Windows, hence the debounce)
  let timer;
  new EventSource('/events').onmessage = (e) => {
    if (JSON.parse(e.data).changed !== $('song').value) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if ($('code').value !== loaded) {
        $('status').innerHTML = 'file changed on disk. <a href="#" id="reload">reload</a>';
        $('reload').onclick = async (ev) => { ev.preventDefault(); await loadSong(); $('status').textContent = ''; if (playing) play(); };
        return;
      }
      await loadSong();
      if (playing) play();
    }, 200);
  };

  loadList();
</script>
```

- [ ] **Step 2: Manual smoke test**

Run: `npm start`, open http://localhost:3000, pick `demo.strudel`, press play. Without packs downloaded yet, expect the sawtooth bass to play and a "sound not found" style message for `bd` in the error box. That proves the page, the bundle, and the audio worker load locally. Stop.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 3 passing (the `GET /` content-type test now reads the real page).

- [ ] **Step 4: Commit**

```bash
git add index.html && git commit -m "feat: play page with song picker, textarea editor, live reload"
```

---

### Task 4: scripts/samples.mjs (downloader)

**Files:**
- Create: `scripts/samples.mjs`
- Test: `test/samples.test.mjs`

**Interfaces:**
- Produces: `export function fileList(json)` → `string[]` of relative paths in a sample JSON (handles string, array, note-map values; skips `_base`). CLI: `node scripts/samples.mjs [packName...]` downloads listed packs (default: all in `PACKS`), writes `samples/packs/<name>.json`, `samples/packs/packs.json`, and `samples/packs/tidal-drum-machines-alias.json`.

- [ ] **Step 1: Write the failing test**

`test/samples.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileList } from '../scripts/samples.mjs';

test('fileList handles string, array, and note-map values and skips _base', () => {
  const json = {
    _base: 'https://x/',
    a: 'a/one.wav',
    b: ['b/1.wav', 'b/2.wav'],
    piano: { A0: 'A0v8.mp3', C1: 'C1v8.mp3' },
  };
  assert.deepEqual(fileList(json).sort(), ['A0v8.mp3', 'C1v8.mp3', 'a/one.wav', 'b/1.wav', 'b/2.wav']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `../scripts/samples.mjs`.

- [ ] **Step 3: Write scripts/samples.mjs**

```js
// Download the sample packs the Strudel REPL preloads, so the page works fully offline.
// usage: node scripts/samples.mjs [pack ...]   (default: all packs below; safe to re-run, skips existing files)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CDN = 'https://strudel.b-cdn.net';
// name → where the JSON lives, and the base URL its paths are relative to (falls back to the JSON's _base)
const PACKS = {
  'uzu-drumkit': { json: `${CDN}/uzu-drumkit.json`, base: `${CDN}/uzu-drumkit/` },
  'tidal-drum-machines': { json: `${CDN}/tidal-drum-machines.json`, base: `${CDN}/tidal-drum-machines/machines/` },
  piano: { json: `${CDN}/piano.json`, base: `${CDN}/piano/` },
  'Dirt-Samples': { json: 'https://raw.githubusercontent.com/felixroos/dough-samples/main/Dirt-Samples.json' },
  mridangam: { json: `${CDN}/mridangam.json`, base: `${CDN}/mrid/` },
  vcsl: { json: `${CDN}/vcsl.json`, base: `${CDN}/VCSL/` },
  'uzu-wavetables': { json: `${CDN}/uzu-wavetables.json`, base: `${CDN}/uzu-wavetables/` },
};
const ALIAS_URL = `${CDN}/tidal-drum-machines-alias.json`;
const OUT = path.resolve(import.meta.dirname, '..', 'samples', 'packs');
const CONCURRENCY = 8;

export function fileList(json) {
  const out = [];
  for (const [k, v] of Object.entries(json)) {
    if (k === '_base') continue;
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) out.push(...v);
    else out.push(...Object.values(v));
  }
  return out;
}

const encodePath = (rel) => rel.split('/').map(encodeURIComponent).join('/');

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 'skipped';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, dest);
  return 'downloaded';
}

async function pool(items, worker) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) results.push(await worker(items[i++]));
  }));
  return results;
}

async function fetchPack(name) {
  const { json: jsonUrl, base } = PACKS[name];
  const json = await (await fetch(jsonUrl)).json();
  const remoteBase = base || json._base;
  const files = fileList(json);
  const dir = path.join(OUT, name);
  const failed = [];
  let downloaded = 0, skipped = 0;
  await pool(files, async (rel) => {
    try {
      const r = await download(remoteBase + encodePath(rel), path.join(dir, rel));
      r === 'skipped' ? skipped++ : downloaded++;
    } catch (e) { failed.push(e.message); }
  });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ ...json, _base: `/samples/packs/${name}/` }, null, 1));
  const listFile = path.join(OUT, 'packs.json');
  const list = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
  if (!list.includes(name)) fs.writeFileSync(listFile, JSON.stringify([...list, name]));
  console.log(`${name}: ${downloaded} downloaded, ${skipped} skipped, ${failed.length} failed of ${files.length}`);
  return failed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2);
  const unknown = names.filter((n) => !PACKS[n]);
  if (unknown.length) { console.error(`unknown pack(s): ${unknown}. known: ${Object.keys(PACKS)}`); process.exit(2); }
  const failed = [];
  for (const name of names.length ? names : Object.keys(PACKS)) failed.push(...await fetchPack(name));
  await download(ALIAS_URL, path.join(OUT, 'tidal-drum-machines-alias.json'));
  if (failed.length) { console.error('failed:\n' + failed.join('\n')); process.exit(1); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 4 passing.

- [ ] **Step 5: Download the small packs first, then the rest**

Run: `node scripts/samples.mjs piano uzu-drumkit`
Expected: two summary lines with 0 failed; `samples/packs/packs.json` is `["piano","uzu-drumkit"]`; `samples/packs/piano.json` has `_base` `/samples/packs/piano/`.

Then run the full default set in the background (it is several hundred MB): `node scripts/samples.mjs`. Re-run if any fail; it resumes.

- [ ] **Step 6: Commit**

```bash
git add scripts/samples.mjs test/samples.test.mjs && git commit -m "feat: resumable downloader for strudel default sample packs"
```

---

### Task 5: scripts/check.mjs (headless validator)

**Files:**
- Create: `scripts/check.mjs`
- Test: `test/check.test.mjs`

**Interfaces:**
- Consumes: `userMap()` from `server.mjs`; `samples/packs/*.json`.
- Produces: CLI `node scripts/check.mjs [file...]` (default: all of `songs/`). Prints events for cycles 0–4, warns on unknown `s` names, exits 1 on any error or unknown sound. `export async function checkFile(file)` → `{ ok: boolean, events: string[], problems: string[] }`.

- [ ] **Step 1: Write the failing test**

`test/check.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkFile } from '../scripts/check.mjs';

const tmp = (name, code) => {
  const f = path.join(import.meta.dirname, name);
  fs.writeFileSync(f, code);
  return f;
};

test('demo song checks clean', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.deepEqual(r.problems, []);
  assert.ok(r.events.length > 8);
  assert.ok(r.events.some((l) => l.includes('"s":"bd"')));
});

test('syntax error is reported', async () => {
  const f = tmp('_t_bad.strudel', 'note("c3"');
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.ok(r.problems.length); }
  finally { fs.rmSync(f); }
});

test('unknown sound is reported', async () => {
  const f = tmp('_t_unknown.strudel', 's("definitely_not_a_sound")');
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.match(r.problems[0], /unknown sound/); }
  finally { fs.rmSync(f); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `../scripts/check.mjs`.

- [ ] **Step 3: Write scripts/check.mjs**

```js
// Headless song check: evaluates a .strudel file with strudel's node packages, prints the first 4 cycles
// of events, and flags sound names that are not in the local packs, the user folder, or the built-in synths.
// usage: node scripts/check.mjs [songs/x.strudel ...]   (default: every file in songs/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evalScope, evaluate } from '@strudel/core';
import { transpiler } from '@strudel/transpiler';
import { miniAllStrings } from '@strudel/mini';
import { userMap } from '../server.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKS = path.join(ROOT, 'samples', 'packs');
// ponytail: hardcoded synth list; registerSynthSounds needs a browser AudioContext so we can't ask it.
const SYNTHS = ['sine', 'square', 'triangle', 'sawtooth', 'sin', 'sqr', 'tri', 'saw', 'supersaw', 'pulse',
  'white', 'pink', 'brown', 'crackle', 'z_sine', 'z_sawtooth', 'z_square', 'z_triangle', 'z_tan', 'z_noise', 'bytebeat'];

let scopeReady;
const ensureScope = () => (scopeReady ??= (async () => {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'),
    { setcps: () => {}, setcpm: () => {}, setCps: () => {}, setCpm: () => {}, samples: async () => {}, hush: () => {} });
  miniAllStrings();
})());

function knownSounds() {
  const known = new Set(SYNTHS);
  if (fs.existsSync(PACKS)) {
    for (const f of fs.readdirSync(PACKS).filter((f) => f.endsWith('.json') && f !== 'packs.json' && !f.includes('alias'))) {
      for (const k of Object.keys(JSON.parse(fs.readFileSync(path.join(PACKS, f), 'utf8')))) if (k !== '_base') known.add(k);
    }
  }
  for (const k of Object.keys(userMap())) if (k !== '_base') known.add(k);
  return known;
}

export async function checkFile(file, cycles = 4) {
  await ensureScope();
  const code = fs.readFileSync(file, 'utf8');
  const problems = [];
  const events = [];
  let pattern;
  try {
    ({ pattern } = await evaluate(code, transpiler));
    if (!pattern?.queryArc) throw new Error('last expression is not a pattern');
  } catch (e) {
    return { ok: false, events, problems: [`${path.basename(file)}: ${e.message}`] };
  }
  const known = knownSounds();
  const unknown = new Set();
  for (const hap of pattern.queryArc(0, cycles)) {
    if (!hap.hasOnset()) continue;
    const v = hap.value;
    const begin = hap.whole.begin.valueOf().toFixed(3);
    const dur = (hap.whole.end.valueOf() - hap.whole.begin.valueOf()).toFixed(3);
    events.push(`${begin} +${dur} ${JSON.stringify(v)}`);
    const s = typeof v === 'object' ? v.s : undefined;
    if (s === undefined) continue;
    for (const name of String(s).split(':')[0].split(',')) {
      const bare = name.trim();
      if (!known.has(bare) && !(v.bank && known.has(`${v.bank}_${bare}`))) unknown.add(bare);
    }
  }
  for (const u of unknown) problems.push(`${path.basename(file)}: unknown sound "${u}"`);
  return { ok: problems.length === 0, events, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel')).map((f) => path.join(ROOT, 'songs', f));
  let bad = 0;
  for (const f of files) {
    const r = await checkFile(f);
    console.log(`== ${path.relative(ROOT, f)} (${r.events.length} events in 4 cycles)`);
    if (files.length === 1) console.log(r.events.join('\n'));
    for (const p of r.problems) console.error('  ' + p);
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
```

Verification note for the implementer: the shape of `hap.whole.begin` (a Fraction with `.valueOf()`) and the existence of `hap.hasOnset()` are from `@strudel/core`. If `pattern` from `evaluate` is a Promise-wrapped value, `await` it before calling `queryArc`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 7 passing. The demo test needs `uzu-drumkit` downloaded (Task 4 step 5) so `bd` is known.

- [ ] **Step 5: Run the CLI on the demo**

Run: `npm run check -- songs/demo.strudel`
Expected: a header line and event lines like `0.000 +0.500 {"s":"bd","bank":"RolandTR909"}`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/check.mjs test/check.test.mjs && git commit -m "feat: headless song checker with unknown-sound detection"
```

---

### Task 6: gen/euclid.mjs (first generator)

**Files:**
- Create: `gen/euclid.mjs`
- Test: `test/gen.test.mjs`

**Interfaces:**
- Consumes: `checkFile` from Task 5 (test only).
- Produces: CLI `node gen/euclid.mjs [--seed=N]` prints a complete song to stdout. `export function generate(seed)` → string.

- [ ] **Step 1: Write the failing test**

`test/gen.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generate } from '../gen/euclid.mjs';
import { checkFile } from '../scripts/check.mjs';

test('generate is deterministic per seed and passes check', async () => {
  assert.equal(generate(7), generate(7));
  assert.notEqual(generate(7), generate(8));
  const f = path.join(import.meta.dirname, '_t_gen.strudel');
  fs.writeFileSync(f, generate(7));
  try {
    const r = await checkFile(f);
    assert.deepEqual(r.problems, []);
    assert.ok(r.events.length > 0);
  } finally { fs.rmSync(f); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `../gen/euclid.mjs`.

- [ ] **Step 3: Write gen/euclid.mjs**

```js
// Euclidean drums + a random-scale melody. Proves the generator path; not trying to be good music yet.
// usage: node gen/euclid.mjs [--seed=N] > songs/euclid.strudel
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function generate(seed = 1) {
  let x = seed >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const bank = pick(['RolandTR808', 'RolandTR909', 'LinnDrum', 'AkaiLinn']);
  const scale = pick(['C:minor', 'D:dorian', 'E:phrygian', 'G:mixolydian', 'A:minor:pentatonic']);
  const bpm = ri(96, 132);
  const melody = Array.from({ length: 8 }, () => (rnd() < 0.2 ? '~' : ri(0, 7))).join(' ');

  return `// generated by gen/euclid.mjs --seed=${seed}  (${bpm} bpm, ${scale}, ${bank})
setcps(${(bpm / 60 / 4).toFixed(3)})
stack(
  s("bd(${ri(2, 5)},8)").bank("${bank}"),
  s("sd(${ri(1, 3)},8,${ri(0, 7)})").bank("${bank}").gain(.8),
  s("hh(${ri(4, 7)},8)").bank("${bank}").gain(.5),
  n("${melody}").scale("${scale}").s("sawtooth").lpf(1200).decay(.15).sustain(0).gain(.6)
)
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.find((a) => a.startsWith('--seed='));
  process.stdout.write(generate(arg ? Number(arg.slice(7)) : 1));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: 8 passing.

- [ ] **Step 5: Generate a song into songs/ and check it**

```bash
node gen/euclid.mjs --seed=3 > songs/euclid.strudel && npm run check -- songs/euclid.strudel
```
Expected: exit 0, events include `"s":"bd"` and `"n":` values.

- [ ] **Step 6: Commit**

```bash
git add gen/euclid.mjs test/gen.test.mjs songs/euclid.strudel && git commit -m "feat: seeded euclidean generator"
```

---

### Task 7: End-to-end proof in a real browser, README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Start the server and drive the page with Playwright**

Run `npm start` in the background. With the Playwright MCP tools: navigate to `http://localhost:3000`, click "▶ play", wait 2 seconds, read console messages. Expected: a `[strudle] evaluated demo.strudel` line, no `error` entries, and the status span lists the downloaded packs. Take a screenshot for the user.

- [ ] **Step 2: Prove live reload**

While the page is still playing, change `lpf(600)` to `lpf(1200)` in `songs/demo.strudel` from the shell. Wait 1 second, read console. Expected: a second `[strudle] evaluated demo.strudel` line. Revert the edit.

- [ ] **Step 3: Write README.md**

```markdown
# strudle

Local [Strudel](https://strudel.cc) harness: edit `songs/*.strudel`, press play in a browser, hear it. All code and samples are local.

## Setup
    npm install
    npm run samples          # one-time, downloads Strudel's default packs (~several hundred MB, resumable)
    npm start                # http://localhost:3000

## Use
- Pick a song, press ▶ (or ctrl+enter). ■ or ctrl+. stops. Save writes the textarea back to the file.
- Editing a song file on disk reloads it in the page. If it was playing, it re-evaluates so you hear the change.
- Drop your own samples in `samples/user/<sound>/*.wav` → `s("<sound>:2")` picks the third file. Loose files work too.

## Scripts
- `npm run check -- songs/x.strudel` prints the first 4 cycles of events and fails on syntax errors or unknown sound names. No args checks every song.
- `node gen/euclid.mjs --seed=3 > songs/euclid.strudel` generates a song. Generators are plain scripts that print Strudel code.
- `npm test` runs the node:test suite.

## Not local
GM soundfont instruments (`gm_*`) still stream from GitHub.
```

- [ ] **Step 4: Run the full suite one last time**

Run: `npm test && npm run check`
Expected: all tests pass, every song in `songs/` checks clean.

- [ ] **Step 5: Commit**

```bash
git add README.md && git commit -m "docs: readme"
```
