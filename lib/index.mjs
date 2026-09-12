// Loads the strudel-bench library into the current Strudel scope (browser page or Node checker).
import { song, section, registerLayer, layerNames } from './song.mjs';
import * as axes from './axes.mjs';
import * as vocab from './vocab.mjs';
import * as harmony from './harmony.mjs';
import { ARP_ORDERS, arpIndices } from './layers.mjs';

export const strudelLib = { registerLayer, layerNames, ARP_ORDERS, arpIndices, ...axes, ...vocab, ...harmony };
Object.assign(globalThis, { song, section, strudelLib, ramp: axes.ramp });
if (typeof window !== 'undefined') vocab.loadVocab((f) => fetch(new URL(f, import.meta.url)).then((r) => r.json()));

// Per-layer globals for tests and quick experiments in the page: drums({ density: .8 }) returns just that layer.
const oneLayer = (name, attrs = {}, { cycles = 1, ...meta } = {}) =>
  song(meta, [section('_', cycles, { [name]: attrs })]).strudel.sections[0].layers[name].pattern;
for (const name of layerNames()) globalThis[name] = (attrs, ctx) => oneLayer(name, attrs, ctx);

export { song, section };
