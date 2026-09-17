// The sample workshop's DOM-free half (samples.html draws and wires it): what a definition is written as, where it
// lands in a pack.json, and whether its name is free. Tested in Node.

/** A definition as saved: only the keys that differ from the sample part's defaults, `sound` only when it differs from the name. */
export function defText(name, def) {
  const out = {};
  if (def.sound && def.sound !== name) out.sound = def.sound;
  if (def.begin > 0) out.begin = +def.begin.toFixed(4);
  if (def.end < 1) out.end = +def.end.toFixed(4);
  if (def.bars && def.bars !== 1) out.bars = def.bars;
  if (Array.isArray(def.slices) ? def.slices.length : def.slices > 1) out.slices = Array.isArray(def.slices) ? def.slices.map((f) => +f.toFixed(4)) : def.slices;
  if (def.stretch) out.stretch = true;
  return out;
}

/** pack.json with definition `name` set to `def`, or removed when def is null; the pack's other fields kept. A removal of a name the pack does not have changes nothing (so it cannot invent a `samples` key). */
export function packJsonWith(meta, name, def) {
  if (!def && !Object.hasOwn(meta.samples ?? {}, name)) return meta;
  const samples = { ...(meta.samples ?? {}) };
  if (def) samples[name] = def; else delete samples[name];
  return { ...meta, samples };
}

/** A legal sample name: letters, digits, - and _, and not a name another pack's sounds or definitions already use (registerSamples would refuse it). */
export const nameProblem = (name, pack, packs) => (!/^[\w-]+$/.test(name) ? 'letters, digits, - and _ only'
  : Object.entries(packs).find(([p, x]) => p !== pack && (x.samples?.[name] || x.sounds?.[name])) ? `"${name}" is already a sound or sample in another pack` : null);
