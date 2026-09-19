// Render a batch of short clips for the web: every entry in a manifest becomes one small mono mp3.
// usage: node scripts/snippets.mjs snippets.json [--out-dir DIR] [--force]   (PORT env overrides 3000)
//
// The page has to be open for /render to work, so start it first: `npm run headless` (or `npm start`
// and open the page). Each manifest entry is one render:
//
//   { "out": "say-darker/audio/signal-alone", "song": "arrival.strudel", "section": "signal",
//     "layer": "melody", "cycles": 2, "kbps": 64, "mono": true }
//
// `out` is the path under --out-dir, without the extension: the blog's manifests all write `<post>/audio/<name>`
// so one `--out-dir <blog>/src/content/posts` serves every manifest. A render whose peak is under 0.005 is a
// failed render, not a quiet part (the page rendered before a sample could sound, say): the wav is kept, the
// mp3 is not written, and the run stops with exit 1. `section`, `layer` and `cycles` are the
// same arguments `scripts/render.mjs` takes: omit `section` for the whole song, omit `layer` for the
// whole section. Defaults are 64 kbps mono, which is what a 4-bar clip on a blog page wants; the
// clip is skipped when it already exists, so re-running only fills the gaps (--force re-renders).
import fs from 'node:fs';
import path from 'node:path';
import { wavToMp3 } from './mp3.mjs';
import { readWav } from '../lib/analyze.mjs';

const args = process.argv.slice(2);
const opt = (k, dflt) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : dflt; };
const manifestPath = args.find((a) => a.endsWith('.json')) || 'snippets.json';
const outDir = opt('out-dir', 'renders/snippets');
const force = args.includes('--force');
const port = process.env.PORT || 3000;
const SILENT = 0.005; // peak below this is a failed render

if (!fs.existsSync(manifestPath)) { console.error(`no manifest at ${manifestPath}`); process.exit(2); }
const clips = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(clips)) { console.error(`${manifestPath}: expected an array of clips`); process.exit(2); }

let made = 0, skipped = 0;
for (const [i, clip] of clips.entries()) {
  const where = `clip ${i + 1} (${clip.out || '?'})`;
  if (!clip.out || !clip.song) { console.error(`${where}: needs "out" and "song"`); process.exit(1); }
  const mp3Path = path.join(outDir, `${clip.out}.mp3`);
  if (!force && fs.existsSync(mp3Path)) { skipped++; continue; }

  // one render per clip: the page writes renders/<name>.wav, then we encode it small
  const name = `snippet-${clip.out.replace(/[\\/]/g, '-')}`;
  const body = { song: clip.song, section: clip.section, layer: clip.layer, cycles: clip.cycles, name };
  const res = await fetch(`http://localhost:${port}/render`, { method: 'POST', body: JSON.stringify(body) }).catch(() => null);
  if (!res) { console.error(`server not running on :${port}. run: npm run headless`); process.exit(1); }
  if (!res.ok) { console.error(`${where}: ${res.status} ${await res.text()}`); process.exit(1); }

  const wav = (await res.json()).path;
  const peak = readWav(fs.readFileSync(wav)).frames.reduce((m, f) => f.reduce((n, s) => Math.max(n, Math.abs(s)), m), 0);
  if (peak < SILENT) { console.error(`${where}: silent render (peak ${peak.toFixed(4)}), kept ${wav}`); process.exit(1); }
  wavToMp3(wav, { kbps: clip.kbps ?? 64, mono: clip.mono ?? true, out: mp3Path });
  fs.unlinkSync(wav);
  console.log(`${mp3Path}  ${(fs.statSync(mp3Path).size / 1024).toFixed(0)}KB`);
  made++;
}
console.log(`${made} rendered, ${skipped} already present`);
