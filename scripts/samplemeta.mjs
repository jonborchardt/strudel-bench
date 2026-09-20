// What each sample file is, measured: seconds, rms and peak (dBFS, rms over the loudest half second), written next to
// each pack map as <pack>.meta.json (samples/user/<pack>/meta.json for a local pack) and read by the check. A name says
// nothing about its take: vcsl's `anvil:0` is the pp layer at -60 dBFS and its timpani hits run 11 s, and neither shows
// until a render. Only wav files are measured; anything else is left out and the check treats it as unknown.
// usage: node scripts/samplemeta.mjs [pack ...]   (default: every pack map in samples/packs and every samples/user pack)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav } from '../lib/analyze.mjs';
import { fileList } from './samples.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKS = path.join(ROOT, 'samples', 'packs');
const USER = path.join(ROOT, 'samples', 'user');
const db = (x) => (x > 0 ? +(20 * Math.log10(x)).toFixed(1) : -Infinity);
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/** { seconds, rms, peak } of one wav file (rms over its loudest half second, so a long tail does not hide a loud hit). */
export function measureWav(buf) {
  const { rate, frames } = readWav(buf);
  const x = frames[0];
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const win = Math.min(x.length, Math.floor(rate / 2)), step = Math.max(1, Math.floor(win / 4));
  let e = 0;
  for (let i = 0; i < win; i++) e += x[i] * x[i];
  let best = e;
  for (let s = step; s + win <= x.length; s += step) { // a sliding window, moved a quarter at a time
    for (let i = s - step; i < s; i++) e -= x[i] * x[i];
    for (let i = s + win - step; i < s + win; i++) e += x[i] * x[i];
    best = Math.max(best, e);
  }
  return { seconds: +(x.length / rate).toFixed(2), rms: db(Math.sqrt(best / win)), peak: db(peak) };
}

/** Meta for every wav in a pack map: keyed by the map's own file string, so the check can look a map entry up as written. */
export function metaFor(json, dir) {
  const out = {};
  for (const f of fileList(json)) {
    const file = path.join(dir, ...String(f).split('/').map(safeDecode));
    if (!/\.wav$/i.test(file) || !fs.existsSync(file)) continue;
    try { out[f] = measureWav(fs.readFileSync(file)); } catch { /* not a wav we can read: left out */ }
  }
  return out;
}

/** The pack maps on this machine: [{ name, json, dir, out }] for samples/packs and samples/user. */
export function packMaps(only = []) {
  const maps = [];
  if (fs.existsSync(PACKS)) for (const f of fs.readdirSync(PACKS)) {
    if (!f.endsWith('.json') || f === 'packs.json' || f.includes('alias') || f.endsWith('.meta.json')) continue;
    const name = f.slice(0, -5), json = JSON.parse(fs.readFileSync(path.join(PACKS, f), 'utf8'));
    maps.push({ name, json, dir: path.join(PACKS, name), out: path.join(PACKS, `${name}.meta.json`) });
  }
  if (fs.existsSync(USER)) for (const name of fs.readdirSync(USER)) {
    const dir = path.join(USER, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const json = {}; // the same keys userPacks() builds, <pack>/<sound>/<file> or <pack>/<file>, relative to samples/user
    for (const e of fs.readdirSync(dir)) {
      const p = path.join(dir, e);
      if (fs.statSync(p).isDirectory()) json[e] = fs.readdirSync(p).filter((x) => /\.wav$/i.test(x)).map((x) => `${name}/${e}/${x}`);
      else if (/\.wav$/i.test(e)) json[e.replace(/\.wav$/i, '')] = [`${name}/${e}`];
    }
    maps.push({ name, json, dir: USER, out: path.join(dir, 'meta.json') });
  }
  return only.length ? maps.filter((m) => only.includes(m.name)) : maps;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const m of packMaps(process.argv.slice(2))) {
    const meta = metaFor(m.json, m.dir);
    fs.writeFileSync(m.out, JSON.stringify(meta));
    console.log(`${path.relative(ROOT, m.out)}: ${Object.keys(meta).length} files`);
  }
}
