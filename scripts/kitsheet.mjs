// The kit audit: every drum kit on the same two bars in one render, plus a table of what each kit's files are.
// usage: node scripts/kitsheet.mjs [--render]   (PORT env; --render needs an open page: PORT=3001 npm run headless)
// Writes renders/kitsheet.md (the table, with a verdict from the objective columns, and the index: which second each
// kit starts at) and, with --render, songs/_t_kitsheet.strudel (removed after) rendered to renders/kitsheet.mp3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import KITS from '../lib/kits.json' with { type: 'json' };
import { renderVia } from './render.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const KIT_VOICES = ['bd', 'sd', 'hh', 'oh', 'rim', 'cb', 'rd', 'cr', 'cp', 'ht', 'mt', 'lt']; // the page's auditionKit grid (index.html KIT_GRIDS)
const GRIDS = { bd: 'x...x...x...x...|x...x...x...x...', sd: '....x.......x...|....x.......x...', hh: 'x.x.x.x.x.x.x.x.|................', oh: '..x...x...x...x.|..x...x...x.....', rim: '.......x.......x|.......x........', cb: '......x.......x.|......x.......x.', rd: '................|x.x.x.x.x.x.x.x.', cr: '................|x...............', cp: '................|....x.......x...', ht: '................|............x...', mt: '................|.............x..', lt: '................|..............xx' };

export const kitVoices = (map, kit) => KIT_VOICES.filter((v) => map[`${kit}_${v}`]);
export const sheetSource = (kits, map) => `// kit audit sheet, written by scripts/kitsheet.mjs\nsong({ bpm: 120, seed: 1 }, [\n${kits.map((k) => `  section('${k}', 2, { kit: '${k}', drums: { template: { ${kitVoices(map, k).map((v) => `${v}: '${GRIDS[v]}'`).join(', ')} } } }),`).join('\n')}\n])\n`;

export function kitTable(kits, map, meta, usage) {
  const range = (xs, fmt = String) => (xs.length ? (Math.min(...xs) === Math.max(...xs) ? fmt(xs[0]) : `${fmt(Math.min(...xs))}-${fmt(Math.max(...xs))}`) : '?');
  return kits.map((kit) => {
    const files = kitVoices(map, kit).flatMap((v) => map[`${kit}_${v}`]).map((f) => meta[f]).filter(Boolean);
    const num = (k) => files.map((m) => m[k]).filter((x) => typeof x === 'number');
    const rms = num('rms');
    const bitsN = files.map((m) => m.bits).filter((x) => x !== undefined).map((b) => (b === '32f' ? 32 : b));
    const float = files.some((m) => m.bits === '32f');
    const fmtBits = (b) => (float && b === 32 ? '32f' : String(b));
    const minBits = Math.min(...bitsN), minRate = Math.min(...num('rate'));
    const why = [minBits < 16 && `bits ${minBits}`, minRate < 44100 && `rate ${minRate}`].filter(Boolean).join(', ');
    return { kit, voices: kitVoices(map, kit).length, rate: range(num('rate')), bits: range(bitsN, fmtBits), seconds: files.length ? +(num('seconds').sort((a, b) => a - b)[Math.floor(files.length / 2)]).toFixed(2) : 0, rmsSpread: rms.length ? +(Math.max(...rms) - Math.min(...rms)).toFixed(0) : 0, songs: usage[kit] ?? [], verdict: why ? 'ban' : 'ok', why: why || 'bits >= 16 and rate >= 44100' };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packsDir = path.join(ROOT, 'samples', 'packs');
  const map = {}, meta = {};
  for (const f of fs.readdirSync(packsDir)) { // every pack map and its meta, keyed by the map's file strings
    if (!f.endsWith('.json') || f === 'packs.json' || f.includes('alias')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8'));
    if (f.endsWith('.meta.json')) Object.assign(meta, j); else for (const [k, v] of Object.entries(j)) if (k !== '_base') map[k] = [v].flat();
  }
  const kits = Object.keys(KITS).filter((k) => kitVoices(map, k).length);
  const usage = {};
  for (const s of fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel'))) for (const m of fs.readFileSync(path.join(ROOT, 'songs', s), 'utf8').matchAll(/kit: '(\w+)'/g)) (usage[m[1]] ??= []).push(s);
  const rows = kitTable(kits, map, meta, usage);
  let md = `# Kit audit (${new Date().toISOString().slice(0, 10)})\n\nverdict is from the objective columns only (no ear): ban = bits < 16 or rate < 44100 for any file of the kit.\n\n| kit | voices | rate | bits | median s | rms spread dB | songs | at | verdict | why |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  md += rows.map((r, i) => `| ${r.kit} | ${r.voices} | ${r.rate} | ${r.bits} | ${r.seconds} | ${r.rmsSpread} | ${r.songs.length ? r.songs.map((s) => s.replace('.strudel', '')).join(' ') : ''} | ${i * 4} s | ${r.verdict} | ${r.why} |`).join('\n') + '\n';
  fs.mkdirSync(path.join(ROOT, 'renders'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'renders', 'kitsheet.md'), md);
  console.log(md);
  if (process.argv.includes('--render')) {
    const song = path.join(ROOT, 'songs', '_t_kitsheet.strudel');
    fs.writeFileSync(song, sheetSource(kits, map));
    try { console.log(await renderVia({ song: '_t_kitsheet.strudel', name: 'kitsheet', mp3: true })); }
    finally { fs.rmSync(song, { force: true }); }
  }
}
