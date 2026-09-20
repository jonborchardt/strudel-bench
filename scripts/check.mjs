// Headless song check: evaluates a .strudel file with strudel's node packages, prints the first 4 cycles
// of events, and flags sound names that are not in the local packs, the user folder, or the built-in synths.
// usage: node scripts/check.mjs [songs/x.strudel ...]   (default: every file in songs/)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { userPacks } from '../server.mjs';
import './esm-fix.mjs'; // must run before the strudel imports below are resolved, hence dynamic imports
import { parseProgression, chordNames } from '../lib/harmony.mjs';
import { packsOf, registerSamples, SAMPLE_PROBLEMS, SYNTHS } from '../lib/packs.mjs';
import { describeAxes } from '../lib/vocab.mjs';
const { evalScope, evaluate } = await import('@strudel/core');
const { transpiler } = await import('@strudel/transpiler');
const { miniAllStrings } = await import('@strudel/mini');

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKS = path.join(ROOT, 'samples', 'packs');
const USER = path.join(ROOT, 'samples', 'user');
const WORKLETS = ['coarse', 'crush', 'shape', 'distort']; // superdough builds an AudioWorkletNode per hit for each of these
// the audio thread's load from one hit: it lives for its length (in cycles at `cps`) plus its release, as a chain of ~8 audio
// nodes; each worklet effect on it is a JavaScript processor run every quantum and counts as one voice more. A sample hit
// with no `clip` plays its file to the end (superdough), so its length is the file's, not the hap's: strata's timpani kit at
// four beats a bar stacked ~30 of its 11 s takes while the hap lengths said 6, and the audio thread traced at 110%.
const load = (h, cycles, cps, meta) => {
  const v = h.value, worklets = WORKLETS.filter((k) => v[k] !== undefined).length;
  const file = v.clip === undefined && meta?.seconds ? meta.seconds * (typeof v.end === 'number' ? v.end - (v.begin ?? 0) : 1) / Math.max(Math.abs(v.speed ?? 1), 1e-3) : 0;
  return (1 + worklets) * (Math.max(cycles, file * cps) + (v.release ?? 0) * cps);
};

let scopeReady;
export const ensureScope = () => (scopeReady ??= (async () => {
  await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'),
    { setcps: () => {}, setcpm: () => {}, setCps: () => {}, setCpm: () => {}, samples: async () => {}, hush: () => {} });
  miniAllStrings();
  await import('../lib/index.mjs');
})());

/**
 * The evaluated song's resolved attrs per section and layer (what the page's mixer reads as `effective()`), so the
 * resolver can edit a spread layer on the CLI as it does on the page; undefined when `code` is not a song().
 */
export async function effectiveOf(code) {
  await ensureScope();
  registerSamples(userPacks());
  const pattern = await (await evaluate(code, transpiler)).pattern;
  return pattern?.strudel && Object.fromEntries(pattern.strudel.sections.map((s) => [s.name, Object.fromEntries(Object.entries(s.layers).map(([l, x]) => [l, x.attrs]))]));
}

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
let fileMeta = new Map(); // file (as the map entry spells it) -> { seconds, rms, peak } from the packs' meta files (scripts/samplemeta.mjs)

/** The measured samples: every <pack>.meta.json in samples/packs plus meta.json in each local pack. Absent files just leave a sound unmeasured. */
function loadMeta(packs) {
  fileMeta = new Map();
  const files = fs.existsSync(PACKS) ? fs.readdirSync(PACKS).filter((f) => f.endsWith('.meta.json')).map((f) => path.join(PACKS, f)) : [];
  for (const p of Object.keys(packs)) files.push(path.join(USER, p, 'meta.json'));
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) fileMeta.set(k, v);
  }
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : undefined; };

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
/**
 * How long and how loud that is: { seconds, rms, peak } of the variant file, or the median over a pitched instrument's
 * files (superdough picks the file nearest the note; the takes of one instrument are alike). Undefined when unmeasured.
 */
export function soundMeta(name, n = 0, packs = {}) {
  const entry = packFiles.get(name) ?? Object.values(packs).map((p) => p.sounds?.[name]).find(Boolean);
  if (!entry) return undefined;
  if (Array.isArray(entry)) return fileMeta.get(entry[n % entry.length]);
  const ms = Object.values(entry).map((f) => fileMeta.get(f)).filter(Boolean);
  return ms.length ? { seconds: median(ms.map((m) => m.seconds)), rms: median(ms.map((m) => m.rms)), peak: median(ms.map((m) => m.peak)) } : undefined;
}
/** sound -> pack for the local packs, so a sound can be traced to the pack a song must declare. */
const localSounds = (packs) => new Map(Object.entries(packs).flatMap(([p, { sounds }]) => Object.keys(sounds).map((s) => [s, p])));

