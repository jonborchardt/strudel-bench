// The visual score of a song: what a renderer composes from, derived from the built song (pat.strudel) and its onset
// counts and nothing else, so the check, the tests and the page see one composition. Every aesthetic choice (which
// world a mood gets, what a key's mode looks like, which drum voice is a pulse) is a table in lib/visual.json, not code.
// Imports nothing that registers layers: this module only reads what song() built.
import { S } from './strudel.mjs';
import { AXIS_NAMES } from './axes.mjs';
import { OVERLAYS } from './vocab.mjs';
import { layerBase } from './song.mjs';
import { parseProgression, chordName, modeOf } from './harmony.mjs';
import { prng, pick } from './random.mjs';
import POLICY from './visual.json' with { type: 'json' };
import KITS from './kits.json' with { type: 'json' };
export { POLICY };

const NONE = Object.freeze({ kind: 'none', voice: null, role: null, note: null });
/**
 * What one hap is, from its value alone: the fallback for patterns with no song() behind them (plain files, textures
 * stacked around a song, auditions), and the voice/note reading the tagged path uses too, so both share one table.
 * A kit voice arrives bare (bd, with a bank), indexed (sd:2) or written in full (RolandTR909_hh: superdough's
 * <kit>_<voice>, read only under a kit lib/kits.json knows, so a sample whose last word happens to be a voice name
 * stays a sample).
 */
export function classifyHap(v, policy = POLICY) {
  if (!v || typeof v !== 'object') return NONE;
  const s = v.s === undefined ? null : String(v.s).split(':')[0].split(',')[0].trim();
  const cut = s ? s.lastIndexOf('_') : -1;
  const cand = !s ? null : cut < 0 ? s : KITS[s.slice(0, cut)] ? s.slice(cut + 1) : null;
  if (cand && policy.voices[cand]) return { kind: 'drums', voice: cand, role: policy.voices[cand], note: null };
  let note = typeof v.note === 'number' ? v.note : null;
  if (typeof v.note === 'string') { try { note = S.noteToMidi?.(v.note) ?? null; } catch { note = null; } }
  if (note !== null) return { kind: 'pitched', voice: null, role: null, note };
  if (s) return { kind: 'hit', voice: null, role: 'hit', note: null };
  return NONE;
}

const num = (x) => (typeof x === 'number' ? x : null);
const r3 = (x) => +x.toFixed(3);

/** Onsets per cycle of every part in every section, by querying each layer over its bars (at most `bars` of them: the page composes a 300-bar song on the main thread): what the check computes; a host that has the numbers passes them to composeVisual instead. */
export const onsetsOf = (ir, bars = Infinity) => Object.fromEntries(ir.sections.map((s) => {
  const n = Math.min(s.cycles, bars);
  return [s.name, Object.fromEntries(Object.entries(s.layers).map(([k, l]) => [k, l.pattern.queryArc(0, n).filter((h) => h.hasOnset()).length / n]))];
}));

/** The song's mean axis values, each part's number weighted by its section's bars; a signal does not count, an axis nobody writes is the .5 baseline. */
export function meanAxes(ir) {
  const sum = {}, w = {};
  for (const s of ir.sections) for (const l of Object.values(s.layers)) for (const a of AXIS_NAMES) {
    const v = num(l.attrs[a]);
    if (v === null) continue;
    sum[a] = (sum[a] ?? 0) + v * s.cycles; w[a] = (w[a] ?? 0) + s.cycles;
  }
  return Object.fromEntries(AXIS_NAMES.map((a) => [a, w[a] ? sum[a] / w[a] : 0.5]));
}

/**
 * The overlay word (lib/overlays.json) the song leans toward: the projection of its mean axes' lean from the baseline
 * onto each overlay's direction, in axis units (how much of that mood is in the song, direction and size together),
 * the largest wins when it reaches policy.moodThreshold; else 'neutral'. A faint lean in a mood's exact direction is
 * still no mood, which a cosine alone would miss.
 */
export function moodOf(mean, policy = POLICY) {
  const d = AXIS_NAMES.map((a) => mean[a] - 0.5);
  let best = 'neutral', top = policy.moodThreshold;
  for (const [word, vec] of Object.entries(OVERLAYS)) {
    const v = AXIS_NAMES.map((a) => vec[a] ?? 0), nv = Math.hypot(...v);
    const along = nv ? d.reduce((acc, x, i) => acc + x * v[i], 0) / nv : 0;
    if (along > top) { best = word; top = along; }
  }
  return best;
}

/** One of the mood's worlds (a mood with no row takes neutral's), picked by the song's seed: the same song gets the same world, two songs of one mood need not. */
export const worldFor = (mood, seed, policy = POLICY) => pick(prng(seed), policy.moods[mood] ?? policy.moods.neutral);

