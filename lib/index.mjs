// Loads the strudle library into the current strudel scope (browser page or Node checker).
import { S } from './strudel.mjs';
import { song, section, registerLayer, layerNames } from './song.mjs';

export const strudleLib = { registerLayer, layerNames };
Object.assign(globalThis, { song, section, strudleLib });
// later tasks extend strudleLib (AXES, cells, descriptors, resolveDeltas) and register the four layers
export { song, section };