/** `packs` (default: every pack in samples/user) is the local pack index to check against; the Pages build passes the deployed subset. */
export const checkFile = (file, cycles = 4, packs) => checkCode(fs.readFileSync(file, 'utf8'), file, cycles, packs);
/** Same as checkFile for a code string; `file` only names it in problem messages. */
export async function checkCode(code, file = 'code', cycles = 4, packs = userPacks()) {
  await ensureScope();
  registerSamples(packs); // a song's sample part may name a definition from a pack; samplePlan resolves it through the registry
  const problems = [];
  const events = [];
  const declared = packsOf(code);
  // A declared pack that is not on this machine is the cause of everything downstream, not a peer of it: the
  // definitions it supplies vanish, so a sample part falls back to one slice and its pattern's indices go out of
  // range. Checked before evaluating, and reported alone, so the message names the pack rather than the symptom.
  const absent = declared.filter((p) => !packs[p]);
  if (absent.length) return { ok: false, events, cycles, problems: absent.map((p) => `${path.basename(file)}: missing pack "${p}" (declared, not in samples/user/)`) };
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
  loadMeta(packs);
  // the sound a hap plays as superdough resolves it (the bank-prefixed name when the kit has it, else the bare name) and its take
  const soundOf = (v) => {
    if (typeof v !== 'object' || v === null || v.s === undefined) return null;
    const bare = String(v.s).split(':')[0].split(',')[0].trim();
    return { name: v.bank && known.has(`${v.bank}_${bare}`) ? `${v.bank}_${bare}` : bare, n: v.n ?? +(String(v.s).split(':')[1] ?? 0) };
  };
  const metaOf = (h) => { const u = soundOf(h.value); return u && soundMeta(u.name, u.n, packs); };
  // a bad sample definition in a pack the song declares, and a definition of that pack another pack's name took
  for (const p of declared)
    for (const bad of [...(packs[p].problems ?? []), ...SAMPLE_PROBLEMS.filter((b) => b.startsWith(`samples/user/${p}/`))]) problems.push(`${path.basename(file)}: ${bad}`);
  const unknown = new Set(), undeclared = new Map(), used = new Map();
  const haps = pattern.queryArc(0, cycles).filter((h) => h.hasOnset())
    .sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf());
  for (const hap of haps) {
    const v = hap.value;
    const begin = hap.whole.begin.valueOf().toFixed(3);
    const dur = (hap.whole.end.valueOf() - hap.whole.begin.valueOf()).toFixed(3);
    events.push(`${begin} +${dur} ${JSON.stringify(v)}`);
    // room.ir names a sample like s() does (superdough resolves it through the same sound map), so it goes through the same rule
    const names = typeof v === 'object' && v !== null ? [...(v.s === undefined ? [] : String(v.s).split(':')[0].split(',')), ...(typeof v.ir === 'string' ? [v.ir] : [])] : [];
    for (const name of names) {
      const bare = name.trim();
      const full = v.bank && known.has(`${v.bank}_${bare}`) ? `${v.bank}_${bare}` : bare;
      const idx = bare === v.ir ? 0 : v.n ?? +(String(v.s).split(':')[1] ?? 0);
      used.set(`${full}:${idx}`, { name: full, n: idx });
      if (known.has(full)) continue;
      const pack = local.get(bare);
      if (!pack) unknown.add(bare);
      else if (!declared.includes(pack)) undeclared.set(bare, pack);
    }
  }
  const sounds = [...used.values()].map((u) => ({ ...u, file: soundFile(u.name, u.n, packs), ...soundMeta(u.name, u.n, packs) })).filter((u) => u.file);
  for (const u of unknown) problems.push(`${path.basename(file)}: unknown sound "${u}"`);
  for (const [s, p] of undeclared) problems.push(`${path.basename(file)}: sound "${s}" is in local pack "${p}" which the song does not declare: add packs: ['${p}']`);
  let sections;
  if (pattern.strudel) {
    sections = pattern.strudel.sections.map((s) => {
      return {
        name: s.name, cycles: s.cycles, offset: s.offset, span: s.span, role: s.role, grid: s.grid, cps: s.cps,
        harmony: `${s.key}  ${s.progression} → ${chordNames(s.key, parseProgression(s.progression))}`,
        layers: Object.fromEntries(Object.entries(s.layers).map(([k, l]) => {
          const lh = l.pattern.queryArc(0, s.cycles).filter((h) => h.hasOnset());
          return [k, {
            attrs: Object.fromEntries(Object.entries(l.attrs).map(([a, v]) => [a,
              typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v
              : v && typeof v === 'object' && typeof v.queryArc !== 'function' ? JSON.stringify(v) : 'signal'])),
            onsetsPerCycle: +(lh.length / s.cycles).toFixed(2),
            // voices sounding at once, on average (`load`: the audio thread's load; a section near 50 crackled on a laptop, see lint)
            voices: +(lh.reduce((n, h) => n + load(h, h.duration.valueOf(), s.cps, metaOf(h)), 0) / s.cycles).toFixed(1),
            // what the part plays, measured (seconds, rms, peak from the meta files), and its lowest note: the lint's static audibility
            sounds: [...new Map(lh.map((h) => soundOf(h.value)).filter(Boolean).map((u) => [`${u.name}:${u.n}`, { ...u, ...soundMeta(u.name, u.n, packs) }])).values()],
            minNote: lh.reduce((m, h) => (typeof h.value.note === 'number' && h.value.note < m ? h.value.note : m), Infinity),
            words: describeAxes(l.attrs), // the axis values read back as vocabulary words
          }];
        })),
      };
    });
    // form: a section's energy is its onsets per cycle summed over its parts, each scaled by its level; the arc line prints them
    for (const sct of sections) {
      sct.energy = +Object.values(sct.layers).reduce((n, l) => n + l.onsetsPerCycle * (typeof l.attrs.level === 'number' ? l.attrs.level : 1), 0).toFixed(1);
      const parts = Object.values(sct.layers).reduce((n, l) => n + l.voices, 0);
      // the whole pattern over the section's window too, so a stack() of textures around the song() (songs/machine.strudel)
      // is counted: machine's chorus3 read 22 from its parts alone and scratched, ~46 with its textures and distortion counted
      const whole = haps.filter((h) => h.whole.begin.valueOf() >= sct.offset && h.whole.begin.valueOf() < sct.offset + sct.span)
        .reduce((n, h) => n + load(h, h.duration.valueOf() * sct.cycles / sct.span, sct.cps, metaOf(h)), 0) / sct.cycles;
      sct.outside = +Math.max(0, whole - parts).toFixed(0); // voices outside the parts (a stack around the song)
      sct.voices = +(parts + sct.outside).toFixed(0);
    }
    formLetters(sections).forEach((f, i) => { sections[i].form = f; });
  }
  return { ok: problems.length === 0, events, problems, sections, sounds, cycles, cps: pattern.strudel?.meta.cps };
}

