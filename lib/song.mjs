import { S } from './strudel.mjs';
import { AXIS_NAMES } from './axes.mjs';
import { parseProgression, chordPatterns, DEFAULT_PROGRESSION } from './harmony.mjs';
import VISUAL from './visual.json' with { type: 'json' }; // the worlds a song's `visual` key may name

export function parseMeter(text = '4/4') {
  const m = /^(\d+)\/(4|8|16)$/.exec(String(text));
  if (!m || +m[1] < 1) throw new Error(`meter must look like 4/4, 3/4, 6/8 or 7/8, got ${JSON.stringify(text)}`);
  const [beats, den] = [+m[1], +m[2]];
  return { steps: beats * 16 / den, pulse: 16 / den, beats };
}

const layers = new Map();
// every layer that carries material also takes `level`; a layer registered without a materials list
// (ad-hoc test/experiment layers) takes axis names only.
const MIX_KEYS = ['level', 'position', 'duck', 'duckDepth', 'duckAttack', 'velocity', 'humanize', 'compressor']; // the mix material every part takes (lib/song.mjs applies them after the layer builds)
export const registerLayer = (name, fn, { materials } = {}) => {
  const material = materials ? [...materials, ...MIX_KEYS] : []; // a part that generates lines lists `seed` itself
  layers.set(name, { fn, material, keys: new Set([...AXIS_NAMES, ...material]) });
};
export const layerNames = () => [...layers.keys()];
/** Sections end to end over `total` song cycles: [span, pattern.fast(cycles)] plays `cycles` bars in `span` song-cycles, so a section can carry its own tempo. `patternOf` picks what each section plays (the page's solo/mute). */
export const arrange = (sections, total, patternOf = (s) => s.pattern) => S.stepcat(...sections.map((s) => [s.span, patternOf(s).fast(s.cycles)])).slow(total);
export const layerMaterial = (name) => layers.get(name)?.material ?? []; // the non-axis keys a layer takes (level included)
/** `drums2` is a second drums layer: the layer a section key builds with is the key minus a trailing number. */
export const layerBase = (key) => key.replace(/\d+$/, '');

/** 1 for the last `n` bars of a section of `cycles` bars, 0 before, at eighth-bar resolution so a fractional section (2.5 bars) still gets its tail (the fx riser's mask, dropout and sweep). */
export const tailMask = (cycles, n) => { const slices = Math.ceil(cycles * 8); return S.sequence(...Array.from({ length: slices }, (_, i) => (i / 8 >= cycles - n ? 1 : 0))).slow(slices / 8); };

export function section(name, cycles, spec = {}) {
  if (typeof name !== 'string' || !(cycles > 0)) throw new Error('section(name, cycles, spec)');
  return { name, cycles, spec };
}

