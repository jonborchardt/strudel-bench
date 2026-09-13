// Headless song check: evaluates a .strudel file with strudel's node packages, prints the first 4 cycles
// of events, and flags sound names that are not in the local packs, the user folder, or the built-in synths.
// usage: node scripts/check.mjs [songs/x.strudel ...]   (default: every file in songs/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { userPacks } from '../server.mjs';
import './esm-fix.mjs'; // must run before the strudel imports below are resolved, hence dynamic imports
import { parseProgression, chordNames } from '../lib/harmony.mjs';
import { packsOf, SYNTHS } from '../lib/packs.mjs';
import { describeAxes } from '../lib/vocab.mjs';
const { evalScope, evaluate } = await import('@strudel/core');
const { transpiler } = await import('@strudel/transpiler');
const { miniAllStrings } = await import('@strudel/mini');

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKS = path.join(ROOT, 'samples', 'packs');

let scopeReady;
export const ensureScope = () => (scopeReady ??= (async () => {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'),
    { setcps: () => {}, setcpm: () => {}, setCps: () => {}, setCpm: () => {}, samples: async () => {}, hush: () => {} });
  miniAllStrings();
  await import('../lib/index.mjs');
})());

/** Built-in sounds: the synths plus every downloaded/CDN pack map in samples/packs. */
function builtinSounds() {
  const known = new Set(SYNTHS);
  if (fs.existsSync(PACKS)) {
    for (const f of fs.readdirSync(PACKS).filter((f) => f.endsWith('.json') && f !== 'packs.json' && !f.includes('alias'))) {
      for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(PACKS, f), 'utf8')))) if (k !== '_base') { known.add(k); packFiles.set(k, v); }
    }
  }
  return known;
}
const packFiles = new Map(); // sound -> its map entry (a list of variant files, or {note: file} for a pitched instrument)

/**
 * What a sound name actually plays: the variant file for `name:n` (index 0 when no n), or the sampled range of a pitched
 * instrument. A name says nothing about its variants (didgeridoo:0 is a bark, :8 a sustained note), so the check prints this.
 */
export function soundFile(name, n = 0, packs = {}) {
  const entry = packFiles.get(name) ?? Object.values(packs).map((p) => p.sounds?.[name]).find(Boolean);
  if (!entry) return undefined;
  const base = (f) => decodeURIComponent(String(f).split('/').pop());
  if (Array.isArray(entry)) return `${base(entry[n % entry.length])} (${entry.length} variant${entry.length === 1 ? '' : 's'})`;
  const notes = Object.keys(entry);
  return `pitched, ${notes.length} samples ${notes[0]}..${notes.at(-1)}`;
}
/** sound -> pack for the local packs, so a sound can be traced to the pack a song must declare. */
const localSounds = (packs) => new Map(Object.entries(packs).flatMap(([p, { sounds }]) => Object.keys(sounds).map((s) => [s, p])));

/** `packs` (default: every pack in samples/user) is the local pack index to check against; the Pages build passes the deployed subset. */
export const checkFile = (file, cycles = 4, packs) => checkCode(fs.readFileSync(file, 'utf8'), file, cycles, packs);
/** Same as checkFile for a code string; `file` only names it in problem messages. */
export async function checkCode(code, file = 'code', cycles = 4, packs = userPacks()) {
  await ensureScope();
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
  cycles = pattern.strudel?.total ?? cycles;
  const known = builtinSounds();
  const local = localSounds(packs);
  const declared = packsOf(code);
  for (const p of declared) if (!packs[p]) problems.push(`${path.basename(file)}: missing pack "${p}" (declared, not in samples/user/)`);
  const unknown = new Set(), undeclared = new Map(), used = new Map();
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
      const full = v.bank && known.has(`${v.bank}_${bare}`) ? `${v.bank}_${bare}` : bare;
      const idx = v.n ?? +(String(s).split(':')[1] ?? 0);
      used.set(`${full}:${idx}`, { name: full, n: idx });
      if (known.has(full)) continue;
      const pack = local.get(bare);
      if (!pack) unknown.add(bare);
      else if (!declared.includes(pack)) undeclared.set(bare, pack);
    }
  }
  const sounds = [...used.values()].map((u) => ({ ...u, file: soundFile(u.name, u.n, packs) })).filter((u) => u.file);
  for (const u of unknown) problems.push(`${path.basename(file)}: unknown sound "${u}"`);
  for (const [s, p] of undeclared) problems.push(`${path.basename(file)}: sound "${s}" is in local pack "${p}" which the song does not declare: add packs: ['${p}']`);
  let sections;
  if (pattern.strudel) {
    sections = pattern.strudel.sections.map((s) => {
      return {
        name: s.name, cycles: s.cycles, offset: s.offset, span: s.span, role: s.role, grid: s.grid, cps: s.cps,
        harmony: `${s.key}  ${s.progression} → ${chordNames(s.key, parseProgression(s.progression))}`,
        layers: Object.fromEntries(Object.entries(s.layers).map(([k, l]) => [k, {
          attrs: Object.fromEntries(Object.entries(l.attrs).map(([a, v]) => [a,
            typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v
            : v && typeof v === 'object' && typeof v.queryArc !== 'function' ? JSON.stringify(v) : 'signal'])),
          onsetsPerCycle: +(l.pattern.queryArc(0, s.cycles).filter((h) => h.hasOnset()).length / s.cycles).toFixed(2),
          words: describeAxes(l.attrs), // the axis values read back as vocabulary words
        }])),
      };
    });
    // form: a section's energy is its onsets per cycle summed over its parts, each scaled by its level; the arc line prints them
    for (const sct of sections) sct.energy = +Object.values(sct.layers).reduce((n, l) => n + l.onsetsPerCycle * (typeof l.attrs.level === 'number' ? l.attrs.level : 1), 0).toFixed(1);
  }
  return { ok: problems.length === 0, events, problems, sections, sounds, cycles, cps: pattern.strudel?.meta.cps };
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
    if (files.length === 1 && r.sounds?.length) { // which file each sample name plays: a name says nothing about its variants
      console.log('  sounds');
      for (const u of r.sounds) console.log(`    ${`${u.name}:${u.n}`.padEnd(24)} ${u.file}`);
    }
    for (const sct of r.sections ?? []) {
      console.log(`  [${sct.offset}-${sct.offset + sct.span}) ${sct.name}${sct.role ? ' (' + sct.role + ')' : ''}`);
      console.log(`    harmony ${sct.harmony}`);
      for (const [layer, l] of Object.entries(sct.layers)) {
        const attrs = Object.entries(l.attrs).map(([a, v]) => `${a}=${v}`).join(' ');
        console.log(`    ${layer.padEnd(7)} ${String(l.onsetsPerCycle).padStart(5)}/cyc  ${attrs}${l.words.length ? `  — ${l.words.join(', ')}` : ''}`);
      }
    }
    if (r.sections?.length) { // the arc: each section's energy against the loudest, so the shape reads at a glance
      const max = Math.max(...r.sections.map((s) => s.energy), 1e-9), bar = '▁▂▃▄▅▆▇█';
      console.log(`  arc: ${r.sections.map((s) => `${s.name} ${s.energy} ${bar[Math.round((s.energy / max) * 7)]}`).join(' · ')}`);
    }
    for (const p of r.problems) console.error('  ' + p);
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
