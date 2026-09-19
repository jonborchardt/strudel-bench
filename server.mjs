import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wavToMp3 } from './scripts/mp3.mjs';
import { DEF_KEYS } from './lib/packs.mjs';

const ROOT = import.meta.dirname;
const SONGS = path.join(ROOT, 'songs');
const RENDERS = path.join(ROOT, 'renders');
const USER = path.join(ROOT, 'samples', 'user');
const SONG_NAME = /^[\w.-]+\.strudel$/;
const SONG_FILE = /^[\w.-]+\.(strudel|notes\.json)$/; // a song and its provenance metadata (why it sounds this way) live side by side
// an imported sample: <pack>/<sound>.<audio ext>, or the pack's policy file; one folder deep, so the regex is the path check
const SAMPLE_FILE = /^[\w-]+\/(?:[\w-]+\.(?:wav|mp3|ogg|flac|aif|aiff|m4a|webm)|pack\.json)$/i;
const AUDIO = new Set(['.wav', '.mp3', '.ogg', '.flac', '.aif', '.aiff', '.m4a', '.webm']);
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.aif': 'audio/aiff', '.aiff': 'audio/aiff', '.m4a': 'audio/mp4', '.webm': 'audio/webm', '.strudel': 'text/plain',
};

export const songList = () => fs.readdirSync(SONGS).filter((f) => SONG_NAME.test(f)).sort();
// a song with a `// @hidden` comment line stays off the song dropdown (songs/index.json) but still loads by url, checks and ships
export const isUnlisted = (src) => /^\s*\/\/\s*@hidden\b/m.test(src);
export const listedSongs = () => songList().filter((f) => !isUnlisted(fs.readFileSync(path.join(SONGS, f), 'utf8')));
const isAudio = (f) => AUDIO.has(path.extname(f).toLowerCase());

/**
 * Local sample packs: each folder samples/user/<pack>/ is one pack, inside it a subfolder is a sound with variants
 * and a loose audio file a single-variant sound. `<pack>/pack.json` carries the deployment policy
 * (`{ deploy: true | false | ['sound', ...], license, source }`); without one the pack is local-only.
 * Returns `{ <pack>: { sounds: { name: [paths relative to samples/user/] }, deploy, license, source } }`.
 */
export function userPacks() {
  const packs = {};
  if (!fs.existsSync(USER)) return packs;
  for (const p of fs.readdirSync(USER, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const dir = path.join(USER, p);
    const sounds = {};
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        const files = fs.readdirSync(path.join(dir, e.name)).filter(isAudio).sort();
        if (files.length) sounds[e.name] = files.map((f) => `${p}/${e.name}/${f}`);
      } else if (isAudio(e.name)) {
        sounds[path.parse(e.name).name] = [`${p}/${e.name}`];
      }
    }
    // named sample definitions (a region of a pack sound, read as bars/slices): bad ones are reported, never thrown, so one typo does not break the index
    const samples = {}, problems = [];
    // the file itself gets the same treatment. every caller of userPacks() -- the packs route, the checker, dump and
    // the pages build -- depends on it parsing, so unparseable json is one pack's problem, not the whole index's
    const metaFile = path.join(dir, 'pack.json');
    let meta = {};
    if (fs.existsSync(metaFile)) {
      try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); }
      catch (e) { problems.push(`${p}/pack.json: not valid json (${e.message})`); }
    }
    for (const [name, def] of Object.entries(meta.samples ?? {})) {
      // a name that is not a plain word, and the three that would land on the object itself (__proto__ sets the prototype
      // instead of a key, so the definition would silently vanish): reported, not dropped
      if (!/^[\w-]+$/.test(name) || ['__proto__', 'constructor', 'prototype'].includes(name)) { problems.push(`${p}/pack.json samples.${name}: not a legal name (letters, digits, - and _ only)`); continue; }
      if (!def || typeof def !== 'object' || Array.isArray(def)) { problems.push(`${p}/pack.json samples.${name}: not an object`); continue; }
      const bad = Object.keys(def).find((k) => !DEF_KEYS.includes(k));
      if (bad) { problems.push(`${p}/pack.json samples.${name}: unknown key "${bad}" (known: ${DEF_KEYS.join(', ')})`); continue; }
      const sound = def.sound ?? name;
      if (!Object.hasOwn(sounds, sound)) { problems.push(`${p}/pack.json samples.${name}: sound "${sound}" is not in the pack`); continue; }
      samples[name] = def;
    }
    packs[p] = { sounds, samples, problems, deploy: meta.deploy ?? false, license: meta.license, source: meta.source };
  }
  return packs;
}
/** One Strudel sample map over every sound in `packs` (default: all local packs), the shape `samples()` loads. */
export const userMap = (packs = userPacks()) => Object.assign({ _base: '/samples/user/' }, ...Object.values(packs).map((p) => p.sounds));

