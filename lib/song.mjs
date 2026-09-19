import { S } from './strudel.mjs';
import { AXIS_NAMES } from './axes.mjs';
import { parseProgression, chordPatterns, DEFAULT_PROGRESSION } from './harmony.mjs';

export function parseMeter(text = '4/4') {
  const m = /^(\d+)\/(4|8|16)$/.exec(String(text));
  if (!m || +m[1] < 1) throw new Error(`meter must look like 4/4, 3/4, 6/8 or 7/8, got ${JSON.stringify(text)}`);
  const [beats, den] = [+m[1], +m[2]];
  return { steps: beats * 16 / den, pulse: 16 / den, beats };
}

const layers = new Map();
// every layer that carries material also takes `level`; a layer registered without a materials list
// (ad-hoc test/experiment layers) takes axis names only.
export const MIX_KEYS = ['level', 'position', 'duck', 'duckDepth', 'duckAttack', 'velocity', 'humanize', 'compressor']; // the mix material every part takes (lib/song.mjs applies them after the layer builds)
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
  const d = position / 2;
  const f = (v) => ({ ...v, pan: Math.min(1, Math.max(0, (v.pan ?? 0.5) + d)) });
  f.toString = () => `(v) => ({ ...v, pan: Math.min(1, Math.max(0, (v.pan ?? 0.5) + ${d})) })`;
  return p.withValue(f);
}
/** velocity: a mini string of per-step multipliers over one bar ('.8 1 .9 1', '<[...] [...]>' for two), superdough's velocity, under gain and the grid's accents. */
function withVelocity(p, velocity, where) {
  if (velocity === undefined) return p;
  if (typeof velocity === 'string') { if (!/^[\d.\s<>\[\]~@*!]+$/.test(velocity) || !/\d/.test(velocity)) throw new Error(`${where}: velocity must be a mini string of numbers, got ${JSON.stringify(velocity)}`); return p.velocity(S.mini(velocity)); }
  if (typeof velocity?.queryArc === 'function') return p.velocity(velocity);
  throw new Error(`${where}: velocity must be a mini string of numbers, got ${JSON.stringify(velocity)}`);
}
/**
 * humanize: a played feel that is correlated, not dice per hit (that is organicness). Three seeded curves of time, one each
 * for timing (seconds, ± timingMs), gain (± velocity) and note length (± length): a slow wave over `correlation` bars
 * ('bar', 'phrase' = 4, or a bar count), a fixed lean per beat position inside the bar, and a little residual, so a hit
 * leans the same way on every play and neighbours lean together.
 */
function withHumanize(p, h, seed, beats, where) {
  if (h === undefined) return p;
  onlyKeys(where, 'humanize', h, ['timingMs', 'velocity', 'length', 'correlation']);
  const { timingMs = 0, velocity = 0, length = 0, correlation = 'bar' } = h;
  numIn(where, 'humanize.timingMs', timingMs, 0, 200); numIn(where, 'humanize.velocity', velocity, 0, 1); numIn(where, 'humanize.length', length, 0, 1);
  const per = correlation === 'phrase' ? 4 : correlation === 'bar' ? 1 : correlation;
  numIn(where, 'humanize.correlation', per, 0.25, 64);
  const ph = (k) => +(((Math.imul(seed | 0, 2654435761) + k * 40503) >>> 0) / 2 ** 32 * 6.2832).toFixed(3);
  // compiled from source so the dump prints the curve with its numbers inlined and no closure variables
  const curve = (amt, k) => S.signal(Function(`return (t) => ${amt} * (0.5 * Math.sin(2 * Math.PI * t / ${per} + ${ph(k)}) + 0.3 * Math.sin(2 * Math.PI * (t % 1) * ${beats} + ${ph(k + 1)}) + 0.2 * ((Math.sin(t * 127.1 + ${ph(k + 2)}) * 43758.5453) % 1))`)());
  if (timingMs) p = p.nudge(curve(timingMs / 1000, 1));
  if (velocity) p = p.mul(S.gain(curve(velocity, 4).add(1)));
  if (length) p = p.mul(S.clip(curve(length, 7).add(1)));
  return p;
}
/** compressor: superdough's per-part DynamicsCompressorNode, { threshold (dBFS), ratio, knee, attack, release }. */
function withCompressor(p, c, where) {
  if (c === undefined) return p;
  onlyKeys(where, 'compressor', c, ['threshold', 'ratio', 'knee', 'attack', 'release']);
  const { threshold, ratio = 4, knee = 10, attack = .003, release = .05 } = c;
  numIn(where, 'compressor.threshold', threshold, -100, 0); numIn(where, 'compressor.ratio', ratio, 1, 20); numIn(where, 'compressor.knee', knee, 0, 40); numIn(where, 'compressor.attack', attack, 0, 1); numIn(where, 'compressor.release', release, 0, 1);
  return p.compressor(`${threshold}:${ratio}:${knee}:${attack}:${release}`);
}
/** room: one reverb character for every part (song key, a section may override): superdough's per-orbit reverb settings. A part's `space` stays its send. */
export const ROOM_KEYS = { size: 'roomsize', decay: 'roomfade', damping: 'roomlp', dimension: 'roomdim', ir: 'ir' };
function withRoom(p, room, where) {
  if (room === undefined) return p;
  onlyKeys(where, 'room', room, Object.keys(ROOM_KEYS));
  for (const [k, v] of Object.entries(room)) {
    if (k === 'ir') { if (typeof v !== 'string') throw new Error(`${where}: room.ir must be a sample name`); }
    else numIn(where, `room.${k}`, v, 0, k === 'size' ? 20 : k === 'decay' ? 1 : 20000);
  }
  return Object.entries(room).reduce((q, [k, v]) => q[ROOM_KEYS[k]](v), p);
}

