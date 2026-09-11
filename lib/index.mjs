// Loads the strudle library into the current strudel scope (browser page or Node checker).
import { song, section, registerLayer, layerNames } from './song.mjs';
import * as axes from './axes.mjs';
import * as vocab from './vocab.mjs';
import './layers.mjs';

export const strudleLib = { registerLayer, layerNames, ...axes, ...vocab };
// DESCRIPTORS/OVERLAYS are reassigned by loadVocab (browser fetch happens after this module runs), so the
// spread above would freeze them at their initial value; expose live getters instead.
Object.defineProperties(strudleLib, {
  DESCRIPTORS: { get: () => vocab.DESCRIPTORS, enumerable: true },
  OVERLAYS: { get: () => vocab.OVERLAYS, enumerable: true },
});
Object.assign(globalThis, { song, section, strudleLib });
if (typeof window !== 'undefined') vocab.loadVocab((f) => fetch(`/lib/${f}`).then((r) => r.json()));

// Per-layer globals for tests and quick experiments in the page: drums({ density: .8 }) returns just that layer.
const oneLayer = (name, attrs = {}, ctx = {}) =>
  song({ ...ctx }, [section('_', ctx.cycles ?? 1, { [name]: attrs })]).strudle.sections[0].layers[name].pattern;
for (const name of layerNames()) globalThis[name] = (attrs, ctx) => oneLayer(name, attrs, ctx);

export { song, section };
