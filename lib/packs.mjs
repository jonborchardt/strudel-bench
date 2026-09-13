// Local sample packs (samples/user/<pack>/) as a song sees them. Shared by the checker, the Pages build and the page.
import CDN from './packs.json' with { type: 'json' };

/**
 * Packs a song declares: `packs: ['a', 'b']` in its song() header, or the same text in a comment for plain
 * Strudel files (a comment line reading packs: ['a']). Packs the song does not declare are not available to it, even locally.
 */
export const packsOf = (src) => [...(src.match(/packs:\s*\[([^\]]*)\]/)?.[1].matchAll(/['"]([^'"]+)['"]/g) ?? [])].map((m) => m[1]);

/** What a pack is in this environment: 'deployed' ships with the site, 'local' stays on this machine, 'missing' is declared but not here. */
export const packKind = (pack) => (!pack ? 'missing' : pack.deploy ? 'deployed' : 'local');

// ponytail: hardcoded synth list; registerSynthSounds needs a browser AudioContext so neither the checker nor the page can ask it.
export const SYNTHS = ['sine', 'square', 'triangle', 'sawtooth', 'sin', 'sqr', 'tri', 'saw', 'supersaw', 'pulse',
  'white', 'pink', 'brown', 'crackle', 'z_sine', 'z_sawtooth', 'z_square', 'z_triangle', 'z_tan', 'z_noise', 'bytebeat'];
/** Is `sound` an oscillator rather than a sample? `sawtooth:2` counts; a bank-prefixed or sampled name does not. */
export const isSynth = (sound) => SYNTHS.includes(String(sound).split(':')[0]);

/**
 * The `samples()` calls that register what the page prebakes, so a dump pastes into the strudel.cc REPL and
 * plays instead of warning "sound not loaded". Packs stream from the same CDN the page falls back to; a song's
 * declared local packs come from the deployed site (only packs whose pack.json says deploy are there).
 */
export const prebakeHeader = (packs = []) => [
  '// sample packs the page prebakes; strudel.cc registers a different set, so paste these too',
  ...Object.values(CDN.packs).map((p) => `await samples('${p.json}'${p.base ? `, '${p.base}'` : ''})`),
  `await aliasBank('${CDN.alias}')`,
  ...(packs.length ? [`await samples('${CDN.userBase}strudel.json', '${CDN.userBase}')`] : []),
].join('\n');
