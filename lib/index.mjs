// Loads the strudle library into the current strudel scope (browser page or Node checker).
import { song, section, registerLayer, layerNames } from './song.mjs';
import * as axes from './axes.mjs';
import './layers.mjs';

export const strudleLib = { registerLayer, layerNames, ...axes };
Object.assign(globalThis, { song, section, strudleLib });

// Per-layer globals for tests and quick experiments in the page: drums({ density: .8 }) returns just that layer.
const oneLayer = (name, attrs = {}, ctx = {}) =>
  song({ ...ctx }, [section('_', ctx.cycles ?? 1, { [name]: attrs })]).strudle.sections[0].layers[name].pattern;
for (const name of layerNames()) globalThis[name] = (attrs, ctx) => oneLayer(name, attrs, ctx);

export { song, section };