/**
 * Form letters: sections with the same set of sounding parts share a letter (A, B, ...), so the arc reads as ABAB or
 * through-composed at a glance; a prime marks one whose energy differs from that letter's first section by more than a
 * fifth of the loudest section's (the same parts, but a lift or a breakdown).
 */
export function formLetters(sections) {
  const max = Math.max(...sections.map((s) => s.energy), 1e-9), seen = new Map();
  return sections.map((s) => {
    const sig = Object.entries(s.layers).filter(([, l]) => l.onsetsPerCycle > 0).map(([k]) => k).sort().join(' ');
    if (!seen.has(sig)) seen.set(sig, { letter: String.fromCharCode(65 + seen.size), energy: s.energy });
    const f = seen.get(sig);
    return f.letter + (Math.abs(s.energy - f.energy) > max / 5 ? "'" : '');
  });
}

/**
 * Is the only thing wrong with this result that a pack the song declares is not on this machine? A local-only pack
 * (one whose licence keeps it off the repo, say) cannot be checked where it does not exist, and that is not the
 * song's fault. Scanning every song skips these; naming one explicitly still fails, because you asked for that song.
 */
export const missingPackOnly = (r) => r.problems.length > 0 && r.problems.every((p) => /missing pack "[^"]+" \(declared, not in samples\/user\/\)/.test(p));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel')).map((f) => path.join(ROOT, 'songs', f));
  let bad = 0;
  for (const f of files) {
    const r = await checkFile(f);
    if (files.length > 1 && missingPackOnly(r)) { // scanning them all: a song whose pack is not here is skipped, not failed
      console.log(`== ${path.relative(ROOT, f)} skipped: ${r.problems[0].replace(/^[^:]+: /, '')}`);
      continue;
    }
    console.log(`== ${path.relative(ROOT, f)} (${r.events.length} events in ${r.cycles} cycles)`);
    if (files.length === 1) console.log(r.events.join('\n'));
    if (files.length === 1 && r.sounds?.length) { // which file each sample name plays: a name says nothing about its variants
      console.log('  sounds');
      for (const u of r.sounds) console.log(`    ${`${u.name}:${u.n}`.padEnd(24)} ${u.file}${u.seconds !== undefined ? `  ${u.seconds} s, rms ${u.rms} dB, peak ${u.peak} dB` : ''}`);
    }
    for (const sct of r.sections ?? []) {
      console.log(`  [${sct.offset}-${sct.offset + sct.span}) ${sct.name}${sct.role ? ' (' + sct.role + ')' : ''}  ~${sct.voices} voices at once${sct.outside ? ` (${sct.outside} outside the parts)` : ''}`);
      console.log(`    harmony ${sct.harmony}`);
      for (const [layer, l] of Object.entries(sct.layers)) {
        const attrs = Object.entries(l.attrs).map(([a, v]) => `${a}=${v}`).join(' ');
        console.log(`    ${layer.padEnd(7)} ${String(l.onsetsPerCycle).padStart(5)}/cyc  ${attrs}${l.words.length ? `  — ${l.words.join(', ')}` : ''}`);
      }
    }
    if (r.sections?.length) { // the arc: each section's energy against the loudest, so the shape reads at a glance
      const max = Math.max(...r.sections.map((s) => s.energy), 1e-9), bar = '▁▂▃▄▅▆▇█';
      console.log(`  arc: ${r.sections.map((s) => `${s.name} ${s.energy} ${bar[Math.round((s.energy / max) * 7)]} ${s.form}`).join(' · ')}`);
    }
    for (const p of r.problems) console.error('  ' + p);
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
