// Download the sample packs the Strudel REPL preloads, so the page works fully offline.
// usage: node scripts/samples.mjs [pack ...]   (default: all packs below; safe to re-run, skips existing files)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// pack list lives in lib/packs.json so the page can stream the same packs from the CDN when none are downloaded
const { packs: PACKS, alias: ALIAS_URL } = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'lib', 'packs.json'), 'utf8'));
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

// some packs (vcsl) ship paths already percent-encoded, others (tidal-drum-machines) have literal spaces
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const decodePath = (rel) => rel.split('/').map(safeDecode).join('/');
const encodePath = (rel) => rel.split('/').map((seg) => encodeURIComponent(safeDecode(seg))).join('/');

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
  let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) await worker(items[i++]);
  }));
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
      const r = await download(remoteBase + encodePath(rel), path.join(dir, decodePath(rel)));
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
