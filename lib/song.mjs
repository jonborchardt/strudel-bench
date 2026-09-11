import { S } from './strudel.mjs';

const layers = new Map();
export const registerLayer = (name, fn) => layers.set(name, fn);
export const layerNames = () => [...layers.keys()];

export function section(name, cycles, spec = {}) {
  if (typeof name !== 'string' || !(cycles > 0)) throw new Error('section(name, cycles, spec)');
  return { name, cycles, spec };
}

export function song(meta = {}, sections = []) {
  const ctx = { cps: .5, key: 'C:minor', seed: 1, kit: 'RolandTR909', ...meta };
  let offset = 0;
  const built = sections.map(({ name, cycles, spec }) => {
    const { role, ...layerSpecs } = spec;
    const out = { name, cycles, offset, role, layers: {} };
    const pats = [];
    for (const [layer, attrs] of Object.entries(layerSpecs)) {
      const fn = layers.get(layer);
      if (!fn) throw new Error(`unknown layer "${layer}" in section "${name}" (known: ${layerNames().join(', ')})`);
      const pattern = fn(attrs ?? {}, { ...ctx, section: name, cycles });
      out.layers[layer] = { attrs: attrs ?? {}, pattern };
      pats.push(pattern);
    }
    out.pattern = pats.length ? S.stack(...pats) : S.silence;
    offset += cycles;
    return out;
  });
  const pat = S.arrange(...built.map((b) => [b.cycles, b.pattern]));
  pat.strudle = { meta: ctx, total: offset, sections: built };
  return pat;
}
