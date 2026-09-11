// Harmony is material, not an axis (README rule 4). Diatonic roman numerals over a per-section key.
import { S } from './strudel.mjs';

export const DEFAULT_PROGRESSION = 'i VI';
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

export const rootOf = (key) => key.split(':')[0].replace(/\d+$/, '');
export const modeOf = (key) => key.split(':').slice(1).join(':') || 'minor';
export const keyAt = (key, octave) => `${rootOf(key)}${octave}:${modeOf(key)}`;

/** 'i VI III VII' -> [{ numeral: 'i', degree: 0 }, ...]. Empty or missing text is the default progression. */
export function parseProgression(text) {
  const src = (text ?? '').trim() || DEFAULT_PROGRESSION;
  return src.split(/\s+/).map((numeral) => {
    const degree = NUMERALS.indexOf(numeral.toLowerCase());
    if (degree < 0) throw new Error(`bad roman numeral "${numeral}" in progression "${src}" (use I..VII, no accidentals or sevenths)`);
    return { numeral, degree };
  });
}

/** One chord root per cycle, as a mini-notation degree pattern the layers can n().add(). */
export const degreeMini = (prog) => `<${prog.map((c) => c.degree).join(' ')}>`;

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const pcOf = (name) => (PC[name[0].toUpperCase()] + (name.slice(1).match(/#/g)?.length ?? 0) - (name.slice(1).match(/b/g)?.length ?? 0) + 12) % 12;
// ponytail: spelling heuristic (flats for minor-ish keys, sharps otherwise) is for reports only; E minor prints Gb for F#.
export const spell = (pc, key) => {
  const root = rootOf(key), mode = modeOf(key);
  const flats = root.includes('b') || (!root.includes('#') && /minor|aeolian|dorian|phrygian|locrian/.test(mode));
  return (flats ? FLATS : SHARPS)[((pc % 12) + 12) % 12];
};

/** MIDI number of scale step `step` in `key`, via Strudel's own scale() so both hosts agree. */
const stepMidi = (key, step) => S.n(step).scale(keyAt(key, 4)).add(S.note(0)).queryArc(0, 1)[0].value.note;

const QUALITY = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
export function chordName(key, degree) {
  const [r, t, f] = [0, 2, 4].map((k) => stepMidi(key, degree + k));
  const q = QUALITY[`${(t - r + 12) % 12},${(f - r + 12) % 12}`] ?? '?';
  return spell(r, key) + q;
}

export const describeHarmony = (key, prog) => `${prog.map((c) => c.numeral).join(' ')} in ${key} → ${prog.map((c) => chordName(key, c.degree)).join(' ')}`;

const MAJORISH = ['major', 'ionian'], MINORISH = ['minor', 'aeolian'];
export function withMode(key, mode) { return `${rootOf(key)}:${mode}`; }

/** Relative major of a minor key (+3 semitones) or relative minor of a major key (-3). Other modes: refuse. */
export function relativeKey(key) {
  const root = rootOf(key), mode = modeOf(key);
  const toMajor = MINORISH.includes(mode), toMinor = MAJORISH.includes(mode);
  if (!toMajor && !toMinor) throw new Error(`relative key is only defined from major or minor, not "${mode}"`);
  const pc = (pcOf(root) + (toMajor ? 3 : 9)) % 12;
  const flats = root.includes('b') || (!root.includes('#') && toMajor);
  return `${(flats ? FLATS : SHARPS)[pc]}:${toMajor ? 'major' : 'minor'}`;
}

/** Apply parsed harmony words (from vocab.parsePhrase) as states on { key, progression }. */
export function applyHarmonyWords(state, harmony) {
  let { key, progression } = state;
  for (const h of harmony) {
    if (h.kind === 'relative') key = relativeKey(key);
    else if (h.kind === 'mode') key = withMode(h.relative ? relativeKey(key) : key, h.value);
    else if (h.kind === 'progression') progression = h.value;
  }
  return { key, progression };
}
