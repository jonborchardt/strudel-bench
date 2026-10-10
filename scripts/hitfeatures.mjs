// Measure drum one-shots and group the ones that sound alike, so an A/B compares like with like.
// usage: node scripts/hitfeatures.mjs <voice> | --all   (writes samples/_candidates/freekit/features-<voice>.json, and with
// --all features.md: every hit of every voice as numbers and words, the table a reader picks a kit from)
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
  return { seconds: +(x.length / rate).toFixed(3), peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1), rmsDb: +(20 * Math.log10(a.rms || 1e-9)).toFixed(1), crest: a.crest, attackMs: +((a90 / rate) * 1000).toFixed(1), decayMs: +(((dec - at) / rate) * 1000).toFixed(0), centroidHz: a.centroidHz, low: a.lowRatio, high: a.highRatio, flatness: a.flatness };
}

/**
 * The group a hit belongs to, named so a person can read it: decay (tight < 150 ms, medium to 350, long past that) by
 * tone (deep: centroid under 75 Hz, mid to 110, bright above). k-means was tried first and put 34 of 43 kicks in one
 * group because two outliers (a 3 s 808, a bright boom-bap) stretched the axes; two musical axes with fixed edges read
 * better. The edges suit kicks and toms; hats and cymbals would want higher tone edges (a later voice can pass its own).
 */
export const EDGES = {
  bd: { decay: [150, 350], tone: [75, 110] }, lt: { decay: [150, 400], tone: [90, 140] }, mt: { decay: [150, 400], tone: [110, 180] }, ht: { decay: [150, 400], tone: [140, 240] },
  sd: { decay: [120, 300], tone: [900, 1800] }, cp: { decay: [120, 300], tone: [900, 1800] }, rim: { decay: [60, 200], tone: [900, 2000] }, cb: { decay: [100, 300], tone: [600, 1200] },
  hh: { decay: [60, 200], tone: [3500, 6500] }, oh: { decay: [200, 600], tone: [3500, 6500] }, rd: { decay: [300, 900], tone: [2500, 5000] }, cr: { decay: [400, 1200], tone: [2500, 5000] },
  other: { decay: [150, 400], tone: [1000, 4000] },
};
export function bucket(r, edges = EDGES.bd) {
  const d = r.decayMs < edges.decay[0] ? 'tight' : r.decayMs < edges.decay[1] ? 'medium' : 'long';
  const t = r.centroidHz < edges.tone[0] ? 'deep' : r.centroidHz < edges.tone[1] ? 'mid' : 'bright';
  return `${d} · ${t}`;
}
/** Plain words for a hit, for reading rather than listening: attack, decay, tone, weight, air, texture. */
export function words(r, edges) {
  const attack = r.attackMs < 3 ? 'click' : r.attackMs < 10 ? 'snap' : 'soft';
  const [d, t] = bucket(r, edges).split(' · ');
  const weight = r.low > .9 ? 'all low' : r.low > .6 ? 'heavy' : r.low > .25 ? 'some low' : 'no low';
  const air = r.high > .3 ? 'airy' : r.high > .08 ? 'some air' : 'dull';
  const texture = r.flatness > .35 ? 'noisy' : r.flatness > .12 ? 'mixed' : 'tonal';
  return `${d} ${t} ${attack}, ${weight}, ${air}, ${texture}`;
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
  for (const r of out) { r.group = bucket(r, edges); r.words = words(r, edges); }
  fs.writeFileSync(path.join(CAND, `features-${voice}.json`), JSON.stringify({ voice, edges, rows: out }, null, 1));
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith('hitfeatures.mjs')) {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node scripts/hitfeatures.mjs <voice> | --all'); process.exit(2); }
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
