// Measure drum one-shots and group the ones that sound alike, so an A/B compares like with like.
// usage: node scripts/hitfeatures.mjs <voice> | --all   (writes samples/_candidates/freekit/features-<voice>.json, and with
// --all features.md: every hit of every voice as numbers and words, the table a reader picks a kit from)
// Per file: seconds, peak dB, attack ms (0 -> 90% of peak), decay ms (peak -> -30 dB), spectral centroid Hz, and the share
// of energy under 150 Hz and over 5 kHz. The candidates come from samples/_candidates/freekit/manifest.json (mapped by the
// same name rules kitpick.html uses); the references are Strudel's own takes for the voice (909, 808, uzu-drumkit).
// Grouping: named buckets on decay and tone (lib/hitwords.mjs: EDGES, bucket, words), so an A/B inside a group compares
// like with like and the Strudel take sits inside its own group.
import fs from 'node:fs';
import path from 'node:path';
import { readWav, analyze } from '../lib/analyze.mjs';
import { EDGES, guessVoice as guess, bucket, words, hitFeatures } from '../lib/hitwords.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), CAND = path.join(ROOT, 'samples', '_candidates', 'freekit');
export function features(buf) {
  const w = readWav(buf), x = w.frames[0], rate = w.rate;
  let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const a = analyze(w, { cps: .5 });
  return { seconds: +(x.length / rate).toFixed(3), peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1), rmsDb: +(20 * Math.log10(a.rms || 1e-9)).toFixed(1), ...hitFeatures(w) };
}