export const META_KEYS = ['cps', 'bpm', 'meter', 'key', 'seed', 'kit', 'packs', 'room'];
export function song(meta = {}, sections = []) {
  for (const k of Object.keys(meta)) if (!META_KEYS.includes(k)) throw new Error(`unknown song key "${k}" (known: ${META_KEYS.join(', ')})`);
  if (meta.packs !== undefined && !(Array.isArray(meta.packs) && meta.packs.every((p) => typeof p === 'string'))) throw new Error(`packs must list sample pack names, e.g. packs: ['mine']`);
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
    for (const [layer, attrs] of Object.entries(layerSpecs)) {
      const L = layers.get(layerBase(layer));
      if (!L) throw new Error(`unknown layer "${layer}" in section "${name}" (known: ${layerNames().join(', ')})`);
      for (const k of Object.keys(attrs ?? {})) {
        if (!L.keys.has(k)) throw new Error(`unknown key "${k}" on ${layer} in section "${name}" (axes: ${AXIS_NAMES.join(', ')}; material: ${L.material.join(', ') || 'none'})`);
      }
      if (attrs?.seed !== undefined && typeof attrs.seed !== 'number') throw new Error(`seed on ${layer} in section "${name}" must be a number, not a signal or expression`); // a function would seed the PRNG with NaN, silently
      const lctx = attrs?.seed !== undefined ? { ...sctx, seed: attrs.seed } : sctx; // a part's own seed: its generated lines differ from the song's
      const resolved = Object.fromEntries(Object.entries(attrs ?? {}).map(([k, v]) => [k, typeof v === 'function' ? v(lctx) : v]));
      const orbit = Object.keys(out.layers).length + 1; // one bus per part: reverb and delay are per orbit in superdough
      const where = `section "${name}": ${layer}`;
      let pattern = L.fn(resolved, lctx).orbit(orbit);
      pattern = withPosition(pattern, resolved.position, where);
      pattern = withVelocity(pattern, resolved.velocity, where);
      pattern = withHumanize(pattern, resolved.humanize, lctx.seed, grid.beats, where);
      pattern = withCompressor(pattern, resolved.compressor, where);
      pattern = withRoom(pattern, room, `section "${name}"`);
      out.layers[layer] = { attrs: resolved, pattern, orbit };
    }
    // sidechain: a part that names its ducker gets that part's haps pointed at its orbit (superdough's duckorbit)
    const anyAttack = Object.values(out.layers).some((l) => l.attrs.duckAttack !== undefined); // the attack list is written only when a part sets one: superdough reads it in step with duckorbit
    for (const [layer, l] of Object.entries(out.layers)) {
      const { duck, duckDepth = 0.5, duckAttack = 0.1 } = l.attrs;
      if (duck === undefined) continue;
      if (duck === layer) throw new Error(`section "${name}": ${layer} cannot duck itself`);
      const src = out.layers[duck];
      if (!src) throw new Error(`section "${name}": ${layer}.duck: no part "${duck}" in section "${name}"`);
      if (!(typeof duckDepth === 'number' && duckDepth >= 0 && duckDepth <= 1)) throw new Error(`section "${name}": ${layer}.duckDepth must be a number in 0..1`);
      numIn(`section "${name}": ${layer}`, 'duckAttack', duckAttack, 0, 2);
      // one depth per target, in step with duckorbit (superdough reads depth[i] for target[i]): two parts ducking the same source each get their own
      const att = anyAttack ? `, duckattack: [...(v.duckattack ?? []), ${duckAttack}]` : '';
      const f = Function(`return (v) => ({ ...v, duckorbit: [...(v.duckorbit ?? []), ${l.orbit}], duckdepth: [...(v.duckdepth ?? []), ${duckDepth}]${att} })`)();
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
