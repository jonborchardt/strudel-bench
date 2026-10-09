// Turn a folder of Freesound downloads into a drum-kit user pack, keeping only what the API says is CC0.
// usage: FREESOUND_TOKEN=... node scripts/freesound.mjs <dir> <kit>
// Files in <dir> are named <voice>_<id>__<user>__<name>.wav (Freesound's own name with the voice put in front; voices:
// bd sd hh oh rim cb rd cr cp ht mt lt). Each id is looked up (GET /apiv2/sounds/<id>/); a licence other than CC0 is
// rejected and named. Writes samples/user/<kit>/<kit>_<voice>/<id>.wav, pack.json { deploy, license, source } and
// LICENSE-ASSETS.md with one row per file. Then: node scripts/samplemeta.mjs <kit>; add the kit to lib/kits.json; node scripts/kiticons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav } from '../lib/analyze.mjs';
import { writeWav } from './analyze.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const VOICES = ['bd', 'sd', 'hh', 'oh', 'rim', 'cb', 'rd', 'cr', 'cp', 'ht', 'mt', 'lt'];
const FIELDS = 'id,name,username,license,url,samplerate,bitdepth,channels,duration';

export const parseName = (file) => { const m = /^([a-z]+)_(\d+)__/.exec(file); return m && VOICES.includes(m[1]) ? { voice: m[1], id: m[2] } : null; };
export const isCc0 = (license) => /creativecommons\.org\/publicdomain\/zero|^Creative Commons 0$/i.test(String(license));

export async function importKit(dir, kit, { fetchJson, root = ROOT, peakDb = -3 } = {}) {
  if (!/^[a-z][a-z0-9]*$/.test(kit)) throw new Error('kit: lowercase letters and digits (it becomes the bank prefix)');
  const out = path.join(root, 'samples', 'user', kit), imported = [], rejected = [];
  const keep = [];
  for (const file of fs.readdirSync(dir).filter((f) => /\.(wav|flac|aif|aiff)$/i.test(f)).sort()) { // look every id up first: an API failure writes nothing
    if (peakDb != null && !/\.wav$/i.test(file)) throw new Error(`${file}: only wav can be peak-normalised (convert it, or pass --peak none)`);
    const p = parseName(file);
    if (!p) { rejected.push({ file, why: 'name must be <voice>_<id>__...' }); continue; }
    const m = await fetchJson(p.id);
    if (!m) { rejected.push({ file, why: 'not found on Freesound' }); continue; }
    if (!isCc0(m.license)) { rejected.push({ file, why: `licence ${m.license}` }); continue; }
    keep.push({ file, p, m });
  }
  for (const v of new Set(keep.map((k) => k.p.voice))) fs.rmSync(path.join(out, `${kit}_${v}`), { recursive: true, force: true }); // a re-run keeps no stale takes
  for (const { file, p, m } of keep) {
    fs.mkdirSync(path.join(out, `${kit}_${p.voice}`), { recursive: true });
    fs.copyFileSync(path.join(dir, file), path.join(out, `${kit}_${p.voice}`, `${p.id}${path.extname(file).toLowerCase()}`));
    if (peakDb != null && /\.wav$/i.test(file)) { // takes of one voice differ by up to 24 dB; a per-hit take pick would jump in level
      const dest = path.join(out, `${kit}_${p.voice}`, `${p.id}.wav`), w = readWav(fs.readFileSync(dest));
      const pk = Math.max(...w.frames.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0))), g = pk > 0 ? 10 ** (peakDb / 20) / pk : 1;
      writeWav(dest, w.rate, w.frames.map((c) => c.map((v) => v * g)));
    }
    imported.push({ voice: p.voice, id: p.id, name: m.name, username: m.username, url: m.url, ext: path.extname(file).toLowerCase() });
  }
  if (!imported.length) return { imported, rejected };
  fs.writeFileSync(path.join(out, 'pack.json'), JSON.stringify({ deploy: true, license: 'CC0-1.0', source: 'Freesound (https://freesound.org/), CC0 files only, provenance in LICENSE-ASSETS.md; imported by scripts/freesound.mjs' }, null, 1) + '\n');
  const rows = imported.map((x) => `| ${kit}_${x.voice}/${x.id}${x.ext} | ${x.name} | ${x.username} | ${x.url} | CC0 |`).join('\n');
  fs.writeFileSync(path.join(out, 'LICENSE-ASSETS.md'), `# Asset license\n\nEvery file here is CC0 1.0 (public domain dedication) on Freesound, checked through the API by id when imported.\n${peakDb != null ? `Modified: peak-normalised to ${peakDb} dBFS at import (16-bit wav); otherwise the originals.\n` : ''}No attribution is required; the provenance is kept so the check can be repeated.\n\n| file | title | uploader | source | licence |\n|---|---|---|---|---|\n${rows}\n`);
  return { imported, rejected };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pi = process.argv.indexOf('--peak'), peakDb = pi > 0 ? (/^(null|none)$/i.test(process.argv[pi + 1]) ? null : Number(process.argv[pi + 1])) : -3;
  const [dir, kit] = process.argv.slice(2).filter((a, i, v) => a !== '--peak' && v[i - 1] !== '--peak'), token = process.env.FREESOUND_TOKEN;
  if (!dir || !kit) { console.error('usage: FREESOUND_TOKEN=... node scripts/freesound.mjs <dir> <kit>'); process.exit(2); }
  if (!token) { console.error('set FREESOUND_TOKEN (https://freesound.org/apiv2/apply/)'); process.exit(2); }
  const fetchJson = async (id) => { const r = await fetch(`https://freesound.org/apiv2/sounds/${id}/?token=${token}&fields=${FIELDS}`); if (r.status === 404) return null; if (!r.ok) throw new Error(`Freesound API ${r.status} for sound ${id} (Retry-After: ${r.headers.get('retry-after') ?? 'none'})`); return r.json(); };
  const { imported, rejected } = await importKit(dir, kit, { fetchJson, peakDb });
  for (const x of imported) console.log(`+ ${kit}_${x.voice}/${x.id}  ${x.name} (${x.username})`);
  for (const x of rejected) console.log(`- ${x.file}: ${x.why}`);
  console.log(`${imported.length} imported, ${rejected.length} rejected. next: node scripts/samplemeta.mjs ${kit}; add "${kit}" to lib/kits.json; node scripts/kiticons.mjs`);
}
