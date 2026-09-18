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
export const registerLayer = (name, fn, { materials } = {}) => {
  const material = materials ? [...materials, 'level', 'duck', 'duckDepth'] : []; // every part takes level (gain) and can name a sidechain source; a part that generates lines lists `seed` itself
  layers.set(name, { fn, material, keys: new Set([...AXIS_NAMES, ...material]) });
};
export const layerNames = () => [...layers.keys()];
/** Sections end to end over `total` song cycles: [span, pattern.fast(cycles)] plays `cycles` bars in `span` song-cycles, so a section can carry its own tempo. `patternOf` picks what each section plays (the page's solo/mute). */
export const arrange = (sections, total, patternOf = (s) => s.pattern) => S.stepcat(...sections.map((s) => [s.span, patternOf(s).fast(s.cycles)])).slow(total);
export const layerMaterial = (name) => layers.get(name)?.material ?? []; // the non-axis keys a layer takes (level included)
/** `drums2` is a second drums layer: the layer a section key builds with is the key minus a trailing number. */
export const layerBase = (key) => key.replace(/\d+$/, '');

/** 1 for the last `n` bars of a section of `cycles` bars, 0 before, at eighth-bar resolution (the fx riser's mask). */
const tailMask = (cycles, n) => { const slices = Math.ceil(cycles * 8); return S.sequence(...Array.from({ length: slices }, (_, i) => (i / 8 >= cycles - n ? 1 : 0))).slow(slices / 8); };

export function section(name, cycles, spec = {}) {
  if (typeof name !== 'string' || !(cycles > 0)) throw new Error('section(name, cycles, spec)');
  return { name, cycles, spec };
}

export const META_KEYS = ['cps', 'bpm', 'meter', 'key', 'seed', 'kit', 'packs'];
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
    const { role, key = ctx.key, kit = ctx.kit, progression = DEFAULT_PROGRESSION, meter: sectionMeter, bpm: sectionBpm, cps: sectionCps, dropout = 0, sweep = 0, ...layerSpecs } = spec;
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
      const pattern = L.fn(resolved, lctx).orbit(orbit);
      out.layers[layer] = { attrs: resolved, pattern, orbit };
    }
    // sidechain: a part that names its ducker gets that part's haps pointed at its orbit (superdough's duckorbit)
    for (const [layer, l] of Object.entries(out.layers)) {
      const { duck, duckDepth = 0.5 } = l.attrs;
      if (duck === undefined) continue;
      if (duck === layer) throw new Error(`section "${name}": ${layer} cannot duck itself`);
      const src = out.layers[duck];
      if (!src) throw new Error(`section "${name}": ${layer}.duck: no part "${duck}" in section "${name}"`);
      if (!(typeof duckDepth === 'number' && duckDepth >= 0 && duckDepth <= 1)) throw new Error(`section "${name}": ${layer}.duckDepth must be a number in 0..1`);
      const f = (v) => ({ ...v, duckorbit: [...(v.duckorbit ?? []), l.orbit], duckdepth: duckDepth });
      f.toString = () => `(v) => ({ ...v, duckorbit: [...(v.duckorbit ?? []), ${l.orbit}], duckdepth: ${duckDepth} })`;
      src.pattern = src.pattern.withValue(f);
    }
    for (const [layer, l] of Object.entries(out.layers)) {
      if (layerBase(layer) === 'fx') continue;
      if (dropout) l.pattern = l.pattern.mask(tailMask(cycles, dropout).fmap((x) => 1 - x));
      if (sweep) l.pattern = S.stack(l.pattern.mask(tailMask(cycles, sweep).fmap((x) => 1 - x)), l.pattern.mask(tailMask(cycles, sweep)).lpf(S.saw.range(8000, 150).slow(sweep).late(cycles - sweep)));
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
