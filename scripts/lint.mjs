// Musical lint over the check's section table: the rules the song-editing skill states, so they are caught before a render.
// usage: node scripts/lint.mjs [songs/x.strudel ...]   (default: every song in songs/); exit 1 when a song has errors
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AXIS_NAMES } from '../lib/axes.mjs';
import { layerBase } from '../lib/song.mjs';
import { soundNames } from '../lib/packs.mjs';
import { checkFile, missingPackOnly } from './check.mjs';

// the check table prints a list or weights sound as its JSON; a plain name is itself; a pattern is the word "signal"
const soundsOf = (v) => { try { return soundNames(JSON.parse(v)); } catch { return [v]; } };

const DEFAULT_SOUND = { bass: 'sawtooth', melody: 'sawtooth', pad: 'sawtooth', fx: 'white' }; // what a part plays when it names no sound (lib/layers.mjs)
const SAW = new Set(['sawtooth', 'saw', 'supersaw']);
// superdough builds a DynamicsCompressorNode per hit; above this many hits a bar that is a real audio-thread cost (the dropouts of 2026-09-18 were convolvers per part, since fixed in song(): a density rule that stood in for that was dropped)
const LOAD = { compressorHits: 16 };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Findings for one checkFile result: [{ level: 'error' | 'warn', section?, text }]. A plain-Strudel file has no sections and no findings. */
export function lint({ sections, problems = [] }) {
  const out = [];
  for (const p of problems) out.push({ level: 'error', text: p });
  if (!sections?.length) return out;
  const warn = (section, text) => out.push({ level: 'warn', section, text });
  const climax = sections.filter((s) => s.role === 'climax');
  if (!climax.length) warn(null, 'no section has role climax: the arc has no peak');
  const top = Math.max(...sections.map((s) => s.energy)), peak = sections.find((s) => s.energy === top);
  if (climax.length && !climax.some((s) => s.energy === top)) warn(peak.name, `the most energetic section is ${peak.name} (${peak.energy}), not the climax (${climax.map((s) => `${s.name} ${s.energy}`).join(', ')})`); // a climax that ties the peak is the peak
  sections.forEach((s, i) => {
    const prev = sections[i - 1];
    if (prev && same(prev.layers, s.layers)) warn(s.name, `identical to ${prev.name}: same parts, same values; change something or merge them`);
    const saws = Object.entries(s.layers).filter(([l, x]) => soundsOf(x.attrs.sound ?? DEFAULT_SOUND[layerBase(l)]).some((n) => SAW.has(n))).map(([l]) => l);
    if (saws.length > 1) warn(s.name, `${saws.join(', ')}: raw saws in one section are mud, give all but one a pack instrument`);
    for (const [l, x] of Object.entries(s.layers)) {
      const base = layerBase(l);
      if ((base === 'melody' || base === 'bass') && x.attrs.notes === undefined) warn(s.name, `${l} plays the seeded line: write its notes (the hook) in mini-notation`);
      for (const a of AXIS_NAMES) if (typeof x.attrs[a] === 'number' && (x.attrs[a] < 0 || x.attrs[a] > 1)) out.push({ level: 'error', section: s.name, text: `${l}.${a} is ${x.attrs[a]}: axes take 0..1` });
      if (typeof x.attrs.level === 'number' && (x.attrs.level < 0 || x.attrs.level > 2)) warn(s.name, `${l}.level is ${x.attrs.level}: 0..2 is the useful range (1 = as built)`);
      // superdough builds a DynamicsCompressorNode per hit, not per part: on a dense kit that is dozens of live nodes a bar on the audio thread
      if (x.attrs.compressor !== undefined && x.onsetsPerCycle > LOAD.compressorHits) warn(s.name, `${l}.compressor is applied per hit (${x.onsetsPerCycle} a bar, each its own compressor node): keep it off dense parts, lower level instead`);
    }
  });
  return out;
}

// ponytail: the thresholds below are heuristics from the first measured songs; retune them from renders, not by argument.
const MIX = { headroom: 0.98, clipped: 1e-4, inaudibleDb: -30, dominantDb: -2, centre: 0.05, maskingLow: 0.5, maskingMid: 0.6, depthSpread: 0.15 }; // clipped: fraction of samples at full scale below which a peak at 1 is a transient, not a level
const FOUNDATION = (n) => ['drums', 'bass'].includes(layerBase(n)); // centre by convention: never "flat stage" material

