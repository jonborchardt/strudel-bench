// Headless song check: evaluates a .strudel file with strudel's node packages, prints the first 4 cycles
// of events, and flags sound names that are not in the local packs, the user folder, or the built-in synths.
// usage: node scripts/check.mjs [songs/x.strudel ...]   (default: every file in songs/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { userMap } from '../server.mjs';
import './esm-fix.mjs'; // must run before the strudel imports below are resolved, hence dynamic imports
const { evalScope, evaluate } = await import('@strudel/core');
const { transpiler } = await import('@strudel/transpiler');
const { miniAllStrings } = await import('@strudel/mini');

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKS = path.join(ROOT, 'samples', 'packs');
// ponytail: hardcoded synth list; registerSynthSounds needs a browser AudioContext so we can't ask it.
const SYNTHS = ['sine', 'square', 'triangle', 'sawtooth', 'sin', 'sqr', 'tri', 'saw', 'supersaw', 'pulse',
  'white', 'pink', 'brown', 'crackle', 'z_sine', 'z_sawtooth', 'z_square', 'z_triangle', 'z_tan', 'z_noise', 'bytebeat'];

let scopeReady;
const ensureScope = () => (scopeReady ??= (async () => {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'),
    { setcps: () => {}, setcpm: () => {}, setCps: () => {}, setCpm: () => {}, samples: async () => {}, hush: () => {} });
  miniAllStrings();
  await import('../lib/index.mjs');
})());

function knownSounds() {
  const known = new Set(SYNTHS);
  if (fs.existsSync(PACKS)) {
    for (const f of fs.readdirSync(PACKS).filter((f) => f.endsWith('.json') && f !== 'packs.json' && !f.includes('alias'))) {
      for (const k of Object.keys(JSON.parse(fs.readFileSync(path.join(PACKS, f), 'utf8')))) if (k !== '_base') known.add(k);
    }
  }
  for (const k of Object.keys(userMap())) if (k !== '_base') known.add(k);
  return known;
}

export async function checkFile(file, cycles = 4) {
  await ensureScope();
  const code = fs.readFileSync(file, 'utf8');
  const problems = [];
  const events = [];
  let pattern;
  try {
    ({ pattern } = await evaluate(code, transpiler));
    pattern = await pattern;
    if (!pattern?.queryArc) throw new Error('last expression is not a pattern');
  } catch (e) {
    return { ok: false, events, problems: [`${path.basename(file)}: ${e.message}`], cycles };
  }
  cycles = pattern.strudle?.total ?? cycles;
  const known = knownSounds();
  const unknown = new Set();
  const haps = pattern.queryArc(0, cycles).filter((h) => h.hasOnset())
    .sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf());
  for (const hap of haps) {
    const v = hap.value;
    const begin = hap.whole.begin.valueOf().toFixed(3);
    const dur = (hap.whole.end.valueOf() - hap.whole.begin.valueOf()).toFixed(3);
    events.push(`${begin} +${dur} ${JSON.stringify(v)}`);
    const s = typeof v === 'object' && v !== null ? v.s : undefined;
    if (s === undefined) continue;
    for (const name of String(s).split(':')[0].split(',')) {
      const bare = name.trim();
      if (!known.has(bare) && !(v.bank && known.has(`${v.bank}_${bare}`))) unknown.add(bare);
    }
  }
  for (const u of unknown) problems.push(`${path.basename(file)}: unknown sound "${u}"`);
  let sections;
  if (pattern.strudle) {
    sections = pattern.strudle.sections.map((s) => ({
      name: s.name, cycles: s.cycles, offset: s.offset, role: s.role,
      layers: Object.fromEntries(Object.entries(s.layers).map(([k, l]) => [k, {
        attrs: Object.fromEntries(Object.entries(l.attrs).map(([a, v]) => [a, typeof v === 'number' || typeof v === 'string' ? v : `signal`])),
        onsetsPerCycle: +(l.pattern.queryArc(0, s.cycles).filter((h) => h.hasOnset()).length / s.cycles).toFixed(2),
      }])),
    }));
  }
  return { ok: problems.length === 0, events, problems, sections, cycles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel')).map((f) => path.join(ROOT, 'songs', f));
  let bad = 0;
  for (const f of files) {
    const r = await checkFile(f);
    console.log(`== ${path.relative(ROOT, f)} (${r.events.length} events in ${r.cycles} cycles)`);
    if (files.length === 1) console.log(r.events.join('\n'));
    for (const sct of r.sections ?? []) {
      console.log(`  [${sct.offset}-${sct.offset + sct.cycles}) ${sct.name}${sct.role ? ' (' + sct.role + ')' : ''}`);
      for (const [layer, l] of Object.entries(sct.layers)) {
        const attrs = Object.entries(l.attrs).map(([a, v]) => `${a}=${v}`).join(' ');
        console.log(`    ${layer.padEnd(7)} ${String(l.onsetsPerCycle).padStart(5)}/cyc  ${attrs}`);
      }
    }
    for (const p of r.problems) console.error('  ' + p);
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