const VOICES = ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cb', 'rd', 'cr', 'ht', 'mt', 'lt', 'other'];
function measureVoice(voice, manifest) {
  const rows = [];
  for (const r of manifest) if ((r.voice === 'unmapped' ? guess(r.name) : r.voice) === voice) rows.push({ kind: r.picked ? 'in kit' : 'candidate', id: r.id, label: r.name, url: `samples/_candidates/freekit/${r.file}`, file: path.join(CAND, r.file) });
  const tdm = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', 'tidal-drum-machines.json'), 'utf8')), uzu = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', 'uzu-drumkit.json'), 'utf8'));
  for (const [kit, map, key] of [['909', tdm, `RolandTR909_${voice}`], ['808', tdm, `RolandTR808_${voice}`], ['uzu', uzu, voice]]) {
    [map[key]].flat().filter(Boolean).slice(0, 3).forEach((f, i) => rows.push({ kind: 'strudel', id: `${kit}-${i + 1}`, label: `${kit} ${voice} #${i + 1}`, url: map._base.replace(/^\//, '') + f, file: path.join(ROOT, map._base.replace(/^\//, ''), f) }));
  }
  const out = [];
  for (const r of rows) { if (!fs.existsSync(r.file)) { console.error(`missing ${r.file}`); continue; } out.push({ kind: r.kind, id: r.id, label: r.label, url: r.url, ...features(fs.readFileSync(r.file)) }); }
  const edges = EDGES[voice] ?? EDGES.other;
  for (const r of out) { r.group = bucket(r, edges); r.words = words(r, voice); }
  fs.writeFileSync(path.join(CAND, `features-${voice}.json`), JSON.stringify({ voice, edges, rows: out }, null, 1));
  return out;
}

// --dir <folder> [--label <name>]: every wav under the folder, its voice guessed from the sound name in the folder's
// strudel.json (else the path) and the file name with lib/hitwords.mjs's rules. Non-wav files are listed, not measured (readWav is wav only).
// Writes samples/_candidates/features-<label>.md and .json.
function measureDir(argv) {
  const at = (f) => (argv.indexOf(f) > 0 ? argv[argv.indexOf(f) + 1] : null);
  const dir = path.resolve(at('--dir')), label = at('--label') ?? path.basename(dir), outDir = path.join(ROOT, 'samples', '_candidates');
  const soundOf = new Map(); // relative file -> sound name in the map
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'strudel.json'), 'utf8').replace(/^﻿/, ''));
    const walk = (v, k) => { if (typeof v === 'string') soundOf.set(decodeURIComponent(v).replace(/^\/+/, ''), k); else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x, k); };
    for (const [k, v] of Object.entries(m)) if (!k.startsWith('_')) walk(v, k);
  } catch { /* no map: the path names the sound */ }
  const files = [];
  (function ls(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? ls(path.join(d, e.name)) : files.push(path.join(d, e.name)); })(dir);
  const rows = [], skipped = [], bad = [];
  for (const f of files) {
    const rel = path.relative(dir, f).split(path.sep).join('/');
    if (rel === 'strudel.json') continue;
    if (!/\.wav$/i.test(f)) { skipped.push(rel); continue; }
    const sound = soundOf.get(rel) ?? path.dirname(rel);
    const voice = [guess(sound), guess(path.basename(rel, path.extname(rel)))].find((v) => v !== 'other') ?? 'other';
    try { rows.push({ kind: label, id: rel, label: rel, sound, voice, ...features(fs.readFileSync(f)) }); } catch (e) { bad.push(`${rel} (${e.message})`); }
  }
  for (const r of rows) { r.group = bucket(r, EDGES[r.voice]); r.words = words(r, r.voice); }
  fs.writeFileSync(path.join(outDir, `features-${label}.json`), JSON.stringify({ label, notMeasured: skipped, unreadable: bad, rows }, null, 1));
  const exts = [...new Set(skipped.map((s) => path.extname(s).toLowerCase()))].join(' ');
  const md = [`# ${label}, measured`, '', `${rows.length} wavs measured; ${skipped.length} non-wav not measured${exts ? ` (${exts})` : ''}; ${bad.length} unreadable. Columns as in features.md.`, ''];
  const order = ['tight · deep', 'tight · mid', 'tight · bright', 'medium · deep', 'medium · mid', 'medium · bright', 'long · deep', 'long · mid', 'long · bright'];
  for (const voice of VOICES) {
    const vr = rows.filter((r) => r.voice === voice); if (!vr.length) continue;
    md.push(`## ${voice} (${vr.length})`, '', '| kind | id | name | group | words | s | att | dec | Hz | low | high | flat | rms |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const g of order) for (const r of vr.filter((x) => x.group === g)) md.push(`| ${[r.kind, r.id, r.label, r.group, r.words, r.seconds, r.attackMs, r.decayMs, r.centroidHz, r.low, r.high, r.flatness, r.rmsDb].join(' | ')} |`);
    md.push('');
  }
  if (skipped.length) md.push('## not measured', '', ...skipped.map((s) => `- ${s}`), '');
  if (bad.length) md.push('## unreadable', '', ...bad.map((s) => `- ${s}`), '');
  fs.writeFileSync(path.join(outDir, `features-${label}.md`), md.join('\n'));
  console.log(`${label}: ${rows.length} measured, ${skipped.length} not wav, ${bad.length} unreadable`);
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('hitfeatures.mjs')) {
  const arg = process.argv[2];
  if (arg === '--dir') { measureDir(process.argv); process.exit(0); }
  if (!arg) { console.error('usage: node scripts/hitfeatures.mjs <voice> | --all | --dir <folder> [--label <name>]'); process.exit(2); }
  const manifest = JSON.parse(fs.readFileSync(path.join(CAND, 'manifest.json'), 'utf8'));
  const voices = arg === '--all' ? VOICES : [arg];
  const md = ['# Drum one-shots, measured', '', 'Every candidate from the Figure Drum Kits downloads and the Strudel takes for each voice (909, 808, uzu-drumkit), as numbers and words.',
    'length s · attack ms (to 90% of peak) · decay ms (peak to −30 dB) · centroid Hz · low = share of energy under 150 Hz · high = share over 5 kHz · flat = spectral flatness (0 tonal, 1 noise) · rms dBFS of the file.',
    'Words: decay (tight/medium/long) tone (deep/mid/bright) attack (click/snap/soft), weight, air, texture; the edges differ per voice (in each features-<voice>.json).', ''];
  const order = ['tight · deep', 'tight · mid', 'tight · bright', 'medium · deep', 'medium · mid', 'medium · bright', 'long · deep', 'long · mid', 'long · bright'];
  for (const voice of voices) {
    const out = measureVoice(voice, manifest);
    md.push(`## ${voice} (${out.length})`, '', '| kind | id | name | group | words | s | att | dec | Hz | low | high | flat | rms |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const name of order) for (const r of out.filter((x) => x.group === name)) md.push(`| ${r.kind} | ${r.id} | ${r.label} | ${r.group} | ${r.words} | ${r.seconds} | ${r.attackMs} | ${r.decayMs} | ${r.centroidHz} | ${r.low} | ${r.high} | ${r.flatness} | ${r.rmsDb} |`);
    md.push('');
    console.log(`${voice}: ${out.length} hits in ${new Set(out.map((r) => r.group)).size} groups`);
  }
  // the index kitpick.html reads, so it fetches only the voices that have been measured
  fs.writeFileSync(path.join(CAND, 'features.json'), JSON.stringify({ voices: fs.readdirSync(CAND).map((f) => /^features-(\w+)\.json$/.exec(f)?.[1]).filter(Boolean) }));
  if (arg === '--all') { fs.writeFileSync(path.join(CAND, 'features.md'), md.join('\n')); console.log(`wrote ${path.relative(ROOT, path.join(CAND, 'features.md'))}`); }
}