/** Findings over a measured section (scripts/measure.mjs's json: the mix row first, then a row per part, and the masking pairs). */
export function lintMeasure({ section, parts, pairs = [] }) {
  const out = [], warn = (text) => out.push({ level: 'warn', section, text });
  const [mix, ...rows] = parts;
  if (mix?.peak >= MIX.headroom) {
    if (!(mix.clipped < MIX.clipped)) warn(`no headroom: the mix peaks at ${mix.peak} (${mix.relativeDb} dBFS)${mix.clipped ? `, ${(mix.clipped * 100).toFixed(2)}% of samples clip` : ''}; bring levels down`);
    else warn(`transients touch full scale (${(mix.clipped * 100).toFixed(3)}% of samples, ${mix.relativeDb} dBFS): a compressor on the part with the crest, not level; a master limiter is not built`);
  }
  for (const p of rows) {
    if (!Number.isFinite(p.relativeDb) || p.relativeDb < MIX.inaudibleDb) warn(`${p.name} is inaudible (${p.relativeDb} dB under the mix): raise its level or cut it`);
    else if (p.relativeDb > MIX.dominantDb && rows.length > 1 && !FOUNDATION(p.name)) warn(`${p.name} dominates (${p.relativeDb} dB under the mix): it is most of what is heard`);
  }
  const heard = rows.filter((p) => Number.isFinite(p.relativeDb) && p.relativeDb >= MIX.inaudibleDb);
  const centred = heard.filter((p) => !FOUNDATION(p.name) && Math.abs(p.meanPan - 0.5) < MIX.centre);
  if (centred.length >= 3) warn(`flat stage: ${centred.map((p) => p.name).join(', ')} all sit centre; give some a position`);
  for (const q of pairs) {
    if (q.low >= MIX.maskingLow) warn(`${q.a} and ${q.b} share the low band (masking ${q.low}): move one up (register), thin it (density), or duck it`);
    if (q.mid >= MIX.maskingMid) warn(`${q.a} and ${q.b} share the mids (masking ${q.mid}): rest where the other plays (density), an octave apart (register), darken one (brightness), or a position each`);
  }
  const deep = heard.filter((p) => p.depth !== null);
  if (deep.length >= 3) {
    const spread = (k) => Math.max(...deep.map((p) => p[k])) - Math.min(...deep.map((p) => p[k]));
    if (spread('depth') < MIX.depthSpread) {
      const same = spread('relativeDb') < 4 ? 'the same level' : spread('highRatio') < 0.03 ? 'the same brightness' : spread('tail') < 0.1 ? 'the same tail' : 'no one component apart';
      warn(`no depth contrast: ${deep.map((p) => `${p.name} ${p.depth}`).join(', ')} read at one distance (${same}); push one back (level down, brightness down, space up) or bring one forward`);
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(import.meta.dirname, '..');
  const mi = process.argv.indexOf('--measure');
  if (mi > 0) {
    const m = JSON.parse(fs.readFileSync(process.argv[mi + 1], 'utf8'));
    const findings = lintMeasure(m);
    console.log(`== ${m.song} ${m.section}: ${findings.length ? `${findings.length} warnings` : 'clean'}`);
    for (const x of findings) console.log(`  ! ${x.text}`);
    process.exit(0);
  }
  const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel')).map((f) => path.join(ROOT, 'songs', f));
  let bad = 0;
  for (const f of files) {
    const r = await checkFile(f);
    if (files.length > 1 && missingPackOnly(r)) { // as in check.mjs: scanning them all, a song whose pack is not here is skipped
      console.log(`== ${path.relative(ROOT, f)} skipped: ${r.problems[0].replace(/^[^:]+: /, '')}`);
      continue;
    }
    const findings = lint(r);
    console.log(`== ${path.relative(ROOT, f)}: ${findings.length ? `${findings.filter((x) => x.level === 'error').length} errors, ${findings.filter((x) => x.level === 'warn').length} warnings` : 'clean'}`);
    for (const x of findings) console.log(`  ${x.level === 'error' ? '✖' : '!'} ${x.section ? x.section + ': ' : ''}${x.text}`);
    if (findings.some((x) => x.level === 'error')) bad++;
  }
  process.exit(bad ? 1 : 0);
}
