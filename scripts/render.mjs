// Ask the open page to render a song (or a section / layer) offline and save renders/<name>.wav
// usage: node scripts/render.mjs songs/x.strudel [--section s] [--layer l] [--cycles n] [--name out] [--port 3000] [--mp3]
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a) => a.endsWith('.strudel'));
if (!file) { console.error('usage: node scripts/render.mjs songs/x.strudel [--section s] [--layer l] [--cycles n] [--name out]'); process.exit(2); }
const body = { song: path.basename(file), section: opt('section'), layer: opt('layer'), cycles: opt('cycles') ? Number(opt('cycles')) : undefined, name: opt('name'), mp3: args.includes('--mp3') };
const port = opt('port') || process.env.PORT || 3000;
const res = await fetch(`http://localhost:${port}/render`, { method: 'POST', body: JSON.stringify(body) }).catch(() => null);
if (!res) { console.error(`server not running on :${port}. run: npm start`); process.exit(1); }
if (!res.ok) { console.error(`${res.status}: ${await res.text()}`); process.exit(1); }
console.log((await res.json()).path);
