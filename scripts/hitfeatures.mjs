// Measure drum one-shots and group the ones that sound alike, so an A/B compares like with like.
// usage: node scripts/hitfeatures.mjs <voice>   (writes samples/_candidates/freekit/features-<voice>.json)
// Per file: seconds, peak dB, attack ms (0 -> 90% of peak), decay ms (peak -> -30 dB), spectral centroid Hz, and the share
// of energy under 150 Hz and over 5 kHz. The candidates come from samples/_candidates/freekit/manifest.json (mapped by the
// same name rules kitpick.html uses); the references are Strudel's own takes for the voice (909, 808, uzu-drumkit).
// Grouping: named buckets on the two axes that separate kicks, decay and tone (see `bucket`), so an A/B inside a group
// compares like with like and the Strudel take sits inside its own group.
import fs from 'node:fs';
import path from 'node:path';
import { readWav, analyze } from '../lib/analyze.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), CAND = path.join(ROOT, 'samples', '_candidates', 'freekit');
const RULES = [ // kitpick.html's rules, the first match wins
  [/open|\boh\b|ohh|ohat/, 'oh'], [/closed|\bch\b|chh|hihat|hi-?hat|\bhat|\bhh\b/, 'hh'],
  [/kick|bass ?drum|\bbd\b|\bkik/, 'bd'], [/snare|\bsnr?\b|\bsd\b/, 'sd'], [/clap|\bcp\b/, 'cp'],
  [/rim|stick|cross/, 'rim'], [/cowbell|bell|bling|\bcb\b/, 'cb'], [/ride|\brd\b/, 'rd'], [/crash|cymbal|splash|china|\bcr\b/, 'cr'],
  [/floor|low ?tom|\blt\b/, 'lt'], [/hi(gh)? ?tom|rack|\bht\b/, 'ht'], [/tom|\bmt\b/, 'mt'],
];
const guess = (name) => { const n = name.toLowerCase().replace(/[_-]+/g, ' '); for (const [re, v] of RULES) if (re.test(n)) return v; return 'other'; };

export function features(buf) {
  const w = readWav(buf), x = w.frames[0], rate = w.rate;
  let peak = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > peak) { peak = Math.abs(x[i]); at = i; }
  let a90 = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) >= .9 * peak) { a90 = i; break; }
  // decay: the envelope (peak over 5 ms blocks) after the peak, the first block under -30 dB of the peak
  const blk = Math.round(rate * .005); let dec = x.length;
  for (let i = at; i + blk <= x.length; i += blk) { let m = 0; for (let j = i; j < i + blk; j++) m = Math.max(m, Math.abs(x[j])); if (m < peak * 10 ** (-30 / 20)) { dec = i; break; } }
  const a = analyze(w, { cps: .5 });
  return { seconds: +(x.length / rate).toFixed(3), peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1), attackMs: +((a90 / rate) * 1000).toFixed(1), decayMs: +(((dec - at) / rate) * 1000).toFixed(0), centroidHz: a.centroidHz, low: a.lowRatio, high: a.highRatio };
}

/**
 * The group a hit belongs to, named so a person can read it: decay (tight < 150 ms, medium to 350, long past that) by
 * tone (deep: centroid under 75 Hz, mid to 110, bright above). k-means was tried first and put 34 of 43 kicks in one
 * group because two outliers (a 3 s 808, a bright boom-bap) stretched the axes; two musical axes with fixed edges read
 * better. The edges suit kicks and toms; hats and cymbals would want higher tone edges (a later voice can pass its own).
 */
export const EDGES = { bd: { decay: [150, 350], tone: [75, 110] } };
export function bucket(r, edges = EDGES.bd) {
  const d = r.decayMs < edges.decay[0] ? 'tight' : r.decayMs < edges.decay[1] ? 'medium' : 'long';
  const t = r.centroidHz < edges.tone[0] ? 'deep' : r.centroidHz < edges.tone[1] ? 'mid' : 'bright';
  return `${d} · ${t}`;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('hitfeatures.mjs')) {
  const voice = process.argv[2];
  if (!voice) { console.error('usage: node scripts/hitfeatures.mjs <voice>'); process.exit(2); }
  const manifest = JSON.parse(fs.readFileSync(path.join(CAND, 'manifest.json'), 'utf8'));
  const rows = [];
  for (const r of manifest) if ((r.voice === 'unmapped' ? guess(r.name) : r.voice) === voice) rows.push({ kind: r.picked ? 'in kit' : 'candidate', id: r.id, label: r.name, url: `samples/_candidates/freekit/${r.file}`, file: path.join(CAND, r.file) });
  const tdm = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', 'tidal-drum-machines.json'), 'utf8')), uzu = JSON.parse(fs.readFileSync(path.join(ROOT, 'samples', 'packs', 'uzu-drumkit.json'), 'utf8'));
  for (const [kit, map, key] of [['909', tdm, `RolandTR909_${voice}`], ['808', tdm, `RolandTR808_${voice}`], ['uzu', uzu, voice]]) {
    [map[key]].flat().filter(Boolean).slice(0, 3).forEach((f, i) => rows.push({ kind: 'strudel', id: `${kit}-${i + 1}`, label: `${kit} ${voice} #${i + 1}`, url: map._base.replace(/^\//, '') + f, file: path.join(ROOT, map._base.replace(/^\//, ''), f) }));
  }
  const out = [];
  for (const r of rows) { if (!fs.existsSync(r.file)) { console.error(`missing ${r.file}`); continue; } out.push({ kind: r.kind, id: r.id, label: r.label, url: r.url, ...features(fs.readFileSync(r.file)) }); }
  const edges = EDGES[voice] ?? EDGES.bd;
  for (const r of out) r.group = bucket(r, edges);
  fs.writeFileSync(path.join(CAND, `features-${voice}.json`), JSON.stringify({ voice, edges, rows: out }, null, 1));
  // the index kitpick.html reads, so it fetches only the voices that have been measured
  fs.writeFileSync(path.join(CAND, 'features.json'), JSON.stringify({ voices: fs.readdirSync(CAND).map((f) => /^features-(\w+)\.json$/.exec(f)?.[1]).filter(Boolean) }));
  const order = ['tight · deep', 'tight · mid', 'tight · bright', 'medium · deep', 'medium · mid', 'medium · bright', 'long · deep', 'long · mid', 'long · bright'];
  for (const name of order) {
    const g = out.filter((r) => r.group === name); if (!g.length) continue;
    console.log(`${name}: ${g.length} hits, strudel: ${g.filter((r) => r.kind === 'strudel').map((r) => r.label).join(', ') || 'none'}`);
    for (const r of g) console.log(`   ${r.kind.padEnd(9)} ${r.label.padEnd(26)} ${String(r.seconds).padStart(6)} s  ${String(r.attackMs).padStart(5)} ms att  ${String(r.decayMs).padStart(5)} ms dec  ${String(r.centroidHz).padStart(5)} Hz  low ${r.low}`);
  }
}
