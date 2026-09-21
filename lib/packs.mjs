// Local sample packs (samples/user/<pack>/) as a song sees them. Shared by the checker, the Pages build and the page.
import CDN from './packs.json' with { type: 'json' };
import PATCHES_JSON from './patches.json' with { type: 'json' };
import { isPattern } from './strudel.mjs';
import GM from '../node_modules/@strudel/soundfonts/gm.mjs'; // pure data: the General MIDI names web/soundfonts.mjs registers on the page

/** The gm_* soundfont instruments (guitars, basses, winds, strings...): known to the check, streamed by the page on first use. */
export const GM_SOUNDS = Object.keys(GM);

/** Named voice patches: superdough controls applied under the axes (lib/patches.json). Data, like the vocabulary. */
export const PATCHES = PATCHES_JSON;
export const PATCH_KEYS = ['lpq', 'lpenv', 'lpattack', 'lpdecay', 'penv', 'pattack', 'pdecay', 'fmi', 'fmh', 'noise', 'unison', 'detune', 'vib', 'vibmod'];
/** A patch name looked up in PATCHES, or an object of controls validated against PATCH_KEYS; undefined -> null. */
export function resolvePatch(patch) {
  if (patch === undefined) return null;
  if (typeof patch === 'string') { if (!PATCHES[patch]) throw new Error(`unknown patch "${patch}" (known: ${Object.keys(PATCHES).join(', ')})`); return PATCHES[patch]; }
  if (!patch || typeof patch !== 'object') throw new Error('patch must be a name or an object of voice controls');
  for (const [k, v] of Object.entries(patch)) { if (!PATCH_KEYS.includes(k)) throw new Error(`patch: unknown key "${k}" (known: ${PATCH_KEYS.join(', ')})`); if (typeof v !== 'number') throw new Error(`patch.${k} must be a number`); }
  return patch;
}

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
/** The names a sound value can play: one for a string, all for a list or weights, none for a pattern. */
export const soundNames = (sound) => (Array.isArray(sound) ? sound : sound && typeof sound === 'object' && !isPattern(sound) ? Object.keys(sound) : typeof sound === 'string' ? [sound] : []);
/** Is `sound` an oscillator rather than a sample? `sawtooth:2` counts; a bank-prefixed or sampled name does not; a list or weights object counts when every name does; a pattern never does. */
export const isSynth = (sound) => { const names = soundNames(sound); return names.length > 0 && names.every((n) => SYNTHS.includes(String(n).split(':')[0])); };

/** The keys a sample definition may carry: the part's material keys, plus the pack sound it plays. */
export const DEF_KEYS = ['sound', 'begin', 'end', 'bars', 'slices', 'stretch'];
/** Sample definitions by name, from the packs registered last (`samples` in each pack.json): `{ sound, begin?, end?, bars?, slices?, stretch?, pack }`. */
export const SAMPLES = new Map();
/** Definitions the last registration refused: a name already taken by another pack's definition or sound. One string each, as the checker and the Pages build report them. */
export const SAMPLE_PROBLEMS = [];
/**
 * Fill the registry from a pack index (`{ name: { sounds, samples } }`): the page's packs.json, the checker's
 * userPacks(), the Pages build's shipped set. Packs are read in name order so the winner of a collision is the same
 * everywhere; the loser is skipped and named in SAMPLE_PROBLEMS. A definition named like its own pack's sound is the
 * sound's default interpretation, not a collision.
 */
export function registerSamples(packs = {}) {
  SAMPLES.clear();
  SAMPLE_PROBLEMS.length = 0;
  const names = Object.keys(packs).sort();
  for (const pack of names) {
    for (const [name, def] of Object.entries(packs[pack].samples ?? {})) {
      const taken = SAMPLES.get(name);
      const other = taken ? taken.pack : names.find((n) => n !== pack && Object.hasOwn(packs[n].sounds ?? {}, name));
      if (other) { SAMPLE_PROBLEMS.push(`samples/user/${pack}/pack.json samples.${name}: collides with ${taken ? 'sample' : 'sound'} "${name}" in pack "${other}"`); continue; }
      SAMPLES.set(name, { sound: name, ...def, pack });
    }
  }
}
export const sampleDef = (name) => SAMPLES.get(String(name).split(':')[0]) ?? null;
/** A sample part's attrs with its definition underneath: the part's keys win, `sound` becomes the pack sound (keeping a `:n` variant suffix the part wrote). Unchanged when the sound has no definition. */
export function resolveSample(attrs) {
  const [base, variant] = String(attrs.sound).split(':');
  const def = SAMPLES.get(base);
  if (!def) return attrs;
  const { pack, ...under } = def;
  return { ...under, ...attrs, sound: variant ? `${def.sound}:${variant}` : def.sound };
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
