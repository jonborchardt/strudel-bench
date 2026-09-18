// Musical lint over the check's section table: the rules the song-editing skill states, so they are caught before a render.
// usage: node scripts/lint.mjs [songs/x.strudel ...]   (default: every song in songs/); exit 1 when a song has errors
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AXIS_NAMES } from '../lib/axes.mjs';
import { layerBase } from '../lib/song.mjs';
import { checkFile, missingPackOnly } from './check.mjs';

const DEFAULT_SOUND = { bass: 'sawtooth', melody: 'sawtooth', pad: 'sawtooth', fx: 'white' }; // what a part plays when it names no sound (lib/layers.mjs)
const SAW = new Set(['sawtooth', 'saw', 'supersaw']);
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
    const saws = Object.entries(s.layers).filter(([l, x]) => SAW.has(x.attrs.sound ?? DEFAULT_SOUND[layerBase(l)])).map(([l]) => l);
    if (saws.length > 1) warn(s.name, `${saws.join(', ')}: raw saws in one section are mud, give all but one a pack instrument`);
    for (const [l, x] of Object.entries(s.layers)) {
      const base = layerBase(l);
      if ((base === 'melody' || base === 'bass') && x.attrs.notes === undefined) warn(s.name, `${l} plays the seeded line: write its notes (the hook) in mini-notation`);
      for (const a of AXIS_NAMES) if (typeof x.attrs[a] === 'number' && (x.attrs[a] < 0 || x.attrs[a] > 1)) out.push({ level: 'error', section: s.name, text: `${l}.${a} is ${x.attrs[a]}: axes take 0..1` });
      if (typeof x.attrs.level === 'number' && (x.attrs.level < 0 || x.attrs.level > 2)) warn(s.name, `${l}.level is ${x.attrs.level}: 0..2 is the useful range (1 = as built)`);
    }
  });
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(import.meta.dirname, '..');
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
