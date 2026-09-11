// Harmony is material, not an axis (README rule 4). Diatonic roman numerals over a per-section key.
import { S } from './strudel.mjs';

export const DEFAULT_PROGRESSION = 'i VI';
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

export const rootOf = (key) => key.split(':')[0].replace(/\d+$/, '');
export const modeOf = (key) => key.split(':').slice(1).join(':') || 'minor';
export const keyAt = (key, octave) => `${rootOf(key)}${octave}:${modeOf(key)}`;

const TOKEN = /^([b#]?)([ivIV]+)(m|M|dim)?(7)?$/;
const QUAL = { m: 'minor', M: 'major', dim: 'dim' };

/** 'i [VI VII] bIII7' -> [[chord], [chord, chord], [chord]]: one inner array per cycle. */
export function parseProgression(text) {
  const src = (text ?? '').trim() || DEFAULT_PROGRESSION;
  const chord = (t) => {
    const m = TOKEN.exec(t);
    const degree = m ? NUMERALS.indexOf(m[2].toLowerCase()) : -1;
    if (degree < 0) throw new Error(`bad numeral "${t}" in progression "${src}" (I..VII with optional b/#, m/M/dim, 7, and [..] groups)`);
    const acc = m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0;
    const quality = m[3] ? QUAL[m[3]] : acc ? (m[2] === m[2].toUpperCase() ? 'major' : 'minor') : null;
    return { numeral: t, degree, acc, quality, seventh: !!m[4] };
  };
  const cycles = [];
  let group = null;
  for (const t of src.replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').trim().split(/\s+/)) {
    if (t === '[') { if (group) throw new Error(`nested [ in progression "${src}"`); group = []; }
    else if (t === ']') { if (!group?.length) throw new Error(`empty or stray ] in progression "${src}"`); cycles.push(group); group = null; }
    else if (group) group.push(chord(t));
    else cycles.push([chord(t)]);
  }
  if (group) throw new Error(`unclosed [ in progression "${src}"`);
  return cycles;
}

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const pcOf = (name) => (PC[name[0].toUpperCase()] + (name.slice(1).match(/#/g)?.length ?? 0) - (name.slice(1).match(/b/g)?.length ?? 0) + 12) % 12;

/** MIDI number of scale step `step` in `key`, via Strudel's own scale() so both hosts agree. */
const stepMidi = (key, step) => S.n(step).scale(keyAt(key, 4)).add(S.note(0)).queryArc(0, 1)[0].value.note;
/** Note name of scale step `step` in `key`, straight from scale() (octave digits stripped) — scale() spells correctly, we don't. */
const stepName = (key, step) => String(S.n(step).scale(keyAt(key, 4)).queryArc(0, 1)[0].value.note).replace(/\d+$/, '');

/** Semitone intervals of the chord above its root: diatonic from the key unless the token says otherwise. */
export function chordSpec(key, c) {
  const [r, t, f, s] = [0, 2, 4, 6].map((k) => stepMidi(key, c.degree + k));
  let third = (t - r + 12) % 12, fifth = (f - r + 12) % 12, seventh = (s - r + 12) % 12;
  if (c.quality === 'major') { third = 4; fifth = 7; }
  if (c.quality === 'minor') { third = 3; fifth = 7; }
  if (c.quality === 'dim') { third = 3; fifth = 6; }
  // diatonic root, no suffix: keep the key's own seventh. Any M suffix: major seventh (11). Anything else
  // (m/dim suffix, or an altered/accidental root): minor seventh (10).
  if (c.quality || c.acc) seventh = c.quality === 'major' && /M/.test(c.numeral) ? 11 : 10;
  return { degree: c.degree, acc: c.acc, intervals: [0, third, fifth, seventh] };
}

// Tone-count -> intervals indices, matching the pre-v2 PAD_TONES voicings (root/third/fifth/seventh at
// indices 0/1/2/3): 1 tone is just the root, 2 is a power chord (root+fifth, index 2, skipping the third).
const TONE_IDX = { 1: [0], 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

/** The three parallel mini-strings the layers add: chord root degrees, root accidentals, tone stacks (cut to n). */
export function chordPatterns(key, prog) {
  const cyc = (f) => `<${prog.map((cy) => (cy.length > 1 ? `[${cy.map(f).join(' ')}]` : f(cy[0]))).join(' ')}>`;
  return {
    roots: cyc((c) => c.degree),
    acc: cyc((c) => chordSpec(key, c).acc),
    tones: (n) => cyc((c) => {
      const iv = chordSpec(key, c).intervals;
      const idx = TONE_IDX[c.seventh ? Math.max(n, 4) : n] ?? iv.map((_, i) => i).slice(0, n);
      return `[${idx.map((i) => iv[i]).join(',')}]`;
    }),
  };
}

const QUALITY = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
const spellPc = (key, pc, acc) => ((rootOf(key).includes('b') || (!rootOf(key).includes('#') && acc < 0)) ? FLATS : SHARPS)[(pc + 120) % 12];
export function chordName(key, c) {
  const { acc, intervals: [, third, fifth, seventh] } = chordSpec(key, c);
  const root = acc ? spellPc(key, stepMidi(key, c.degree) + acc, acc) : stepName(key, c.degree);
  const q = QUALITY[`${third},${fifth}`] ?? '?';
  return root + q + (c.seventh ? (seventh === 11 ? 'maj7' : '7') : '');
}
const perCycle = (prog, f) => prog.map((cy) => (cy.length > 1 ? `[${cy.map(f).join(' ')}]` : f(cy[0]))).join(' ');
export const chordNames = (key, prog) => perCycle(prog, (c) => chordName(key, c));
export const describeHarmony = (key, prog) => `${perCycle(prog, (c) => c.numeral)} in ${key} → ${chordNames(key, prog)}`;

const MAJORISH = ['major', 'ionian'], MINORISH = ['minor', 'aeolian'];
const sameMode = (a, b) => a === b || (MAJORISH.includes(a) && MAJORISH.includes(b)) || (MINORISH.includes(a) && MINORISH.includes(b));
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
    else if (h.kind === 'mode') key = withMode(h.relative && !sameMode(modeOf(key), h.value) ? relativeKey(key) : key, h.value);
    else if (h.kind === 'progression') progression = h.value;
  }
  return { key, progression };
}
