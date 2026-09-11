import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { wavToMp3 } from './scripts/mp3.mjs';

const ROOT = import.meta.dirname;
const SONGS = path.join(ROOT, 'songs');
const RENDERS = path.join(ROOT, 'renders');
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
const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (d) => (s += d)).on('end', () => resolve(s)).on('error', reject);
});

function serveStatic(res, urlPath) {
  const file = path.resolve(ROOT, '.' + decodeURIComponent(urlPath));
  const allowed = [path.join(ROOT, 'node_modules'), path.join(ROOT, 'samples'), path.join(ROOT, 'lib')];
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
    if (!file || !SONG_NAME.test(file)) return;
    for (const res of clients) res.write(`data: ${JSON.stringify({ changed: file })}\n\n`);
  });

  const server = http.createServer(async (req, res) => {
    try { await handle(req, res); }
    catch (e) { console.error(`${req.method} ${req.url}:`, e); if (!res.headersSent) send(res, 500, 'internal error'); else res.end(); }
  });

  async function handle(req, res) {
    const { pathname: p, searchParams } = new URL(req.url, 'http://x');

    if (p === '/') return send(res, 200, fs.readFileSync(path.join(ROOT, 'index.html')), 'text/html');
    if (p === '/favicon.ico') return send(res, 204, '');

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
        const timer = setTimeout(() => { if (waiters.delete(key)) reject(new Error('render timed out')); }, 60_000);
        timer.unref?.();
        waiters.set(key, { resolve, reject, timer });
      });
      for (const c of clients) c.write(`data: ${JSON.stringify({ render: { ...body, name } })}\n\n`);
      try { await done; return json(res, { path: path.join('renders', `${name}.${body.mp3 ? 'mp3' : 'wav'}`) }); }
      catch (e) { return send(res, e.status || 504, e.message); }
    }
    // dump runs in a child process: scripts/dump.mjs installs the esm-fix hook and patches strudel globals,
    // neither of which belongs in the server process.
    if (p.startsWith('/dump/') && req.method === 'POST') {
      const song = decodeURIComponent(p.slice('/dump/'.length));
      if (!SONG_NAME.test(song)) return send(res, 400, 'bad song name');
      if (!fs.existsSync(path.join(SONGS, song))) return send(res, 404, 'no such song');
      const out = await new Promise((resolve, reject) =>
        execFile(process.execPath, [path.join(ROOT, 'scripts', 'dump.mjs'), path.join(SONGS, song)], { maxBuffer: 1 << 24 },
          (err, stdout, stderr) => (err ? reject(new Error(stderr.trim().split('\n').pop() || err.message)) : resolve(stdout))))
        .catch((e) => e);
      if (out instanceof Error) return send(res, 422, out.message);
      fs.mkdirSync(RENDERS, { recursive: true });
      const file = path.join(RENDERS, `${song.replace(/\.strudel$/, '')}.dump.txt`); // .txt: it is meant to be pasted into the strudel repl
      fs.writeFileSync(file, out);
      return json(res, { path: path.relative(ROOT, file), code: out });
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
    if (p.startsWith('/renders/') && req.method === 'PUT') {
      const name = decodeURIComponent(p.slice('/renders/'.length));
      if (!/^[\w.-]+\.wav$/.test(name)) return send(res, 400, 'bad render name');
      fs.mkdirSync(RENDERS, { recursive: true });
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const file = path.join(RENDERS, name);
      fs.writeFileSync(file, Buffer.concat(chunks));
      const out = searchParams.has('mp3') ? wavToMp3(file) : file;
      const w = waiters.get(name);
      if (w) { waiters.delete(name); clearTimeout(w.timer); w.resolve(); }
      return send(res, 200, path.relative(ROOT, out));
    }

    if (p === '/samples/user/strudel.json') return json(res, userMap());
    // strudel's UMD build resolves its clock SharedWorker against the page URL, so /assets/ must alias dist/assets
    if (p.startsWith('/assets/')) return serveStatic(res, '/node_modules/@strudel/web/dist' + p);
    if (p.startsWith('/node_modules/') || p.startsWith('/samples/') || p.startsWith('/lib/')) return serveStatic(res, p);
    send(res, 404, 'not found');
  }

  server.on('close', () => watcher.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`strudle -> http://localhost:${port}`));
}
