import { S } from './strudel.mjs';
import { parseProgression, chordPatterns, DEFAULT_PROGRESSION } from './harmony.mjs';

export function parseMeter(text = '4/4') {
  const m = /^(\d+)\/(4|8|16)$/.exec(String(text));
  if (!m || +m[1] < 1) throw new Error(`meter must look like 4/4, 3/4, 6/8 or 7/8, got ${JSON.stringify(text)}`);
  const [beats, den] = [+m[1], +m[2]];
  return { steps: beats * 16 / den, pulse: 16 / den, beats };
}

const layers = new Map();
export const registerLayer = (name, fn) => layers.set(name, fn);
export const layerNames = () => [...layers.keys()];

export function section(name, cycles, spec = {}) {
  if (typeof name !== 'string' || !(cycles > 0)) throw new Error('section(name, cycles, spec)');
  return { name, cycles, spec };
}

export function song(meta = {}, sections = []) {
  const { bpm, meter, ...rest } = meta;
  if (bpm !== undefined && rest.cps !== undefined) throw new Error('give bpm or cps, not both');
  const songGrid = parseMeter(meter);
  const ctx = { cps: bpm !== undefined ? bpm / 60 / songGrid.beats : .5, key: 'C:minor', seed: 1, kit: 'RolandTR909', ...rest, meter: meter ?? '4/4' };
  let offset = 0;
  const built = sections.map(({ name, cycles, spec }, i) => {
    const { role, key = ctx.key, kit = ctx.kit, progression = DEFAULT_PROGRESSION, meter: sectionMeter, ...layerSpecs } = spec;
    let prog;
    try { prog = parseProgression(progression); } catch (e) { throw new Error(`section "${name}": ${e.message}`); }
    const cp = chordPatterns(key, prog);
    const grid = sectionMeter ? parseMeter(sectionMeter) : songGrid;
    const sctx = { ...ctx, key, kit, progression: prog, chords: cp.roots, chordAcc: cp.acc, chordTones: cp.tones, section: name, cycles, grid, next: sections[i + 1]?.spec.role };
    const out = { name, cycles, offset, role, key, kit, progression: progression || DEFAULT_PROGRESSION, grid, layers: {} };
    const pats = [];
    for (const [layer, attrs] of Object.entries(layerSpecs)) {
      const fn = layers.get(layer);
      if (!fn) throw new Error(`unknown layer "${layer}" in section "${name}" (known: ${layerNames().join(', ')})`);
      const resolved = Object.fromEntries(Object.entries(attrs ?? {}).map(([k, v]) => [k, typeof v === 'function' ? v(sctx) : v]));
      const pattern = fn(resolved, sctx);
      out.layers[layer] = { attrs: resolved, pattern };
      pats.push(pattern);
    }
    out.pattern = pats.length ? S.stack(...pats) : S.silence;
    offset += cycles;
    return out;
  });
  const pat = S.arrange(...built.map((b) => [b.cycles, b.pattern]));
  pat.strudle = { meta: ctx, total: offset, sections: built, pattern: pat }; // pattern: lets dump tell the song apart from a stack() wrapped around it
  return pat;
}
