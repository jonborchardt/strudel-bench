// Loads the strudel-bench library into the current Strudel scope (browser page or Node checker).
import { song, section, registerLayer, layerNames } from './song.mjs';
import * as axes from './axes.mjs';
import * as vocab from './vocab.mjs';
import * as harmony from './harmony.mjs';
import { ARP_ORDERS, arpIndices } from './layers.mjs';
import { PATCHES } from './packs.mjs';

export const strudelLib = { registerLayer, layerNames, ARP_ORDERS, arpIndices, PATCHES, ...axes, ...vocab, ...harmony };
Object.assign(globalThis, { song, section, strudelLib, ...axes.MOTIONS });
if (typeof window !== 'undefined') await vocab.loadVocab((f) => fetch(new URL(f, import.meta.url)).then((r) => r.json())); // awaited: boot() imports this module, so the page has the tables (a score's mood reads them) before it can play

// Per-layer globals for tests and quick experiments in the page: drums({ density: .8 }) returns just that layer.
const oneLayer = (name, attrs = {}, { cycles = 1, ...meta } = {}) =>
  song(meta, [section('_', cycles, { [name]: attrs })]).strudel.sections[0].layers[name].pattern;
for (const name of layerNames()) globalThis[name] = (attrs, ctx) => oneLayer(name, attrs, ctx);

export { song, section };