const send = (res, status, body, type = 'text/plain') => {
  res.writeHead(status, { 'content-type': type });
  res.end(body);
};
const json = (res, obj) => send(res, 200, JSON.stringify(obj), 'application/json');
const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (d) => (s += d)).on('end', () => resolve(s)).on('error', reject);
});

function serveStatic(res, urlPath) {
  const file = path.resolve(ROOT, '.' + decodeURIComponent(urlPath));
  const allowed = [path.join(ROOT, 'node_modules'), path.join(ROOT, 'samples'), path.join(ROOT, 'lib'), path.join(ROOT, 'web')];
  if (!allowed.some((d) => file.startsWith(d + path.sep)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export function createServer() {
  const clients = new Set();
  const waiters = new Map();
  fs.mkdirSync(SONGS, { recursive: true });
  const watcher = fs.watch(SONGS, (_ev, file) => {
    if (!file || !SONG_FILE.test(file)) return;
    for (const res of clients) res.write(`data: ${JSON.stringify({ changed: file })}\n\n`);
  });

  const server = http.createServer(async (req, res) => {
    try { await handle(req, res); }
    catch (e) { console.error(`${req.method} ${req.url}:`, e); if (!res.headersSent) send(res, 500, 'internal error'); else res.end(); }
  });

  async function handle(req, res) {
    const { pathname: p, searchParams } = new URL(req.url, 'http://x');

    const page = p === '/' ? 'index.html' : p.slice(1); // the html pages at the root: index, examples, about, legal, 404
    if (/^[\w-]+\.html$/.test(page) && fs.existsSync(path.join(ROOT, page))) return send(res, 200, fs.readFileSync(path.join(ROOT, page)), 'text/html');
    if (p === '/favicon.ico') return send(res, 204, '');

    if (p === '/songs/index.json') return json(res, listedSongs()); // same path the static pages build writes
    if (p.startsWith('/songs/')) {
      const name = decodeURIComponent(p.slice('/songs/'.length));
      if (!SONG_FILE.test(name)) return send(res, 400, 'bad song name');
      const file = path.join(SONGS, name);
      if (req.method === 'PUT') {
        fs.writeFileSync(file, await readBody(req));
        return send(res, 204, '');
      }
      if (!fs.existsSync(file)) return send(res, 404, 'no such song');
      return send(res, 200, fs.readFileSync(file), name.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8');
    }

    if (p === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write('\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (p === '/render' && req.method === 'POST') {
      if (!clients.size) return send(res, 409, 'no page connected: open http://localhost:3000 first');
      let body;
      try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return send(res, 400, 'bad json'); }
      if (typeof body.song !== 'string' || !body.song) return send(res, 400, 'song required');
      if (!SONG_NAME.test(body.song)) return send(res, 400, 'bad song name');
      const name = (body.name || `${body.song.replace(/\.strudel$/, '')}${body.section ? '.' + body.section : ''}${body.layer ? '.' + body.layer : ''}`).replace(/[^\w.-]/g, '_');
      const key = `${name}.wav`;
      if (waiters.has(key)) return send(res, 409, `render "${name}" already pending`);
      const done = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { if (waiters.delete(key)) reject(new Error('render timed out')); }, 900_000);
        timer.unref?.();
        waiters.set(key, { resolve, reject, timer });
      });
      for (const c of clients) c.write(`data: ${JSON.stringify({ render: { ...body, name } })}\n\n`);
      try { await done; return json(res, { path: path.join('renders', `${name}.${body.mp3 ? 'mp3' : 'wav'}`) }); }
      catch (e) { return send(res, e.status || 504, e.message); }
    }
    if (p === '/render-error' && req.method === 'POST') {
      let body;
      try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return send(res, 400, 'bad json'); }
      const { name, message } = body;
      if (name) {
        const w = waiters.get(`${name}.wav`);
        if (w) { waiters.delete(`${name}.wav`); clearTimeout(w.timer); w.reject(Object.assign(new Error(message), { status: 409 })); }
      }
      return send(res, 204, '');
    }
    // wav from a render job (?mp3 converts it too); mp3 and .txt (expanded strudel) come ready-made from the page's export buttons
    if (p.startsWith('/renders/') && req.method === 'PUT') {
      const name = decodeURIComponent(p.slice('/renders/'.length));
      if (!/^[\w.-]+\.(wav|mp3|txt)$/.test(name)) return send(res, 400, 'bad render name');
      fs.mkdirSync(RENDERS, { recursive: true });
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const file = path.join(RENDERS, name);
      fs.writeFileSync(file, Buffer.concat(chunks));
      const out = searchParams.has('mp3') && name.endsWith('.wav') ? wavToMp3(file) : file;
      const w = waiters.get(name);
      if (w) { waiters.delete(name); clearTimeout(w.timer); w.resolve(); }
      return send(res, 200, path.relative(ROOT, out));
    }

    // the Compose page's sample import: the file lands in samples/user/<pack>/ where userPacks() scans it, so the map,
    // the checker's pack rule and the Pages deploy policy apply to it like to any hand-copied sample
    if (p.startsWith('/samples/user/') && req.method === 'PUT') {
      const name = decodeURIComponent(p.slice('/samples/user/'.length));
      if (!SAMPLE_FILE.test(name)) return send(res, 400, 'bad sample name: <pack>/<sound>.<wav|mp3|ogg|flac|aif|aiff|m4a|webm> or <pack>/pack.json');
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      // SAMPLE_FILE is case-insensitive, so this guard has to be too: on a case-insensitive filesystem PACK.JSON
      // otherwise skips validation and lands on the real pack.json, which every reader of userPacks() then chokes on
      if (/pack\.json$/i.test(name)) { try { JSON.parse(body.toString()); } catch { return send(res, 400, 'pack.json must be json'); } }
      const file = path.join(USER, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, body);
      return send(res, 204, '');
    }
    if (p === '/samples/user/strudel.json') return json(res, userMap());
    if (p === '/samples/user/packs.json') return json(res, userPacks()); // the pack index: what the page shows as deployed / local-only
    // strudel's UMD build resolves its clock SharedWorker against the page URL, so /assets/ must alias dist/assets
    if (p.startsWith('/assets/')) return serveStatic(res, '/node_modules/@strudel/web/dist' + p);
    if (p.startsWith('/node_modules/') || p.startsWith('/samples/') || p.startsWith('/lib/') || p.startsWith('/web/')) return serveStatic(res, p);
    // anything else a browser navigates to gets the same 404 page github pages serves; fetches keep the plain text
    if (req.headers.accept?.includes('text/html')) return send(res, 404, fs.readFileSync(path.join(ROOT, '404.html')), 'text/html');
    send(res, 404, 'not found');
  }

  server.on('close', () => watcher.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, '127.0.0.1', () => console.log(`strudel-bench -> http://localhost:${port}`));
}
