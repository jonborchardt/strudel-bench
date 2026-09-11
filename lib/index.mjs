// Loads the strudle library into the current strudel scope (browser page or Node checker).
import { S } from './strudel.mjs';
import { song, section, registerLayer, layerNames } from './song.mjs';
import * as axes from './axes.mjs';

export const strudleLib = { registerLayer, layerNames, ...axes };
Object.assign(globalThis, { song, section, strudleLib });
// task 3 registers the four layers against this registry
export { song, section };
