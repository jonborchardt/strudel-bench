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

/** The keys a sample definition may carry: the part's material keys, plus the pack sound it plays. */
export const DEF_KEYS = ['sound', 'begin', 'end', 'bars', 'slices', 'stretch'];
/** Sample definitions by name, from the packs registered last (`samples` in each pack.json): `{ sound, begin?, end?, bars?, slices?, stretch?, pack }`. */
export const SAMPLES = new Map();
/** Fill the registry from a pack index (`{ name: { sounds, samples } }`): the page's packs.json, the checker's userPacks(), the Pages build's shipped set. */
export function registerSamples(packs = {}) {
  SAMPLES.clear();
  for (const [pack, p] of Object.entries(packs)) for (const [name, def] of Object.entries(p.samples ?? {})) SAMPLES.set(name, { sound: name, ...def, pack });
}
export const sampleDef = (name) => SAMPLES.get(String(name).split(':')[0]) ?? null;
/** A sample part's attrs with its definition underneath: the part's keys win, `sound` becomes the pack sound. Unchanged when the sound has no definition. */
export function resolveSample(attrs) {
  const def = sampleDef(attrs.sound);
  if (!def) return attrs;
  const { pack, ...base } = def;
  return { ...base, ...attrs, sound: def.sound };
}

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