// ---------- mix material, applied in song() after a layer builds ----------
const numIn = (where, k, v, lo, hi) => { if (!(typeof v === 'number' && v >= lo && v <= hi)) throw new Error(`${where}: ${k} must be a number in ${lo}..${hi}, got ${JSON.stringify(v)}`); return v; };
const onlyKeys = (where, k, obj, keys) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${where}: ${k} must be an object { ${keys.join(', ')} }`);
  const bad = Object.keys(obj).filter((x) => !keys.includes(x));
  if (bad.length) throw new Error(`${where}: ${k} takes ${keys.join(', ')}, not ${bad.join(', ')}`);
};
/** position -1..1 (0 centre) shifts each hap's pan (.5 when the part sets none) by position/2, so a drum kit's voice spread moves together. */
function withPosition(p, position, where) {
  if (position === undefined || numIn(where, 'position', position, -1, 1) === 0) return p;
  return p.withValue(Function(`return (v) => ({ ...v, pan: Math.min(1, Math.max(0, (v.pan ?? 0.5) + ${position / 2})) })`)()); // compiled from source, so the dump prints it with the number inlined
}
/** velocity: a mini string of per-step multipliers over one bar ('.8 1 .9 1', '<[...] [...]>' for two), superdough's velocity, under gain and the grid's accents. */
function withVelocity(p, velocity, where) {
  if (velocity === undefined) return p;
  // no `~`: a rest in the velocity pattern drops the notes under it (the note keeps only the steps velocity has a value for); write 1 instead
  if (typeof velocity === 'string') { if (!/^[\d.\s<>\[\]@*!]+$/.test(velocity) || !/\d/.test(velocity)) throw new Error(`${where}: velocity must be a mini string of numbers (no ~: a rest drops the notes under it, write 1), got ${JSON.stringify(velocity)}`); return p.velocity(S.mini(velocity)); }
  if (typeof velocity?.queryArc === 'function') return p.velocity(velocity);
  throw new Error(`${where}: velocity must be a mini string of numbers, got ${JSON.stringify(velocity)}`);
}
/**
 * humanize: a played feel that is correlated, not dice per hit (that is organicness). Three seeded curves of time, one each
 * for timing (seconds, ± timingMs), gain (± velocity) and note length (± length): a slow wave over `correlation` bars
 * ('bar', 'phrase' = 4, or a bar count), a fixed lean per beat position inside the bar, and a little residual, so a hit
 * leans the same way on every play and neighbours lean together.
 */
function withHumanize(p, h, seed, beats, cps, where) {
  if (h === undefined) return p;
  onlyKeys(where, 'humanize', h, ['timingMs', 'velocity', 'length', 'correlation']);
  const { timingMs = 0, velocity = 0, length = 0, correlation = 'bar' } = h;
  numIn(where, 'humanize.timingMs', timingMs, 0, 200); numIn(where, 'humanize.velocity', velocity, 0, 1); numIn(where, 'humanize.length', length, 0, 1);
  const per = correlation === 'phrase' ? 4 : correlation === 'bar' ? 1 : correlation;
  numIn(where, 'humanize.correlation', per, 0.25, 64);
  const ph = (k) => +(((Math.imul(seed | 0, 2654435761) + k * 40503) >>> 0) / 2 ** 32 * 6.2832).toFixed(3);
  // compiled from source so the dump prints the curve with its numbers inlined and no closure variables
  const src = (amt, k) => `(t) => ${amt} * (0.5 * Math.sin(2 * Math.PI * t / ${per} + ${ph(k)}) + 0.3 * Math.sin(2 * Math.PI * (t % 1) * ${beats} + ${ph(k + 1)}) + 0.2 * ((Math.sin(t * 127.1 + ${ph(k + 2)}) * 43758.5453) % 1))`;
  const curve = (amt, k) => S.signal(Function(`return ${src(amt, k)}`)());
  // timing moves the hap itself (whole and part) in cycles, so every output honours it and the check table shows it;
  // superdough's `nudge` is read by its sampler only, a synth part would not move at all. Late only (0..timingMs): a hit
  // moved before its grid point can land before a render's start, or before the offline scheduler's window, and is dropped
  if (timingMs) p = p.withHap(Function(`return (h) => { const d = (${src(timingMs / 2000 * cps, 1)})((h.whole ?? h.part).begin.valueOf()) + ${timingMs / 2000 * cps}; return h.withSpan((s) => s.withTime((t) => t.add(d))); }`)());
  if (velocity) p = p.mul(S.gain(curve(velocity, 4).add(1)));
  // length scales a clip the part already has; a sample with none plays to its end, and writing a clip onto it would cut it at its step
  if (length) p = p.withHap(Function(`return (h) => h.value?.clip === undefined ? h : h.withValue((v) => ({ ...v, clip: v.clip * (1 + (${src(length, 7)})((h.whole ?? h.part).begin.valueOf())) }))`)());
  return p;
}
/** compressor: superdough's per-part DynamicsCompressorNode, { threshold (dBFS), ratio, knee, attack, release }; the bounds are the AudioParam ranges Web Audio clamps to silently. */
const COMP_BOUNDS = { threshold: [-100, 0], ratio: [1, 20], knee: [0, 40], attack: [0, 1], release: [0, 1] };
function withCompressor(p, c, where) {
  if (c === undefined) return p;
  onlyKeys(where, 'compressor', c, ['threshold', 'ratio', 'knee', 'attack', 'release']);
  const tuple = { threshold: c.threshold, ratio: 4, knee: 10, attack: .003, release: .05, ...c };
  for (const [k, v] of Object.entries(tuple)) numIn(where, `compressor.${k}`, v, ...COMP_BOUNDS[k]);
  const { threshold, ratio, knee, attack, release } = tuple;
  // numbers straight in (the ':' string form goes through the mini parser, which has no exponent notation), one control call each (an object through .set() dumps as /*pattern*/)
  return p.compressor(threshold).compressorRatio(ratio).compressorKnee(knee).compressorAttack(attack).compressorRelease(release);
}
/**
 * room: one reverb character for every part (song key, a section may override): superdough's per-orbit reverb settings.
 * A part's `space` stays its send. `size` is the decay time in seconds; `fade` is seconds of ramp on the reverb's own
 * head (superdough's `roomfade` scales the impulse's first samples up from zero), which softens an attack the way a
 * pre-delay would without actually delaying it. A real pre-delay is an `ir` whose head is silent; `irbegin` reads that
 * file from a fraction in, so one impulse serves several pre-delays. `size` truncates the impulse, it never stretches it.
 */
const ROOM_KEYS = { size: ['roomsize', 0.05, 60], fade: ['roomfade', 0, 10], damping: ['roomlp', 0, 20000], dimension: ['roomdim', 0, 20000], ir: ['ir'], irbegin: ['irbegin', 0, 1] }; // control name and bounds (irbegin is a fraction of the file: superdough wraps anything past 1 to the file's start)
function withRoom(p, room, where) {
  if (room === undefined) return p;
  onlyKeys(where, 'room', room, Object.keys(ROOM_KEYS));
  if (room.irbegin !== undefined && room.ir === undefined) throw new Error(`${where}: room.irbegin only means something with room.ir`);
  if (room.ir !== undefined && typeof room.ir !== 'string') throw new Error(`${where}: room.ir must be a sample name`);
  for (const [k, v] of Object.entries(room)) if (k !== 'ir') numIn(where, `room.${k}`, v, ROOM_KEYS[k][1], ROOM_KEYS[k][2]);
  return Object.entries(room).reduce((q, [k, v]) => q[ROOM_KEYS[k][0]](v), p); // one control call per key: a `.set({...})` would be one wrapper, but the dump prints an object-valued pattern as /*pattern*/ and the expanded Strudel goes silent
}

/**
 * Which parts may share a superdough orbit. Reverb and delay live on the orbit, so two parts on one orbit must want the
 * same reverb: under a `room` every part does; otherwise a layer's space cell maps one `space` number to one size, so the
 * same layer kind at the same space value does. A part that is ducked needs a bus of its own (the duck dips the whole
 * orbit), a raw part sets whatever it likes, and a space signal changes size per hap: those get a private orbit (null).
 * Sends (`room`, `delay` amounts) are per hap, so parts sharing a bus still keep their own amounts.
 */
const SEND_ONLY = new Set(['bass', 'melody']); // their space cells set the send (and the melody's delay amount), never the room's size: any of them share superdough's default reverb
export const orbitKey = (layer, attrs, room) => {
  const base = layerBase(layer);
  if (attrs.duck !== undefined || base === 'raw') return null;
  if (room?.size !== undefined) return 'room'; // one room per section, and its size is every part's size: one bus
  // a room without a size sets the same fade/damping on every part but leaves each part's own size, so the buses still split by size
  const prefix = room !== undefined ? 'room:' : '';
  if (SEND_ONLY.has(base)) return prefix + 'default';
  const space = attrs.space ?? 0.5;
  return typeof space === 'number' ? `${prefix}${base}:${space}` : null;
};

export const META_KEYS = ['cps', 'bpm', 'meter', 'key', 'seed', 'kit', 'packs', 'room', 'visual'];
export function song(meta = {}, sections = []) {
  for (const k of Object.keys(meta)) if (!META_KEYS.includes(k)) throw new Error(`unknown song key "${k}" (known: ${META_KEYS.join(', ')})`);
  if (meta.packs !== undefined && !(Array.isArray(meta.packs) && meta.packs.every((p) => typeof p === 'string'))) throw new Error(`packs must list sample pack names, e.g. packs: ['mine']`);
  // the stage's world for this song, as a name or { world, seed } (seed: the visual identity's own, the song's otherwise); unwritten, the score picks one by mood and seed
  if (meta.visual !== undefined) {
    const v = typeof meta.visual === 'string' ? { world: meta.visual } : meta.visual;
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`visual must be a world name or { world, seed }, got ${JSON.stringify(meta.visual)}`);
    for (const k of Object.keys(v)) if (k !== 'world' && k !== 'seed') throw new Error(`visual takes world and seed, not ${k}`);
    if (v.world !== undefined && !VISUAL.worlds[v.world]) throw new Error(`visual must name a world: ${Object.keys(VISUAL.worlds).join(', ')} (got ${JSON.stringify(v.world)})`);
    if (v.seed !== undefined && typeof v.seed !== 'number') throw new Error(`visual.seed must be a number, got ${JSON.stringify(v.seed)}`);
  }
  const { bpm, meter, ...rest } = meta;
  if (bpm !== undefined && rest.cps !== undefined) throw new Error('give bpm or cps, not both');
  const songGrid = parseMeter(meter);
  const ctx = { cps: bpm !== undefined ? bpm / 60 / songGrid.beats : .5, key: 'C:minor', seed: 1, kit: 'RolandTR909', ...rest, meter: meter ?? '4/4' };
  if (!(ctx.cps > 0)) throw new Error(`tempo must be positive: cps is ${ctx.cps} (from ${bpm !== undefined ? `bpm ${bpm}` : `cps ${rest.cps}`})`);
  let offset = 0;
  const built = sections.map(({ name, cycles, spec }, i) => {
    const { role, key = ctx.key, kit = ctx.kit, progression = DEFAULT_PROGRESSION, meter: sectionMeter, bpm: sectionBpm, cps: sectionCps, dropout = 0, sweep = 0, room = ctx.room, ...layerSpecs } = spec;
    if (sectionBpm !== undefined && sectionCps !== undefined) throw new Error(`section "${name}": give bpm or cps, not both`);
    for (const [k, v] of [['dropout', dropout], ['sweep', sweep]]) {
      if (!(Number.isInteger(v) && v >= 0 && v <= cycles)) throw new Error(`section "${name}": ${k} must be a whole number of bars up to ${cycles}`);
    }
    let prog;
    try { prog = parseProgression(progression); } catch (e) { throw new Error(`section "${name}": ${e.message}`); }
    const cp = chordPatterns(key, prog);
    const grid = sectionMeter ? parseMeter(sectionMeter) : songGrid;
    const cps = sectionBpm !== undefined ? sectionBpm / 60 / grid.beats : sectionCps ?? ctx.cps;
    if (!(cps > 0)) throw new Error(`section "${name}": tempo must be positive: cps is ${cps} (from ${sectionBpm !== undefined ? `bpm ${sectionBpm}` : `cps ${sectionCps}`})`);
    const span = cycles * ctx.cps / cps;
    const sctx = { ...ctx, cps, key, kit, progression: prog, chords: cp.roots, chordAcc: cp.acc, chordTones: cp.tones, section: name, cycles, grid, next: sections[i + 1]?.spec.role };
    const out = { name, cycles, offset, role, key, kit, progression: progression || DEFAULT_PROGRESSION, grid, cps, span, layers: {} };
    const orbits = new Map(); let nextOrbit = 0; // reverb signature -> orbit: parts whose reverb would be identical share one bus (one convolver), see orbitKey
    for (const [layer, attrs] of Object.entries(layerSpecs)) {
      const L = layers.get(layerBase(layer));
      if (!L) throw new Error(`unknown layer "${layer}" in section "${name}" (known: ${layerNames().join(', ')})`);
      for (const k of Object.keys(attrs ?? {})) {
        if (!L.keys.has(k)) throw new Error(`unknown key "${k}" on ${layer} in section "${name}" (axes: ${AXIS_NAMES.join(', ')}; material: ${L.material.join(', ') || 'none'})`);
      }
      if (attrs?.seed !== undefined && typeof attrs.seed !== 'number') throw new Error(`seed on ${layer} in section "${name}" must be a number, not a signal or expression`); // a function would seed the PRNG with NaN, silently
      const lctx = attrs?.seed !== undefined ? { ...sctx, seed: attrs.seed } : sctx; // a part's own seed: its generated lines differ from the song's
      const resolved = Object.fromEntries(Object.entries(attrs ?? {}).map(([k, v]) => [k, typeof v === 'function' ? v(lctx) : v]));
      const okey = orbitKey(layer, resolved, room), orbit = orbits.get(okey) ?? ++nextOrbit;
      if (okey !== null) orbits.set(okey, orbit);
      const where = `section "${name}": ${layer}`;
      const built = L.fn(resolved, lctx);
      let pattern = built.orbit(orbit);
      pattern = withPosition(pattern, resolved.position, where);
      pattern = withVelocity(pattern, resolved.velocity, where);
      pattern = withHumanize(pattern, resolved.humanize, lctx.seed, grid.beats, cps, where);
      pattern = withCompressor(pattern, resolved.compressor, where);
      pattern = withRoom(pattern, room, `section "${name}"`);
      out.layers[layer] = { attrs: resolved, pattern, orbit, plan: built.plan ?? null }; // plan: the layer's structural summary (lib/layers.mjs withPlan), frozen plain data, for the visual score
    }
    // sidechain: a part that names its ducker gets that part's haps pointed at its orbit (superdough's duckorbit)
    for (const [layer, l] of Object.entries(out.layers)) {
      const { duck, duckDepth = 0.5, duckAttack = 0.1 } = l.attrs;
      if (duck === undefined) continue;
      if (duck === layer) throw new Error(`section "${name}": ${layer} cannot duck itself`);
      const src = out.layers[duck];
      if (!src) throw new Error(`section "${name}": ${layer}.duck: no part "${duck}" in section "${name}"`);
      numIn(`section "${name}": ${layer}`, 'duckDepth', duckDepth, 0, 1); numIn(`section "${name}": ${layer}`, 'duckAttack', duckAttack, 0, 2);
      // one depth per target, in step with duckorbit (superdough reads depth[i] for target[i]): two parts ducking the same source each get their own
      const f = Function(`return (v) => ({ ...v, duckorbit: [...(v.duckorbit ?? []), ${l.orbit}], duckdepth: [...(v.duckdepth ?? []), ${duckDepth}], duckattack: [...(v.duckattack ?? []), ${duckAttack}] })`)();
      src.pattern = src.pattern.withValue(f);
    }
    // dropout: one head mask shared by every part. sweep: a closing low-pass over the tail, 8000 -> 150 Hz, folded into each
    // hap (one pass, no second query of the part); a part already darker than the sweep (brightness) keeps its own cutoff
    const head = dropout ? tailMask(cycles, dropout).fmap((x) => 1 - x) : null, from = cycles - sweep;
    const closing = (h) => { const t = (h.whole ?? h.part).begin.valueOf() % cycles; return t < from ? h : h.withValue((v) => ({ ...v, cutoff: Math.min(v.cutoff ?? 20000, 8000 - 7850 * ((t - from) / sweep)) })); };
    closing.toString = () => `(h) => { const t = (h.whole ?? h.part).begin.valueOf() % ${cycles}; return t < ${from} ? h : h.withValue((v) => ({ ...v, cutoff: Math.min(v.cutoff ?? 20000, 8000 - 7850 * ((t - ${from}) / ${sweep})) })); }`;
    for (const [layer, l] of Object.entries(out.layers)) {
      if (layerBase(layer) === 'fx') continue;
      if (head) l.pattern = l.pattern.mask(head);
      if (sweep) l.pattern = l.pattern.withHap(closing);
    }
    Object.assign(out, { dropout, sweep });
    out.pattern = Object.keys(out.layers).length ? S.stack(...Object.values(out.layers).map((l) => l.pattern)) : S.silence;
    offset += span;
    return out;
  });
  const pat = arrange(built, offset);
  pat.strudel = { meta: ctx, total: offset, sections: built, pattern: pat }; // pattern: lets dump tell the song apart from a stack() wrapped around it
  return pat;
}