/**
 * Parts in order of first appearance, each with its kind and the world slot it takes: the first of its kind's
 * preferences (policy.kinds) with capacity left in policy.worlds[world].slots; grain is unbounded and every kind ends
 * there. A drums part lists the union of the voices that sound in any section, each with its role (policy.voices).
 */
export function castOf(ir, world, policy = POLICY) {
  const left = { ...policy.worlds[world].slots }, cast = {};
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers)) {
    const kind = layerBase(name);
    if (!cast[name]) {
      const slot = (policy.kinds[kind] ?? ['grain']).find((k) => k === 'grain' || left[k] > 0) ?? 'grain';
      if (slot !== 'grain') left[slot]--;
      cast[name] = kind === 'drums' ? { kind, slot, voices: {} } : { kind, slot };
    }
    if (kind === 'drums') for (const v of l.plan?.voices ?? []) cast[name].voices[v] = policy.voices[v] ?? 'hit';
  }
  return cast;
}

/** Chord names per bar: the progression's cycles cycled over the section's bars, a bracketed bar as 'Cm Ab'. */
const chordsOf = (key, progression, bars) => {
  const prog = parseProgression(progression);
  return Array.from({ length: Math.ceil(bars) }, (_, b) => prog[b % prog.length].map((c) => chordName(key, c)).join(' '));
};

const sectionOf = (s, onsets) => {
  const parts = Object.fromEntries(Object.entries(s.layers).map(([k, l]) => [k, {
    level: num(l.attrs.level) ?? 1,
    onsets: onsets[s.name]?.[k] ?? 0,
    attrs: Object.fromEntries(AXIS_NAMES.filter((a) => l.attrs[a] !== undefined).map((a) => [a, num(l.attrs[a]) ?? 'signal'])),
    plan: l.plan,
  }]));
  const fx = Object.entries(s.layers).find(([k]) => layerBase(k) === 'fx')?.[1].plan;
  return {
    name: s.name, role: s.role ?? null, at: s.offset, until: s.offset + s.span, bars: s.cycles, cps: s.cps, key: s.key,
    chords: chordsOf(s.key, s.progression, s.cycles),
    riser: fx?.riser ?? 0, impact: fx?.impact ?? null, dropout: s.dropout, sweep: s.sweep,
    energy: Object.values(parts).reduce((n, p) => n + p.onsets * p.level, 0),
    parts,
  };
};

/**
 * The score: mood and world from the song as a whole, the palette from its mean axes, the cast from its parts, one
 * entry per section in song cycles with its energy against the loudest section, and the two names a renderer (and
 * the check's description) compare, the loudest section and the written climax. Plain data, the same on every call.
 */
export function composeVisual(ir, { onsets = onsetsOf(ir), policy = POLICY } = {}) {
  const asked = typeof ir.meta.visual === 'string' ? { world: ir.meta.visual } : ir.meta.visual ?? {}; // the song's own choice: a world name, or { world, seed }
  const mean = meanAxes(ir), mood = moodOf(mean, policy), seed = asked.seed ?? ir.meta.seed ?? 1;
  const world = asked.world && policy.worlds[asked.world] ? asked.world : worldFor(mood, seed, policy);
  const raw = ir.sections.map((s) => sectionOf(s, onsets));
  const max = Math.max(0, ...raw.map((s) => s.energy));
  const sections = raw.map((s) => ({ ...s, energy: max ? r3(s.energy / max) : 0 }));
  const peak = sections.reduce((p, s) => (p === null || s.energy > p.energy ? s : p), null)?.name ?? null;
  const climax = sections.find((s) => s.role === 'climax')?.name ?? null;
  const palette = { temperature: policy.temperature[modeOf(ir.meta.key)] ?? policy.temperature.default, ...Object.fromEntries(Object.entries(policy.palette).map(([k, a]) => [k, r3(mean[a])])) };
  return { seed, mood, world, palette, cps: ir.meta.cps, total: ir.total, meter: ir.meta.meter, key: ir.meta.key, cast: castOf(ir, world, policy), sections, peak, climax };
}

/**
 * The score as words for the check table, one clause per entry (the CLI joins them with ' · '): world (mood,
 * temperature), part → slot (drum voices with their roles), and the loudest section against the written climax,
 * a description of the arc as it is, not a rule about how it should be.
 */
export function describeVisual(score) {
  const out = [`${score.world} (${score.mood}, ${score.palette.temperature})`];
  for (const [name, c] of Object.entries(score.cast)) {
    const voices = c.voices && Object.keys(c.voices).length ? ` (${Object.entries(c.voices).map(([v, r]) => `${v} ${r}`).join(', ')})` : '';
    out.push(`${name} → ${c.slot}${voices}`);
  }
  if (score.peak) out.push(score.climax === null ? `peak ${score.peak}; no climax` : score.peak === score.climax ? `peak ${score.peak} (climax)` : `peak ${score.peak}; climax ${score.climax}`);
  return out;
}
