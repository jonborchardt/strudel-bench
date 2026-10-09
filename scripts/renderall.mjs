// Render every song into renders/<tag>/ (a wav, optionally an mp3, and an analysis json each) through the open page,
// and compare two tags. usage: node scripts/renderall.mjs <tag> [song.strudel ...] [--mp3]   (PORT env; a page must be
// open: PORT=3001 npm run headless)   |   node scripts/renderall.mjs --compare <tagA> <tagB>
// Resumable: a song with both wav and json under the tag is skipped (a wav alone is only analyzed). A render of silence means the page died (memory:
// silent renders), so it is retried once and then reported, never recorded.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderVia } from './render.mjs';
import { songList } from '../server.mjs';
import { readWav, analyze } from '../lib/analyze.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), RENDERS = path.join(ROOT, 'renders');
export const KEYS = ['rms', 'peak', 'crest', 'centroidHz', 'highRatio', 'lowRatio', 'width', 'tail'];
const db = (x) => 20 * Math.log10(x || 1e-9);

/** true when every sample of the wav in `buf` is zero: the page rendered nothing. */
export const silent = (buf) => readWav(buf).frames.every((ch) => ch.every((x) => x === 0));

/** Per-song deltas b - a of KEYS (dB for rms and peak), for the songs both tags have. */
export function compareTable(a, b) {
  return Object.keys(a).filter((s) => b[s]).map((s) => ({
    song: s,
    rmsDb: +(db(b[s].rms) - db(a[s].rms)).toFixed(1),
    peakDb: +(db(b[s].peak) - db(a[s].peak)).toFixed(1),
    ...Object.fromEntries(KEYS.slice(2).map((k) => [k, +(b[s][k] - a[s][k]).toFixed(3)])),
  }));
}

/** The header tempo as cps, for the analyzer's cycle grid: `cps: a / b`, `cps: NAME` (a const above), bpm over 4/4, setcps, or .5. */
export function cpsOf(src) {
  const ratio = (a, b) => (b ? +a / +b : +a);
  let m = /\bcps:\s*([\d.]+)(?:\s*\/\s*([\d.]+))?/.exec(src);
  if (m) return ratio(m[1], m[2]);
  m = /\bcps:\s*([A-Za-z_]\w*)/.exec(src);
  if (m) { const c = new RegExp('\\b(?:const|let|var)\\s+' + m[1] + '\\s*=\\s*([\\d.]+)(?:\\s*/\\s*([\\d.]+))?').exec(src); if (c) return ratio(c[1], c[2]); }
  m = /\bbpm:\s*([\d.]+)/.exec(src);
  if (m) return +m[1] / 240;
  m = /\bsetcps\(\s*([\d.]+)/.exec(src);
  return m ? +m[1] : .5;
}

/** Wav and json are both needed to call a song done; a wav alone only lacks its analysis. */
function record(dir, base, song) {
  const out = path.join(dir, `${base}.wav`);
  const a = analyze(readWav(fs.readFileSync(out)), { cps: cpsOf(fs.readFileSync(path.join(ROOT, 'songs', song), 'utf8')) });
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(a, null, 1));
  console.log(`${base}: rms ${a.rms} peak ${a.peak} centroid ${a.centroidHz} Hz`);
}

export async function renderAll(tag, songs, { port = process.env.PORT || 3000, mp3 = false } = {}) {
  const dir = path.join(RENDERS, tag); fs.mkdirSync(dir, { recursive: true });
  const failed = [];
  for (const song of songs) {
    const base = song.replace(/\.strudel$/, ''), out = path.join(dir, `${base}.wav`);
    if (fs.existsSync(out)) {
      if (fs.existsSync(path.join(dir, `${base}.json`))) console.log(`${base}: have`); else record(dir, base, song);
      continue;
    }
    let wav = null;
    for (let attempt = 0; attempt < 2 && !wav; attempt++) {
      let got;
      try { got = path.join(ROOT, (await renderVia({ song, name: `${tag}-${base}`, mp3 }, port)).replace(/\.mp3$/, '.wav')); }
      catch (e) {
        if (/server not running/.test(e.message)) throw e; // a dead server would cost a timeout per song
        console.log(`${base}: ${e.message}`); continue;
      }
      if (silent(fs.readFileSync(got))) { console.log(`${base}: silent render, retrying`); fs.rmSync(got, { force: true }); fs.rmSync(got.replace(/\.wav$/, '.mp3'), { force: true }); continue; }
      wav = got;
    }
    if (!wav) { failed.push(base); console.log(`${base}: FAILED: relaunch the headless page and re-run`); continue; }
    fs.renameSync(wav, out);
    const m = wav.replace(/\.wav$/, '.mp3');
    if (fs.existsSync(m)) fs.renameSync(m, path.join(dir, `${base}.mp3`));
    // the page PUTs its mp3 after the job resolves, so a late file can land in renders/ after the move
    fs.rmSync(wav, { force: true }); fs.rmSync(m, { force: true });
    record(dir, base, song);
  }
  return failed;
}

export const loadTag = (tag) => {
  const dir = path.join(RENDERS, tag);
  if (!fs.existsSync(dir)) { console.error(`no renders/${tag}/`); process.exit(1); }
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] === '--compare') {
    const rows = compareTable(loadTag(args[1]), loadTag(args[2]));
    const cols = ['song', 'rmsDb', 'peakDb', ...KEYS.slice(2)];
    console.log(cols.map((c) => c.padStart(c === 'song' ? 28 : 11)).join(''));
    for (const r of rows) console.log(cols.map((c) => String(r[c]).padStart(c === 'song' ? 28 : 11)).join(''));
    const mean = (k) => +(rows.reduce((s, r) => s + r[k], 0) / (rows.length || 1)).toFixed(2);
    console.log(['mean', ...cols.slice(1).map(mean)].map((c, i) => String(c).padStart(i ? 11 : 28)).join(''));
    process.exit(0);
  }
  const mp3 = args.includes('--mp3'), tag = args.find((a) => !a.startsWith('--') && !a.endsWith('.strudel'));
  if (!tag || !/^[\w.-]+$/.test(tag)) { console.error('usage: node scripts/renderall.mjs <tag> [song.strudel ...] [--mp3] | --compare a b'); process.exit(2); }
  const only = args.filter((a) => a.endsWith('.strudel')).map((a) => path.basename(a));
  const failed = await renderAll(tag, only.length ? only : songList(), { mp3 });
  if (failed.length) { console.error(`failed: ${failed.join(', ')}`); process.exit(1); }
}
